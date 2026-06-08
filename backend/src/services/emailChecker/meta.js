/**
 * Email metadata validation service
 * Can be mocked for testing
 */

// Disposable email domains
const DISPOSABLE_DOMAINS = [
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
  'spamdomain.com', 'badmail.net', 'virusmail.org', 'bad-domain.test'
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

export function isDisposable(domain) {
  return DISPOSABLE_DOMAINS.includes(domain.toLowerCase());
}

export function isBlacklisted(domain) {
  return BLACKLISTED_DOMAINS.includes(domain.toLowerCase());
}

export function isRoleBased(localPart) {
  return ROLE_BASED_PREFIXES.some(prefix => 
    localPart.toLowerCase().startsWith(prefix)
  );
}

export function extractDomain(email) {
  const parts = email.split('@');
  if (parts.length !== 2) {
    throw new Error('Invalid email format for domain extraction');
  }
  return parts[1];
}

export function extractLocalPart(email) {
  const parts = email.split('@');
  if (parts.length !== 2) {
    throw new Error('Invalid email format for local part extraction');
  }
  return parts[0];
}

export default {
  isDisposable,
  isBlacklisted,
  isRoleBased,
  extractDomain,
  extractLocalPart
};
