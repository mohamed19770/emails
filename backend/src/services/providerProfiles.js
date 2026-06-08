/**
 * Provider profiles for email verification
 * Identifies sensitive providers and their MX patterns
 */

// Sensitive email providers that require special handling
export const providerSensitiveDomains = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aim.com',
  'protonmail.com', 'proton.me',
  'mail.com', 'gmx.com', 'web.de',
  'zoho.com', 'zohomail.com'
]);

// Sensitive MX host patterns
export const providerSensitiveMxHosts = new Set([
  // Google patterns
  'gmail-smtp-in.l.google.com',
  'alt1.gmail-smtp-in.l.google.com',
  'alt2.gmail-smtp-in.l.google.com',
  'alt3.gmail-smtp-in.l.google.com',
  'alt4.gmail-smtp-in.l.google.com',
  'aspmx.l.google.com',
  'alt1.aspmx.l.google.com',
  'alt2.aspmx.l.google.com',
  'alt3.aspmx.l.google.com',
  'alt4.aspmx.l.google.com',
  
  // Microsoft patterns
  'outlook-com.olc.protection.outlook.com',
  'outlook.olc.protection.outlook.com',
  'outlook.office365.com',
  'outlook.olc.protection.outlook.com',
  'protection.outlook.com',
  
  // Yahoo patterns
  'mta1.am0.yahoodns.net',
  'mta2.am0.yahoodns.net',
  'mta3.am0.yahoodns.net',
  'mta4.am0.yahoodns.net',
  'mta5.am0.yahoodns.net',
  'mta6.am0.yahoodns.net',
  'mta7.am0.yahoodns.net',
  
  // Apple patterns
  'mx01.mail.icloud.com',
  'mx02.mail.icloud.com',
  'mx03.mail.icloud.com',
  'mx04.mail.icloud.com',
  'mx05.mail.icloud.com',
  'mx06.mail.icloud.com',
  
  // AOL patterns
  'inbound.mx.aol.com',
  'mx-aol.mail.gm0.yahoodns.net',
  
  // ProtonMail patterns
  'mail.protonmail.com',
  'mailsec.protonmail.com'
]);

// Known accept-all MX hosts (start empty but keep hook for future)
export const alwaysAcceptMxHosts = new Set([
  // Add known accept-all relays here if discovered
  // 'relay.accept-all.example.com'
]);

/**
 * Check if a domain is a sensitive provider
 * @param {string} domain - The domain to check
 * @returns {boolean} True if domain is sensitive
 */
export function isProviderSensitiveDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  return providerSensitiveDomains.has(domain.toLowerCase());
}

/**
 * Check if an MX host is from a sensitive provider
 * @param {string} mxHost - The MX host to check
 * @returns {boolean} True if MX host is from sensitive provider
 */
export function isProviderSensitiveMxHost(mxHost) {
  if (!mxHost || typeof mxHost !== 'string') return false;
  return providerSensitiveMxHosts.has(mxHost.toLowerCase());
}

/**
 * Check if a domain/MX combination is from a sensitive provider
 * @param {Object} params - Parameters object
 * @param {string} params.domain - The domain
 * @param {string} params.mxHost - The MX host
 * @returns {boolean} True if provider is sensitive
 */
export function isProviderSensitive({ domain, mxHost }) {
  return isProviderSensitiveDomain(domain) || isProviderSensitiveMxHost(mxHost);
}

/**
 * Check if an MX host is known to always accept
 * @param {string} mxHost - The MX host to check
 * @returns {boolean} True if MX host always accepts
 */
export function isAlwaysAcceptMxHost(mxHost) {
  return alwaysAcceptMxHosts.has(mxHost.toLowerCase());
}

/**
 * Get provider classification
 * @param {string} domain - The domain
 * @returns {string} Provider classification
 */
export function getProviderClassification(domain) {
  if (isProviderSensitiveDomain(domain)) {
    return 'sensitive';
  }
  return 'normal';
}

export default {
  providerSensitiveDomains,
  providerSensitiveMxHosts,
  alwaysAcceptMxHosts,
  isProviderSensitiveDomain,
  isProviderSensitiveMxHost,
  isProviderSensitive,
  isAlwaysAcceptMxHost,
  getProviderClassification
};
