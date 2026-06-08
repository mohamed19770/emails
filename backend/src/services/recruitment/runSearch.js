/**
 * Recruitment-focused phone search service
 */

import { runDuckDuckGo } from './engines/ddg.js';
import { runBingSearch } from './engines/bing.js';
import { extractRecruitmentPhones } from '../phones/recruitmentExtract.js';
import { isLikelyFakePhone } from '../phones/phoneValidation.js';
import { shouldIncludeWhatsAppResult } from '../phones/whatsappVerify.js';
import logger from '../../config/logger.js';

const GLOBAL_CONCURRENCY = 3;
const TIMEOUT_MS = 15000;
const BACKOFF_BASE_MS = 2000;
const PAGE_DELAY_MS = 400;
const MAX_PATHS_PER_DOMAIN = 5;

const CAREER_PATHS = [
  '/careers', '/jobs', '/career', '/join-us', '/contact', '/contact-us',
  '/en/careers', '/ar/careers', '/recruitment', '/employment', '/vacancies'
];

const LISTICLE_DOMAINS = [
  'lifeinsaudiarabia.net', 'ksaexpats.com', 'expatriates.com', 'quora.com'
];

const COUNTRY_HINTS = {
  'Saudi Arabia': 'Saudi Arabia KSA',
  'United Arab Emirates': 'UAE Dubai',
  'Qatar': 'Qatar Doha',
  'Kuwait': 'Kuwait',
  'Bahrain': 'Bahrain',
  'Oman': 'Oman',
  'Egypt': 'Egypt'
};

const RECRUITMENT_QUERY_TEMPLATE = (keyword, country) => {
  const hint = COUNTRY_HINTS[country] || country;
  return `${keyword} company careers jobs recruitment hiring contact phone whatsapp ${hint}`;
};

/**
 * Run recruitment-focused phone search
 */
export async function runRecruitmentPhoneSearch({
  runId,
  country,
  recruitmentOnly,
  carrierAware,
  keywords,
  maxPages,
  engines,
  phones,
  activeRuns
}) {
  const run = activeRuns.get(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  logger.info(`[RECRUITMENT-SEARCH] Starting search for ${country} with keywords: ${keywords.join(', ')}`);

  try {
    await new Promise(resolve => setTimeout(resolve, 300));

    const seenPairs = new Set();
    const backoffDomains = new Map();
    const queries = buildRecruitmentQueries(keywords, country, maxPages);
    const semaphore = new Semaphore(GLOBAL_CONCURRENCY);

    for (const query of queries) {
      if (run.status === 'stopped') break;
      await waitIfPaused(run);
      if (run.status === 'stopped') break;

      await semaphore.acquire();
      try {
        await processQuery(query, run.results, run, {
          recruitmentOnly,
          carrierAware,
          phones,
          seenPairs,
          backoffDomains
        });
      } finally {
        semaphore.release();
      }

      sendProgressEvent(run, {
        phase: 'searching',
        phonesFound: run.results.phones.length,
        whatsappFound: run.results.whatsapp.length,
        pagesVisited: run.results.pagesVisited
      });
    }

    const totalSoFar = run.results.phones.length + run.results.whatsapp.length;
    if (totalSoFar === 0) {
      logger.info('[RECRUITMENT-SEARCH] No results from DDG, trying Bing fallback');
      for (const query of queries) {
        if (run.status === 'stopped') break;
        await processQuery({ ...query, engine: 'bing' }, run.results, run, {
          recruitmentOnly,
          carrierAware,
          phones,
          seenPairs,
          backoffDomains
        });
        if (run.results.phones.length + run.results.whatsapp.length > 0) break;
      }
    }

    run.status = 'completed';
    const total = run.results.phones.length + run.results.whatsapp.length;

    sendProgressEvent(run, { phase: 'complete', total });

    if (run.res) {
      run.res.write(`data: ${JSON.stringify({
        type: 'done',
        status: 'completed',
        results: {
          phones: run.results.phones.length,
          whatsapp: run.results.whatsapp.length,
          pagesVisited: run.results.pagesVisited
        },
        timestamp: new Date().toISOString()
      })}\n\n`);
      run.res.end();
      run.res = null;
    }

    logger.info(`[RECRUITMENT-SEARCH] Search completed: ${run.results.phones.length} phones, ${run.results.whatsapp.length} WhatsApp`);
  } catch (error) {
    logger.error(`[RECRUITMENT-SEARCH] Search failed for run ${runId}:`, error);
    run.status = 'error';
    run.error = error.message;

    if (run.res) {
      run.res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      })}\n\n`);
      run.res.end();
      run.res = null;
    }
  }
}

async function fetchPageContent(url) {
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
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`Non-HTML: ${contentType}`);
  }

  return response.text();
}

function prioritizeResults(searchResults, country) {
  if (country === 'Saudi Arabia') {
    const saResults = searchResults.filter(r => /\.sa(\/|$)/i.test(r.url));
    const pool = saResults.length > 0 ? saResults : searchResults.filter(r =>
      /saudi|ksa|riyadh|jeddah|dammam/i.test(`${r.url} ${r.title} ${r.snippet}`)
    );
    return [...(pool.length > 0 ? pool : searchResults)].sort((a, b) => {
      const score = (url) => (url.includes('.sa') ? 2 : 0) + (/\/careers|\/jobs|\/recruitment|\/contact/i.test(url) ? 1 : 0);
      return score(b.url) - score(a.url);
    });
  }
  return searchResults;
}

function expandDomainUrls(baseUrl) {
  const urls = [];
  try {
    const origin = new URL(baseUrl).origin;
    urls.push(baseUrl);
    for (const path of CAREER_PATHS) {
      if (urls.length >= MAX_PATHS_PER_DOMAIN) break;
      const candidate = `${origin}${path}`;
      if (!urls.includes(candidate)) urls.push(candidate);
    }
  } catch {
    urls.push(baseUrl);
  }
  return urls;
}

function extractSaLinksFromHtml(html, baseOrigin) {
  const links = new Set();
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseOrigin).href;
      if (resolved.includes('.sa') && !LISTICLE_DOMAINS.some(d => resolved.includes(d))) {
        links.add(resolved);
      }
    } catch {
      // skip
    }
  }
  return [...links].slice(0, 8);
}

async function visitAndExtract(url, domain, query, results, run, options) {
  const { recruitmentOnly, carrierAware, phones, seenPairs } = options;

  sendTraceEvent(run, {
    scope: 'visit',
    engine: query.engine,
    country: query.country,
    url,
    status: 'started',
    durationMs: 0,
    note: `Visiting ${url}`
  });

  const html = await fetchPageContent(url);
  const extractionResults = extractRecruitmentPhones(html, url, {
    country: query.country,
    recruitmentOnly,
    carrierAware,
    maxPhonesPerDomain: phones.perDomainCaps?.phones || 10,
    maxWhatsAppPerDomain: phones.perDomainCaps?.whatsapp || 10
  });

  let found = 0;

  for (const phone of extractionResults.phones) {
    if (isLikelyFakePhone(phone.e164, phone.local)) continue;

    const pairKey = `${phone.e164}|${phone.companyName || domain}`;
    if (!seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      const item = { resultType: 'phone', ...phone, fetchedAt: new Date().toISOString() };
      results.phones.push(item);
      results.companies.add(phone.companyName || domain);
      results.domains.add(domain);
      sendResultEvent(run, item);
      found++;
    }
  }

  for (const wa of extractionResults.whatsapp) {
    if (isLikelyFakePhone(wa.e164, wa.local)) continue;

    const { include, check } = await shouldIncludeWhatsAppResult(wa.e164);
    if (!include) {
      logger.info(`[WHATSAPP-VERIFY] Rejected ${wa.e164}: ${check.reason || 'not_on_whatsapp'}`);
      continue;
    }

    const pairKey = `${wa.e164}|${wa.companyName || domain}`;
    if (!seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      const item = {
        resultType: 'whatsapp',
        ...wa,
        whatsappVerified: check.verified && check.exists === true,
        verificationProvider: check.provider,
        waLink: wa.waLink || `https://wa.me/${wa.e164.replace(/\D/g, '')}`,
        fetchedAt: new Date().toISOString()
      };
      results.whatsapp.push(item);
      results.companies.add(wa.companyName || domain);
      results.domains.add(domain);
      sendResultEvent(run, item);
      found++;
    }
  }

  results.pagesVisited++;

  sendTraceEvent(run, {
    scope: 'visit',
    engine: query.engine,
    country: query.country,
    url,
    status: 'completed',
    durationMs: 0,
    note: `Found ${extractionResults.phones.length} phones, ${extractionResults.whatsapp.length} WhatsApp`
  });

  return { found, html };
}

async function processQuery(query, results, run, options) {
  const { recruitmentOnly, carrierAware, phones, seenPairs, backoffDomains } = options;

  try {
    let searchResults = [];
    if (query.engine === 'bing') {
      searchResults = await runBingSearch(query, query.maxPages);
    } else {
      try {
        searchResults = await runDuckDuckGo(query, query.maxPages);
      } catch (ddgError) {
        logger.warn(`[RECRUITMENT-SEARCH] DDG failed: ${ddgError.message}, trying Bing`);
        searchResults = [];
      }

      if (searchResults.length === 0) {
        logger.info(`[RECRUITMENT-SEARCH] DDG returned no results for "${query.keyword}", using Bing`);
        searchResults = await runBingSearch(query, query.maxPages);
      }
    }

    const visitedDomains = new Set();

    for (const result of prioritizeResults(searchResults, query.country)) {
      if (run.status === 'stopped') break;

      let domain;
      try {
        domain = new URL(result.url).hostname;
      } catch {
        continue;
      }

      if (visitedDomains.has(domain)) continue;

      const backoffUntil = backoffDomains.get(domain);
      if (backoffUntil && Date.now() < backoffUntil) {
        results.backoffs++;
        continue;
      }

      visitedDomains.add(domain);

      const isListicle = LISTICLE_DOMAINS.some(d => domain.includes(d))
        || /top-\d+|best-\d+|list-of|companies-in|construction-companies/i.test(result.url);

      try {
        if (isListicle) {
          const html = await fetchPageContent(result.url);
          results.pagesVisited++;

          try {
            const { found } = await visitAndExtract(result.url, domain, query, results, run, options);
            if (found > 0) continue;
          } catch {
            // continue to linked companies
          }

          const saLinks = extractSaLinksFromHtml(html, result.url);

          for (const link of saLinks) {
            if (run.status === 'stopped') break;
            let linkDomain;
            try {
              linkDomain = new URL(link).hostname;
            } catch {
              continue;
            }
            if (visitedDomains.has(linkDomain)) continue;
            visitedDomains.add(linkDomain);

            for (const url of expandDomainUrls(link)) {
              if (run.status === 'stopped') break;
              try {
                const { found } = await visitAndExtract(url, linkDomain, query, results, run, options);
                if (found > 0) break;
                await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS));
              } catch (error) {
                results.errors++;
              }
            }
          }
        } else {
          for (const url of expandDomainUrls(result.url)) {
            if (run.status === 'stopped') break;

            try {
              const { found } = await visitAndExtract(url, domain, query, results, run, options);
              if (found > 0) break;
              await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS));
            } catch (error) {
              results.errors++;
              logger.warn(`[RECRUITMENT-SEARCH] Error processing ${url}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        results.errors++;
        backoffDomains.set(domain, Date.now() + BACKOFF_BASE_MS);
        logger.warn(`[RECRUITMENT-SEARCH] Error processing ${result.url}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors++;
    logger.error(`[RECRUITMENT-SEARCH] Error processing query:`, error);
  }
}

function buildRecruitmentQueries(keywords, country, maxPages) {
  const pages = Math.min(Math.max(maxPages || 3, 1), 5);
  const unique = [...new Set(keywords.map(k => k.trim()).filter(Boolean))];

  const queries = [];
  if (unique.length > 1) {
    queries.push({
      query: RECRUITMENT_QUERY_TEMPLATE(unique.slice(0, 4).join(' '), country),
      country,
      keyword: unique.join(', '),
      maxPages: pages,
      engine: 'bing'
    });
  }

  for (const keyword of unique.slice(0, 3)) {
    queries.push({
      query: RECRUITMENT_QUERY_TEMPLATE(keyword, country),
      country,
      keyword,
      maxPages: Math.min(pages, 2),
      engine: 'bing'
    });
  }

  return queries;
}

class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    await new Promise(resolve => this.queue.push(resolve));
    this.current++;
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    }
  }
}

async function waitIfPaused(run) {
  while (run.status === 'paused') {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

function sendProgressEvent(run, data) {
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({ type: 'progress', ...data, timestamp: new Date().toISOString() })}\n\n`);
  }
}

function sendTraceEvent(run, data) {
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({ type: 'trace', ...data, timestamp: new Date().toISOString() })}\n\n`);
  }
}

function sendResultEvent(run, data) {
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({ type: 'result', ...data, timestamp: new Date().toISOString() })}\n\n`);
  }
}

export async function getEngines() {
  return ['ddg', 'bing'];
}
