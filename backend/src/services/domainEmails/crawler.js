import * as cheerio from 'cheerio';
import { extractAllEmailsFromHtml } from '../prefixEmails/filters.js';
import logger from '../../config/logger.js';

const VISIT_DELAY_MS = 500;
const TIMEOUT_MS = 12000;
const DEFAULT_EXCLUDE_PATTERNS = [
  /\b(auth|login|logout|cart|checkout|subscribe)\b/i,
  /\b(privacy|terms|cookies)\b/i,
  /\b(tag|category|archive|calendar)\b/i,
  /\?(utm_|fbclid|gclid)/i
];

function normalizeDomain(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function domainToUrl(domain) {
  return `https://${domain}`;
}

function isSameSite(hostname, targetDomain) {
  return hostname === targetDomain || hostname.endsWith(`.${targetDomain}`);
}

function shouldExcludeLink(url, excludePatterns) {
  const href = url.href;
  return excludePatterns.some(pattern => pattern.test(href));
}

function extractLinks(html, baseUrl, targetDomain, excludePatterns) {
  const links = [];
  const $ = cheerio.load(html);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    try {
      const linkUrl = new URL(href, baseUrl);
      if (linkUrl.protocol !== 'http:' && linkUrl.protocol !== 'https:') return;
      if (!isSameSite(linkUrl.hostname, targetDomain)) return;
      if (shouldExcludeLink(linkUrl, excludePatterns)) return;

      links.push({
        url: linkUrl.href,
        title: $(el).text().trim().slice(0, 120) || linkUrl.pathname
      });
    } catch {
      // skip invalid URLs
    }
  });

  return links;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`Non-HTML content: ${contentType}`);
  }

  return response.text();
}

export async function crawlDomainForEmails({
  domains,
  depthLimit = 3,
  maxPagesPerDomain = 50,
  onlyTargetDomain = false,
  excludeFreeWebmail = true,
  maxEmailsPerDomain = 100,
  onProgress,
  onEmail,
  onPage,
  shouldStop
}) {
  const results = {
    emails: [],
    pagesVisited: 0,
    errors: 0,
    domains: []
  };

  const normalizedDomains = [...new Set(domains.map(normalizeDomain).filter(Boolean))];

  for (const targetDomain of normalizedDomains) {
    if (shouldStop?.()) break;

    const domainResult = {
      domain: targetDomain,
      emails: [],
      pagesVisited: 0,
      errors: 0
    };

    const visited = new Set();
    const queue = [{ url: domainToUrl(targetDomain), depth: 0, title: 'Homepage' }];
    const seenEmails = new Set();

    while (queue.length > 0 && domainResult.pagesVisited < maxPagesPerDomain) {
      if (shouldStop?.()) break;

      queue.sort((a, b) => a.depth - b.depth);
      const current = queue.shift();
      if (!current || visited.has(current.url)) continue;

      visited.add(current.url);
      domainResult.pagesVisited++;
      results.pagesVisited++;

      onPage?.({
        domain: targetDomain,
        url: current.url,
        depth: current.depth,
        pagesVisited: domainResult.pagesVisited
      });

      try {
        const html = await fetchPage(current.url);
        const pageEmails = extractAllEmailsFromHtml(html, {
          targetDomains: [targetDomain],
          maxEmails: maxEmailsPerDomain,
          excludeFreeWebmail,
          onlyTargetDomain
        });

        for (const emailData of pageEmails) {
          if (seenEmails.has(emailData.email)) continue;
          seenEmails.add(emailData.email);

          const emailResult = {
            ...emailData,
            targetDomain,
            sourceUrl: current.url,
            pageTitle: current.title,
            fetchedAt: new Date().toISOString()
          };

          domainResult.emails.push(emailResult);
          results.emails.push(emailResult);
          onEmail?.(emailResult);
        }

        if (current.depth < depthLimit) {
          const links = extractLinks(html, current.url, targetDomain, DEFAULT_EXCLUDE_PATTERNS);
          for (const link of links.slice(0, 40)) {
            if (!visited.has(link.url)) {
              queue.push({ url: link.url, depth: current.depth + 1, title: link.title });
            }
          }
        }
      } catch (error) {
        domainResult.errors++;
        results.errors++;
        logger.warn(`[DOMAIN-EMAILS] Error crawling ${current.url}: ${error.message}`);
      }

      onProgress?.({
        domain: targetDomain,
        pagesVisited: domainResult.pagesVisited,
        emailsFound: domainResult.emails.length,
        queueSize: queue.length,
        totalEmails: results.emails.length
      });

      await new Promise(resolve => setTimeout(resolve, VISIT_DELAY_MS));
    }

    results.domains.push(domainResult);
  }

  return results;
}
