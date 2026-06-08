/**
 * Enhanced phone extraction focused on recruitment pages
 * Integrates carrier validation and recruitment intent detection
 */

import * as cheerio from 'cheerio';
import { extractFromHtml } from './extractFromHtml.js';
import { validateCarrierPrefix, getCarrierName, countryNameToCode } from './carrierPrefixes.js';
import { isRecruitmentPage } from '../recruitment/intent.js';
import { extractCompanyName } from '../extract/companyName.js';
import { isLikelyFakePhone } from './phoneValidation.js';
import logger from '../../config/logger.js';

/**
 * Extract recruitment-focused phone numbers from HTML
 * @param {string} html - HTML content
 * @param {string} url - Source URL
 * @param {Object} options - Extraction options
 * @returns {Object} - { phones: [], whatsapp: [], companies: [], trace: [] }
 */
export function extractRecruitmentPhones(html, url, options = {}) {
  const {
    country = 'Saudi Arabia',
    recruitmentOnly = true,
    carrierAware = true,
    maxPhonesPerDomain = 5,
    maxWhatsAppPerDomain = 5
  } = options;
  
  const phones = [];
  const whatsapp = [];
  const companies = [];
  const trace = [];
  const startTime = Date.now();
  
  logger.info(`[RECRUITMENT-EXTRACT] Starting extraction from ${url} for ${country}`);
  
  try {
    const $ = cheerio.load(html);
    const pageText = $.text();
    
    // Extract company name first
    const companyInfo = extractCompanyName(html, url);
    companies.push(companyInfo);
    
    // Check recruitment intent
    const recruitmentContext = isRecruitmentPage({
      text: pageText,
      url: url,
      title: $('title').text(),
      meta: $('meta[name="description"]').attr('content')
    });
    
    if (recruitmentOnly && !recruitmentContext.matched) {
      trace.push({
        scope: 'recruitment-filter',
        url,
        step: 'filtered',
        status: 'SKIPPED',
        note: 'Page does not appear to be recruitment-related',
        durationMs: Date.now() - startTime
      });
      
      return { phones, whatsapp, companies, trace };
    }
    
    // Extract phone numbers using existing service
    const phoneResults = extractFromHtml(html, url, {
      countries: [country],
      maxPhonesPerDomain,
      maxWhatsAppPerDomain,
      strictMode: false,
      includeTypes: ['mobile', 'landline', 'toll-free']
    });
    
    const countryCode = countryNameToCode[country];

    const getNationalNumber = (phone) => {
      const digits = String(phone.e164 || '').replace(/\D/g, '');
      const local = String(phone.local || '').replace(/\D/g, '').replace(/^0/, '');
      const callingCodeMap = { SA: '966', AE: '971', QA: '974', KW: '965', BH: '973', OM: '968', EG: '20', JO: '962', LB: '961' };
      const cc = callingCodeMap[countryCode];
      if (cc && digits.startsWith(cc)) return digits.slice(cc.length);
      return local || digits;
    };
    
    // Process and validate phone numbers
    for (const phone of phoneResults.phones) {
      if (isLikelyFakePhone(phone.e164, phone.local)) {
        trace.push({
          scope: 'fake-filter',
          url,
          step: 'filtered',
          status: 'SKIPPED',
          note: `Rejected likely fake number ${phone.e164}`,
          durationMs: 0
        });
        continue;
      }

      if (carrierAware && countryCode) {
        const nationalNumber = getNationalNumber(phone);
        
        if (nationalNumber && !validateCarrierPrefix(nationalNumber, countryCode)) {
          trace.push({
            scope: 'carrier-validation',
            url,
            step: 'filtered',
            status: 'SKIPPED',
            note: `Phone ${phone.e164} does not match valid carrier prefixes for ${country}`,
            durationMs: 0
          });
          continue; // Skip invalid carrier numbers
        }
        
        // Add carrier information
        phone.carrier = getCarrierName(nationalNumber, countryCode);
      }
      
      // Add recruitment context
      phone.companyName = companyInfo.companyName;
      phone.companySource = companyInfo.source;
      phone.companyConfidence = companyInfo.confidence;
      
      if (recruitmentContext.matched) {
        phone.recruitmentEvidence = recruitmentContext.keywords.join(', ');
        phone.recruitmentConfidence = recruitmentContext.confidence;
      }
      
      phones.push(phone);
    }
    
    // Process WhatsApp numbers
    for (const wa of phoneResults.whatsapp) {
      if (isLikelyFakePhone(wa.e164, wa.local)) {
        continue;
      }

      if (carrierAware && countryCode) {
        const nationalNumber = getNationalNumber(wa);
        
        if (nationalNumber && !validateCarrierPrefix(nationalNumber, countryCode)) {
          trace.push({
            scope: 'carrier-validation',
            url,
            step: 'filtered',
            status: 'SKIPPED',
            note: `WhatsApp ${wa.e164} does not match valid carrier prefixes for ${country}`,
            durationMs: 0
          });
          continue;
        }
        
        wa.carrier = getCarrierName(nationalNumber, countryCode);
      }
      
      // Add recruitment context
      wa.companyName = companyInfo.companyName;
      wa.companySource = companyInfo.source;
      wa.companyConfidence = companyInfo.confidence;
      
      if (recruitmentContext.matched) {
        wa.recruitmentEvidence = recruitmentContext.keywords.join(', ');
        wa.recruitmentConfidence = recruitmentContext.confidence;
      }
      
      whatsapp.push(wa);
    }
    
    // Add recruitment trace
    if (recruitmentContext.matched) {
      trace.push({
        scope: 'recruitment-detection',
        url,
        step: 'matched',
        status: 'SUCCESS',
        note: `Recruitment page detected: ${recruitmentContext.keywords.join(', ')}`,
        confidence: recruitmentContext.confidence,
        durationMs: 0
      });
    }
    
    trace.push(...(phoneResults.trace || []));
    
    const duration = Date.now() - startTime;
    
    trace.push({
      scope: 'recruitment-extract',
      url,
      step: 'complete',
      status: 'SUCCESS',
      count: phones.length + whatsapp.length,
      durationMs: duration,
      note: `Extracted ${phones.length} phones, ${whatsapp.length} WhatsApp from recruitment page`
    });
    
    logger.info(`[RECRUITMENT-EXTRACT] Extraction complete: ${phones.length} phones, ${whatsapp.length} WhatsApp from ${url}`);
    
    return { phones, whatsapp, companies, trace };
    
  } catch (error) {
    logger.error(`[RECRUITMENT-EXTRACT] Error extracting from ${url}:`, error);
    return {
      phones: [],
      whatsapp: [],
      companies: [],
      trace: [{
        scope: 'recruitment-extract',
        url,
        step: 'error',
        status: 'ERROR',
        note: error.message,
        durationMs: Date.now() - startTime
      }]
    };
  }
}
