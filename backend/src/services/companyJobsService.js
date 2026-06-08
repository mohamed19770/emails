/**
 * Company Jobs Extractor Service
 * 
 * Extracts job listings from company websites with Safe Mode protections
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

class CompanyJobsService {
  constructor() {
    this.config = {
      GLOBAL_CONCURRENCY: 3,
      PER_DOMAIN_CONCURRENCY: 1,
      REQUEST_DELAY_PER_DOMAIN: 6000, // 6 seconds
      TIMEOUT: 10000, // 10 seconds
      CACHE_TTL: 30 * 60 * 1000, // 30 minutes
      BACKOFF_DURATION: 2 * 60 * 60 * 1000, // 2 hours
      USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    
    this.cache = new Map();
    this.backoffDomains = new Map();
    this.activeRequests = new Map();
  }

  /**
   * Main extraction method
   */
  async extractJobs(params) {
    const { country, cities = [], domains = [], keyword = '' } = params;
    
    if (!domains || domains.length === 0) {
      throw new Error('No domains provided');
    }

    const results = [];
    const logs = {};
    const startTime = Date.now();

    // Process domains with concurrency control
    const domainBatches = this.chunkArray(domains, this.config.PER_DOMAIN_CONCURRENCY);
    
    for (const batch of domainBatches) {
      const batchPromises = batch.map(domain => this.processDomain(domain, country, cities, keyword));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const domain = batch[index];
        if (result.status === 'fulfilled') {
          results.push(...result.value.jobs);
          logs[domain] = result.value.log;
        } else {
          logs[domain] = `❌ Error: ${result.reason.message}`;
        }
      });

      // Delay between batches
      if (domainBatches.indexOf(batch) < domainBatches.length - 1) {
        await this.delay(this.config.REQUEST_DELAY_PER_DOMAIN);
      }
    }

    // Deduplicate by URL
    const uniqueJobs = this.deduplicateJobs(results);

    return {
      ok: true,
      count: uniqueJobs.length,
      items: uniqueJobs,
      logs,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Process a single domain
   */
  async processDomain(domain, country, cities, keyword) {
    const domainKey = domain.toLowerCase();
    
    // Check backoff
    if (this.backoffDomains.has(domainKey)) {
      const backoffUntil = this.backoffDomains.get(domainKey);
      if (Date.now() < backoffUntil) {
        return { jobs: [], log: `⏳ Domain in backoff until ${new Date(backoffUntil).toISOString()}` };
      }
      this.backoffDomains.delete(domainKey);
    }

    // Check cache
    if (this.cache.has(domainKey)) {
      const cached = this.cache.get(domainKey);
      if (Date.now() - cached.timestamp < this.config.CACHE_TTL) {
        return { jobs: cached.jobs, log: `📋 Cached results (${cached.jobs.length} jobs)` };
      }
      this.cache.delete(domainKey);
    }

    try {
      const careersUrl = await this.findCareersPage(domain);
      if (!careersUrl) {
        return { jobs: [], log: '❌ No careers page found' };
      }

      const jobs = await this.extractJobsFromPage(careersUrl, domain, country, cities, keyword);
      
      // Cache results
      this.cache.set(domainKey, {
        jobs,
        timestamp: Date.now()
      });

      return { 
        jobs, 
        log: `✓ ${careersUrl} found, ${jobs.length} jobs extracted` 
      };

    } catch (error) {
      // Handle rate limiting
      if (error.response?.status === 429 || error.response?.status === 403) {
        this.backoffDomains.set(domainKey, Date.now() + this.config.BACKOFF_DURATION);
        return { jobs: [], log: `⏳ Rate limited, backoff for 2 hours` };
      }
      
      throw error;
    }
  }

  /**
   * Find careers page for a domain
   */
  async findCareersPage(domain) {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const commonPaths = [
      '/careers',
      '/jobs',
      '/join-us',
      '/en/careers',
      '/work-with-us',
      '/careers/',
      '/jobs/'
    ];

    // Try common paths first
    for (const path of commonPaths) {
      try {
        const url = `${baseUrl}${path}`;
        const response = await this.makeRequest(url);
        if (response.status === 200) {
          return url;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    // Try homepage for career links
    try {
      const response = await this.makeRequest(baseUrl);
      const $ = cheerio.load(response.data);
      
      const careerLinks = $('a[href*="career"], a[href*="job"], a[href*="join"]')
        .map((i, el) => $(el).attr('href'))
        .get()
        .filter(href => href && !href.startsWith('mailto:') && !href.startsWith('tel:'));

      if (careerLinks.length > 0) {
        const firstLink = careerLinks[0];
        return firstLink.startsWith('http') ? firstLink : `${baseUrl}${firstLink}`;
      }
    } catch (error) {
      // Continue to sitemap check
    }

    // Try sitemap.xml
    try {
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
      const response = await this.makeRequest(sitemapUrl);
      const $ = cheerio.load(response.data, { xmlMode: true });
      
      const careerUrls = $('loc')
        .map((i, el) => $(el).text())
        .get()
        .filter(url => url.includes('career') || url.includes('job'));

      if (careerUrls.length > 0) {
        return careerUrls[0];
      }
    } catch (error) {
      // No sitemap or no career URLs
    }

    return null;
  }

  /**
   * Extract jobs from a careers page
   */
  async extractJobsFromPage(url, source, country, cities, keyword) {
    const response = await this.makeRequest(url);
    const $ = cheerio.load(response.data);
    
    const jobs = [];
    
    // Find job links
    $('a').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (!href || !text) return;
      
      // Check if this looks like a job link
      const jobKeywords = ['job', 'career', 'apply', 'position', 'vacancy', 'opening', 'role'];
      const isJobLink = jobKeywords.some(keyword => 
        text.toLowerCase().includes(keyword) || 
        href.toLowerCase().includes(keyword)
      );
      
      if (!isJobLink) return;
      
      // Make URL absolute
      const absoluteUrl = href.startsWith('http') ? href : new URL(href, url).href;
      
      // Extract location from nearby text
      const location = this.extractLocation($el, $);
      
      // Filter by country
      const countryMatch = this.matchesCountry(location, country);
      if (!countryMatch) return;
      
      // Filter by cities
      const cityMatch = cities.length > 0 ? this.matchesCities(location, cities) : null;
      if (cities.length > 0 && !cityMatch) return;
      
      // Filter by keyword
      if (keyword && !text.toLowerCase().includes(keyword.toLowerCase()) && 
          !location.toLowerCase().includes(keyword.toLowerCase())) {
        return;
      }
      
      jobs.push({
        title: text,
        url: absoluteUrl,
        source,
        location: location || 'Unknown',
        countryMatch,
        cityMatch,
        fetchedAt: new Date().toISOString()
      });
    });
    
    return jobs;
  }

  /**
   * Extract location from element and nearby elements
   */
  extractLocation($el, $) {
    // Try parent elements
    let location = '';
    $el.parents().each((i, parent) => {
      const text = $(parent).text();
      if (text.includes('Riyadh') || text.includes('Jeddah') || text.includes('Dammam') ||
          text.includes('Doha') || text.includes('Kuwait') || text.includes('Dubai')) {
        location = text.trim();
        return false; // Break
      }
    });
    
    if (location) return location;
    
    // Try sibling elements
    const siblings = $el.siblings();
    for (let i = 0; i < siblings.length; i++) {
      const text = $(siblings[i]).text();
      if (text.includes('Riyadh') || text.includes('Jeddah') || text.includes('Dammam') ||
          text.includes('Doha') || text.includes('Kuwait') || text.includes('Dubai')) {
        return text.trim();
      }
    }
    
    return 'Unknown';
  }

  /**
   * Check if location matches country
   */
  matchesCountry(location, country) {
    if (!location) return false;
    
    const locationLower = location.toLowerCase();
    const countryLower = country.toLowerCase();
    
    // Direct match
    if (locationLower.includes(countryLower)) return true;
    
    // Country synonyms
    const synonyms = {
      'saudi arabia': ['saudi', 'ksa', 'السعودية', 'saudi arabia'],
      'qatar': ['qatar', 'قطر'],
      'kuwait': ['kuwait', 'الكويت'],
      'uae': ['uae', 'united arab emirates', 'dubai', 'abu dhabi', 'الإمارات'],
      'bahrain': ['bahrain', 'البحرين'],
      'oman': ['oman', 'عمان']
    };
    
    const countrySynonyms = synonyms[countryLower] || [countryLower];
    return countrySynonyms.some(synonym => locationLower.includes(synonym));
  }

  /**
   * Check if location matches any of the cities
   */
  matchesCities(location, cities) {
    if (!location || cities.length === 0) return null;
    
    const locationLower = location.toLowerCase();
    return cities.find(city => locationLower.includes(city.toLowerCase()));
  }

  /**
   * Make HTTP request with protections
   */
  async makeRequest(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.TIMEOUT);
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.config.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: this.config.TIMEOUT,
        signal: controller.signal,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Deduplicate jobs by URL
   */
  deduplicateJobs(jobs) {
    const seen = new Set();
    return jobs.filter(job => {
      if (seen.has(job.url)) return false;
      seen.add(job.url);
      return true;
    });
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility: Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.backoffDomains.clear();
  }
}

module.exports = new CompanyJobsService();
