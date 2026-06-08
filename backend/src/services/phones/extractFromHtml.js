import * as cheerio from 'cheerio';
import logger from '../../config/logger.js';
import { simpleNormalizePhone, extractWhatsAppFromUrl } from './simpleNormalize.js';
import { isLikelyFakePhone } from './phoneValidation.js';

/**
 * Extracts phone numbers and WhatsApp links from HTML content
 * @param {string} html - HTML content
 * @param {string} url - Source URL
 * @param {Object} options - Extraction options
 * @returns {Object} - { phones: [], whatsapp: [], trace: [] }
 */
export function extractFromHtml(html, url, options = {}) {
  const {
    countries = [],
    maxPhonesPerDomain = 5,
    maxWhatsAppPerDomain = 3,
    strictMode = false,
    includeTypes = ['mobile', 'landline', 'toll-free']
  } = options;
  
  const phones = [];
  const whatsapp = [];
  const trace = [];
  const startTime = Date.now();
  
  logger.info(`[PHONE-EXTRACT] Starting extraction from ${url}`);
  
  try {
    const $ = cheerio.load(html);
    
    // Step 1: Direct selectors (fast path)
    const directResults = extractDirectSelectors($, url, countries, html);
    phones.push(...directResults.phones);
    whatsapp.push(...directResults.whatsapp);
    trace.push(...directResults.trace);
    
    // Step 2: Structured data (JSON-LD, Microdata)
    const structuredResults = extractStructuredData($, url, countries, html);
    phones.push(...structuredResults.phones);
    trace.push(...structuredResults.trace);
    
    // Step 3: WhatsApp URLs embedded anywhere in HTML
    const rawWaResults = extractWhatsAppFromRawHtml(html, url, countries);
    whatsapp.push(...rawWaResults.whatsapp);
    trace.push(...rawWaResults.trace);

    // Step 4: DOM text scanning
    const textResults = extractFromText($, url, countries, html);
    phones.push(...textResults.phones);
    whatsapp.push(...textResults.whatsapp);
    trace.push(...textResults.trace);
    
    // Step 5: Deduplication and filtering
    const finalResults = deduplicateAndFilter({
      phones,
      whatsapp
    }, {
      maxPhonesPerDomain,
      maxWhatsAppPerDomain,
      includeTypes,
      strictMode
    });
    
    const duration = Date.now() - startTime;
    
    trace.push({
      scope: 'extract-phone',
      url,
      step: 'final-summary',
      status: 'SUCCESS',
      count: finalResults.phones.length + finalResults.whatsapp.length,
      durationMs: duration,
      note: `Extracted ${finalResults.phones.length} phones, ${finalResults.whatsapp.length} WhatsApp links`
    });
    
    logger.info(`[PHONE-EXTRACT] Extraction complete: ${finalResults.phones.length} phones, ${finalResults.whatsapp.length} WhatsApp from ${url}`);
    
    return {
      phones: finalResults.phones,
      whatsapp: finalResults.whatsapp,
      trace
    };
    
  } catch (error) {
    logger.error(`[PHONE-EXTRACT] Error extracting from ${url}:`, error);
    return {
      phones: [],
      whatsapp: [],
      trace: [{
        scope: 'extract-phone',
        url,
        step: 'error',
        status: 'ERROR',
        note: error.message,
        durationMs: Date.now() - startTime
      }]
    };
  }
}

/**
 * Extracts phone numbers from direct HTML selectors
 */
function extractDirectSelectors($, url, countries, html) {
  const phones = [];
  const whatsapp = [];
  const trace = [];
  const startTime = Date.now();
  
  // Extract tel: links
  $('a[href^="tel:"]').each((i, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().trim();
    
    if (href) {
      const phoneNumber = href.replace('tel:', '').trim();
      const normalized = simpleNormalizePhone(phoneNumber, url, countries, html);
      
      if (normalized) {
        phones.push({
          ...normalized,
          sourceUrl: url,
          source: 'tel-link',
          confidence: 'high',
          context: text || phoneNumber,
          fetchedAt: new Date().toISOString()
        });
      }
    }
  });
  
  // Extract WhatsApp links
  $('a[href*="wa.me"], a[href*="api.whatsapp.com"]').each((i, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().trim();
    
    if (href) {
      const whatsappResult = extractWhatsAppFromUrl(href, url, countries, html);
      if (whatsappResult) {
        const digits = whatsappResult.e164.replace(/\D/g, '');
        whatsapp.push({
          ...whatsappResult,
          sourceUrl: url,
          source: 'whatsapp-link',
          hasWhatsAppLink: true,
          waLink: `https://wa.me/${digits}`,
          context: text || href,
          fetchedAt: new Date().toISOString()
        });
      }
    }
  });
  
  const duration = Date.now() - startTime;
  
  trace.push({
    scope: 'extract-phone',
    url,
    step: 'direct-selectors',
    status: 'SUCCESS',
    count: phones.length + whatsapp.length,
    durationMs: duration,
    note: `Found ${phones.length} tel links, ${whatsapp.length} WhatsApp links`
  });
  
  return { phones, whatsapp, trace };
}

/**
 * Extracts phone numbers from structured data (JSON-LD, Microdata)
 */
function extractStructuredData($, url, countries, html) {
  const phones = [];
  const trace = [];
  const startTime = Date.now();
  
  // Extract from JSON-LD
  $('script[type="application/ld+json"]').each((i, element) => {
    try {
      const jsonData = JSON.parse($(element).html());
      const extracted = extractPhonesFromJsonLd(jsonData, url, countries, html);
      phones.push(...extracted);
    } catch (e) {
      // Ignore invalid JSON
    }
  });
  
  const duration = Date.now() - startTime;
  
  trace.push({
    scope: 'extract-phone',
    url,
    step: 'structured-data',
    status: 'SUCCESS',
    count: phones.length,
    durationMs: duration,
    note: `Found ${phones.length} phones in structured data`
  });
  
  return { phones, trace };
}

/**
 * Extracts phone numbers from JSON-LD structured data
 */
function extractPhonesFromJsonLd(data, url, countries, html) {
  const phones = [];
  
  function processObject(obj) {
    if (typeof obj !== 'object' || obj === null) return;
    
    // Check for telephone field
    if (obj.telephone) {
      const normalized = simpleNormalizePhone(obj.telephone, url, countries, html);
      if (normalized) {
        phones.push({
          ...normalized,
          sourceUrl: url,
          source: 'json-ld',
          confidence: 'high',
          context: obj.telephone,
          fetchedAt: new Date().toISOString()
        });
      }
    }
    
    // Check for contactPoint array
    if (obj.contactPoint && Array.isArray(obj.contactPoint)) {
      obj.contactPoint.forEach(point => processObject(point));
    }
    
    // Recursively process nested objects
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        processObject(value);
      }
    });
  }
  
  if (Array.isArray(data)) {
    data.forEach(item => processObject(item));
  } else {
    processObject(data);
  }
  
  return phones;
}

/**
 * Extract wa.me / api.whatsapp.com URLs from raw HTML (scripts, data attrs, etc.)
 */
function extractWhatsAppFromRawHtml(html, url, countries) {
  const whatsapp = [];
  const trace = [];
  const seen = new Set();
  const startTime = Date.now();

  const patterns = [
    /wa\.me\/(\d{10,15})/gi,
    /api\.whatsapp\.com\/send\?phone=(\d{10,15})/gi,
    /whatsapp:\/\/send\?phone=(\d{10,15})/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const digits = match[1];
      if (seen.has(digits)) continue;
      seen.add(digits);

      const waUrl = `https://wa.me/${digits}`;
      const result = extractWhatsAppFromUrl(waUrl, url, countries, html);
      if (result) {
        whatsapp.push({
          ...result,
          sourceUrl: url,
          source: 'whatsapp-link',
          confidence: 'high',
          hasWhatsAppLink: true,
          waLink: waUrl,
          context: waUrl,
          fetchedAt: new Date().toISOString()
        });
      }
    }
  }

  trace.push({
    scope: 'extract-phone',
    url,
    step: 'raw-whatsapp-scan',
    status: 'SUCCESS',
    count: whatsapp.length,
    durationMs: Date.now() - startTime,
    note: `Found ${whatsapp.length} WhatsApp URLs in HTML`
  });

  return { whatsapp, trace };
}

/**
 * Extracts phone numbers from DOM text content
 */
function extractFromText($, url, countries, html) {
  const phones = [];
  const whatsapp = [];
  const trace = [];
  const startTime = Date.now();
  
  const textContent = $.text();
  const foundNumbers = new Set();
  const foundWhatsApp = new Set();

  const whatsappLabelPatterns = [
    /(?:whatsapp|واتساب|واتس|whats\s*app)[:\s\-–—]*(\+?966[\s\-]?[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{4})/gi,
    /(?:whatsapp|واتساب|واتس|whats\s*app)[:\s\-–—]*(0[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{4})/gi,
    /(\+?966[\s\-]?[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{4})[^\d]{0,20}(?:whatsapp|واتساب|واتس)/gi,
    /(0[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{4})[^\d]{0,20}(?:whatsapp|واتساب|واتس)/gi
  ];

  for (const pattern of whatsappLabelPatterns) {
    let match;
    while ((match = pattern.exec(textContent)) !== null) {
      const number = match[1].replace(/\s|-/g, '');
      if (foundWhatsApp.has(number)) continue;
      foundWhatsApp.add(number);

      const normalized = simpleNormalizePhone(number, url, countries, html);
      if (normalized) {
        const digits = normalized.e164.replace(/\D/g, '');
        whatsapp.push({
          ...normalized,
          sourceUrl: url,
          source: 'whatsapp-text',
          confidence: 'medium',
          hasWhatsAppLink: false,
          waLink: `https://wa.me/${digits}`,
          context: match[0].trim().slice(0, 80),
          fetchedAt: new Date().toISOString()
        });
      }
    }
  }

  const phonePatterns = [
    /(\+966[0-9]{9})/g,
    /(0[0-9]{9})/g
  ];
  
  phonePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(textContent)) !== null) {
      const number = match[1];
      if (foundNumbers.has(number) || foundWhatsApp.has(number)) continue;
      foundNumbers.add(number);
        
      const normalized = simpleNormalizePhone(number, url, countries, html);
      if (normalized) {
        phones.push({
          ...normalized,
          sourceUrl: url,
          source: 'text-scan',
          confidence: 'low',
          hasWhatsAppLink: false,
          context: number,
          fetchedAt: new Date().toISOString()
        });
      }
    }
  });
  
  const duration = Date.now() - startTime;
  
  trace.push({
    scope: 'extract-phone',
    url,
    step: 'text-scan',
    status: 'SUCCESS',
    count: phones.length + whatsapp.length,
    durationMs: duration,
    note: `Found ${phones.length} phones, ${whatsapp.length} WhatsApp-labeled numbers in text`
  });
  
  return { phones, whatsapp, trace };
}

/**
 * Deduplicates and filters results based on options
 */
function deduplicateAndFilter(results, options) {
  const { maxPhonesPerDomain, maxWhatsAppPerDomain, includeTypes, strictMode } = options;
  
  // Deduplicate by E.164
  const phoneMap = new Map();
  const whatsappMap = new Map();
  
  // Filter and deduplicate phones
  results.phones.forEach(phone => {
    if (phone.e164 && !isLikelyFakePhone(phone.e164, phone.local) && (!strictMode || includeTypes.includes(phone.type))) {
      if (!phoneMap.has(phone.e164)) {
        phoneMap.set(phone.e164, phone);
      }
    }
  });
  
  // Filter and deduplicate WhatsApp
  results.whatsapp.forEach(wa => {
    if (wa.e164 && !isLikelyFakePhone(wa.e164, wa.local)) {
      if (!whatsappMap.has(wa.e164)) {
        whatsappMap.set(wa.e164, wa);
      }
    }
  });
  
  // Apply per-domain limits
  const finalPhones = Array.from(phoneMap.values()).slice(0, maxPhonesPerDomain);
  const finalWhatsapp = Array.from(whatsappMap.values()).slice(0, maxWhatsAppPerDomain);
  
  return {
    phones: finalPhones,
    whatsapp: finalWhatsapp
  };
}
