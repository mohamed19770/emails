/**
 * Email parser and normalizer with RFC 5321/5322 compliance
 * Handles punycode, case normalization, and format validation
 */

import { toASCII, toUnicode } from 'punycode';

/**
 * RFC 5321/5322 compliant email format validation
 * More strict than basic regex to catch edge cases
 */
export function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'invalid-input' };
  }

  // Basic length checks
  if (email.length > 254) {
    return { valid: false, reason: 'too-long' };
  }

  // Check for basic structure
  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex >= email.length - 1) {
    return { valid: false, reason: 'missing-at' };
  }

  const localPart = email.substring(0, atIndex);
  const domainPart = email.substring(atIndex + 1);

  // Local part validation (RFC 5321)
  if (localPart.length > 64) {
    return { valid: false, reason: 'local-too-long' };
  }

  if (localPart.length === 0) {
    return { valid: false, reason: 'empty-local' };
  }

  // Check for valid local part characters
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
    return { valid: false, reason: 'invalid-local-chars' };
  }

  // Check for consecutive dots
  if (localPart.includes('..')) {
    return { valid: false, reason: 'consecutive-dots' };
  }

  // Check for leading/trailing dots
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, reason: 'invalid-dot-placement' };
  }

  // Domain part validation
  if (domainPart.length > 253) {
    return { valid: false, reason: 'domain-too-long' };
  }

  if (domainPart.length === 0) {
    return { valid: false, reason: 'empty-domain' };
  }

  // Check for valid domain format
  if (!/^[a-zA-Z0-9.-]+$/.test(domainPart)) {
    return { valid: false, reason: 'invalid-domain-chars' };
  }

  // Check for consecutive dots in domain
  if (domainPart.includes('..')) {
    return { valid: false, reason: 'domain-consecutive-dots' };
  }

  // Check for leading/trailing dots in domain
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
    return { valid: false, reason: 'domain-invalid-dot-placement' };
  }

  // Check for valid TLD (at least 2 characters, no numbers)
  const parts = domainPart.split('.');
  if (parts.length < 2) {
    return { valid: false, reason: 'no-tld' };
  }

  const tld = parts[parts.length - 1];
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return { valid: false, reason: 'invalid-tld' };
  }

  return { valid: true, reason: 'valid-format' };
}

/**
 * Normalize email address according to RFC standards
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  try {
    // Trim whitespace
    let normalized = email.trim();

    // Convert to lowercase (RFC 5321)
    normalized = normalized.toLowerCase();

    // Split into local and domain parts
    const atIndex = normalized.lastIndexOf('@');
    if (atIndex === -1) {
      return null;
    }

    const localPart = normalized.substring(0, atIndex);
    const domainPart = normalized.substring(atIndex + 1);

    // Normalize domain with punycode
    let normalizedDomain;
    try {
      // Convert to ASCII if needed
      normalizedDomain = toASCII(domainPart);
    } catch (error) {
      // If punycode conversion fails, use as-is
      normalizedDomain = domainPart;
    }

    // Reconstruct email
    const result = `${localPart}@${normalizedDomain}`;

    // Final validation
    const validation = validateEmailFormat(result);
    if (!validation.valid) {
      return null;
    }

    return result;
  } catch (error) {
    return null;
  }
}

/**
 * Parse email into components
 */
export function parseEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const atIndex = normalized.lastIndexOf('@');
  const localPart = normalized.substring(0, atIndex);
  const domainPart = normalized.substring(atIndex + 1);

  return {
    original: email,
    normalized,
    localPart,
    domainPart,
    isValid: true
  };
}

/**
 * Extract domain from email
 */
export function extractDomain(email) {
  const parsed = parseEmail(email);
  return parsed ? parsed.domainPart : null;
}

/**
 * Extract local part from email
 */
export function extractLocalPart(email) {
  const parsed = parseEmail(email);
  return parsed ? parsed.localPart : null;
}

/**
 * Check if email is in a valid format
 */
export function isValidEmail(email) {
  const validation = validateEmailFormat(email);
  return validation.valid;
}

export default {
  validateEmailFormat,
  normalizeEmail,
  parseEmail,
  extractDomain,
  extractLocalPart,
  isValidEmail
};
