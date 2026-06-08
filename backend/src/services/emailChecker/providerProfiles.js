/**
 * Provider profiles and domain classifications
 * Lists for disposable, blacklisted, sensitive providers, and role-based emails
 */

import disposableDomains from 'disposable-email-domains/index.json' with { type: 'json' };

// Use the comprehensive disposable domains list
export const DISPOSABLE_DOMAINS = disposableDomains;

// Blacklisted domains (spam, malware, phishing domains)
export const BLACKLISTED_DOMAINS = [
  'spamdomain.com', 'badmail.net', 'virusmail.org', 'malware.com',
  'phishing.net', 'scam.org', 'fraud.com', 'bad-domain.test',
  'spam.com', 'junkmail.com', 'spam.org', 'trashmail.com',
  'spammer.com', 'spam.net', 'spam.org', 'spam.co.uk',
  'spam.de', 'spam.fr', 'spam.it', 'spam.es',
  'spam.ru', 'spam.cn', 'spam.jp', 'spam.in',
  'spam.com.br', 'spam.com.au', 'spam.ca', 'spam.co.za',
  'malware.com', 'virus.com', 'trojan.com', 'worm.com',
  'phishing.com', 'scam.com', 'fraud.com', 'fake.com',
  'bogus.com', 'fake.net', 'fake.org', 'fake.co.uk',
  'test.com', 'example.com', 'localhost', 'invalid.com',
  'nonexistent.com', 'dummy.com', 'placeholder.com'
];

// Sensitive providers that require special handling
export const SENSITIVE_PROVIDERS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'ymail.com',
  'icloud.com', 'me.com',
  'aol.com', 'aim.com'
];

// Role-based email prefixes (comprehensive list)
export const ROLE_BASED_PREFIXES = [
  // Administrative
  'admin', 'administrator', 'root', 'daemon', 'postmaster', 'hostmaster',
  'webmaster', 'sysadmin', 'system', 'server', 'host', 'hosting',
  
  // Communication
  'info', 'information', 'contact', 'contacts', 'hello', 'hi', 'hey',
  'enquiries', 'enquiry', 'inquiry', 'inquiries', 'questions', 'question',
  'feedback', 'feedbacks', 'suggestions', 'suggestion', 'comments', 'comment',
  
  // Support
  'support', 'supports', 'help', 'helps', 'helpdesk', 'assistance', 'assist',
  'service', 'services', 'customer', 'customers', 'client', 'clients',
  'user', 'users', 'member', 'members', 'subscriber', 'subscribers',
  
  // Business
  'sales', 'sale', 'business', 'commercial', 'trade', 'trading', 'commerce',
  'marketing', 'market', 'promotion', 'promo', 'advertising', 'ads',
  'billing', 'bill', 'bills', 'payment', 'payments', 'finance', 'financial',
  'accounting', 'accounts', 'account', 'invoice', 'invoices', 'receipt',
  
  // Human Resources
  'hr', 'humanresources', 'human-resources', 'personnel', 'staff', 'employee',
  'employees', 'recruitment', 'recruit', 'hiring', 'jobs', 'job', 'careers',
  'career', 'employment', 'employ', 'work', 'works', 'workplace', 'office',
  
  // Technical
  'tech', 'technical', 'technology', 'it', 'is', 'systems', 'system',
  'dev', 'developer', 'developers', 'development', 'programming', 'programmer',
  'code', 'coding', 'software', 'hardware', 'network', 'networking',
  'security', 'secure', 'privacy', 'compliance', 'gdpr', 'legal', 'law',
  
  // Media & Content
  'press', 'media', 'news', 'newsletter', 'newsletters', 'bulletin', 'bulletin',
  'content', 'contents', 'editor', 'editors', 'editorial', 'publishing',
  'publish', 'publication', 'publications', 'blog', 'blogs', 'social',
  
  // Operations
  'operations', 'ops', 'operational', 'maintenance', 'maintain', 'updates',
  'update', 'upgrade', 'upgrades', 'monitoring', 'monitor', 'alerts',
  'alert', 'notifications', 'notification', 'reports', 'report', 'logs',
  
  // Generic
  'test', 'testing', 'tests', 'demo', 'demos', 'sample', 'samples',
  'example', 'examples', 'trial', 'trials', 'beta', 'alpha', 'staging',
  'development', 'dev', 'prod', 'production', 'live', 'sandbox',
  
  // No-reply patterns
  'noreply', 'no-reply', 'noreply', 'no_reply', 'donotreply', 'do-not-reply',
  'donotreply', 'do_not_reply', 'nobody', 'nobody', 'null', 'void',
  
  // Common patterns
  'mail', 'email', 'emails', 'message', 'messages', 'send', 'sending',
  'receive', 'receiving', 'delivery', 'deliveries', 'bounce', 'bounces',
  'return', 'returns', 'reply', 'replies', 'response', 'responses',
  
  // Geographic/Departmental
  'headquarters', 'hq', 'main', 'primary', 'secondary', 'backup', 'backups',
  'regional', 'region', 'local', 'international', 'global', 'worldwide',
  'europe', 'asia', 'americas', 'africa', 'oceania', 'north', 'south',
  'east', 'west', 'central', 'northeast', 'northwest', 'southeast', 'southwest'
];

/**
 * Check if domain is disposable
 */
export function isDisposable(domain) {
  return DISPOSABLE_DOMAINS.includes(domain.toLowerCase());
}

/**
 * Check if domain is blacklisted
 */
export function isBlacklisted(domain) {
  return BLACKLISTED_DOMAINS.includes(domain.toLowerCase());
}

/**
 * Check if domain is a sensitive provider
 */
export function isSensitiveProvider(domain) {
  return SENSITIVE_PROVIDERS.some(provider => 
    domain.toLowerCase().includes(provider.toLowerCase())
  );
}

/**
 * Check if email is role-based
 */
export function isRoleBased(localPart) {
  return ROLE_BASED_PREFIXES.some(prefix => 
    localPart.toLowerCase().startsWith(prefix)
  );
}

// Provider-specific profiles for special handling
export const PROVIDER_PROFILES = {
  'gmail.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'googlemail.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'outlook.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'hotmail.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'live.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'yahoo.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'ymail.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'icloud.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'me.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'aol.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  },
  'aim.com': {
    alwaysAcceptsRCPT: true,
    catchAllLikely: false,
    requiresTLS: true,
    maxConcurrent: 1,
    timeout: 5000
  }
};

/**
 * Get provider profile for a domain
 */
export function getProviderProfile(domain) {
  return PROVIDER_PROFILES[domain.toLowerCase()] || null;
}

/**
 * Check if provider always accepts RCPT (like Gmail/Outlook)
 */
export function alwaysAcceptsRCPT(domain) {
  const profile = getProviderProfile(domain);
  return profile ? profile.alwaysAcceptsRCPT : false;
}

/**
 * Get provider classification for domain
 */
export function getProviderClassification(domain) {
  const lowerDomain = domain.toLowerCase();
  
  if (isDisposable(lowerDomain)) {
    return 'disposable';
  }
  
  if (isBlacklisted(lowerDomain)) {
    return 'blacklisted';
  }
  
  if (isSensitiveProvider(lowerDomain)) {
    return 'sensitive';
  }
  
  return 'normal';
}

export default {
  DISPOSABLE_DOMAINS,
  BLACKLISTED_DOMAINS,
  SENSITIVE_PROVIDERS,
  ROLE_BASED_PREFIXES,
  isDisposable,
  isBlacklisted,
  isSensitiveProvider,
  isRoleBased,
  getProviderClassification
};
