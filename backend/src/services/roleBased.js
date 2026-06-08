/**
 * Role-based email detection
 * Identifies emails that are likely role-based (admin, info, support, etc.)
 */

// Role-based email prefixes
export const ROLE_BASED_PREFIXES = new Set([
  // Administrative
  'admin', 'administrator', 'root', 'daemon', 'postmaster',
  'hostmaster', 'webmaster', 'sysadmin', 'system', 'server',
  'host', 'hosting', 'superuser', 'super', 'owner',
  
  // Communication
  'info', 'information', 'contact', 'contacts', 'hello',
  'hi', 'hey', 'enquiries', 'enquiry', 'inquiry',
  'inquiries', 'questions', 'question', 'feedback',
  'feedbacks', 'suggestions', 'suggestion', 'comments',
  'comment', 'general', 'public', 'publicity',
  
  // Support
  'support', 'supports', 'help', 'helps', 'helpdesk',
  'assistance', 'assist', 'service', 'services',
  'customer', 'customers', 'client', 'clients',
  'user', 'users', 'member', 'members', 'subscriber',
  'subscribers', 'subs', 'sub', 'community',
  
  // Business
  'sales', 'sale', 'business', 'commercial', 'trade',
  'trading', 'commerce', 'marketing', 'market',
  'promotion', 'promo', 'advertising', 'ads',
  'billing', 'bill', 'bills', 'payment', 'payments',
  'finance', 'financial', 'accounting', 'accounts',
  'account', 'invoice', 'invoices', 'receipt',
  'receipts', 'orders', 'order', 'purchases',
  'purchase', 'transactions', 'transaction',
  
  // Human Resources
  'hr', 'humanresources', 'human-resources', 'personnel',
  'staff', 'employee', 'employees', 'recruitment',
  'recruit', 'hiring', 'jobs', 'job', 'careers',
  'career', 'employment', 'employ', 'work', 'works',
  'workplace', 'office', 'offices', 'headquarters',
  'hq', 'main', 'primary', 'secondary', 'backup',
  'backups', 'regional', 'region', 'local',
  'international', 'global', 'worldwide',
  
  // Technical
  'tech', 'technical', 'technology', 'it', 'is',
  'systems', 'system', 'dev', 'developer', 'developers',
  'development', 'programming', 'programmer', 'code',
  'coding', 'software', 'hardware', 'network',
  'networking', 'security', 'secure', 'privacy',
  'compliance', 'gdpr', 'legal', 'law', 'legal',
  'compliance', 'audit', 'auditing', 'monitoring',
  'monitor', 'alerts', 'alert', 'notifications',
  'notification', 'reports', 'report', 'logs',
  'logging', 'analytics', 'analytics', 'metrics',
  
  // Media & Content
  'press', 'media', 'news', 'newsletter', 'newsletters',
  'bulletin', 'bulletin', 'content', 'contents',
  'editor', 'editors', 'editorial', 'publishing',
  'publish', 'publication', 'publications', 'blog',
  'blogs', 'social', 'socialmedia', 'social-media',
  'marketing', 'marketing', 'promotion', 'promo',
  'advertising', 'ads', 'campaign', 'campaigns',
  
  // Operations
  'operations', 'ops', 'operational', 'maintenance',
  'maintain', 'updates', 'update', 'upgrade',
  'upgrades', 'monitoring', 'monitor', 'alerts',
  'alert', 'notifications', 'notification', 'reports',
  'report', 'logs', 'logging', 'analytics',
  'metrics', 'kpi', 'kpis', 'dashboard', 'dashboards',
  
  // Generic
  'test', 'testing', 'tests', 'demo', 'demos',
  'sample', 'samples', 'example', 'examples',
  'trial', 'trials', 'beta', 'alpha', 'staging',
  'development', 'dev', 'prod', 'production',
  'live', 'sandbox', 'playground', 'experiment',
  'experiments', 'pilot', 'pilots', 'prototype',
  'prototypes', 'mock', 'mocks', 'simulation',
  'simulations', 'sim', 'sims',
  
  // No-reply patterns
  'noreply', 'no-reply', 'noreply', 'no_reply',
  'donotreply', 'do-not-reply', 'donotreply',
  'do_not_reply', 'nobody', 'nobody', 'null',
  'void', 'empty', 'blank', 'void', 'null',
  'none', 'nothing', 'zero', 'nil',
  
  // Common patterns
  'mail', 'email', 'emails', 'message', 'messages',
  'send', 'sending', 'receive', 'receiving',
  'delivery', 'deliveries', 'bounce', 'bounces',
  'return', 'returns', 'reply', 'replies',
  'response', 'responses', 'forward', 'forwards',
  'redirect', 'redirects', 'transfer', 'transfers',
  
  // Geographic/Departmental
  'headquarters', 'hq', 'main', 'primary',
  'secondary', 'backup', 'backups', 'regional',
  'region', 'local', 'international', 'global',
  'worldwide', 'europe', 'asia', 'americas',
  'africa', 'oceania', 'north', 'south', 'east',
  'west', 'central', 'northeast', 'northwest',
  'southeast', 'southwest', 'european', 'asian',
  'american', 'african', 'oceanian', 'continental',
  'national', 'state', 'provincial', 'county',
  'city', 'municipal', 'district', 'zone',
  'area', 'territory', 'territories'
]);

/**
 * Check if an email local part is role-based
 * @param {string} localPart - The local part of the email
 * @returns {boolean} True if local part is role-based
 */
export function isRoleBased(localPart) {
  if (!localPart || typeof localPart !== 'string') {
    return false;
  }
  
  const normalizedLocal = localPart.toLowerCase().trim();
  
  // Check exact match
  if (ROLE_BASED_PREFIXES.has(normalizedLocal)) {
    return true;
  }
  
  // Check for role-based patterns
  const roleBasedPatterns = [
    /^admin\d*$/,
    /^info\d*$/,
    /^support\d*$/,
    /^help\d*$/,
    /^sales\d*$/,
    /^marketing\d*$/,
    /^billing\d*$/,
    /^hr\d*$/,
    /^tech\d*$/,
    /^dev\d*$/,
    /^test\d*$/,
    /^demo\d*$/,
    /^sample\d*$/,
    /^example\d*$/,
    /^dummy\d*$/,
    /^placeholder\d*$/,
    /^invalid\d*$/,
    /^nonexistent\d*$/,
    /^bogus\d*$/,
    /^fake\d*$/,
    /^spam\d*$/,
    /^trash\d*$/,
    /^junk\d*$/,
    /^temp\d*$/,
    /^temporary\d*$/,
    /^disposable\d*$/,
    /^throwaway\d*$/,
    /^noreply\d*$/,
    /^no-reply\d*$/,
    /^donotreply\d*$/,
    /^do-not-reply\d*$/
  ];
  
  return roleBasedPatterns.some(pattern => pattern.test(normalizedLocal));
}

/**
 * Add a role-based prefix
 * @param {string} prefix - The prefix to add
 */
export function addRoleBasedPrefix(prefix) {
  if (prefix && typeof prefix === 'string') {
    ROLE_BASED_PREFIXES.add(prefix.toLowerCase().trim());
  }
}

/**
 * Remove a role-based prefix
 * @param {string} prefix - The prefix to remove
 */
export function removeRoleBasedPrefix(prefix) {
  if (prefix && typeof prefix === 'string') {
    ROLE_BASED_PREFIXES.delete(prefix.toLowerCase().trim());
  }
}

/**
 * Get all role-based prefixes
 * @returns {Set} Set of role-based prefixes
 */
export function getRoleBasedPrefixes() {
  return new Set(ROLE_BASED_PREFIXES);
}

export default {
  ROLE_BASED_PREFIXES,
  isRoleBased,
  addRoleBasedPrefix,
  removeRoleBasedPrefix,
  getRoleBasedPrefixes
};
