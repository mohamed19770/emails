import { buildIndustryQueries } from './queryBuilder.js';
import { runDuckDuckGo } from './engines/ddg.js';
import { runMock } from './engines/mock.js';
import { analyzeDomain, extractIndustryKeywords } from './domainAnalyzer.js';
import logger from '../../config/logger.js';

// Performance constants
const GLOBAL_CONCURRENCY = 6;
const PER_DOMAIN_CONCURRENCY = 1;
const SERP_DELAY_MS = 600;
const VISIT_DELAY_MS = 600;
const TIMEOUT_MS = 30000; // Increased timeout to 30 seconds
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const BACKOFF_429_403_MS = 30 * 60 * 1000; // 30 minutes

// In-memory cache for results
const cache = new Map();
const backoffDomains = new Map();

export async function runIndustryDomainSearch({
  runId,
  industryKeywords,
  countries,
  biasWords = [],
  engines,
  maxSerpPages = 2,
  verify = { dns: true, http: true, ssl: true, mx: true },
  langBias = 'auto',
  preferredTLDs = [],
  excludedTLDs = [],
  dryRun = false,
  activeRuns
}) {
  try {
    // Build search queries
    const queries = await buildIndustryQueries({
      industryKeywords,
      countries,
      biasWords,
      maxSerpPages
    });
    
    if (dryRun) {
      return queries.map(query => ({
        query: query.query,
        previewUrl: query.previewUrl,
        engine: query.engine,
        country: query.country,
        industryKeyword: query.industryKeyword,
        page: query.page
      }));
    }
    
    // Get active run from the activeRuns map
    const run = activeRuns.get(runId);
    
    if (!run) {
      logger.error(`[INDUSTRY-DOMAINS] Run ${runId} not found in activeRuns`);
      throw new Error('Run not found');
    }
    
    const results = {
      domains: [],
      industries: [], // Changed from Set() to array for consistency
      pagesVisited: 0,
      serpPagesFetched: 0,
      errors: 0,
      backoffs: 0
    };
    
    // Process each query
    for (const query of queries) {
      if (run.status === 'stopped') break;
      
      // Wait if paused
      while (run.status === 'paused' && run.status !== 'stopped') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (run.status === 'stopped') break;
      
      try {
        // Send trace event
        sendTraceEvent(run, {
          scope: 'search',
          engine: query.engine,
          country: query.country,
          industryKeyword: query.industryKeyword,
          query: query.query,
          status: 'started',
          durationMs: 0,
          note: `Starting ${query.engine} search for ${query.industryKeyword} in ${query.country}`
        });
        
        // Run the search based on engine
        let searchResults = [];
        try {
          if (query.engine === 'ddg') {
            searchResults = await runDuckDuckGo(query, maxSerpPages);
          } else if (query.engine === 'mock') {
            searchResults = await runMock(query, maxSerpPages);
          } else {
            logger.warn(`[INDUSTRY-DOMAINS] Unknown engine: ${query.engine}`);
            searchResults = [];
          }
        } catch (engineError) {
          logger.error(`[INDUSTRY-DOMAINS] Engine ${query.engine} failed:`, engineError);
          searchResults = [];
        }
        
        results.serpPagesFetched += searchResults.length;
        
        // Send progress update
        sendProgressEvent(run, {
          phase: 'serp_fetching',
          processed: queries.indexOf(query) + 1,
          queued: queries.length - queries.indexOf(query) - 1,
          domainsFound: results.domains.length,
          industriesFound: results.industries.size
        });
        
        // Process each search result
        for (const result of searchResults) {
          if (run.status === 'stopped') break;
          
          // Wait if paused
          while (run.status === 'paused' && run.status !== 'stopped') {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          if (run.status === 'stopped') break;
          
          try {
            // Extract domain from URL
            const domain = new URL(result.url).hostname;
            
            // Check if domain is in backoff
            const backoffUntil = backoffDomains.get(domain);
            if (backoffUntil && Date.now() < backoffUntil) {
              results.backoffs++;
              continue;
            }
            
            // Check TLD exclusions
            const tld = getTLD(domain);
            if (excludedTLDs.includes(tld)) {
              continue;
            }
            
            // Send trace event for domain analysis
            sendTraceEvent(run, {
              scope: 'analysis',
              engine: query.engine,
              country: query.country,
              industryKeyword: query.industryKeyword,
              domain: domain,
              status: 'started',
              durationMs: 0,
              note: `Analyzing domain ${domain}`
            });
            
            // Analyze domain
            const analysis = await analyzeDomain(domain, {
              verify,
              langBias,
              industryKeywords,
              biasWords,
              preferredTLDs,
              excludedTLDs
            });
            
            results.pagesVisited++;
            
            // Extract industry keywords from the page
            const extractedKeywords = await extractIndustryKeywords(result.url, {
              industryKeywords,
              biasWords,
              langBias
            });
            
            // Calculate score with TLD preference
            let score = analysis.score || 0;
            if (preferredTLDs.includes(tld)) {
              score += 8; // Bonus for preferred TLD
            }
            if (excludedTLDs.includes(tld)) {
              score -= 15; // Penalty for excluded TLD
            }
            
            // Create domain result
            const domainResult = {
              domain,
              industryKeyword: query.industryKeyword,
              status: analysis.status || 'unknown',
              score: Math.max(0, score),
              signals: analysis.signals || {},
              evidence: analysis.evidence || {},
              domainAgeDays: analysis.domainAgeDays,
              sslValidTo: analysis.sslValidTo,
              countryMatch: analysis.countryMatch || false,
              language: analysis.language || 'unknown',
              extractedKeywords,
              sourceUrl: result.url,
              engine: query.engine,
              fetchedAt: new Date().toISOString()
            };
            
            // Add to results
            results.domains.push(domainResult);
            if (!results.industries.includes(query.industryKeyword)) {
              results.industries.push(query.industryKeyword);
            }
            
            // Send result event
            sendResultEvent(run, domainResult);
            
            // Send trace event for completion
            sendTraceEvent(run, {
              scope: 'analysis',
              engine: query.engine,
              country: query.country,
              industryKeyword: query.industryKeyword,
              domain: domain,
              status: 'completed',
              durationMs: 0,
              note: `Found domain ${domain} with score ${score}`
            });
            
            // Polite delay
            await new Promise(resolve => setTimeout(resolve, VISIT_DELAY_MS));
            
          } catch (error) {
            results.errors++;
            logger.error(`[INDUSTRY-DOMAINS] Error processing ${result.url}:`, error);
            
            // Handle rate limiting
            if (error.status === 429 || error.status === 403) {
              const domain = new URL(result.url).hostname;
              backoffDomains.set(domain, Date.now() + BACKOFF_429_403_MS);
              results.backoffs++;
            }
            
            sendTraceEvent(run, {
              scope: 'analysis',
              engine: query.engine,
              country: query.country,
              industryKeyword: query.industryKeyword,
              domain: result.url,
              status: 'error',
              durationMs: 0,
              note: error.message
            });
          }
        }
        
        // Send trace event for query completion
        sendTraceEvent(run, {
          scope: 'search',
          engine: query.engine,
          country: query.country,
          industryKeyword: query.industryKeyword,
          query: query.query,
          status: 'completed',
          durationMs: 0,
          note: `Completed ${query.engine} search for ${query.industryKeyword} in ${query.country}`
        });
        
        // Polite delay between queries
        await new Promise(resolve => setTimeout(resolve, SERP_DELAY_MS));
        
      } catch (error) {
        results.errors++;
        logger.error(`[INDUSTRY-DOMAINS] Error in query ${query.query}:`, error);
        
        sendTraceEvent(run, {
          scope: 'search',
          engine: query.engine,
          country: query.country,
          industryKeyword: query.industryKeyword,
          query: query.query,
          status: 'error',
          durationMs: 0,
          note: error.message
        });
      }
    }
    
    // Update run results
    run.results = results;
    run.status = 'completed';
    
    // Send final checkpoint
    sendCheckpointEvent(run, {
      domainsFound: results.domains.length,
      industriesFound: results.industries.size,
      pagesVisited: results.pagesVisited,
      serpPagesFetched: results.serpPagesFetched,
      errors: results.errors,
      backoffs: results.backoffs
    });
    
    // Send done event
    sendDoneEvent(run, {
      domainsFound: results.domains.length,
      industriesFound: results.industries.size,
      pagesVisited: results.pagesVisited,
      serpPagesFetched: results.serpPagesFetched,
      errors: results.errors,
      backoffs: results.backoffs,
      duration: Date.now() - run.startTime
    });
    
    return results;
    
  } catch (error) {
    logger.error(`[INDUSTRY-DOMAINS] Run search error:`, error);
    throw error;
  }
}

// Helper function to get TLD
function getTLD(hostname) {
  if (!hostname) return '';
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.');
  }
  return '.' + parts[parts.length - 1];
}

// Event sending functions
function sendProgressEvent(run, data) {
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({
      type: 'progress',
      ...data
    })}\n\n`);
  }
}

function sendTraceEvent(run, data) {
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({
      type: 'trace',
      ...data
    })}\n\n`);
  }
}

function sendResultEvent(run, data) {
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({
      type: 'result',
      ...data
    })}\n\n`);
  }
}

function sendCheckpointEvent(run, data) {
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({
      type: 'checkpoint',
      ...data
    })}\n\n`);
  }
}

function sendDoneEvent(run, data) {
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({
      type: 'done',
      ...data
    })}\n\n`);
    run.res.end();
  }
}

export function getEngines() {
  return [
    { id: 'ddg', name: 'DuckDuckGo', description: 'Web search engine' },
    { id: 'mock', name: 'Mock Engine', description: 'Test data generator' }
  ];
}

