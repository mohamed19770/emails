/**
 * Confidence scoring system for email verification results
 * Provides accurate confidence levels based on verification methods and results
 */

import { isSensitiveProvider, isDisposableProvider, isBlacklistedDomain, isRoleBasedEmail } from './safetyControls.js';

/**
 * Calculate confidence score based on verification method and result
 */
export function calculateConfidence(result) {
  let baseConfidence = 0;
  let methodMultiplier = 1;
  let resultMultiplier = 1;
  let safetyMultiplier = 1;

  // Base confidence by method
  switch (result.method) {
    case 'regex':
      baseConfidence = 0.3;
      break;
    case 'mx':
      baseConfidence = 0.6;
      break;
    case 'smtp':
      baseConfidence = 0.8;
      break;
    default:
      baseConfidence = 0.1;
  }

  // Method-specific adjustments
  if (result.method === 'smtp') {
    // SMTP confidence depends on response
    switch (result.reason) {
      case 'deliverable':
        resultMultiplier = 1.0;
        break;
      case 'smtp-reject':
        resultMultiplier = 0.9;
        break;
      case 'temporary-failure':
        resultMultiplier = 0.6;
        break;
      case 'timeout':
        resultMultiplier = 0.4;
        break;
      case 'smtp-error':
        resultMultiplier = 0.2;
        break;
      default:
        resultMultiplier = 0.5;
    }
  } else if (result.method === 'mx') {
    // MX confidence depends on result
    if (result.status === 'invalid' && result.reason === 'no-mx-records') {
      resultMultiplier = 0.9;
    } else if (result.status === 'valid' && result.hasMX) {
      resultMultiplier = 0.7;
    } else {
      resultMultiplier = 0.5;
    }
  } else if (result.method === 'regex') {
    // Regex confidence is lower
    resultMultiplier = 0.8;
  }

  // Safety adjustments
  if (result.providerSensitive) {
    safetyMultiplier = 0.5; // Reduce confidence for sensitive providers
  }

  if (result.disposable) {
    safetyMultiplier *= 0.8; // Reduce confidence for disposable emails
  }

  if (result.blacklisted) {
    safetyMultiplier *= 0.3; // Significantly reduce confidence for blacklisted domains
  }

  if (result.roleBased) {
    safetyMultiplier *= 0.9; // Slightly reduce confidence for role-based emails
  }

  if (result.catchAll) {
    safetyMultiplier *= 0.7; // Reduce confidence for catch-all domains
  }

  // STARTTLS bonus
  if (result.startTLS) {
    methodMultiplier = 1.1; // Slight bonus for encrypted connections
  }

  // Calculate final confidence
  const confidence = Math.min(
    baseConfidence * methodMultiplier * resultMultiplier * safetyMultiplier,
    1.0
  );

  return Math.round(confidence * 100) / 100; // Round to 2 decimal places
}

/**
 * Determine verification status based on confidence and result
 */
export function determineStatus(result, confidence) {
  // If confidence is very low, mark as unknown
  if (confidence < 0.3) {
    return 'unknown';
  }

  // If we have a clear SMTP result
  if (result.method === 'smtp') {
    if (result.status === 'valid' && confidence >= 0.7) {
      return 'valid';
    } else if (result.status === 'invalid' && confidence >= 0.7) {
      return 'invalid';
    } else {
      return 'risky';
    }
  }

  // If we have MX result
  if (result.method === 'mx') {
    if (result.status === 'invalid' && result.reason === 'no-mx-records') {
      return 'invalid';
    } else if (result.status === 'valid' && result.hasMX) {
      return 'risky'; // MX alone is not enough for 'valid'
    } else {
      return 'unknown';
    }
  }

  // If we only have regex result
  if (result.method === 'regex') {
    if (result.status === 'invalid') {
      return 'invalid';
    } else {
      return 'unknown';
    }
  }

  return 'unknown';
}

/**
 * Generate detailed confidence breakdown
 */
export function getConfidenceBreakdown(result) {
  const breakdown = {
    base: 0,
    method: 0,
    result: 0,
    safety: 0,
    final: 0
  };

  // Base confidence
  switch (result.method) {
    case 'regex':
      breakdown.base = 0.3;
      break;
    case 'mx':
      breakdown.base = 0.6;
      break;
    case 'smtp':
      breakdown.base = 0.8;
      break;
    default:
      breakdown.base = 0.1;
  }

  // Method adjustments
  breakdown.method = breakdown.base;

  // Result adjustments
  if (result.method === 'smtp') {
    switch (result.reason) {
      case 'deliverable':
        breakdown.result = 1.0;
        break;
      case 'smtp-reject':
        breakdown.result = 0.9;
        break;
      case 'temporary-failure':
        breakdown.result = 0.6;
        break;
      case 'timeout':
        breakdown.result = 0.4;
        break;
      default:
        breakdown.result = 0.5;
    }
  } else {
    breakdown.result = 1.0;
  }

  // Safety adjustments
  breakdown.safety = 1.0;
  
  if (result.providerSensitive) breakdown.safety *= 0.5;
  if (result.disposable) breakdown.safety *= 0.8;
  if (result.blacklisted) breakdown.safety *= 0.3;
  if (result.roleBased) breakdown.safety *= 0.9;
  if (result.catchAll) breakdown.safety *= 0.7;

  // Final calculation
  breakdown.final = breakdown.method * breakdown.result * breakdown.safety;

  return breakdown;
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(confidence) {
  if (confidence >= 0.9) return 'very-high';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.7) return 'good';
  if (confidence >= 0.5) return 'medium';
  if (confidence >= 0.3) return 'low';
  return 'very-low';
}

/**
 * Get confidence color for UI
 */
export function getConfidenceColor(confidence) {
  if (confidence >= 0.8) return '#10b981'; // green
  if (confidence >= 0.6) return '#f59e0b'; // yellow
  if (confidence >= 0.4) return '#f97316'; // orange
  return '#ef4444'; // red
}

/**
 * Calculate overall verification quality score
 */
export function calculateQualityScore(results) {
  if (!results || results.length === 0) {
    return 0;
  }

  const validResults = results.filter(r => r.status === 'valid');
  const invalidResults = results.filter(r => r.status === 'invalid');
  const riskyResults = results.filter(r => r.status === 'risky');
  const unknownResults = results.filter(r => r.status === 'unknown');

  const total = results.length;
  const validRatio = validResults.length / total;
  const invalidRatio = invalidResults.length / total;
  const riskyRatio = riskyResults.length / total;
  const unknownRatio = unknownResults.length / total;

  // Quality score calculation
  // Valid results are good, invalid results are also good (clear rejection)
  // Risky and unknown results reduce quality
  const qualityScore = (validRatio + invalidRatio) - (riskyRatio * 0.5) - (unknownRatio * 0.3);

  return Math.max(0, Math.min(1, qualityScore));
}

/**
 * Get verification summary with confidence metrics
 */
export function getVerificationSummary(results) {
  if (!results || results.length === 0) {
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      risky: 0,
      unknown: 0,
      averageConfidence: 0,
      qualityScore: 0,
      confidenceDistribution: {}
    };
  }

  const summary = {
    total: results.length,
    valid: results.filter(r => r.status === 'valid').length,
    invalid: results.filter(r => r.status === 'invalid').length,
    risky: results.filter(r => r.status === 'risky').length,
    unknown: results.filter(r => r.status === 'unknown').length,
    averageConfidence: 0,
    qualityScore: 0,
    confidenceDistribution: {}
  };

  // Calculate average confidence
  const totalConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0);
  summary.averageConfidence = totalConfidence / results.length;

  // Calculate quality score
  summary.qualityScore = calculateQualityScore(results);

  // Confidence distribution
  const confidenceLevels = ['very-high', 'high', 'good', 'medium', 'low', 'very-low'];
  confidenceLevels.forEach(level => {
    summary.confidenceDistribution[level] = 0;
  });

  results.forEach(result => {
    const level = getConfidenceLevel(result.confidence || 0);
    summary.confidenceDistribution[level]++;
  });

  return summary;
}

/**
 * Validate confidence score
 */
export function validateConfidence(confidence) {
  if (typeof confidence !== 'number') {
    return false;
  }

  if (confidence < 0 || confidence > 1) {
    return false;
  }

  if (isNaN(confidence) || !isFinite(confidence)) {
    return false;
  }

  return true;
}

export default {
  calculateConfidence,
  determineStatus,
  getConfidenceBreakdown,
  getConfidenceLevel,
  getConfidenceColor,
  calculateQualityScore,
  getVerificationSummary,
  validateConfidence
};
