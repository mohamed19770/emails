import { buildQueries } from './queryBuilder.js';
import { runDuckDuckGo } from './engines/ddg.js';
import { runMock } from './engines/mock.js';
import { filterResults, extractEmails } from './filters.js';
import { SiteExplorer } from './siteExplorer.js';
import { extractFromHtml } from '../phones/extractFromHtml.js';
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

export async function runPrefixSearch({
  runId,
  prefixes,
  keywords,
  countries,
  locations = [],
  engines,
  maxPages = 2,
  maxEmailsPerDomain = 3,
  exploration = {},
  dryRun = false,
  activeRuns,
  // Phone extraction options
  extractPhones = false,
  phoneTypes = ['mobile', 'landline', 'toll-free'],
  maxPhonesPerDomain = 5,
  maxWhatsAppPerDomain = 3,
  strictPhoneMode = false
}) {
  try {
    // Build search queries
    const queries = await buildQueries({
      prefixes,
      keywords,
      countries,
      locations,
      maxPages
    });
    
    if (dryRun) {
      return queries.map(query => ({
        query: query.query,
        previewUrl: query.previewUrl,
        engine: query.engine,
        country: query.country,
        page: query.page
      }));
    }
    
    // Get active run from the activeRuns map
    const run = activeRuns.get(runId);
    
    if (!run) {
      throw new Error('Run not found');
    }
    
    const results = {
      emails: [],
      domains: new Set(),
      phones: [],
      whatsapp: [],
      pagesVisited: 0,
      serpPagesFetched: 0,
      errors: 0,
      backoffs: 0,
      siteQueue: 0,
      serpQueue: 0,
      visitedTotal: 0
    };
    
    // Check if site-wide exploration is enabled
    if (exploration.siteWide) {
      logger.info(`[PREFIX-EMAILS] Starting site-wide exploration for run ${runId}`);
      
      // Create site explorer
      const siteExplorer = new SiteExplorer(run, exploration);
      
      // Process each query to get initial SERP results
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
            query: query.query,
            status: 'started',
            durationMs: 0,
            note: `Starting ${query.engine} search for ${query.country}`
          });
          
          // Run the search based on engine
          let searchResults = [];
          if (query.engine === 'ddg') {
            searchResults = await runDuckDuckGo(query, maxPages);
          } else if (query.engine === 'mock') {
            searchResults = await runMock(query, maxPages);
          }
          
          results.serpPagesFetched += searchResults.length;
          
          // Send progress update
          sendProgressEvent(run, {
            phase: 'serp_fetching',
            processed: queries.indexOf(query) + 1,
            queued: queries.length - queries.indexOf(query) - 1,
            emailsFound: results.emails.length,
            domainsFound: results.domains.size
          });
          
          // Send trace event for query completion
          sendTraceEvent(run, {
            scope: 'search',
            engine: query.engine,
            country: query.country,
            query: query.query,
            status: 'completed',
            durationMs: 0,
            note: `Completed ${query.engine} search for ${query.country}, found ${searchResults.length} results`
          });
          
          // Polite delay between queries
          await new Promise(resolve => setTimeout(resolve, SERP_DELAY_MS));
          
        } catch (error) {
          results.errors++;
          logger.error(`[PREFIX-EMAILS] Error in query ${query.query}:`, error);
          
          sendTraceEvent(run, {
            scope: 'search',
            engine: query.engine,
            country: query.country,
            query: query.query,
            status: 'error',
            durationMs: 0,
            note: error.message
          });
        }
      }
      
      // Start site-wide exploration
      const explorationResults = await siteExplorer.exploreSite([]);
      
      // Merge results
      results.emails = explorationResults.emails;
      results.domains = explorationResults.domains;
      results.pagesVisited = explorationResults.pagesVisited;
      results.errors = explorationResults.errors;
      results.backoffs = explorationResults.backoffs;
      results.siteQueue = explorationResults.siteQueue;
      results.serpQueue = explorationResults.serpQueue;
      results.visitedTotal = explorationResults.visitedTotal;
      
    } else {
      // Traditional mode - process each query without site exploration
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
            query: query.query,
            status: 'started',
            durationMs: 0,
            note: `Starting ${query.engine} search for ${query.country}`
          });
          
          // Run the search based on engine
          let searchResults = [];
          if (query.engine === 'ddg') {
            searchResults = await runDuckDuckGo(query, maxPages);
          } else if (query.engine === 'mock') {
            searchResults = await runMock(query, maxPages);
          }
          
          results.serpPagesFetched += searchResults.length;
          
          // Send progress update
          sendProgressEvent(run, {
            phase: 'serp_fetching',
            processed: queries.indexOf(query) + 1,
            queued: queries.length - queries.indexOf(query) - 1,
            emailsFound: results.emails.length,
            domainsFound: results.domains.size
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
              // Check if domain is in backoff
              const domain = new URL(result.url).hostname;
              const backoffUntil = backoffDomains.get(domain);
              if (backoffUntil && Date.now() < backoffUntil) {
                results.backoffs++;
                continue;
              }
              
              // Send trace event for page visit
              sendTraceEvent(run, {
                scope: 'visit',
                engine: query.engine,
                country: query.country,
                url: result.url,
                status: 'started',
                durationMs: 0,
                note: `Visiting ${result.title}`
              });
              
              // Visit the page and extract emails
              const pageEmails = await extractEmailsFromPage(result.url, {
                prefixes,
                maxEmailsPerDomain,
                countries,
                locations,
                mockHtml: result.htmlContent // Pass mock HTML if available
              });
              
              results.pagesVisited++;
              
              // Filter and add emails
              const filteredEmails = filterResults(pageEmails, {
                countries,
                locations,
                excludeJobBoards: true,
                excludeFreeWebmail: true
              });
              
              // Extract phones if enabled
              let pagePhones = [];
              let pageWhatsApp = [];
              if (extractPhones && result.htmlContent) {
                try {
                  const phoneResults = extractFromHtml(result.htmlContent, result.url, {
                    countries,
                    maxPhonesPerDomain,
                    maxWhatsAppPerDomain,
                    strictMode: strictPhoneMode,
                    includeTypes: phoneTypes
                  });
                  
                  pagePhones = phoneResults.phones || [];
                  pageWhatsApp = phoneResults.whatsapp || [];
                  
                  // Add phone extraction trace
                  if (phoneResults.trace) {
                    for (const trace of phoneResults.trace) {
                      if (activeRuns.has(runId)) {
                        activeRuns.get(runId).trace.push({
                          ...trace,
                          runId,
                          timestamp: new Date().toISOString()
                        });
                      }
                    }
                  }
                  
                  logger.debug(`[PHONE-EXTRACT] Extracted ${pagePhones.length} phones, ${pageWhatsApp.length} WhatsApp from ${result.url}`);
                } catch (error) {
                  logger.error(`[PHONE-EXTRACT] Error extracting phones from ${result.url}:`, error);
                }
              }
              
              // Add emails to results
              for (const email of filteredEmails) {
                const domain = email.domain;
                
                // Check domain limit
                const domainCount = results.emails.filter(e => e.domain === domain).length;
                if (domainCount >= maxEmailsPerDomain) {
                  continue;
                }
                
                // Check for duplicates
                const isDuplicate = results.emails.some(e => 
                  e.email === email.email && e.sourceUrl === email.sourceUrl
                );
                
                if (!isDuplicate) {
                  results.emails.push({
                    email: email.email,
                    domain: email.domain,
                    title: result.title,
                    sourceUrl: result.url,
                    engine: query.engine,
                    snippet: email.snippet,
                    fetchedAt: new Date().toISOString()
                  });
                  
                  results.domains.add(domain);
                  
                  // Send result event
                  sendResultEvent(run, {
                    email: email.email,
                    domain: email.domain,
                    title: result.title,
                    sourceUrl: result.url,
                    engine: query.engine,
                    snippet: email.snippet,
                    fetchedAt: new Date().toISOString()
                  });
                }
              }
              
              // Add phones to results if extracted
              if (extractPhones && (pagePhones.length > 0 || pageWhatsApp.length > 0)) {
                for (const phone of pagePhones) {
                  const domain = phone.sourceUrl ? new URL(phone.sourceUrl).hostname : '';
                  
                  // Check domain limit for phones
                  const domainPhoneCount = results.phones.filter(p => 
                    p.sourceUrl && new URL(p.sourceUrl).hostname === domain
                  ).length;
                  if (domainPhoneCount >= maxPhonesPerDomain) {
                    continue;
                  }
                  
                  // Check for duplicates
                  const isDuplicate = results.phones.some(p => 
                    p.e164 === phone.e164 && p.sourceUrl === phone.sourceUrl
                  );
                  
                  if (!isDuplicate) {
                    results.phones.push(phone);
                    
                    // Send phone result event
                    sendResultEvent(run, {
                      resultType: 'phone',
                      ...phone
                    });
                  }
                }
                
                for (const whatsapp of pageWhatsApp) {
                  const domain = whatsapp.sourceUrl ? new URL(whatsapp.sourceUrl).hostname : '';
                  
                  // Check domain limit for WhatsApp
                  const domainWhatsAppCount = results.whatsapp.filter(w => 
                    w.sourceUrl && new URL(w.sourceUrl).hostname === domain
                  ).length;
                  if (domainWhatsAppCount >= maxWhatsAppPerDomain) {
                    continue;
                  }
                  
                  // Check for duplicates
                  const isDuplicate = results.whatsapp.some(w => 
                    w.e164 === whatsapp.e164 && w.sourceUrl === whatsapp.sourceUrl
                  );
                  
                  if (!isDuplicate) {
                    results.whatsapp.push(whatsapp);
                    
                    // Send WhatsApp result event
                    sendResultEvent(run, {
                      resultType: 'whatsapp',
                      ...whatsapp
                    });
                  }
                }
              }
              
              // Send trace event for completion
              sendTraceEvent(run, {
                scope: 'visit',
                engine: query.engine,
                country: query.country,
                url: result.url,
                status: 'completed',
                durationMs: 0,
                note: `Found ${filteredEmails.length} emails`
              });
              
              // Polite delay
              await new Promise(resolve => setTimeout(resolve, VISIT_DELAY_MS));
              
            } catch (error) {
              results.errors++;
              logger.error(`[PREFIX-EMAILS] Error processing ${result.url}:`, error);
              
              // Handle rate limiting
              if (error.status === 429 || error.status === 403) {
                const domain = new URL(result.url).hostname;
                backoffDomains.set(domain, Date.now() + BACKOFF_429_403_MS);
                results.backoffs++;
              }
              
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
          
          // Send trace event for query completion
          sendTraceEvent(run, {
            scope: 'search',
            engine: query.engine,
            country: query.country,
            query: query.query,
            status: 'completed',
            durationMs: 0,
            note: `Completed ${query.engine} search for ${query.country}`
          });
          
          // Polite delay between queries
          await new Promise(resolve => setTimeout(resolve, SERP_DELAY_MS));
          
        } catch (error) {
          results.errors++;
          logger.error(`[PREFIX-EMAILS] Error in query ${query.query}:`, error);
          
          sendTraceEvent(run, {
            scope: 'search',
            engine: query.engine,
            country: query.country,
            query: query.query,
            status: 'error',
            durationMs: 0,
            note: error.message
          });
        }
      }
    }
    
    // Update run results
    run.results = results;
    run.status = 'completed';
    
    // Send final checkpoint
    sendCheckpointEvent(run, {
      emailsFound: results.emails.length,
      domainsFound: results.domains.size,
      pagesVisited: results.pagesVisited,
      serpPagesFetched: results.serpPagesFetched,
      errors: results.errors,
      backoffs: results.backoffs,
      siteQueue: results.siteQueue,
      serpQueue: results.serpQueue,
      visitedTotal: results.visitedTotal
    });
    
    // Send done event
    sendDoneEvent(run, {
      emailsFound: results.emails.length,
      domainsFound: results.domains.size,
      pagesVisited: results.pagesVisited,
      serpPagesFetched: results.serpPagesFetched,
      errors: results.errors,
      backoffs: results.backoffs,
      siteQueue: results.siteQueue,
      serpQueue: results.serpQueue,
      visitedTotal: results.visitedTotal,
      duration: Date.now() - run.startTime
    });
    
    return results;
    
  } catch (error) {
    logger.error(`[PREFIX-EMAILS] Run search error:`, error);
    throw error;
  }
}

// Helper function to extract emails from a page
async function extractEmailsFromPage(url, options) {
  try {
    // Check cache first
    const cacheKey = `page:${url}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.emails;
    }
    
    let html;
    
    // Use mock HTML if available (for mock engine)
    if (options.mockHtml) {
      html = options.mockHtml;
    } else {
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
      prefixes: options.prefixes,
      maxEmailsPerDomain: options.maxEmailsPerDomain,
      countries: options.countries,
      locations: options.locations
    });
    
    console.log(`[PREFIX-EMAILS] Extracted ${emails.length} emails from ${url}`);
    
    // Cache the result
    cache.set(cacheKey, {
      emails,
      timestamp: Date.now()
    });
    
    return emails;
    
  } catch (error) {
    logger.error(`[PREFIX-EMAILS] Error extracting emails from ${url}:`, error);
    return [];
  }
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
