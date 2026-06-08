/**
 * Email format validation and normalization
 * RFC-compliant with punycode support
 */

import { toASCII, toUnicode } from 'punycode';

/**
 * RFC 5321/5322 compliant email format validation
 */
export function isValidFormat(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic length checks
  if (email.length > 254) {
    return false;
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex >= email.length - 1) {
    return false;
  }

  const localPart = email.substring(0, atIndex);
  const domainPart = email.substring(atIndex + 1);

  // Local part validation
  if (localPart.length > 64 || localPart.length === 0) {
    return false;
  }

  // Check for valid local part characters
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
    return false;
  }

  // Check for consecutive dots
  if (localPart.includes('..')) {
    return false;
  }

  // Check for leading/trailing dots
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return false;
  }

  // Domain part validation
  if (domainPart.length > 253 || domainPart.length === 0) {
    return false;
  }

  // Check for valid domain format
  if (!/^[a-zA-Z0-9.-]+$/.test(domainPart)) {
    return false;
  }

  // Check for consecutive dots in domain
  if (domainPart.includes('..')) {
    return false;
  }

  // Check for leading/trailing dots in domain
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
    return false;
  }

  // Check for valid TLD
  const parts = domainPart.split('.');
  if (parts.length < 2) {
    return false;
  }

  const tld = parts[parts.length - 1];
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return false;
  }

  return true;
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
    if (!isValidFormat(result)) {
      return null;
    }

    return result;
  } catch (error) {
    return null;
  }
}

/**
 * Extract domain from email
 */
export function extractDomain(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const atIndex = normalized.lastIndexOf('@');
  return normalized.substring(atIndex + 1);
}

/**
 * Extract local part from email
 */
export function extractLocalPart(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const atIndex = normalized.lastIndexOf('@');
  return normalized.substring(0, atIndex);
}

export default {
  isValidFormat,
  normalizeEmail,
  extractDomain,
  extractLocalPart
};