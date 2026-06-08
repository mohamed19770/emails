/**
 * Conservative Email Checker API routes
 * Eliminates false positives with comprehensive validation
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { normalizeEmail, isValidFormat, extractDomain, extractLocalPart } from '../services/emailChecker/format.js';
import { resolveMx, resolveTxt } from '../services/dnsCache.js';
import { isDisposable } from '../services/disposable.js';
import { isBlacklisted } from '../services/blacklist.js';
import { isRoleBased } from '../services/roleBased.js';
import { isProviderSensitive } from '../services/providerProfiles.js';
import { smtpProbe, smtpCatchAll } from '../services/ndsmtp.js';
import { computeConfidence, determineFinalStatus } from '../services/score.js';
import logger from '../config/logger.js';

const router = express.Router();

// Rate limiting for email checking
const emailCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes
  message: {
    error: 'Too many email check requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/email-checker-conservative/run
 * @desc Check multiple email addresses with conservative validation
 * @access Public
 */
router.post('/run', emailCheckLimiter, async (req, res) => {
  try {
    const { emails, safeMode = false } = req.body;

    // Validate input
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Emails array is required'
      });
    }

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Emails array cannot be empty'
      });
    }

    if (emails.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 1000 emails per request'
      });
    }

    logger.info(`Starting conservative email validation: ${emails.length} emails, safeMode: ${safeMode}`);

    // Process emails
    const results = [];
    const processedEmails = new Set();
    
    for (const email of emails) {
      if (processedEmails.has(email.toLowerCase())) {
        continue; // Skip duplicates
      }
      processedEmails.add(email.toLowerCase());
      
      const result = await processEmailConservative(email, safeMode);
      results.push(result);
    }

    // Calculate summary
    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      risky: results.filter(r => r.status === 'risky').length,
      unknown: results.filter(r => r.status === 'unknown').length,
      duplicates: emails.length - results.length
    };

    logger.info(`Conservative email validation completed:`, summary);

    res.json({
      success: true,
      data: {
        summary,
        results,
        processedAt: new Date().toISOString(),
        safeMode
      }
    });

  } catch (error) {
    logger.error('Conservative email checker error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during email validation'
    });
  }
});

/**
 * Process a single email with conservative validation
 */
async function processEmailConservative(email, safeMode) {
  const checkedAt = new Date().toISOString();
  
  try {
    // 1. Normalize and validate format
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !isValidFormat(normalizedEmail)) {
      return {
        email: normalizedEmail || email,
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

    const domain = extractDomain(normalizedEmail);
    const localPart = extractLocalPart(normalizedEmail);
    let method = 'regex';

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
        email: normalizedEmail,
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
        email: normalizedEmail,
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
        email: normalizedEmail,
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
      let safeConfidence = 0.6;
      
      if (roleBased) {
        safeStatus = 'risky';
        safeReason = 'role-based';
        safeConfidence = 0.6;
      }
      
      return {
        email: normalizedEmail,
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

    // 6. SMTP verification (full mode)
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
          // SMTP probe
          const smtpResult = await smtpProbe({
            email: normalizedEmail,
            domain,
            mxHost,
            timeouts: {
              connect: 3000,
              command: 3000,
              overall: 8000
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
                  connect: 3000,
                  command: 3000,
                  overall: 8000
                },
                useStartTLS: startTLS
              });

              catchAll = catchAllResult.ok;
            } catch (catchAllError) {
              logger.debug(`Catch-all test failed for ${normalizedEmail}: ${catchAllError.message}`);
              catchAll = false;
            }
            break; // Success, no need to try other MX hosts
          }
        } catch (smtpError) {
          logger.debug(`SMTP probe failed for ${normalizedEmail} via ${mxHost}: ${smtpError.message}`);
          continue; // Try next MX host
        }
      }
    } catch (error) {
      logger.debug(`SMTP verification failed for ${normalizedEmail}: ${error.message}`);
    }

    // 7. Compute confidence and determine final status
    const result = {
      email: normalizedEmail,
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

export default router;
