/**
 * Verify if a phone number is registered on WhatsApp.
 * Requires a third-party API — there is no free official Meta endpoint.
 *
 * Supported providers (set WHATSAPP_VERIFY_PROVIDER):
 *   - 2chat  — needs WHATSAPP_VERIFY_API_KEY + WHATSAPP_VERIFY_FROM_NUMBER
 *   - wawp   — needs WHATSAPP_VERIFY_API_KEY + WHATSAPP_VERIFY_INSTANCE_ID
 *   - custom — needs WHATSAPP_VERIFY_URL (use {phone} placeholder)
 */

import logger from '../../config/logger.js';

const VERIFY_TIMEOUT_MS = 12000;
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function isStrictMode() {
  return process.env.WHATSAPP_VERIFY_STRICT !== 'false';
}

function getProvider() {
  const p = (process.env.WHATSAPP_VERIFY_PROVIDER || 'none').toLowerCase();
  if (p === 'none' || !p) return 'none';
  return p;
}

function cacheGet(digits) {
  const hit = cache.get(digits);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;
  return null;
}

function cacheSet(digits, result) {
  cache.set(digits, { result, at: Date.now() });
}

async function verifyVia2Chat(digits) {
  const apiKey = process.env.WHATSAPP_VERIFY_API_KEY;
  const fromNumber = digitsOnly(process.env.WHATSAPP_VERIFY_FROM_NUMBER);
  if (!apiKey || !fromNumber) {
    return { exists: null, verified: false, provider: '2chat', reason: 'missing_config' };
  }

  const url = `https://api.p.2chat.io/open/whatsapp/check-number/+${fromNumber}/+${digits}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    headers: { 'X-User-API-Key': apiKey, Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`2Chat HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.is_valid) {
    return { exists: false, verified: true, provider: '2chat', reason: 'invalid_format' };
  }

  return {
    exists: Boolean(data.on_whatsapp),
    verified: true,
    provider: '2chat',
    whatsappId: data.whatsapp_info?.number_id || digits,
    isBusiness: data.whatsapp_info?.is_business || false
  };
}

async function verifyViaWawp(digits) {
  const apiKey = process.env.WHATSAPP_VERIFY_API_KEY;
  const instanceId = process.env.WHATSAPP_VERIFY_INSTANCE_ID;
  if (!apiKey || !instanceId) {
    return { exists: null, verified: false, provider: 'wawp', reason: 'missing_config' };
  }

  const response = await fetch('https://api.wawp.net/v2/contacts/check-exists', {
    method: 'POST',
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      instance_id: instanceId,
      access_token: apiKey,
      phone: digits
    })
  });

  if (!response.ok) {
    throw new Error(`Wawp HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    exists: Boolean(data.exists),
    verified: true,
    provider: 'wawp',
    whatsappId: data.jid ? String(data.jid).split('@')[0] : digits
  };
}

async function verifyViaCustom(digits) {
  const template = process.env.WHATSAPP_VERIFY_URL;
  const apiKey = process.env.WHATSAPP_VERIFY_API_KEY;
  if (!template) {
    return { exists: null, verified: false, provider: 'custom', reason: 'missing_config' };
  }

  const url = template.replace('{phone}', digits);
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    headers
  });

  if (!response.ok) {
    throw new Error(`Custom verify HTTP ${response.status}`);
  }

  const data = await response.json();
  const exists = Boolean(
    data.exists ?? data.on_whatsapp ?? data.numberExists ?? data.isInWhatsapp
  );

  return {
    exists,
    verified: true,
    provider: 'custom',
    whatsappId: data.jid || data.number_id || data.chatId || digits
  };
}

/**
 * @param {string} e164 - e.g. +966520916465
 * @returns {Promise<{exists: boolean|null, verified: boolean, provider: string, reason?: string}>}
 */
export async function verifyWhatsAppNumber(e164) {
  const digits = digitsOnly(e164);
  if (!digits || digits.length < 10) {
    return { exists: false, verified: true, provider: 'local', reason: 'invalid_length' };
  }

  const cached = cacheGet(digits);
  if (cached) return cached;

  const provider = getProvider();
  let result;

  try {
    switch (provider) {
      case '2chat':
        result = await verifyVia2Chat(digits);
        break;
      case 'wawp':
        result = await verifyViaWawp(digits);
        break;
      case 'custom':
        result = await verifyViaCustom(digits);
        break;
      default:
        result = {
          exists: null,
          verified: false,
          provider: 'none',
          reason: isStrictMode() ? 'no_provider_strict' : 'no_provider'
        };
    }
  } catch (error) {
    logger.warn(`[WHATSAPP-VERIFY] Failed for ${e164}: ${error.message}`);
    result = { exists: null, verified: false, provider, reason: 'api_error', error: error.message };
  }

  cacheSet(digits, result);
  return result;
}

/**
 * Should this number be shown as WhatsApp?
 */
export async function shouldIncludeWhatsAppResult(e164) {
  const check = await verifyWhatsAppNumber(e164);

  if (check.verified && check.exists === true) return { include: true, check };
  if (check.verified && check.exists === false) return { include: false, check };

  // Not verified (no API or error)
  if (isStrictMode()) {
    return { include: false, check };
  }

  // Permissive fallback when strict mode off — still mark unverified
  return { include: true, check };
}

export function isWhatsAppVerificationEnabled() {
  return getProvider() !== 'none'
    && Boolean(process.env.WHATSAPP_VERIFY_API_KEY);
}

export function getWhatsAppVerificationStatus() {
  const provider = getProvider();
  return {
    provider,
    enabled: isWhatsAppVerificationEnabled(),
    strict: isStrictMode(),
    configured: provider !== 'none' && Boolean(process.env.WHATSAPP_VERIFY_API_KEY)
  };
}
