import logger from '../config/logger.js';

/**
 * Detects mock/example domains and URLs in search results
 * @param {Array} results - Array of search result objects
 * @returns {Object} - { verified: [], examples: [], trace: [] }
 */
export function detectMockRows(results) {
  const verified = [];
  const examples = [];
  const trace = [];
  
  logger.info(`[MOCK-DETECT] Analyzing ${results.length} results for mock/example domains`);
  
  for (const result of results) {
    const mockDetection = analyzeResult(result);
    
    if (mockDetection.isMock) {
      result.example = true;
      result.exampleReason = mockDetection.reason;
      examples.push(result);
      
      trace.push({
        scope: 'verify',
        step: 'mock-detect',
        domain: result.domain || result.url,
        status: 'SKIP',
        note: `Mock domain detected: ${mockDetection.reason}`,
        timestamp: new Date().toISOString()
      });
      
      logger.debug(`[MOCK-DETECT] Marked as mock: ${result.domain || result.url} - ${mockDetection.reason}`);
    } else {
      verified.push(result);
    }
  }
  
  logger.info(`[MOCK-DETECT] Detection complete: ${verified.length} verified, ${examples.length} examples`);
  
  return {
    verified,
    examples,
    trace,
    summary: {
      total: results.length,
      verified: verified.length,
      examples: examples.length
    }
  };
}

/**
 * Analyzes a single result to determine if it's a mock/example
 * @param {Object} result - Single search result object
 * @returns {Object} - { isMock: boolean, reason: string }
 */
function analyzeResult(result) {
  const domain = result.domain || extractDomainFromUrl(result.url);
  const url = result.url || '';
  const title = result.title || '';
  const snippet = result.snippet || '';
  const email = result.email || '';
  
  // Check domain patterns
  const mockDomainPatterns = [
    /example\./i,
    /mock/i,
    /test\./i,
    /placeholder/i,
    /dev\./i,
    /localhost/i,
    /\.local$/i,
    /\.test$/i,
    /demo\./i,
    /sample\./i,
    /dummy\./i,
    /fake\./i
  ];
  
  if (domain) {
    for (const pattern of mockDomainPatterns) {
      if (pattern.test(domain)) {
        return {
          isMock: true,
          reason: `Domain matches mock pattern: ${domain}`
        };
      }
    }
  }
  
  // Check URL patterns
  const mockUrlPatterns = [
    /\/example\//i,
    /\/demo\//i,
    /\/test\//i,
    /\/placeholder\//i,
    /\/mock\//i
  ];
  
  for (const pattern of mockUrlPatterns) {
    if (pattern.test(url)) {
      return {
        isMock: true,
        reason: `URL contains mock path: ${url}`
      };
    }
  }
  
  // Check content patterns
  const mockContentPatterns = [
    /this is an example/i,
    /lorem ipsum/i,
    /placeholder text/i,
    /sample content/i,
    /demo content/i,
    /test page/i,
    /example site/i,
    /mock data/i
  ];
  
  const content = `${title} ${snippet}`.toLowerCase();
  for (const pattern of mockContentPatterns) {
    if (pattern.test(content)) {
      return {
        isMock: true,
        reason: `Content matches mock pattern: ${pattern.source}`
      };
    }
  }
  
  // Check email patterns
  if (email) {
    const mockEmailPatterns = [
      /@example\./i,
      /@mock\./i,
      /@test\./i,
      /@demo\./i,
      /@sample\./i,
      /@placeholder\./i,
      /@dummy\./i
    ];
    
    for (const pattern of mockEmailPatterns) {
      if (pattern.test(email)) {
        return {
          isMock: true,
          reason: `Email matches mock pattern: ${email}`
        };
      }
    }
  }
  
  // Check for common example domains
  const commonExampleDomains = [
    'example.com',
    'example.org',
    'example.net',
    'test.com',
    'mock.com',
    'demo.com',
    'sample.com',
    'placeholder.com',
    'dummy.com',
    'fake.com'
  ];
  
  if (domain && commonExampleDomains.includes(domain.toLowerCase())) {
    return {
      isMock: true,
      reason: `Known example domain: ${domain}`
    };
  }
  
  return {
    isMock: false,
    reason: 'No mock patterns detected'
  };
}

/**
 * Extracts domain from URL
 * @param {string} url - URL string
 * @returns {string} - Extracted domain or empty string
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

/**
 * Checks if a domain should be excluded based on common filters
 * @param {string} domain - Domain to check
 * @param {Object} options - Filter options
 * @returns {boolean} - True if domain should be excluded
 */
export function shouldExcludeDomain(domain, options = {}) {
  if (!domain) return true;
  
  const {
    excludeJobBoards = true,
    excludeWebmail = true,
    excludeSubdomains = false
  } = options;
  
  // Job board domains
  if (excludeJobBoards) {
    const jobBoardDomains = [
      'linkedin.com',
      'indeed.com',
      'glassdoor.com',
      'monster.com',
      'bayt.com',
      'gulftalent.com',
      'wuzzuf.net',
      'jooble.org'
    ];
    
    if (jobBoardDomains.includes(domain.toLowerCase())) {
      return true;
    }
  }
  
  // Webmail domains
  if (excludeWebmail) {
    const webmailDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'aol.com',
      'icloud.com',
      'protonmail.com',
      'zoho.com'
    ];
    
    if (webmailDomains.includes(domain.toLowerCase())) {
      return true;
    }
  }
  
  // Exclude subdomains if requested
  if (excludeSubdomains && domain.split('.').length > 2) {
    return true;
  }
  
  return false;
}
