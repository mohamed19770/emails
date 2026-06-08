/**
 * Company name extraction from web pages
 */

import * as cheerio from 'cheerio';

/**
 * Extract company name from HTML content
 * @param {string} html - HTML content
 * @param {string} url - Page URL
 * @returns {Object} - { companyName: string, source: string, confidence: number }
 */
export function extractCompanyName(html, url) {
  const $ = cheerio.load(html);
  
  // Priority 1: JSON-LD Organization/LocalBusiness
  const jsonLdName = extractFromJsonLd($);
  if (jsonLdName) {
    return {
      companyName: jsonLdName,
      source: 'json-ld',
      confidence: 95
    };
  }
  
  // Priority 2: Open Graph meta tags
  const ogName = $('meta[property="og:site_name"]').attr('content') ||
                 $('meta[property="og:title"]').attr('content');
  if (ogName && ogName.length > 2) {
    return {
      companyName: cleanCompanyName(ogName),
      source: 'og-meta',
      confidence: 85
    };
  }
  
  // Priority 3: Title tag (cleaned)
  const title = $('title').text();
  if (title && title.length > 2) {
    const cleanTitle = cleanCompanyName(title);
    if (cleanTitle && cleanTitle.length > 2) {
      return {
        companyName: cleanTitle,
        source: 'title',
        confidence: 75
      };
    }
  }
  
  // Priority 4: Header/brand selectors
  const headerName = extractFromHeaderSelectors($);
  if (headerName) {
    return {
      companyName: headerName,
      source: 'header',
      confidence: 70
    };
  }
  
  // Fallback: eTLD+1 from URL
  try {
    const domain = new URL(url).hostname;
    const etldPlus1 = extractETLDPlus1(domain);
    if (etldPlus1) {
      return {
        companyName: etldPlus1,
        source: 'domain',
        confidence: 50
      };
    }
  } catch (e) {
    // Invalid URL
  }
  
  return {
    companyName: 'Unknown Company',
    source: 'fallback',
    confidence: 10
  };
}

/**
 * Extract company name from JSON-LD structured data
 */
function extractFromJsonLd($) {
  const scripts = $('script[type="application/ld+json"]');
  
  for (let i = 0; i < scripts.length; i++) {
    try {
      const jsonData = JSON.parse($(scripts[i]).html());
      
      // Handle array of JSON-LD objects
      const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
      
      for (const data of dataArray) {
        // Check for Organization
        if (data['@type'] === 'Organization' && data.name) {
          return cleanCompanyName(data.name);
        }
        
        // Check for LocalBusiness
        if (data['@type'] === 'LocalBusiness' && data.name) {
          return cleanCompanyName(data.name);
        }
        
        // Check nested objects
        if (data.organization && data.organization.name) {
          return cleanCompanyName(data.organization.name);
        }
        
        // Check publisher
        if (data.publisher && data.publisher.name) {
          return cleanCompanyName(data.publisher.name);
        }
      }
    } catch (e) {
      // Invalid JSON, continue to next script
      continue;
    }
  }
  
  return null;
}

/**
 * Extract company name from header/brand selectors
 */
function extractFromHeaderSelectors($) {
  const selectors = [
    '.logo img[alt]',
    '.site-title',
    '.brand',
    '.company-name',
    '.brand-name',
    'h1.brand',
    '.header-logo',
    '.site-logo',
    '[class*="logo"]',
    '[class*="brand"]'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      let name = element.attr('alt') || element.text();
      if (name && name.length > 2) {
        name = cleanCompanyName(name);
        if (name && name.length > 2) {
          return name;
        }
      }
    }
  }
  
  return null;
}

/**
 * Clean and normalize company name
 */
function cleanCompanyName(name) {
  if (!name) return null;
  
  // Remove common suffixes and prefixes
  let cleaned = name
    .replace(/^(home|homepage|welcome to|about|contact|careers|jobs|recruitment)\s*/i, '')
    .replace(/\s*(home|homepage|official website|website|company|corp|ltd|llc|inc|group|solutions|services|technologies|tech)\s*$/i, '')
    .replace(/\s*[-|–]\s*.*$/, '') // Remove everything after dash
    .replace(/\s*[\|\|]\s*.*$/, '') // Remove everything after pipe
    .trim();
  
  // Remove extra whitespace and normalize
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Convert to Title Case
  cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
  
  // Minimum length check
  if (cleaned.length < 2) return null;
  
  return cleaned;
}

/**
 * Extract eTLD+1 from domain
 */
function extractETLDPlus1(domain) {
  if (!domain) return null;
  
  const parts = domain.split('.');
  if (parts.length < 2) return null;
  
  // Get the last two parts (eTLD+1)
  const etldPlus1 = parts.slice(-2).join('.');
  
  // Remove common TLDs and clean
  let companyName = parts[parts.length - 2];
  
  // Remove common prefixes/suffixes
  companyName = companyName
    .replace(/^(www|app|portal|admin|api)\d*$/i, '')
    .replace(/^(the|a|an)\s+/i, '');
  
  if (!companyName) return null;
  
  // Convert to Title Case
  companyName = companyName.replace(/\b\w/g, l => l.toUpperCase());
  
  return companyName;
}
