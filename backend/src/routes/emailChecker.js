/**
 * Email Checker API routes
 * Safe email verification with comprehensive validation
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
 * @route POST /api/email-checker/run
 * @desc Check multiple email addresses
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

    if (emails.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10000 emails allowed per request'
      });
    }

    // Validate that all items are strings and normalize
    const normalizedEmails = emails
      .filter(email => typeof email === 'string' && email.trim())
      .map(email => normalizeEmail(email.trim()))
      .filter(email => email !== null);

    if (normalizedEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid emails found'
      });
    }

    // Remove duplicates
    const uniqueEmails = [...new Set(normalizedEmails)];

    logger.info(`Starting email validation: ${uniqueEmails.length} emails, safeMode: ${safeMode}`);

    // Process emails
    const results = [];
    const summary = {
      total: 0,
      valid: 0,
      invalid: 0,
      risky: 0,
      unknown: 0,
      duplicates: emails.length - uniqueEmails.length
    };

    for (const email of uniqueEmails) {
      const result = await processEmail(email, safeMode);
      results.push(result);
      
      // Update summary
      summary[result.status]++;
      summary.total++;
    }

    logger.info(`Email validation completed:`, summary);

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
    logger.error('Email checker error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during email validation'
    });
  }
});

/**
 * Process a single email through the verification pipeline
 */
async function processEmail(email, safeMode) {
  const checkedAt = new Date().toISOString();
  let status = 'unknown';
  let reason = 'initial';
  let domain = null;
  let hasMX = false;
  let disposable = false;
  let blacklisted = false;
  let roleBased = false;
  let catchAll = false;
  let smtpCode = null;
  let method = 'none';
  let startTLS = false;

  try {
    // 1. Format validation
    if (!isValidFormat(email)) {
      return {
        email,
        domain: null,
        status: 'invalid',
        reason: 'invalid-format',
        hasMX: false,
        disposable: false,
        blacklisted: false,
        roleBased: false,
        catchAll: false,
        smtpCode: null,
        method: 'regex',
        confidence: 0.1,
        checkedAt
      };
    }

    domain = extractDomain(email);
    const localPart = extractLocalPart(email);
    method = 'regex';

    // 2. Provider classification
    disposable = isDisposable(domain);
    blacklisted = isBlacklisted(domain);
    roleBased = isRoleBased(localPart);

    // 3. MX lookup
    const mxResult = await resolveMX(domain);
    hasMX = mxResult.hasMX;
    method = 'mx';

    if (!hasMX) {
      return {
        email,
        domain,
        status: 'invalid',
        reason: 'no-mx-records',
        hasMX: false,
        disposable,
        blacklisted,
        roleBased,
        catchAll: false,
        smtpCode: null,
        method,
        confidence: 0.9,
        checkedAt
      };
    }

    // 4. Early classification based on provider type
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
        confidence: 0.9,
        checkedAt
      };
    }

    // 5. Safe mode - return conservative MX-only result
    if (safeMode) {
      // In safe mode, be very conservative - only mark as valid if we're confident
      let safeStatus = 'risky';
      let safeReason = 'mx-only-safe-mode';
      let safeConfidence = 0.6;
      
      // Only mark as valid if:
      // 1. Has MX records
      // 2. Not disposable
      // 3. Not blacklisted
      // 4. Not role-based
      if (hasMX && !disposable && !blacklisted && !roleBased) {
        safeStatus = 'risky'; // Still risky in safe mode
        safeReason = 'mx-only-safe-mode';
        safeConfidence = 0.6;
      } else if (!hasMX) {
        safeStatus = 'invalid';
        safeReason = 'no-mx-records';
        safeConfidence = 0.9;
      } else if (disposable) {
        safeStatus = 'risky';
        safeReason = 'disposable';
        safeConfidence = 0.6;
      } else if (blacklisted) {
        safeStatus = 'invalid';
        safeReason = 'blacklisted';
        safeConfidence = 0.9;
      } else if (roleBased) {
        safeStatus = 'risky';
        safeReason = 'role-based';
        safeConfidence = 0.6;
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
        confidence: safeConfidence,
        checkedAt
      };
    }

    // 6. SMTP verification (full mode)
    const isSensitive = isSensitiveProvider(domain);
    
    try {
      const smtpResult = await verifySMTP(email, domain, mxResult.records);
      method = 'smtp';
      startTLS = smtpResult.startTLS;
      smtpCode = smtpResult.smtpCode;

      if (smtpResult.deliverable) {
        // Check for catch-all only if not a sensitive provider
        if (shouldTestCatchAll(domain, isSensitive)) {
          try {
            const catchAllResult = await testCatchAll(domain, mxResult.records, verifySMTP);
            catchAll = catchAllResult.isCatchAll;
          } catch (catchAllError) {
            logger.debug(`Catch-all test failed for ${email}: ${catchAllError.message}`);
            catchAll = false;
          }
        }

        if (catchAll) {
          status = 'risky';
          reason = 'catch-all';
        } else {
          status = 'valid';
          reason = smtpResult.reason;
        }
      } else {
        status = 'invalid';
        reason = smtpResult.reason;
      }
    } catch (smtpError) {
      logger.debug(`SMTP verification failed for ${email}: ${smtpError.message}`);
      status = 'risky';
      reason = 'smtp-error';
    }

    // 7. Compute confidence and final status
    const result = {
      email,
      domain,
      status,
      reason,
      hasMX,
      disposable,
      blacklisted,
      roleBased,
      catchAll,
      smtpCode,
      method,
      startTLS,
      providerSensitive: isSensitive,
      confidence: 0.5, // Will be computed
      checkedAt
    };

    // Compute confidence using new scoring system
    const confidenceResult = calculateConfidence(result);
    result.confidence = confidenceResult.score;
    
    // Override status based on confidence and conservative rules
    result.status = determineFinalStatus(result, result.confidence);

    return result;

  } catch (error) {
    logger.error(`Email processing failed for ${email}: ${error.message}`);
    return {
      email,
      domain,
      status: 'unknown',
      reason: 'processing-error',
      hasMX: false,
      disposable: false,
      blacklisted: false,
      roleBased: false,
      catchAll: false,
      smtpCode: null,
      method: 'error',
      confidence: 0.1,
      checkedAt,
      error: error.message
    };
  }
}

export default router;
