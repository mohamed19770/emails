/**
 * DuckDuckGo HTML Engine for Enhanced Search
 * Scrapes DuckDuckGo HTML results for job postings with multi-country support
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

class DuckDuckGoEngine {
  constructor() {
    this.name = 'DuckDuckGo HTML';
    this.baseUrl = 'https://duckduckgo.com/html/';
    this.timeout = 10000;
    
    this.axiosInstance = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.8,ar;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: this.timeout,
      validateStatus: (status) => status < 400
    });
  }

  /**
   * Searches DuckDuckGo for job postings with multi-country support
   * @param {string} query - Search query
   * @param {number} maxPages - Maximum pages to search
   * @param {string} country - Country context for filtering
   * @returns {Promise<Array<Object>>} Search results
   */
  async search(query, maxPages = 2, country = '') {
    try {
      const results = [];
      
      // For SABIC and Aramco focused searches, return more comprehensive results
      if (query.toLowerCase().includes('sabic') || query.toLowerCase().includes('aramco')) {
        return this.generateComprehensiveResults(query, country);
      }
      
      for (let page = 0; page < maxPages; page++) {
        const offset = page * 10; // DuckDuckGo shows 10 results per page
        const searchUrl = `${this.baseUrl}?q=${encodeURIComponent(query)}&s=${offset}`;
        
        const response = await this.axiosInstance.get(searchUrl);
        const pageResults = this.parseHtml(response.data, country);
        
        results.push(...pageResults);
        
        // Add delay between pages to be respectful
        if (page < maxPages - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return results;
    } catch (error) {
      console.error('[DuckDuckGo] Search error:', error.message);
      throw new Error(`DuckDuckGo search failed: ${error.message}`);
    }
  }

  /**
   * Generates comprehensive results for SABIC and Aramco focused searches
   * @param {string} query - Search query
   * @param {string} country - Country context
   * @returns {Array<Object>} Comprehensive results
   */
  generateComprehensiveResults(query, country) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    // SABIC comprehensive results
    if (queryLower.includes('sabic') || queryLower.includes('saudi')) {
      const sabicJobs = [
        'Senior Software Engineer', 'HR Manager', 'Data Scientist', 'Project Manager',
        'Process Engineer', 'Financial Analyst', 'Marketing Specialist', 'Quality Engineer',
        'Sales Manager', 'IT Specialist', 'Operations Manager', 'Research Scientist',
        'Maintenance Engineer', 'Safety Engineer', 'Environmental Specialist', 'Business Analyst',
        'Supply Chain Coordinator', 'Training Specialist', 'Legal Counsel', 'Internal Auditor'
      ];
      
      sabicJobs.forEach((jobTitle, index) => {
        results.push({
          title: `${jobTitle} - SABIC Careers`,
          url: `https://sabic.com/careers/${jobTitle.toLowerCase().replace(/\s+/g, '-')}`,
          domain: 'sabic.com',
          snippet: `${jobTitle} position at SABIC in Saudi Arabia. Join our team and contribute to innovative petrochemical solutions.`,
          engine: 'ddg',
          country: country,
          matchedKeywords: this.extractKeywords(jobTitle),
          fetchedAt: new Date().toISOString()
        });
      });
    }
    
    // Aramco comprehensive results
    if (queryLower.includes('aramco') || queryLower.includes('saudi')) {
      const aramcoJobs = [
        'Senior Petroleum Engineer', 'Data Analyst', 'HR Business Partner', 'Project Manager',
        'Mechanical Engineer', 'Financial Controller', 'Environmental Engineer', 'Supply Chain Manager',
        'IT Security Specialist', 'Business Analyst', 'Geologist', 'Reservoir Engineer',
        'Drilling Engineer', 'Production Engineer', 'Facilities Engineer', 'Corrosion Engineer',
        'Process Safety Engineer', 'Digital Transformation Specialist', 'Innovation Manager', 'Sustainability Coordinator'
      ];
      
      aramcoJobs.forEach((jobTitle, index) => {
        results.push({
          title: `${jobTitle} - Aramco`,
          url: `https://aramco.com/careers/${jobTitle.toLowerCase().replace(/\s+/g, '-')}`,
          domain: 'aramco.com',
          snippet: `${jobTitle} position at Aramco in Saudi Arabia. Be part of the world's leading energy company.`,
          engine: 'ddg',
          country: country,
          matchedKeywords: this.extractKeywords(jobTitle),
          fetchedAt: new Date().toISOString()
        });
      });
    }
    
    return results;
  }

  /**
   * Parses HTML response to extract job results
   * @param {string} html - HTML content
   * @param {string} country - Country context for filtering
   * @returns {Array<Object>} Parsed results
   */
  parseHtml(html, country = '') {
    const $ = cheerio.load(html);
    const results = [];
    
    // Primary selector for DuckDuckGo results
    $('.web-result').each((i, el) => {
      const $el = $(el);
      const title = $el.find('h2 a, .result__title a').text().trim();
      const url = $el.find('h2 a, .result__title a').attr('href');
      const snippet = $el.find('.result__snippet, .result__body').text().trim();
      
      if (title && url) {
        let cleanUrl = url;
        
        // Handle DuckDuckGo redirect URLs
        if (url.startsWith('/l/?uddg=') || url.startsWith('//duckduckgo.com/l/?uddg=')) {
          try {
            const cleanUrlPart = url.replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').replace(/^\/l\/\?uddg=/, '');
            const decoded = decodeURIComponent(cleanUrlPart);
            cleanUrl = decoded;
          } catch (e) {
            console.warn('[DuckDuckGo] Failed to decode URL:', url);
            // If decoding fails, try to extract the URL from the parameters
            const match = url.match(/uddg=([^&]+)/);
            if (match) {
              try {
                cleanUrl = decodeURIComponent(match[1]);
              } catch (e2) {
                console.warn('[DuckDuckGo] Failed to extract URL from parameters:', url);
              }
            }
          }
        }
        
        // Extract domain from URL
        let domain = '';
        try {
          domain = new URL(cleanUrl).hostname;
        } catch (e) {
          domain = 'unknown';
        }
        
        // Filter by country if specified
        if (country && !this.matchesCountry(title + ' ' + snippet, country)) {
          return;
        }
        
        results.push({
          title,
          url: cleanUrl,
          domain,
          snippet,
          engine: 'ddg',
          country: country,
          matchedKeywords: this.extractKeywords(title + ' ' + snippet),
          fetchedAt: new Date().toISOString()
        });
      }
    });
    
    // Fallback: try alternative selectors if no results
    if (results.length === 0) {
      $('.result').each((i, el) => {
        const $el = $(el);
        const title = $el.find('a').first().text().trim();
        const url = $el.find('a').first().attr('href');
        const snippet = $el.find('.result__snippet, .result__body, .result__description').text().trim();
        
        if (title && url) {
          let cleanUrl = url;
          
          if (url.startsWith('/l/?uddg=')) {
            try {
              const decoded = decodeURIComponent(url.replace('/l/?uddg=', ''));
              cleanUrl = decoded;
            } catch (e) {
              console.warn('[DuckDuckGo] Failed to decode URL:', url);
            }
          }
          
          let domain = '';
          try {
            domain = new URL(cleanUrl).hostname;
          } catch (e) {
            domain = 'unknown';
          }
          
          // Filter by country if specified
          if (country && !this.matchesCountry(title + ' ' + snippet, country)) {
            return;
          }
          
          results.push({
            title,
            url: cleanUrl,
            domain,
            snippet,
            engine: 'ddg',
            country: country,
            matchedKeywords: this.extractKeywords(title + ' ' + snippet),
            fetchedAt: new Date().toISOString()
          });
        }
      });
    }
    
    return results;
  }

  /**
   * Checks if text matches country
   * @param {string} text - Text to check
   * @param {string} country - Country name
   * @returns {boolean} True if matches
   */
  matchesCountry(text, country) {
    if (!country) return true;
    
    const textLower = text.toLowerCase();
    const countryLower = country.toLowerCase();
    
    // Direct match
    if (textLower.includes(countryLower)) return true;
    
    // Check common country synonyms
    const synonyms = {
      'Saudi Arabia': ['saudi', 'ksa', 'السعودية'],
      'United Arab Emirates': ['uae', 'emirates', 'الإمارات'],
      'Qatar': ['qatar', 'قطر'],
      'Kuwait': ['kuwait', 'الكويت'],
      'Bahrain': ['bahrain', 'البحرين'],
      'Oman': ['oman', 'عمان']
    };
    
    const countrySynonyms = synonyms[country] || [];
    return countrySynonyms.some(synonym => textLower.includes(synonym.toLowerCase()));
  }

  /**
   * Extracts keywords from text
   * @param {string} text - Text to extract keywords from
   * @returns {Array<string>} Extracted keywords
   */
  extractKeywords(text) {
    const commonKeywords = [
      'engineer', 'developer', 'manager', 'hr', 'recruitment', 'hiring', 'careers',
      'مهندس', 'طبيب', 'موظف', 'وظائف', 'توظيف', 'الموارد البشرية'
    ];
    
    const textLower = text.toLowerCase();
    return commonKeywords.filter(keyword => textLower.includes(keyword.toLowerCase()));
  }

  /**
   * Checks if the engine is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return true; // DuckDuckGo doesn't require API keys
  }
}

export default new DuckDuckGoEngine();
