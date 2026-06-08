/**
 * Comprehensive Email Validator
 * Conservative validation with deduplication, batching, and safety limits
 */

import pLimit from 'p-limit';
import { normalizeEmail, isValidFormat, extractDomain, extractLocalPart } from './emailChecker/format.js';
import { resolveMx } from './dnsCache.js';
import { isDisposable } from './disposable.js';
import { isBlacklisted } from './blacklist.js';
import { isRoleBased } from './roleBased.js';
import { isProviderSensitive } from './providerProfiles.js';
import { smtpProbe, smtpCatchAll } from './ndsmtp.js';
import { computeConfidence, determineFinalStatus } from './score.js';
import logger from '../config/logger.js';

// Safety limits
const BATCH_SIZE = 50;
const GLOBAL_CONCURRENCY = 3;
const PER_DOMAIN_CONCURRENCY = 1;
const CONNECT_TIMEOUT = 3000;
const COMMAND_TIMEOUT = 3000;
const COMMAND_JITTER_MIN = 50;
const COMMAND_JITTER_MAX = 150;

// Global concurrency limiter
const globalLimiter = pLimit(GLOBAL_CONCURRENCY);
const domainLimiters = new Map();

/**
 * Get or create domain-specific limiter
 */
function getDomainLimiter(domain) {
  if (!domainLimiters.has(domain)) {
    domainLimiters.set(domain, pLimit(PER_DOMAIN_CONCURRENCY));
  }
  return domainLimiters.get(domain);
}

/**
 * Deduplicate emails and normalize
 */
function deduplicateEmails(emails) {
  const seen = new Set();
  const deduplicated = [];
  
  for (const email of emails) {
    const normalized = normalizeEmail(email);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      deduplicated.push(normalized);
    }
  }
  
  return deduplicated;
}

/**
 * Process emails in batches
 */
function createBatches(emails, batchSize = BATCH_SIZE) {
  const batches = [];
  for (let i = 0; i < emails.length; i += batchSize) {
    batches.push(emails.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Process a single email with conservative validation
 */
async function processEmail(email, safeMode = false) {
  const checkedAt = new Date().toISOString();
  
  try {
    // 1. Format validation
    if (!isValidFormat(email)) {
      return {
        email,
        domain: null,
        status: 'invalid',
        reason: 'bad-format',
        hasMX: false,
        disposable: false,
        blacklisted: false,
        roleBased: false,
        catchAll: false,
        smtpCode: null,
        method: 'regex',
        startTLS: false,
        mxHost: null,
        providerSensitive: false,
        confidence: 0.1,
        checkedAt
      };
    }

    const domain = extractDomain(email);
    const localPart = extractLocalPart(email);
    let method = 'regex';

    // Check if domain extraction failed
    if (!domain) {
      return {
        email,
        domain: null,
        status: 'invalid',
        reason: 'bad-format',
        hasMX: false,
        disposable: false,
        blacklisted: false,
        roleBased: false,
        catchAll: false,
        smtpCode: null,
        method: 'regex',
        startTLS: false,
        mxHost: null,
        providerSensitive: false,
        confidence: 0.1,
        checkedAt
      };
    }

    // 2. Early classification flags
    const disposable = isDisposable(domain);
    const blacklisted = isBlacklisted(domain);
    const roleBased = isRoleBased(localPart);
    const providerSensitive = isProviderSensitive({ domain, mxHost: null });

    // 3. MX lookup
    const mxRecords = await resolveMx(domain);
    const hasMX = mxRecords && mxRecords.length > 0;
    method = 'mx';

    if (!hasMX) {
      return {
        email,
        domain,
        status: 'invalid',
        reason: 'no-mx',
        hasMX: false,
        disposable,
        blacklisted,
        roleBased,
        catchAll: false,
        smtpCode: null,
        method,
        startTLS: false,
        mxHost: null,
        providerSensitive,
        confidence: 0.9,
        checkedAt
      };
    }

    // 4. Early exits for problematic emails
    if (disposable) {
      return {
        email,
        domain,
        status: 'risky',
        reason: 'disposable',
        hasMX,
        disposable: true,
        blacklisted,
        roleBased,
        catchAll: false,
        smtpCode: null,
        method,
        startTLS: false,
        mxHost: mxRecords[0]?.exchange || null,
        providerSensitive,
        confidence: 0.6,
        checkedAt
      };
    }

    if (blacklisted) {
      return {
        email,
        domain,
        status: 'invalid',
        reason: 'blacklisted',
        hasMX,
        disposable,
        blacklisted: true,
        roleBased,
        catchAll: false,
        smtpCode: null,
        method,
        startTLS: false,
        mxHost: mxRecords[0]?.exchange || null,
        providerSensitive,
        confidence: 0.9,
        checkedAt
      };
    }

    // 5. Safe mode - conservative MX-only result
    if (safeMode) {
      let safeStatus = 'risky';
      let safeReason = 'mx-only-safe-mode';
      let safeConfidence = 0.55; // Max confidence for safe mode
      
      if (roleBased) {
        safeStatus = 'risky';
        safeReason = 'role-based';
        safeConfidence = 0.5;
      }
      
      return {
        email,
        domain,
        status: safeStatus,
        reason: safeReason,
        hasMX,
        disposable,
        blacklisted,
        roleBased,
        catchAll: false,
        smtpCode: null,
        method,
        startTLS: false,
        mxHost: mxRecords[0]?.exchange || null,
        providerSensitive,
        confidence: safeConfidence,
        checkedAt
      };
    }

    // 6. SMTP verification (full mode) with domain concurrency limit
    const domainLimiter = getDomainLimiter(domain);
    
    return domainLimiter(async () => {
      let smtpCode = null;
      let startTLS = false;
      let catchAll = false;
      let mxHost = null;

      try {
        // Try up to 2 MX hosts
        const mxHosts = mxRecords.slice(0, 2);
        
        for (const mxRecord of mxHosts) {
          mxHost = mxRecord.exchange;
          
          try {
            // SMTP probe with hard timeouts
            const smtpResult = await smtpProbe({
              email,
              domain,
              mxHost,
              timeouts: {
                connect: CONNECT_TIMEOUT,
                command: COMMAND_TIMEOUT,
                overall: CONNECT_TIMEOUT + COMMAND_TIMEOUT + 2000
              },
              useStartTLS: true
            });

            smtpCode = smtpResult.code;
            startTLS = smtpResult.tls;
            method = 'smtp';

            if (smtpResult.ok) {
              // Check for catch-all in same session
              try {
                const catchAllResult = await smtpCatchAll({
                  domain,
                  mxHost,
                  timeouts: {
                    connect: CONNECT_TIMEOUT,
                    command: COMMAND_TIMEOUT,
                    overall: CONNECT_TIMEOUT + COMMAND_TIMEOUT + 2000
                  },
                  useStartTLS: startTLS
                });

                catchAll = catchAllResult.ok;
              } catch (catchAllError) {
                logger.debug(`Catch-all test failed for ${email}: ${catchAllError.message}`);
                catchAll = false;
              }
              break; // Success, no need to try other MX hosts
            }
          } catch (smtpError) {
            logger.debug(`SMTP probe failed for ${email} via ${mxHost}: ${smtpError.message}`);
            continue; // Try next MX host
          }
        }
      } catch (error) {
        logger.debug(`SMTP verification failed for ${email}: ${error.message}`);
      }

      // 7. Compute confidence and determine final status
      const result = {
        email,
        domain,
        status: 'unknown', // Will be determined by confidence
        reason: 'smtp-verified',
        hasMX,
        disposable,
        blacklisted,
        roleBased,
        catchAll,
        smtpCode,
        method,
        startTLS,
        mxHost,
        providerSensitive,
        confidence: 0.5, // Will be computed
        checkedAt
      };

      // Compute confidence score
      result.confidence = computeConfidence(result);
      
      // Determine final status with conservative rules
      result.status = determineFinalStatus(result, result.confidence);

      return result;
    });

  } catch (error) {
    logger.error(`Email processing failed for ${email}: ${error.message}`);
    return {
      email: email,
      domain: null,
      status: 'unknown',
      reason: 'processing-error',
      hasMX: false,
      disposable: false,
      blacklisted: false,
      roleBased: false,
      catchAll: false,
      smtpCode: null,
      method: 'none',
      startTLS: false,
      mxHost: null,
      providerSensitive: false,
      confidence: 0.0,
      checkedAt
    };
  }
}

/**
 * Process batch of emails with global concurrency limit
 */
async function processBatch(emails, safeMode = false) {
  return globalLimiter(async () => {
    const results = [];
    
    for (const email of emails) {
      const result = await processEmail(email, safeMode);
      results.push(result);
    }
    
    return results;
  });
}

/**
 * Main validation function
 */
export async function validateEmails(emails, safeMode = false) {
  try {
    // Deduplicate inputs
    const deduplicatedEmails = deduplicateEmails(emails);
    const duplicates = emails.length - deduplicatedEmails.length;
    
    logger.info(`Processing ${deduplicatedEmails.length} unique emails (${duplicates} duplicates removed), safeMode: ${safeMode}`);
    
    // Create batches
    const batches = createBatches(deduplicatedEmails, BATCH_SIZE);
    const allResults = [];
    
    // Process batches sequentially to respect global concurrency
    for (const batch of batches) {
      const batchResults = await processBatch(batch, safeMode);
      allResults.push(...batchResults);
    }
    
    // Calculate summary
    const summary = {
      total: allResults.length,
      valid: allResults.filter(r => r.status === 'valid').length,
      invalid: allResults.filter(r => r.status === 'invalid').length,
      risky: allResults.filter(r => r.status === 'risky').length,
      unknown: allResults.filter(r => r.status === 'unknown').length,
      duplicates
    };
    
    logger.info(`Email validation completed:`, summary);
    
    return {
      summary,
      results: allResults,
      processedAt: new Date().toISOString(),
      safeMode
    };
    
  } catch (error) {
    logger.error('Email validation error:', error);
    throw error;
  }
}

export default {
  validateEmails,
  processEmail,
  deduplicateEmails,
  createBatches
};
