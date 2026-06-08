import { extractEmails } from './filters.js';
import logger from '../../config/logger.js';

// Performance constants
const GLOBAL_CONCURRENCY = 6;
const PER_DOMAIN_CONCURRENCY = 1;
const SERP_DELAY_MS = 600;
const VISIT_DELAY_MS = 600;
const TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const BACKOFF_429_403_MS = 30 * 60 * 1000; // 30 minutes

// In-memory cache for results
const cache = new Map();
const backoffDomains = new Map();
const domainCooldowns = new Map();

export class SiteExplorer {
  constructor(run, exploration) {
    this.run = run;
    this.exploration = {
      siteWide: true,
      depthLimit: 3,
      maxPagesPerDomainPerCycle: 40,
      recrawlDelayMinutes: 60,
      scope: 'inDomain',
      includePatterns: [],
      excludePatterns: [
        '/\\b(auth|login|logout|cart|checkout|subscribe)\\b/i',
        '/\\b(privacy|terms|cookies)\\b/i',
        '/\\b(tag|category|archive|calendar)\\b/i',
        '/\\?(utm_|fbclid|gclid)/i'
      ],
      excludeExtensions: [],
      heuristics: {
        preferHiringContact: true,
        preferMailto: true,
        downrankPagination: true
      },
      ...exploration
    };
    
    this.siteQueue = new Map(); // domain -> Set of URLs with depth
    this.serpQueue = new Map(); // engine -> Set of queries
    this.visitedUrls = new Set();
    this.domainCounters = new Map(); // domain -> count
    this.results = {
      emails: [],
      domains: new Set(),
      pagesVisited: 0,
      serpPagesFetched: 0,
      errors: 0,
      backoffs: 0,
      siteQueue: 0,
      serpQueue: 0,
      visitedTotal: 0
    };
  }

  async exploreSite(serpResults) {
    // Seed site queue from SERP results
    this.seedSiteQueue(serpResults);
    
    // Main exploration loop
    while (this.hasWorkToDo() && this.run.status === 'running') {
      await this.waitIfPaused();
      if (this.run.status === 'stopped') break;
      
      // Process site queue
      await this.processSiteQueue();
      
      // Process SERP queue if needed
      if (this.shouldReseed()) {
        await this.reseedSerp();
      }
      
      // Update counters
      this.updateCounters();
      
      // Polite delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.results;
  }

  seedSiteQueue(serpResults) {
    for (const result of serpResults) {
      const url = new URL(result.url);
      const domain = url.hostname;
      
      if (this.isInScope(url, domain)) {
        if (!this.siteQueue.has(domain)) {
          this.siteQueue.set(domain, new Set());
        }
        
        this.siteQueue.get(domain).add({
          url: result.url,
          depth: 0,
          title: result.title,
          htmlContent: result.htmlContent
        });
      }
    }
  }

  isInScope(url, domain) {
    const { scope } = this.exploration;
    
    switch (scope) {
      case 'inDomain':
        return true; // Already filtered by domain
      case 'sameOrg':
        // Allow subdomains with same eTLD+1
        const eTLD = this.getETLDPlus1(domain);
        return url.hostname.endsWith(eTLD);
      case 'external':
        return true; // Allow all external links
      default:
        return true;
    }
  }

  getETLDPlus1(domain) {
    const parts = domain.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return domain;
  }

  hasWorkToDo() {
    return this.siteQueue.size > 0 || this.serpQueue.size > 0;
  }

  shouldReseed() {
    return this.exploration.siteWide && 
           this.siteQueue.size === 0 && 
           this.serpQueue.size === 0;
  }

  async processSiteQueue() {
    const domains = Array.from(this.siteQueue.keys());
    
    for (const domain of domains) {
      if (this.run.status === 'stopped') break;
      
      // Check domain cooldown
      const cooldownUntil = domainCooldowns.get(domain);
      if (cooldownUntil && Date.now() < cooldownUntil) {
        continue;
      }
      
      // Check domain page limit
      const domainCount = this.domainCounters.get(domain) || 0;
      if (domainCount >= this.exploration.maxPagesPerDomainPerCycle) {
        this.setDomainCooldown(domain);
        continue;
      }
      
      const urls = this.siteQueue.get(domain);
      if (!urls || urls.size === 0) {
        this.siteQueue.delete(domain);
        continue;
      }
      
      // Process URLs for this domain
      const urlArray = Array.from(urls);
      for (const urlData of urlArray.slice(0, PER_DOMAIN_CONCURRENCY)) {
        if (this.run.status === 'stopped') break;
        
        await this.waitIfPaused();
        if (this.run.status === 'stopped') break;
        
        await this.processUrl(urlData, domain);
        
        // Remove processed URL
        urls.delete(urlData);
        
        // Polite delay
        await new Promise(resolve => setTimeout(resolve, VISIT_DELAY_MS));
      }
      
      if (urls.size === 0) {
        this.siteQueue.delete(domain);
      }
    }
  }

  async processUrl(urlData, domain) {
    const { url, depth, title, htmlContent } = urlData;
    
    try {
      // Check if already visited
      if (this.visitedUrls.has(url)) {
        return;
      }
      
      this.visitedUrls.add(url);
      this.results.visitedTotal++;
      this.results.pagesVisited++;
      
      // Update domain counter
      this.domainCounters.set(domain, (this.domainCounters.get(domain) || 0) + 1);
      
      // Send trace event
      this.sendTraceEvent({
        scope: 'visit',
        engine: 'site-explorer',
        country: 'N/A',
        url: url,
        status: 'started',
        durationMs: 0,
        note: `Exploring ${title} (depth ${depth})`
      });
      
      // Extract emails
      const emails = await this.extractEmailsFromPage(url, htmlContent);
      
      // Add emails to results
      for (const email of emails) {
        this.addEmail(email, url, title);
      }
      
      // Extract and score links for further exploration
      if (depth < this.exploration.depthLimit) {
        const links = await this.extractAndScoreLinks(url, htmlContent, depth + 1);
        this.addLinksToQueue(links, domain);
      }
      
      // Send trace event for completion
      this.sendTraceEvent({
        scope: 'visit',
        engine: 'site-explorer',
        country: 'N/A',
        url: url,
        status: 'completed',
        durationMs: 0,
        note: `Found ${emails.length} emails, ${links.length} links`
      });
      
    } catch (error) {
      this.results.errors++;
      logger.error(`[SITE-EXPLORER] Error processing ${url}:`, error);
      
      // Handle rate limiting
      if (error.status === 429 || error.status === 403) {
        this.setDomainCooldown(domain);
        this.results.backoffs++;
      }
      
      this.sendTraceEvent({
        scope: 'visit',
        engine: 'site-explorer',
        country: 'N/A',
        url: url,
        status: 'error',
        durationMs: 0,
        note: error.message
      });
    }
  }

  async extractEmailsFromPage(url, htmlContent) {
    try {
      // Check cache first
      const cacheKey = `page:${url}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.emails;
      }
      
      let html = htmlContent;
      
      if (!html) {
        // Fetch the page
        const response = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        html = await response.text();
      }
      
      // Extract emails using the filters module
      const emails = extractEmails(html, {
        prefixes: this.run.config.prefixes,
        maxEmailsPerDomain: this.run.config.maxEmailsPerDomain,
        countries: this.run.config.countries,
        locations: this.run.config.locations
      });
      
      // Cache the result
      cache.set(cacheKey, {
        emails,
        timestamp: Date.now()
      });
      
      return emails;
      
    } catch (error) {
      logger.error(`[SITE-EXPLORER] Error extracting emails from ${url}:`, error);
      return [];
    }
  }

  async extractAndScoreLinks(url, htmlContent, depth) {
    const links = [];
    
    try {
      // Parse HTML to extract links
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
      let match;
      
      while ((match = linkRegex.exec(htmlContent)) !== null) {
        const href = match[1];
        const anchorText = match[2];
        
        try {
          const linkUrl = new URL(href, url);
          const linkDomain = linkUrl.hostname;
          
          // Apply filters
          if (this.shouldExcludeLink(linkUrl, anchorText)) {
            continue;
          }
          
          // Check scope
          if (!this.isInScope(linkUrl, linkDomain)) {
            continue;
          }
          
          // Skip if already visited
          if (this.visitedUrls.has(linkUrl.href)) {
            continue;
          }
          
          // Score the link
          const score = this.scoreLink(linkUrl, anchorText, htmlContent);
          
          links.push({
            url: linkUrl.href,
            domain: linkDomain,
            depth: depth,
            score: score,
            anchorText: anchorText
          });
          
        } catch (e) {
          // Invalid URL, skip
          continue;
        }
      }
      
      // Sort by score and return top links
      return links
        .sort((a, b) => b.score - a.score)
        .slice(0, 30); // Top 30 links per page
      
    } catch (error) {
      logger.error(`[SITE-EXPLORER] Error extracting links from ${url}:`, error);
      return [];
    }
  }

  shouldExcludeLink(url, anchorText) {
    const { excludePatterns, excludeExtensions } = this.exploration;
    
    // Check exclude patterns
    for (const pattern of excludePatterns) {
      try {
        const regex = new RegExp(pattern.slice(1, -2), pattern.slice(-2));
        if (regex.test(url.href) || regex.test(anchorText)) {
          return true;
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
    
    // Check exclude extensions
    const pathname = url.pathname.toLowerCase();
    for (const ext of excludeExtensions) {
      if (pathname.endsWith(`.${ext}`)) {
        return true;
      }
    }
    
    return false;
  }

  scoreLink(url, anchorText, pageContent) {
    const { heuristics } = this.exploration;
    let score = 0;
    
    // Prefer pages containing hiring/contact words
    if (heuristics.preferHiringContact) {
      const hiringWords = /(career|job|join|work|وظائف|التوظيف|hiring|recruitment|apply|contact|mail|email)/i;
      if (hiringWords.test(anchorText) || hiringWords.test(url.href)) {
        score += 0.4;
      }
    }
    
    // Prefer pages with mailto: anchors
    if (heuristics.preferMailto) {
      if (pageContent.includes('mailto:')) {
        score += 0.2;
      }
    }
    
    // Prefer URL path containing locale + keyword
    const localeKeyword = /(\/en|\/ar)/i;
    if (localeKeyword.test(url.href)) {
      score += 0.1;
    }
    
    // Down-rank pagination traps
    if (heuristics.downrankPagination) {
      const paginationTrap = /(page|p|offset|start)=\d+|\/archive\//i;
      if (paginationTrap.test(url.href)) {
        score -= 0.2;
      }
    }
    
    return score;
  }

  addLinksToQueue(links, domain) {
    if (!this.siteQueue.has(domain)) {
      this.siteQueue.set(domain, new Set());
    }
    
    const domainQueue = this.siteQueue.get(domain);
    for (const link of links) {
      domainQueue.add({
        url: link.url,
        depth: link.depth,
        title: link.anchorText,
        htmlContent: null
      });
    }
  }

  addEmail(email, sourceUrl, title) {
    const domain = email.domain;
    
    // Check domain limit
    const domainCount = this.results.emails.filter(e => e.domain === domain).length;
    if (domainCount >= this.run.config.maxEmailsPerDomain) {
      return;
    }
    
    // Check for duplicates
    const isDuplicate = this.results.emails.some(e => 
      e.email === email.email && e.sourceUrl === sourceUrl
    );
    
    if (!isDuplicate) {
      const emailResult = {
        email: email.email,
        domain: email.domain,
        title: title,
        sourceUrl: sourceUrl,
        engine: 'site-explorer',
        snippet: email.snippet,
        fetchedAt: new Date().toISOString()
      };
      
      this.results.emails.push(emailResult);
      this.results.domains.add(domain);
      
      // Send result event
      this.sendResultEvent(emailResult);
    }
  }

  setDomainCooldown(domain) {
    const cooldownUntil = Date.now() + (this.exploration.recrawlDelayMinutes * 60 * 1000);
    domainCooldowns.set(domain, cooldownUntil);
  }

  async reseedSerp() {
    // This would trigger a new SERP search
    // For now, we'll just log it
    logger.info('[SITE-EXPLORER] Reseeding SERP queue');
    
    // Sleep for 20 seconds before reseeding
    await new Promise(resolve => setTimeout(resolve, 20000));
  }

  updateCounters() {
    this.results.siteQueue = Array.from(this.siteQueue.values())
      .reduce((total, urls) => total + urls.size, 0);
    this.results.serpQueue = Array.from(this.serpQueue.values())
      .reduce((total, queries) => total + queries.size, 0);
  }

  async waitIfPaused() {
    while (this.run.status === 'paused' && this.run.status !== 'stopped') {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Event sending functions
  sendTraceEvent(data) {
    if (this.run.res) {
      this.run.res.write(`data: ${JSON.stringify({
        type: 'trace',
        ...data
      })}\n\n`);
    }
  }

  sendResultEvent(data) {
    if (this.run.res) {
      this.run.res.write(`data: ${JSON.stringify({
        type: 'result',
        ...data
      })}\n\n`);
    }
  }

  sendProgressEvent(data) {
    if (this.run.res) {
      this.run.res.write(`data: ${JSON.stringify({
        type: 'progress',
        ...data
      })}\n\n`);
    }
  }
}

