/**
 * Disposable email domain detection
 * Comprehensive list of temporary/disposable email providers
 */

// Comprehensive disposable email domains
export const DISPOSABLE_DOMAINS = new Set([
  // Popular disposable services
  '10minutemail.com', '10minutemail.net', '10minutemail.co.uk',
  'tempmail.org', 'tempmail.net', 'tempmail.co', 'tempmail.us',
  'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'mailinator.com', 'mailinator.net', 'mailinator.org',
  'throwaway.email', 'temp-mail.org', 'temp-mail.net',
  'getnada.com', 'maildrop.cc', 'sharklasers.com',
  
  // Additional disposable services
  'pokemail.net', 'spam4.me', 'bccto.me', 'chacuo.net',
  'dispostable.com', 'fakeinbox.com', 'mailnesia.com',
  'mailnull.com', 'meltmail.com', 'mohmal.com',
  'mytrashmail.com', 'nada.email', 'nada.ltd',
  'spamgourmet.com', 'spamhole.com', 'spam.la',
  'spammotel.com', 'spamobox.com', 'spamspot.com',
  'spamthis.co.uk', 'spamthisplease.com', 'superrito.com',
  'thisisnotmyrealemail.com', 'tittbit.in', 'toomail.biz',
  'toomail.net', 'trash-amil.com', 'trashmail.com',
  'trashmail.net', 'trashymail.com', 'trashymail.net',
  'trbvm.com', 'tyldd.com', 'uggsrock.com',
  'wegwerfadresse.de', 'wegwerfmail.de', 'wetrainbayarea.com',
  'wetrainbayarea.org', 'wh4f.org', 'whyspam.me',
  'willselfdestruct.com', 'wuzup.net', 'wuzupmail.net',
  'yeah.net', 'yopmail.com', 'yopmail.net', 'yopmail.org',
  
  // International disposable services
  'ypmail.webarnak.fr', 'cool.fr.nf', 'jetable.fr',
  'jetable.net', 'jetable.org', 'nospam.ze.tc',
  'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr',
  'courriel.fr.nf', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'tempmail.net', 'temp-mail.net',
  'tempmail.co', 'temp-mail.co', 'tempmail.us',
  'temp-mail.us', 'tempmail.eu', 'temp-mail.eu',
  'tempmail.de', 'temp-mail.de', 'tempmail.fr',
  'temp-mail.fr', 'tempmail.it', 'temp-mail.it',
  'tempmail.es', 'temp-mail.es', 'tempmail.ru',
  'temp-mail.ru', 'tempmail.jp', 'temp-mail.jp',
  'tempmail.cn', 'temp-mail.cn', 'tempmail.in',
  'temp-mail.in', 'tempmail.com.br', 'temp-mail.com.br',
  'tempmail.com.au', 'temp-mail.com.au', 'tempmail.ca',
  'temp-mail.ca', 'tempmail.co.uk', 'temp-mail.co.uk',
  
  // Additional patterns
  'temp-mail.org', 'temp-mail.net', 'temp-mail.co',
  'temp-mail.us', 'temp-mail.eu', 'temp-mail.de',
  'temp-mail.fr', 'temp-mail.it', 'temp-mail.es',
  'temp-mail.ru', 'temp-mail.jp', 'temp-mail.cn',
  'temp-mail.in', 'temp-mail.com.br', 'temp-mail.com.au',
  'temp-mail.ca', 'temp-mail.co.uk'
]);

/**
 * Check if a domain is disposable
 * @param {string} domain - The domain to check
 * @returns {boolean} True if domain is disposable
 */
export function isDisposable(domain) {
  if (!domain || typeof domain !== 'string') {
    return false;
  }
  
  const normalizedDomain = domain.toLowerCase().trim();
  
  // Check exact match
  if (DISPOSABLE_DOMAINS.has(normalizedDomain)) {
    return true;
  }
  
  // Check for common disposable patterns
  const disposablePatterns = [
    /^temp.*\.com$/,
    /^fake.*\.com$/,
    /^spam.*\.com$/,
    /^trash.*\.com$/,
    /^throwaway.*\.com$/,
    /^disposable.*\.com$/,
    /^temporary.*\.com$/,
    /^test.*\.com$/,
    /^demo.*\.com$/,
    /^example.*\.com$/,
    /^sample.*\.com$/,
    /^dummy.*\.com$/,
    /^placeholder.*\.com$/,
    /^invalid.*\.com$/,
    /^nonexistent.*\.com$/,
    /^bogus.*\.com$/,
    /^fake.*\.net$/,
    /^spam.*\.net$/,
    /^trash.*\.net$/,
    /^temp.*\.net$/,
    /^test.*\.net$/,
    /^demo.*\.net$/,
    /^example.*\.net$/,
    /^sample.*\.net$/,
    /^dummy.*\.net$/,
    /^placeholder.*\.net$/,
    /^invalid.*\.net$/,
    /^nonexistent.*\.net$/,
    /^bogus.*\.net$/
  ];
  
  return disposablePatterns.some(pattern => pattern.test(normalizedDomain));
}

/**
 * Add a domain to the disposable list
 * @param {string} domain - The domain to add
 */
export function addDisposableDomain(domain) {
  if (domain && typeof domain === 'string') {
    DISPOSABLE_DOMAINS.add(domain.toLowerCase().trim());
  }
}

/**
 * Remove a domain from the disposable list
 * @param {string} domain - The domain to remove
 */
export function removeDisposableDomain(domain) {
  if (domain && typeof domain === 'string') {
    DISPOSABLE_DOMAINS.delete(domain.toLowerCase().trim());
  }
}

/**
 * Get all disposable domains
 * @returns {Set} Set of disposable domains
 */
export function getDisposableDomains() {
  return new Set(DISPOSABLE_DOMAINS);
}

export default {
  DISPOSABLE_DOMAINS,
  isDisposable,
  addDisposableDomain,
  removeDisposableDomain,
  getDisposableDomains
};
