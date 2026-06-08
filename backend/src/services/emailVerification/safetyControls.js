/**
 * Safety controls and anti-abuse measures for email verification
 * Prevents reputation damage and ensures responsible verification
 */

import { LRUCache } from 'lru-cache';
import logger from '../../config/logger.js';

// Global rate limiting
const globalRateLimit = new LRUCache({
  max: 1000,
  ttl: 60 * 1000, // 1 minute
});

const domainRateLimit = new LRUCache({
  max: 500,
  ttl: 5 * 60 * 1000, // 5 minutes
});

const ipRateLimit = new LRUCache({
  max: 1000,
  ttl: 60 * 1000, // 1 minute
});

// Safety configuration
const SAFETY_CONFIG = {
  MAX_GLOBAL_REQUESTS_PER_MINUTE: 100,
  MAX_DOMAIN_REQUESTS_PER_5_MINUTES: 10,
  MAX_IP_REQUESTS_PER_MINUTE: 20,
  MAX_CONCURRENT_CONNECTIONS: 3,
  MAX_CONNECTIONS_PER_DOMAIN: 1,
  COMMAND_PACING_MIN: 50,
  COMMAND_PACING_MAX: 150,
  CONNECTION_TIMEOUT: 3000,
  COMMAND_TIMEOUT: 3000,
  MAX_RETRIES: 1,
  BACKOFF_BASE: 1000,
  BACKOFF_MAX: 10000
};

// Sensitive providers that should be handled with extra care
const SENSITIVE_PROVIDERS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'ymail.com',
  'icloud.com', 'me.com',
  'aol.com', 'aim.com',
  'protonmail.com', 'tutanota.com'
];

// Disposable email providers
const DISPOSABLE_PROVIDERS = [
  '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'getnada.com', 'maildrop.cc',
  'sharklasers.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'pokemail.net', 'spam4.me', 'bccto.me', 'chacuo.net', 'dispostable.com',
  'fakeinbox.com', 'mailnesia.com', 'mailnull.com', 'meltmail.com',
  'mohmal.com', 'mytrashmail.com', 'nada.email', 'nada.ltd',
  'spamgourmet.com', 'spamhole.com', 'spam.la', 'spammotel.com',
  'spamobox.com', 'spamspot.com', 'spamthis.co.uk', 'spamthisplease.com',
  'superrito.com', 'thisisnotmyrealemail.com', 'tittbit.in', 'toomail.biz',
  'toomail.net', 'trash-amil.com', 'trashmail.com', 'trashmail.net',
  'trashymail.com', 'trashymail.net', 'trbvm.com', 'tyldd.com',
  'uggsrock.com', 'wegwerfadresse.de', 'wegwerfmail.de', 'wetrainbayarea.com',
  'wetrainbayarea.org', 'wh4f.org', 'whyspam.me', 'willselfdestruct.com',
  'wuzup.net', 'wuzupmail.net', 'yeah.net', 'yopmail.com', 'yopmail.net',
  'yopmail.org', 'ypmail.webarnak.fr', 'cool.fr.nf', 'jetable.fr',
  'jetable.net', 'jetable.org', 'nospam.ze.tc', 'nomail.xl.cx',
  'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'monmail.fr.nf', 'tempmail.net', 'temp-mail.net',
  'tempmail.co', 'temp-mail.co', 'tempmail.us', 'temp-mail.us',
  'tempmail.eu', 'temp-mail.eu', 'tempmail.de', 'temp-mail.de',
  'tempmail.fr', 'temp-mail.fr', 'tempmail.it', 'temp-mail.it',
  'tempmail.es', 'temp-mail.es', 'tempmail.ru', 'temp-mail.ru',
  'tempmail.jp', 'temp-mail.jp', 'tempmail.cn', 'temp-mail.cn',
  'tempmail.in', 'temp-mail.in', 'tempmail.com.br', 'temp-mail.com.br',
  'tempmail.com.au', 'temp-mail.com.au', 'tempmail.ca', 'temp-mail.ca',
  'tempmail.co.uk', 'temp-mail.co.uk'
];

// Blacklisted domains
const BLACKLISTED_DOMAINS = [
  'spamdomain.com', 'badmail.net', 'virusmail.org', 'malware.com',
  'phishing.net', 'scam.org', 'fraud.com'
];

// Role-based email prefixes
const ROLE_BASED_PREFIXES = [
  'admin', 'administrator', 'info', 'support', 'sales', 'contact', 'webmaster',
  'noreply', 'postmaster', 'hostmaster', 'marketing', 'billing', 'abuse',
  'security', 'help', 'office', 'jobs', 'careers', 'press', 'media',
  'feedback', 'enquiries', 'hello', 'dev', 'developer', 'test', 'testing',
  'no-reply', 'daemon', 'root', 'ftp', 'www', 'usenet', 'news', 'mail',
  'email', 'contactus', 'feedback', 'inquiry', 'inquiries', 'office',
  'reception', 'hr', 'humanresources', 'recruitment', 'accounts', 'accounting',
  'finance', 'legal', 'privacy', 'compliance', 'gdpr', 'security', 'abuse',
  'spam', 'marketing', 'newsletter', 'subscribe', 'unsubscribe', 'sales',
  'billing', 'support', 'helpdesk', 'tech', 'technical', 'it', 'is'
];

/**
 * Check global rate limit
 */
export function checkGlobalRateLimit() {
  const now = Date.now();
  const key = 'global';
  
  if (!globalRateLimit.has(key)) {
    globalRateLimit.set(key, { count: 0, resetTime: now + 60000 });
  }
  
  const limit = globalRateLimit.get(key);
  
  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + 60000;
  }
  
  if (limit.count >= SAFETY_CONFIG.MAX_GLOBAL_REQUESTS_PER_MINUTE) {
    return {
      allowed: false,
      reason: 'Global rate limit exceeded',
      retryAfter: Math.ceil((limit.resetTime - now) / 1000)
    };
  }
  
  limit.count++;
  return { allowed: true };
}

/**
 * Check domain rate limit
 */
export function checkDomainRateLimit(domain) {
  const now = Date.now();
  const key = domain.toLowerCase();
  
  if (!domainRateLimit.has(key)) {
    domainRateLimit.set(key, { count: 0, resetTime: now + 5 * 60000 });
  }
  
  const limit = domainRateLimit.get(key);
  
  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + 5 * 60000;
  }
  
  if (limit.count >= SAFETY_CONFIG.MAX_DOMAIN_REQUESTS_PER_5_MINUTES) {
    return {
      allowed: false,
      reason: 'Domain rate limit exceeded',
      retryAfter: Math.ceil((limit.resetTime - now) / 1000)
    };
  }
  
  limit.count++;
  return { allowed: true };
}

/**
 * Check IP rate limit
 */
export function checkIPRateLimit(ip) {
  const now = Date.now();
  const key = ip;
  
  if (!ipRateLimit.has(key)) {
    ipRateLimit.set(key, { count: 0, resetTime: now + 60000 });
  }
  
  const limit = ipRateLimit.get(key);
  
  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + 60000;
  }
  
  if (limit.count >= SAFETY_CONFIG.MAX_IP_REQUESTS_PER_MINUTE) {
    return {
      allowed: false,
      reason: 'IP rate limit exceeded',
      retryAfter: Math.ceil((limit.resetTime - now) / 1000)
    };
  }
  
  limit.count++;
  return { allowed: true };
}

/**
 * Check if domain is sensitive provider
 */
export function isSensitiveProvider(domain) {
  return SENSITIVE_PROVIDERS.some(provider => 
    domain.toLowerCase().includes(provider.toLowerCase())
  );
}

/**
 * Check if domain is disposable provider
 */
export function isDisposableProvider(domain) {
  return DISPOSABLE_PROVIDERS.some(provider => 
    domain.toLowerCase().includes(provider.toLowerCase())
  );
}

/**
 * Check if domain is blacklisted
 */
export function isBlacklistedDomain(domain) {
  return BLACKLISTED_DOMAINS.some(blacklisted => 
    domain.toLowerCase().includes(blacklisted.toLowerCase())
  );
}

/**
 * Check if email is role-based
 */
export function isRoleBasedEmail(localPart) {
  return ROLE_BASED_PREFIXES.some(prefix => 
    localPart.toLowerCase().startsWith(prefix)
  );
}

/**
 * Get safety configuration
 */
export function getSafetyConfig() {
  return { ...SAFETY_CONFIG };
}

/**
 * Check if verification should be skipped for safety
 */
export function shouldSkipVerification(email, domain, localPart) {
  const reasons = [];
  
  // Check sensitive providers
  if (isSensitiveProvider(domain)) {
    reasons.push('sensitive-provider');
  }
  
  // Check disposable providers
  if (isDisposableProvider(domain)) {
    reasons.push('disposable-provider');
  }
  
  // Check blacklisted domains
  if (isBlacklistedDomain(domain)) {
    reasons.push('blacklisted-domain');
  }
  
  // Check role-based emails
  if (isRoleBasedEmail(localPart)) {
    reasons.push('role-based-email');
  }
  
  return {
    skip: reasons.length > 0,
    reasons
  };
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(attempt, baseDelay = SAFETY_CONFIG.BACKOFF_BASE) {
  const delay = Math.min(
    baseDelay * Math.pow(2, attempt),
    SAFETY_CONFIG.BACKOFF_MAX
  );
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return Math.floor(delay + jitter);
}

/**
 * Get command pacing delay
 */
export function getCommandPacing() {
  return Math.floor(
    Math.random() * (SAFETY_CONFIG.COMMAND_PACING_MAX - SAFETY_CONFIG.COMMAND_PACING_MIN + 1)
  ) + SAFETY_CONFIG.COMMAND_PACING_MIN;
}

/**
 * Clear all rate limits
 */
export function clearAllRateLimits() {
  globalRateLimit.clear();
  domainRateLimit.clear();
  ipRateLimit.clear();
}

/**
 * Get rate limit statistics
 */
export function getRateLimitStats() {
  const now = Date.now();
  const stats = {
    global: {
      count: 0,
      limit: SAFETY_CONFIG.MAX_GLOBAL_REQUESTS_PER_MINUTE,
      resetTime: null
    },
    domains: {},
    ips: {}
  };
  
  // Global stats
  if (globalRateLimit.has('global')) {
    const limit = globalRateLimit.get('global');
    stats.global.count = limit.count;
    stats.global.resetTime = new Date(limit.resetTime).toISOString();
  }
  
  // Domain stats
  for (const [domain, limit] of domainRateLimit.entries()) {
    if (now <= limit.resetTime) {
      stats.domains[domain] = {
        count: limit.count,
        limit: SAFETY_CONFIG.MAX_DOMAIN_REQUESTS_PER_5_MINUTES,
        resetTime: new Date(limit.resetTime).toISOString()
      };
    }
  }
  
  // IP stats
  for (const [ip, limit] of ipRateLimit.entries()) {
    if (now <= limit.resetTime) {
      stats.ips[ip] = {
        count: limit.count,
        limit: SAFETY_CONFIG.MAX_IP_REQUESTS_PER_MINUTE,
        resetTime: new Date(limit.resetTime).toISOString()
      };
    }
  }
  
  return stats;
}

/**
 * Validate email for verification
 */
export function validateEmailForVerification(email) {
  const issues = [];
  
  if (!email || typeof email !== 'string') {
    issues.push('invalid-input');
    return { valid: false, issues };
  }
  
  if (email.length > 254) {
    issues.push('too-long');
  }
  
  if (email.length < 3) {
    issues.push('too-short');
  }
  
  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex >= email.length - 1) {
    issues.push('invalid-format');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

export default {
  checkGlobalRateLimit,
  checkDomainRateLimit,
  checkIPRateLimit,
  isSensitiveProvider,
  isDisposableProvider,
  isBlacklistedDomain,
  isRoleBasedEmail,
  getSafetyConfig,
  shouldSkipVerification,
  calculateBackoffDelay,
  getCommandPacing,
  clearAllRateLimits,
  getRateLimitStats,
  validateEmailForVerification
};
