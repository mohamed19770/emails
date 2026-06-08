/**
 * Confidence scoring service
 * Calculates confidence scores (0-1) for email validation results
 */

import logger from '../../config/logger.js';

/**
 * Calculate confidence score for an email validation result
 * @param {Object} result - The validation result object
 * @returns {number} Confidence score between 0 and 1
 */
export function calculateConfidence(result) {
  let score = 0;
  const factors = [];
  
  // Base score from validation method
  switch (result.method) {
    case 'regex':
      score += 0.1;
      factors.push('regex-only');
      break;
    case 'mx':
      score += 0.3;
      factors.push('mx-verified');
      break;
    case 'smtp':
      score += 0.6;
      factors.push('smtp-verified');
      break;
    default:
      score += 0.1;
      factors.push('unknown-method');
  }
  
  // MX record quality
  if (result.hasMX) {
    score += 0.2;
    factors.push('has-mx');
    
    // Bonus for multiple MX records (redundancy)
    if (result.mxRecords && result.mxRecords.length > 1) {
      score += 0.1;
      factors.push('multiple-mx');
    }
  }
  
  // SMTP response quality
  if (result.smtpCode) {
    if (result.smtpCode >= 250 && result.smtpCode < 300) {
      score += 0.3;
      factors.push('smtp-accepted');
    } else if (result.smtpCode >= 450 && result.smtpCode < 500) {
      score += 0.1;
      factors.push('smtp-temporary');
    } else if (result.smtpCode >= 550 && result.smtpCode < 600) {
      score -= 0.2;
      factors.push('smtp-rejected');
    }
  }
  
  // TLS/STARTTLS bonus
  if (result.startTLS) {
    score += 0.1;
    factors.push('tls-enabled');
  }
  
  // Penalties for problematic flags
  if (result.disposable) {
    score -= 0.4;
    factors.push('disposable-penalty');
  }
  
  if (result.blacklisted) {
    score -= 0.5;
    factors.push('blacklisted-penalty');
  }
  
  if (result.roleBased) {
    score -= 0.2;
    factors.push('role-based-penalty');
  }
  
  if (result.catchAll) {
    score -= 0.3;
    factors.push('catch-all-penalty');
  }
  
  // Provider-specific adjustments
  if (result.providerSensitive) {
    // Sensitive providers are harder to verify accurately
    score -= 0.1;
    factors.push('sensitive-provider');
  }
  
  // Timeout penalty
  if (result.reason && result.reason.includes('timeout')) {
    score -= 0.2;
    factors.push('timeout-penalty');
  }
  
  // Ensure score is between 0 and 1
  score = Math.max(0, Math.min(1, score));
  
  logger.debug(`Confidence calculation for ${result.email}: ${score.toFixed(3)} (${factors.join(', ')})`);
  
  return {
    score,
    factors,
    confidence: score
  };
}

/**
 * Determine final status based on confidence score and flags
 * @param {Object} result - The validation result object
 * @param {number} confidence - The calculated confidence score
 * @returns {string} Final status: 'valid', 'invalid', 'risky', 'unknown'
 */
export function determineFinalStatus(result, confidence) {
  // Hard rules that override confidence
  if (result.disposable) {
    return 'risky';
  }
  
  if (result.blacklisted) {
    return 'invalid';
  }
  
  if (result.catchAll) {
    return 'risky';
  }
  
  // Confidence-based rules
  if (confidence >= 0.75) {
    return 'valid';
  } else if (confidence >= 0.5) {
    return 'risky';
  } else if (confidence >= 0.25) {
    return 'unknown';
  } else {
    return 'invalid';
  }
}

/**
 * Get confidence level description
 * @param {number} confidence - The confidence score
 * @returns {string} Human-readable confidence level
 */
export function getConfidenceLevel(confidence) {
  if (confidence >= 0.9) return 'very-high';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.7) return 'good';
  if (confidence >= 0.6) return 'moderate';
  if (confidence >= 0.5) return 'low';
  if (confidence >= 0.3) return 'very-low';
  return 'minimal';
}

export default {
  calculateConfidence,
  determineFinalStatus,
  getConfidenceLevel
};