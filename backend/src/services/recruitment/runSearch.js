/**
 * Recruitment-focused phone search service
 */

import { runDuckDuckGo } from './engines/ddg.js';
import { runBingSearch } from './engines/bing.js';
import { extractRecruitmentPhones } from '../phones/recruitmentExtract.js';
import { isLikelyFakePhone } from '../phones/phoneValidation.js';
import logger from '../../config/logger.js';

const GLOBAL_CONCURRENCY = 3;
const TIMEOUT_MS = 15000;
const BACKOFF_BASE_MS = 2000;
const PAGE_DELAY_MS = 400;

const RECRUITMENT_QUERY_TEMPLATE = (keyword, country) =>
  `${keyword} recruitment careers jobs whatsapp contact ${country}`;

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

    for (const result of searchResults) {
      if (run.status === 'stopped') break;

      let domain;
      try {
        domain = new URL(result.url).hostname;
      } catch {
        continue;
      }

      const backoffUntil = backoffDomains.get(domain);
      if (backoffUntil && Date.now() < backoffUntil) {
        results.backoffs++;
        continue;
      }

      try {
        sendTraceEvent(run, {
          scope: 'visit',
          engine: query.engine,
          country: query.country,
          url: result.url,
          status: 'started',
          durationMs: 0,
          note: `Visiting ${result.title}`
        });

        let html = result.htmlContent;
        if (!html) {
          html = await fetchPageContent(result.url);
        }

        const extractionResults = extractRecruitmentPhones(html, result.url, {
          country: query.country,
          recruitmentOnly,
          carrierAware,
          maxPhonesPerDomain: phones.perDomainCaps?.phones || 10,
          maxWhatsAppPerDomain: phones.perDomainCaps?.whatsapp || 10
        });

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
          }
        }

        for (const wa of extractionResults.whatsapp) {
          if (isLikelyFakePhone(wa.e164, wa.local)) continue;

          const pairKey = `${wa.e164}|${wa.companyName || domain}`;
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            const item = { resultType: 'whatsapp', ...wa, fetchedAt: new Date().toISOString() };
            results.whatsapp.push(item);
            results.companies.add(wa.companyName || domain);
            results.domains.add(domain);
            sendResultEvent(run, item);
          }
        }

        results.pagesVisited++;

        sendTraceEvent(run, {
          scope: 'visit',
          engine: query.engine,
          country: query.country,
          url: result.url,
          status: 'completed',
          durationMs: 0,
          note: `Found ${extractionResults.phones.length} phones, ${extractionResults.whatsapp.length} WhatsApp`
        });

        await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS));
      } catch (error) {
        results.errors++;
        backoffDomains.set(domain, Date.now() + BACKOFF_BASE_MS);
        logger.warn(`[RECRUITMENT-SEARCH] Error processing ${result.url}: ${error.message}`);

        sendTraceEvent(run, {
          scope: 'visit',
          engine: query.engine,
          country: query.country,
          url: result.url,
          status: 'error',
          durationMs: 0,
          note: error.message
        });
      }
    }
  } catch (error) {
    results.errors++;
    logger.error(`[RECRUITMENT-SEARCH] Error processing query:`, error);
  }
}

function buildRecruitmentQueries(keywords, country, maxPages) {
  const pages = Math.min(Math.max(maxPages || 3, 1), 5);

  return keywords.map(keyword => ({
    query: RECRUITMENT_QUERY_TEMPLATE(keyword, country),
    country,
    keyword,
    maxPages: pages,
    engine: 'ddg'
  }));
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
    run.r