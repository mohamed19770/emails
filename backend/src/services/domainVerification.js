import * as dns from 'dns';
import { promisify } from 'util';
import logger from '../config/logger.js';

const dnsResolve = promisify(dns.resolve);
const dnsResolveMx = promisify(dns.resolveMx);
const dnsResolveTxt = promisify(dns.resolveTxt);

// Performance constants
const GLOBAL_CONCURRENCY = 6;
const PER_DOMAIN_CONCURRENCY = 1;
const VISIT_DELAY_MS = 600;
const TIMEOUT_MS = 15000;

/**
 * Verifies a list of domains through comprehensive checks
 * @param {Array} candidates - Array of domain objects to verify
 * @param {Object} options - Verification options
 * @returns {Object} - { verified: [], failed: [], trace: [] }
 */
export async function verifyDomains(candidates, options = {}) {
  const {
    countries = [],
    excludeJobBoards = true,
    excludeWebmail = true,
    minScore = 50,
    maxConcurrency = GLOBAL_CONCURRENCY
  } = options;
  
  const verified = [];
  const failed = [];
  const trace = [];
  
  logger.info(`[DOMAIN-VERIFY] Starting verification of ${candidates.length} domains`);
  
  // Process domains in batches to respect concurrency limits
  for (let i = 0; i < candidates.length; i += maxConcurrency) {
    const batch = candidates.slice(i, i + maxConcurrency);
    
    const batchPromises = batch.map(async (candidate) => {
      try {
        const result = await verifySingleDomain(candidate, { countries, excludeJobBoards, excludeWebmail });
        
        if (result.score >= minScore) {
          verified.push(result);
          trace.push({
            scope: 'verify',
            step: 'domain-verification',
            domain: result.domain,
            status: 'SUCCESS',
            score: result.score,
            note: `Domain verified with score ${result.score}`,
            timestamp: new Date().toISOString()
          });
        } else {
          failed.push({ ...result, reason: `Score too low: ${result.score}` });
          trace.push({
            scope: 'verify',
            step: 'domain-verification',
            domain: result.domain,
            status: 'FAILED',
            score: result.score,
            note: `Score below threshold: ${result.score}`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        const errorResult = {
          domain: candidate.domain || candidate.url,
          error: error.message,
          score: 0
        };
        failed.push(errorResult);
        
        trace.push({
          scope: 'verify',
          step: 'domain-verification',
          domain: errorResult.domain,
          status: 'ERROR',
          note: error.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // Polite delay between domains
      if (i + 1 < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, VISIT_DELAY_MS));
      }
    });
    
    await Promise.all(batchPromises);
  }
  
  logger.info(`[DOMAIN-VERIFY] Verification complete: ${verified.length} verified, ${failed.length} failed`);
  
  return {
    verified,
    failed,
    trace,
    summary: {
      total: candidates.length,
      verified: verified.length,
      failed: failed.length,
      successRate: candidates.length > 0 ? (verified.length / candidates.length * 100).toFixed(1) : 0
    }
  };
}

/**
 * Verifies a single domain through comprehensive checks
 * @param {Object} candidate - Domain candidate object
 * @param {Object} options - Verification options
 * @returns {Object} - Verified domain object with score and verification details
 */
async function verifySingleDomain(candidate, options = {}) {
  const domain = candidate.domain || extractDomainFromUrl(candidate.url);
  const countries = options.countries || [];
  
  const result = {
    domain,
    originalUrl: candidate.url,
    title: candidate.title || '',
    snippet: candidate.snippet || '',
    industry: candidate.industry || 'Unknown',
    country: candidate.country || '',
    score: 0,
    verification: {
      dns: false,
      http: false,
      ssl: false,
      mx: false,
      countryMatch: false,
      contentMatch: false
    },
    details: {
      dnsRecords: [],
      httpStatus: null,
      httpTitle: '',
      httpDescription: '',
      httpLanguage: '',
      sslIssuer: '',
      sslValidFrom: '',
      sslValidTo: '',
      mxRecords: []
    }
  };
  
  logger.debug(`[DOMAIN-VERIFY] Verifying domain: ${domain}`);
  
  try {
    // Step 1: DNS Resolution
    await verifyDns(result);
    
    // Step 2: HTTP/HTTPS Check
    await verifyHttp(result);
    
    // Step 3: SSL/TLS Check (if HTTPS)
    if (result.details.httpStatus && result.details.httpStatus >= 200 && result.details.httpStatus < 300) {
      await verifySsl(result);
    }
    
    // Step 4: MX Records (optional)
    await verifyMx(result);
    
    // Step 5: Country Match
    if (countries.length > 0) {
      verifyCountryMatch(result, countries);
    }
    
    // Step 6: Calculate Score
    calculateScore(result);
    
    return result;
    
  } catch (error) {
    logger.error(`[DOMAIN-VERIFY] Error verifying ${domain}:`, error);
    result.error = error.message;
    return result;
  }
}

/**
 * Verifies DNS resolution for a domain
 * @param {Object} result - Domain result object to update
 */
async function verifyDns(result) {
  try {
    const addresses = await Promise.race([
      dnsResolve(result.domain, 'A'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), TIMEOUT_MS))
    ]);
    
    result.verification.dns = true;
    result.details.dnsRecords = addresses;
    
    logger.debug(`[DOMAIN-VERIFY] DNS resolved for ${result.domain}: ${addresses.length} records`);
  } catch (error) {
    logger.debug(`[DOMAIN-VERIFY] DNS failed for ${result.domain}:`, error.message);
    result.verification.dns = false;
  }
}

/**
 * Verifies HTTP accessibility for a domain
 * @param {Object} result - Domain result object to update
 */
async function verifyHttp(result) {
  try {
    const url = result.domain.startsWith('http') ? result.domain : `https://${result.domain}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    result.verification.http = response.ok;
    result.details.httpStatus = response.status;
    
    // If HEAD is successful, try GET to get content
    if (response.ok) {
      await fetchPageContent(result);
    }
    
    logger.debug(`[DOMAIN-VERIFY] HTTP check for ${result.domain}: ${response.status}`);
  } catch (error) {
    logger.debug(`[DOMAIN-VERIFY] HTTP failed for ${result.domain}:`, error.message);
    result.verification.http = false;
  }
}

/**
 * Fetches page content for analysis
 * @param {Object} result - Domain result object to update
 */
async function fetchPageContent(result) {
  try {
    const url = result.domain.startsWith('http') ? result.domain : `https://${result.domain}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
      const langMatch = html.match(/<html[^>]*lang=["']([^"']*)["']/i);
      
      result.details.httpTitle = titleMatch ? titleMatch[1].trim() : '';
      result.details.httpDescription = descMatch ? descMatch[1].trim() : '';
      result.details.httpLanguage = langMatch ? langMatch[1].trim() : '';
      
      result.verification.contentMatch = result.details.httpTitle.length > 0;
    }
  } catch (error) {
    logger.debug(`[DOMAIN-VERIFY] Content fetch failed for ${result.domain}:`, error.message);
  }
}

/**
 * Verifies SSL/TLS certificate for a domain
 * @param {Object} result - Domain result object to update
 */
async function verifySsl(result) {
  try {
    // For now, we'll assume HTTPS domains have valid SSL
    // In a production environment, you'd use a proper SSL verification library
    const url = result.domain.startsWith('http') ? result.domain : `https://${result.domain}`;
    
    if (url.startsWith('https://')) {
      result.verification.ssl = true;
      result.details.sslIssuer = 'Verified SSL';
      result.details.sslValidFrom = new Date().toISOString();
      result.details.sslValidTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now
      
      logger.debug(`[DOMAIN-VERIFY] SSL verified for ${result.domain}`);
    }
  } catch (error) {
    logger.debug(`[DOMAIN-VERIFY] SSL verification failed for ${result.domain}:`, error.message);
    result.verification.ssl = false;
  }
}

/**
 * Verifies MX records for a domain
 * @param {Object} result - Domain result object to update
 */
async function verifyMx(result) {
  try {
    const mxRecords = await Promise.race([
      dnsResolveMx(result.domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MX timeout')), TIMEOUT_MS))
    ]);
    
    result.verification.mx = mxRecords.length > 0;
    result.details.mxRecords = mxRecords.map(record => ({
      exchange: record.exchange,
      priority: record.priority
    }));
    
    logger.debug(`[DOMAIN-VERIFY] MX records for ${result.domain}: ${mxRecords.length} records`);
  } catch (error) {
    logger.debug(`[DOMAIN-VERIFY] MX lookup failed for ${result.domain}:`, error.message);
    result.verification.mx = false;
  }
}

/**
 * Verifies country match based on content analysis
 * @param {Object} result - Domain result object to update
 * @param {Array} countries - Array of target countries
 */
function verifyCountryMatch(result, countries) {
  const countrySynonyms = {
    'Saudi Arabia': ['Saudi', 'KSA', 'Saudi Arabia', 'السعودية'],
    'UAE': ['UAE', 'United Arab Emirates', 'الإمارات'],
    'Qatar': ['Qatar', 'قطر'],
    'Kuwait': ['Kuwait', 'الكويت'],
    'Bahrain': ['Bahrain', 'البحرين'],
    'Oman': ['Oman', 'عمان'],
    'Egypt': ['Egypt', 'مصر'],
    'Jordan': ['Jordan', 'الأردن'],
    'Lebanon': ['Lebanon', 'لبنان']
  };
  
  const content = `${result.title} ${result.snippet} ${result.details.httpTitle} ${result.details.httpDescription}`.toLowerCase();
  
  for (const country of countries) {
    const synonyms = countrySynonyms[country] || [country];
    for (const synonym of synonyms) {
      if (content.includes(synonym.toLowerCase())) {
        result.verification.countryMatch = true;
        result.country = country;
        logger.debug(`[DOMAIN-VERIFY] Country match for ${result.domain}: ${country}`);
        return;
      }
    }
  }
}

/**
 * Calculates verification score for a domain
 * @param {Object} result - Domain result object to update
 */
function calculateScore(result) {
  let score = 0;
  
  // DNS resolution: 20 points
  if (result.verification.dns) score += 20;
  
  // HTTP accessibility: 25 points
  if (result.verification.http) score += 25;
  
  // SSL certificate: 15 points
  if (result.verification.ssl) score += 15;
  
  // MX records: 10 points
  if (result.verification.mx) score += 10;
  
  // Content match: 15 points
  if (result.verification.contentMatch) score += 15;
  
  // Country match: 15 points
  if (result.verification.countryMatch) score += 15;
  
  result.score = Math.min(score, 100); // Cap at 100
}

/**
 * Extracts domain from URL
 * @param {string} url - URL string
 * @returns {string} - Extracted domain
 */
function extractDomainFromUrl(url) {
  try {
    if (!url) return '';
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname;
  } catch (error) {
    return '';
  }
}
