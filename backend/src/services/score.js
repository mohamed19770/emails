/**
 * Confidence scoring for email verification
 * Calculates confidence scores (0-1) based on multiple factors
 */

/**
 * Compute confidence score for email verification result
 * @param {Object} result - The verification result object
 * @returns {number} Confidence score between 0 and 1
 */
export function computeConfidence(result) {
  let score = 0;
  
  // Base score from validation method
  switch (result.method) {
    case 'smtp':
      score += 0.5; // SMTP verification is most reliable
      break;
    case 'mx':
      score += 0.25; // MX lookup is moderately reliable
      break;
    case 'regex':
      score += 0.1; // Regex only is least reliable
      break;
    default:
      score += 0.1;
  }
  
  // SMTP response codes
  if (result.smtpCode) {
    if (result.smtpCode >= 200 && result.smtpCode < 300) {
      score += 0.3; // 2xx responses are good
    } else if (result.smtpCode >= 500 && result.smtpCode < 600) {
      score -= 0.5; // 5xx responses are bad
    } else if (result.smtpCode >= 400 && result.smtpCode < 500) {
      score -= 0.2; // 4xx responses are temporary issues
    }
  }
  
  // Timeout penalty
  if (result.reason && result.reason.includes('timeout')) {
    score -= 0.2;
  }
  
  // TLS/STARTTLS bonus
  if (result.startTLS) {
    score += 0.05; // TLS is a good sign
  }
  
  // MX record quality
  if (result.hasMX) {
    score += 0.1; // Having MX records is good
  }
  
  // Penalties for problematic flags
  if (result.catchAll) {
    score -= 0.25; // Catch-all domains are unreliable
  }
  
  if (result.disposable) {
    score -= 0.35; // Disposable domains are unreliable
  }
  
  if (result.blacklisted) {
    score -= 0.35; // Blacklisted domains are bad
  }
  
  if (result.providerSensitive) {
    score -= 0.15; // Sensitive providers are harder to verify
  }
  
  if (result.roleBased) {
    score -= 0.05; // Role-based emails are less reliable
  }
  
  // Clamp score to 0-1 range
  score = Math.max(0, Math.min(1, score));
  
  return score;
}

/**
 * Determine final status based on confidence score and flags
 * @param {Object} result - The verification result object
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

/**
 * Get confidence color for UI
 * @param {number} confidence - The confidence score
 * @returns {string} CSS color class
 */
export function getConfidenceColor(confidence) {
  if (confidence >= 0.8) return 'green';
  if (confidence >= 0.6) return 'yellow';
  if (confidence >= 0.4) return 'orange';
  return 'red';
}

export default {
  computeConfidence,
  determineFinalStatus,
  getConfidenceLevel,
  getConfidenceColor
};
