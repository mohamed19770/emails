/**
 * Blacklisted domain detection
 * Domains known for spam, malware, phishing, or other malicious activities
 */

// Blacklisted domains (spam, malware, phishing, etc.)
export const BLACKLISTED_DOMAINS = new Set([
  // Spam domains
  'spam.com', 'spam.net', 'spam.org', 'spam.co.uk',
  'spam.de', 'spam.fr', 'spam.it', 'spam.es',
  'spam.ru', 'spam.cn', 'spam.jp', 'spam.in',
  'spam.com.br', 'spam.com.au', 'spam.ca', 'spam.co.za',
  
  // Junk mail domains
  'junkmail.com', 'junkmail.net', 'junkmail.org',
  'trashmail.com', 'trashmail.net', 'trashmail.org',
  'spammail.com', 'spammail.net', 'spammail.org',
  
  // Malware/virus domains
  'malware.com', 'virus.com', 'trojan.com', 'worm.com',
  'virusmail.org', 'malware.net', 'virus.net',
  'trojan.net', 'worm.net', 'malware.org',
  
  // Phishing domains
  'phishing.com', 'phishing.net', 'phishing.org',
  'scam.com', 'scam.net', 'scam.org', 'fraud.com',
  'fraud.net', 'fraud.org', 'fake.com', 'fake.net',
  'fake.org', 'bogus.com', 'bogus.net', 'bogus.org',
  
  // Test/example domains
  'test.com', 'test.net', 'test.org', 'example.com',
  'example.net', 'example.org', 'localhost', 'invalid.com',
  'invalid.net', 'invalid.org', 'nonexistent.com',
  'nonexistent.net', 'nonexistent.org', 'dummy.com',
  'dummy.net', 'dummy.org', 'placeholder.com',
  'placeholder.net', 'placeholder.org',
  
  // Bad domain patterns
  'bad-domain.test', 'badmail.net', 'spamdomain.com',
  'virusmail.org', 'malware.com', 'phishing.net',
  'scam.org', 'fraud.com', 'bad-domain.test',
  
  // Additional malicious patterns
  'spammer.com', 'spammer.net', 'spammer.org',
  'spamdomain.com', 'spamdomain.net', 'spamdomain.org',
  'badmail.com', 'badmail.net', 'badmail.org',
  'virusmail.com', 'virusmail.net', 'virusmail.org',
  'malware.net', 'malware.org', 'phishing.com',
  'phishing.org', 'scam.net', 'scam.com',
  'fraud.net', 'fraud.org', 'fake.net', 'fake.org',
  'bogus.net', 'bogus.org'
]);

/**
 * Check if a domain is blacklisted
 * @param {string} domain - The domain to check
 * @returns {boolean} True if domain is blacklisted
 */
export function isBlacklisted(domain) {
  if (!domain || typeof domain !== 'string') {
    return false;
  }
  
  const normalizedDomain = domain.toLowerCase().trim();
  
  // Check exact match
  if (BLACKLISTED_DOMAINS.has(normalizedDomain)) {
    return true;
  }
  
  // Check for common blacklist patterns
  const blacklistPatterns = [
    /^spam.*\.com$/,
    /^spam.*\.net$/,
    /^spam.*\.org$/,
    /^junk.*\.com$/,
    /^junk.*\.net$/,
    /^junk.*\.org$/,
    /^trash.*\.com$/,
    /^trash.*\.net$/,
    /^trash.*\.org$/,
    /^virus.*\.com$/,
    /^virus.*\.net$/,
    /^virus.*\.org$/,
    /^malware.*\.com$/,
    /^malware.*\.net$/,
    /^malware.*\.org$/,
    /^phishing.*\.com$/,
    /^phishing.*\.net$/,
    /^phishing.*\.org$/,
    /^scam.*\.com$/,
    /^scam.*\.net$/,
    /^scam.*\.org$/,
    /^fraud.*\.com$/,
    /^fraud.*\.net$/,
    /^fraud.*\.org$/,
    /^fake.*\.com$/,
    /^fake.*\.net$/,
    /^fake.*\.org$/,
    /^bogus.*\.com$/,
    /^bogus.*\.net$/,
    /^bogus.*\.org$/,
    /^test.*\.com$/,
    /^test.*\.net$/,
    /^test.*\.org$/,
    /^example.*\.com$/,
    /^example.*\.net$/,
    /^example.*\.org$/,
    /^dummy.*\.com$/,
    /^dummy.*\.net$/,
    /^dummy.*\.org$/,
    /^placeholder.*\.com$/,
    /^placeholder.*\.net$/,
    /^placeholder.*\.org$/,
    /^invalid.*\.com$/,
    /^invalid.*\.net$/,
    /^invalid.*\.org$/,
    /^nonexistent.*\.com$/,
    /^nonexistent.*\.net$/,
    /^nonexistent.*\.org$/
  ];
  
  return blacklistPatterns.some(pattern => pattern.test(normalizedDomain));
}

/**
 * Add a domain to the blacklist
 * @param {string} domain - The domain to add
 */
export function addBlacklistedDomain(domain) {
  if (domain && typeof domain === 'string') {
    BLACKLISTED_DOMAINS.add(domain.toLowerCase().trim());
  }
}

/**
 * Remove a domain from the blacklist
 * @param {string} domain - The domain to remove
 */
export function removeBlacklistedDomain(domain) {
  if (domain && typeof domain === 'string') {
    BLACKLISTED_DOMAINS.delete(domain.toLowerCase().trim());
  }
}

/**
 * Get all blacklisted domains
 * @returns {Set} Set of blacklisted domains
 */
export function getBlacklistedDomains() {
  return new Set(BLACKLISTED_DOMAINS);
}

export default {
  BLACKLISTED_DOMAINS,
  isBlacklisted,
  addBlacklistedDomain,
  removeBlacklistedDomain,
  getBlacklistedDomains
};
