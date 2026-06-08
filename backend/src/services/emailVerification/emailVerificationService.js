/**
 * Main email verification service
 * Orchestrates the complete verification pipeline
 */

import { parseEmail, normalizeEmail, isValidEmail } from './parser.js';
import { getDNSIntelligence } from './dnsIntelligence.js';
import { verifySMTP } from './smtpHandshake.js';
import { detectCatchAll } from './catchAllDetection.js';
import { 
  checkGlobalRateLimit, 
  checkDomainRateLimit, 
  checkIPRateLimit,
  shouldSkipVerification,
  validateEmailForVerification
} from './safetyControls.js';
import { 
  calculateConfidence, 
  determineStatus, 
  getConfidenceBreakdown 
} from './confidenceScoring.js';
import logger from '../../config/logger.js';

/**
 * Main email verification function
 */
export async function verifyEmail(email, options = {}) {
  const startTime = Date.now();
  const {
    safeMode = false,
    clientIP = 'unknown',
    skipSafetyChecks = false
  } = options;

  try {
    // Input validation
    const validation = validateEmailForVerification(email);
    if (!validation.valid) {
      return {
        email,
        status: 'invalid',
        reason: 'invalid-input',
        domain: null,
        hasMX: false,
        catchAll: false,
        disposable: false,
        blacklisted: false,
        roleBased: false,
        providerSensitive: false,
        method: 'validation',
        startTLS: false,
        confidence: 0.1,
        checkedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        issues: validation.issues
      };
    }

    // Rate limiting checks
    if (!skipSafetyChecks) {
      const globalLimit = checkGlobalRateLimit();
      if (!globalLimit.allowed) {
        return {
          email,
          status: 'unknown',
          reason: 'rate-limited',
          domain: null,
          hasMX: false,
          catchAll: false,
          disposable: false,
          blacklisted: false,
          roleBased: false,
          providerSensitive: false,
          method: 'rate-limit',
          startTLS: false,
          confidence: 0.1,
          checkedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          retryAfter: globalLimit.retryAfter
        };
      }

      const domainLimit = checkDomainRateLimit(extractDomain(email));
      if (!domainLimit.allowed) {
        return {
          email,
          status: 'unknown',
          reason: 'domain-rate-limited',
          domain: extractDomain(email),
          hasMX: false,
          catchAll: false,
          disposable: false,
          blacklisted: false,
          roleBased: false,
          providerSensitive: false,
          method: 'rate-limit',
          startTLS: false,
          confidence: 0.1,
          checkedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          retryAfter: domainLimit.retryAfter
        };
      }

      const ipLimit = checkIPRateLimit(clientIP);
      if (!ipLimit.allowed) {
        return {
          email,
          status: 'unknown',
          reason: 'ip-rate-limited',
          domain: extractDomain(email),
          hasMX: false,
          catchAll: false,
          disposable: false,
          blacklisted: false,
          roleBased: false,
          providerSensitive: false,
          method: 'rate-limit',
          startTLS: false,
          confidence: 0.1,
          checkedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          retryAfter: ipLimit.retryAfter
        };
      }
    }

    // Parse and normalize email
    const parsed = parseEmail(email);
    if (!parsed) {
      return {
        email,
        status: 'invalid',
        reason: 'parse-failed',
        domain: null,
        hasMX: false,
        catchAll: false,
        disposable: false,
        blacklisted: false,
        roleBased: false,
        providerSensitive: false,
        method: 'parser',
        startTLS: false,
        confidence: 0.1,
        checkedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };
    }

    const { normalized, localPart, domainPart } = parsed;

    // Safety checks
    const safetyCheck = shouldSkipVerification(normalized, domainPart, localPart);
    if (safetyCheck.skip && !skipSafetyChecks) {
      return {
        email: normalized,
        status: 'risky',
        reason: 'safety-skip',
        domain: domainPart,
        hasMX: false,
        catchAll: false,
        disposable: safetyCheck.reasons.includes('disposable-provider'),
        blacklisted: safetyCheck.reasons.includes('blacklisted-domain'),
        roleBased: safetyCheck.reasons.includes('role-based-email'),
        providerSensitive: safetyCheck.reasons.includes('sensitive-provider'),
        method: 'safety',
        startTLS: false,
        confidence: 0.3,
        checkedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        skipReasons: safetyCheck.reasons
      };
    }

    // DNS Intelligence gathering
    let dnsIntelligence;
    try {
      dnsIntelligence = await getDNSIntelligence(domainPart);
    } catch (error) {
      logger.error(`DNS intelligence failed for ${domainPart}: ${error.message}`);
      return {
        email: normalized,
        status: 'unknown',
        reason: 'dns-error',
        domain: domainPart,
        hasMX: false,
        catchAll: false,
        disposable: false,
        blacklisted: false,
        roleBased: false,
        providerSensitive: false,
        method: 'dns',
        startTLS: false,
        confidence: 0.1,
        checkedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }

    // Check MX records
    if (!dnsIntelligence.mx.hasMX) {
      return {
        email: normalized,
        status: 'invalid',
        reason: 'no-mx-records',
        domain: domainPart,
        hasMX: false,
        catchAll: false,
        disposable: false,
        blacklisted: false,
        roleBased: false,
        providerSensitive: false,
        method: 'mx',
        startTLS: false,
        confidence: 0.9,
        checkedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };
    }

    // SMTP verification (if not in safe mode)
    let smtpResult = null;
    if (!safeMode && !safetyCheck.skip) {
      try {
        smtpResult = await verifySMTP(normalized, domainPart, dnsIntelligence.mx.records, safeMode);
      } catch (error) {
        logger.error(`SMTP verification failed for ${normalized}: ${error.message}`);
        smtpResult = {
          deliverable: false,
          reason: 'smtp-error',
          startTLS: false,
          confidence: 0.1,
          rawLog: `Error: ${error.message}`
        };
      }
    }

    // Catch-all detection
    let catchAllResult = null;
    if (smtpResult && smtpResult.deliverable && !safetyCheck.skip) {
      try {
        catchAllResult = await detectCatchAll(normalized, domainPart, dnsIntelligence, smtpResult);
      } catch (error) {
        logger.debug(`Catch-all detection failed for ${normalized}: ${error.message}`);
        catchAllResult = {
          isCatchAll: false,
          confidence: 0.1,
          method: 'detection-failed',
          reason: `Detection failed: ${error.message}`
        };
      }
    }

    // Build result object
    const result = {
      email: normalized,
      domain: domainPart,
      hasMX: dnsIntelligence.mx.hasMX,
      catchAll: catchAllResult ? catchAllResult.isCatchAll : false,
      disposable: safetyCheck.reasons.includes('disposable-provider'),
      blacklisted: safetyCheck.reasons.includes('blacklisted-domain'),
      roleBased: safetyCheck.reasons.includes('role-based-email'),
      providerSensitive: safetyCheck.reasons.includes('sensitive-provider'),
      method: smtpResult ? 'smtp' : 'mx',
      startTLS: smtpResult ? smtpResult.startTLS : false,
      checkedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };

    // Determine status and reason
    if (smtpResult) {
      if (smtpResult.deliverable) {
        result.status = 'valid';
        result.reason = smtpResult.reason;
      } else {
        result.status = 'risky';
        result.reason = smtpResult.reason;
      }
    } else if (dnsIntelligence.mx.hasMX) {
      result.status = 'risky';
      result.reason = 'mx-only';
    } else {
      result.status = 'invalid';
      result.reason = 'no-mx-records';
    }

    // Calculate confidence
    result.confidence = calculateConfidence(result);

    // Override status based on confidence
    result.status = determineStatus(result, result.confidence);

    // Add additional metadata
    result.dnsIntelligence = dnsIntelligence;
    if (smtpResult) {
      result.smtpResult = smtpResult;
    }
    if (catchAllResult) {
      result.catchAllResult = catchAllResult;
    }

    return result;

  } catch (error) {
    logger.error(`Email verification failed for ${email}: ${error.message}`);
    return {
      email: email,
      status: 'unknown',
      reason: 'verification-error',
      domain: extractDomain(email),
      hasMX: false,
      catchAll: false,
      disposable: false,
      blacklisted: false,
      roleBased: false,
      providerSensitive: false,
      method: 'error',
      startTLS: false,
      confidence: 0.1,
      checkedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Verify multiple emails
 */
export async function verifyEmails(emails, options = {}) {
  const {
    safeMode = false,
    clientIP = 'unknown',
    skipSafetyChecks = false,
    maxConcurrency = 5
  } = options;

  const results = [];
  const uniqueEmails = [...new Set(emails.map(e => e.trim().toLowerCase()))];

  // Process emails in batches to respect rate limits
  const batchSize = Math.min(maxConcurrency, 10);
  for (let i = 0; i < uniqueEmails.length; i += batchSize) {
    const batch = uniqueEmails.slice(i, i + batchSize);
    const batchPromises = batch.map(email => 
      verifyEmail(email, { safeMode, clientIP, skipSafetyChecks })
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < uniqueEmails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Get verification statistics
 */
export function getVerificationStats(results) {
  if (!results || results.length === 0) {
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      risky: 0,
      unknown: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      methodDistribution: {},
      confidenceDistribution: {}
    };
  }

  const stats = {
    total: results.length,
    valid: results.filter(r => r.status === 'valid').length,
    invalid: results.filter(r => r.status === 'invalid').length,
    risky: results.filter(r => r.status === 'risky').length,
    unknown: results.filter(r => r.status === 'unknown').length,
    averageConfidence: 0,
    averageProcessingTime: 0,
    methodDistribution: {},
    confidenceDistribution: {}
  };

  // Calculate averages
  const totalConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0);
  stats.averageConfidence = totalConfidence / results.length;

  const totalProcessingTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0);
  stats.averageProcessingTime = totalProcessingTime / results.length;

  // Method distribution
  results.forEach(result => {
    const method = result.method || 'unknown';
    stats.methodDistribution[method] = (stats.methodDistribution[method] || 0) + 1;
  });

  // Confidence distribution
  results.forEach(result => {
    const confidence = result.confidence || 0;
    let level = 'very-low';
    if (confidence >= 0.9) level = 'very-high';
    else if (confidence >= 0.8) level = 'high';
    else if (confidence >= 0.7) level = 'good';
    else if (confidence >= 0.5) level = 'medium';
    else if (confidence >= 0.3) level = 'low';
    
    stats.confidenceDistribution[level] = (stats.confidenceDistribution[level] || 0) + 1;
  });

  return stats;
}

export default {
  verifyEmail,
  verifyEmails,
  getVerificationStats
};
