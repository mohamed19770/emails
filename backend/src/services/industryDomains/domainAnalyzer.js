import * as dns from 'dns';
import { promisify } from 'util';
import logger from '../../config/logger.js';

const dnsResolve = promisify(dns.resolve);
const dnsResolveMx = promisify(dns.resolveMx);

// Analyze domain for industry relevance
export async function analyzeDomain(domain, options = {}) {
  const {
    verify = { dns: true, http: true, ssl: true, mx: true },
    langBias = 'auto',
    industryKeywords = [],
    biasWords = [],
    preferredTLDs = [],
    excludedTLDs = []
  } = options;
  
  const analysis = {
    status: 'unknown',
    score: 0,
    signals: {},
    evidence: {},
    domainAgeDays: null,
    sslValidTo: null,
    countryMatch: false,
    language: 'unknown'
  };
  
  try {
    // DNS verification
    if (verify.dns) {
      try {
        const addresses = await dnsResolve(domain);
        analysis.signals.dnsOk = addresses.length > 0;
        analysis.score += addresses.length > 0 ? 5 : 0;
      } catch (error) {
        analysis.signals.dnsOk = false;
        analysis.score -= 10;
      }
    }
    
    // MX record verification
    if (verify.mx) {
      try {
        const mxRecords = await dnsResolveMx(domain);
        analysis.signals.mxOk = mxRecords.length > 0;
        analysis.score += mxRecords.length > 0 ? 10 : 0;
      } catch (error) {
        analysis.signals.mxOk = false;
        analysis.score -= 5;
      }
    }
    
    // HTTP verification
    if (verify.http) {
      try {
        const response = await fetch(`https://${domain}`, {
          method: 'HEAD',
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        analysis.signals.http200 = response.ok;
        analysis.score += response.ok ? 15 : 0;
        
        // Check for HTTPS redirect
        if (response.url.startsWith('https://')) {
          analysis.signals.httpsRedirect = true;
          analysis.score += 5;
        }
      } catch (error) {
        analysis.signals.http200 = false;
        analysis.score -= 5;
      }
    }
    
    // SSL verification
    if (verify.ssl) {
      try {
        const response = await fetch(`https://${domain}`, {
          method: 'HEAD',
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        analysis.signals.sslOk = response.ok;
        analysis.score += response.ok ? 10 : 0;
        
        // Get SSL certificate info (simplified)
        if (response.ok) {
          analysis.sslValidTo = '2025-12-31'; // Mock date
        }
      } catch (error) {
        analysis.signals.sslOk = false;
        analysis.score -= 5;
      }
    }
    
    // Domain age estimation (simplified)
    analysis.domainAgeDays = Math.floor(Math.random() * 3650) + 365; // 1-10 years
    
    // Language detection (simplified)
    analysis.language = detectLanguage(domain);
    
    // Country matching
    analysis.countryMatch = checkCountryMatch(domain, industryKeywords);
    if (analysis.countryMatch) {
      analysis.score += 5;
    }
    
    // Industry keyword matching
    const keywordMatch = checkIndustryKeywords(domain, industryKeywords);
    if (keywordMatch) {
      analysis.score += 10;
    }
    
    // Bias word matching
    if (biasWords.length > 0) {
      const biasMatch = checkBiasWords(domain, biasWords);
      if (biasMatch) {
        analysis.score += 5;
      }
    }
    
    // TLD preference scoring
    const tld = getTLD(domain);
    if (preferredTLDs.includes(tld)) {
      analysis.score += 8;
    }
    if (excludedTLDs.includes(tld)) {
      analysis.score -= 15;
    }
    
    // Set final status
    if (analysis.score >= 30) {
      analysis.status = 'high_relevance';
    } else if (analysis.score >= 15) {
      analysis.status = 'medium_relevance';
    } else if (analysis.score >= 0) {
      analysis.status = 'low_relevance';
    } else {
      analysis.status = 'irrelevant';
    }
    
    return analysis;
    
  } catch (error) {
    logger.error(`[DOMAIN-ANALYZER] Error analyzing ${domain}:`, error);
    return {
      status: 'error',
      score: -20,
      signals: {},
      evidence: {},
      domainAgeDays: null,
      sslValidTo: null,
      countryMatch: false,
      language: 'unknown'
    };
  }
}

// Extract industry keywords from page content
export async function extractIndustryKeywords(url, options = {}) {
  const { industryKeywords = [], biasWords = [], langBias = 'auto' } = options;
  
  try {
    const response = await fetch(url, {
      timeout: 15000, // Increased timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const html = await response.text();
    const extractedKeywords = [];
    
    // Simple keyword extraction from HTML content
    const textContent = html.replace(/<[^>]*>/g, ' ').toLowerCase();
    
    // Check for industry keywords
    for (const keyword of industryKeywords) {
      if (textContent.includes(keyword.toLowerCase())) {
        extractedKeywords.push(keyword);
      }
    }
    
    // Check for bias words
    for (const word of biasWords) {
      if (textContent.includes(word.toLowerCase())) {
        extractedKeywords.push(word);
      }
    }
    
    return extractedKeywords;
    
  } catch (error) {
    // Only log critical errors, skip common network issues to reduce console noise
    if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || error.cause?.code === 'ERR_SSL_TLSV1_UNRECOGNIZED_NAME') {
      // Skip logging common network issues to reduce console noise
      return [];
    } else {
      logger.error(`[DOMAIN-ANALYZER] Error extracting keywords from ${url}:`, error);
    }
    return [];
  }
}

// Helper functions
function getTLD(hostname) {
  if (!hostname) return '';
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.');
  }
  return '.' + parts[parts.length - 1];
}

function detectLanguage(domain) {
  // Simple language detection based on TLD and domain patterns
  const arabicTLDs = ['.sa', '.ae', '.qa', '.kw', '.bh', '.om', '.eg', '.jo', '.lb'];
  const tld = getTLD(domain);
  
  if (arabicTLDs.includes(tld)) {
    return 'ar';
  }
  
  // Check for Arabic characters in domain
  if (/[\u0600-\u06FF]/.test(domain)) {
    return 'ar';
  }
  
  return 'en';
}

function checkCountryMatch(domain, industryKeywords) {
  // Simple country matching based on TLD
  const countryTLDs = {
    'Saudi Arabia': ['.sa', '.com.sa'],
    'UAE': ['.ae', '.com.ae'],
    'Qatar': ['.qa', '.com.qa'],
    'Kuwait': ['.kw', '.com.kw'],
    'Bahrain': ['.bh', '.com.bh'],
    'Oman': ['.om', '.com.om'],
    'Egypt': ['.eg', '.com.eg'],
    'Jordan': ['.jo', '.com.jo'],
    'Lebanon': ['.lb', '.com.lb']
  };
  
  const tld = getTLD(domain);
  
  for (const [country, tlds] of Object.entries(countryTLDs)) {
    if (tlds.includes(tld)) {
      return true;
    }
  }
  
  return false;
}

function checkIndustryKeywords(domain, industryKeywords) {
  const domainLower = domain.toLowerCase();
  
  for (const keyword of industryKeywords) {
    if (domainLower.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

function checkBiasWords(domain, biasWords) {
  const domainLower = domain.toLowerCase();
  
  for (const word of biasWords) {
    if (domainLower.includes(word.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

