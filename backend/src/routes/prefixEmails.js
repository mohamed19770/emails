import express from 'express';
import { runPrefixSearch, getEngines } from '../services/prefixEmails/runSearch.js';
import logger from '../config/logger.js';

const router = express.Router();

// Store active runs in memory (in production, use Redis or database)
const activeRuns = new Map();

// Start a new prefix email search run
router.post('/run', async (req, res) => {
  const { 
    prefixes, keywords, countries, locations, engines, maxPages, maxEmailsPerDomain, exploration,
    // Phone extraction options
    extractPhones = false,
    phoneTypes = ['mobile', 'landline', 'toll-free'],
    maxPhonesPerDomain = 5,
    maxWhatsAppPerDomain = 3,
    strictPhoneMode = false
  } = req.body;
  const dryRun = req.query.dry === '1';
  
  // Check if SAFE_MODE is enabled
  if (process.env.SAFE_MODE === 'true') {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable (Safe Mode enabled)'
    });
  }
  
  // Validate required fields
  if (!prefixes || !Array.isArray(prefixes) || prefixes.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one prefix is required'
    });
  }
  
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one keyword is required'
    });
  }
  
  if (!countries || !Array.isArray(countries) || countries.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one country is required'
    });
  }
  
  if (!engines || !Array.isArray(engines) || engines.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one engine is required'
    });
  }
  
  // Generate unique run ID
  const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    if (dryRun) {
      // For dry run, just return the queries that would be executed
      const queries = await runPrefixSearch({
        prefixes,
        keywords,
        countries,
        locations: locations || [],
        engines,
        maxPages: Math.min(Math.max(1, maxPages || 2), 5),
        maxEmailsPerDomain: Math.max(1, maxEmailsPerDomain || 3),
        exploration: exploration || {},
        dryRun: true,
        // Phone extraction options
        extractPhones,
        phoneTypes,
        maxPhonesPerDomain,
        maxWhatsAppPerDomain,
        strictPhoneMode
      });
      
      return res.json({
        success: true,
        runId,
        dryRun: true,
        queries
      });
    }
    
    // Store run configuration
    activeRuns.set(runId, {
      runId,
      status: 'running',
      extractPhones,
      phoneTypes,
      maxPhonesPerDomain,
      maxWhatsAppPerDomain,
      strictPhoneMode,
      startTime: Date.now(),
      config: {
        prefixes,
        keywords,
        countries,
        locations: locations || [],
        engines,
        maxPages: Math.min(Math.max(1, maxPages || 2), 5),
        maxEmailsPerDomain: Math.max(1, maxEmailsPerDomain || 3),
        exploration: exploration || {}
      },
      results: {
        emails: [],
        domains: new Set(),
        pagesVisited: 0,
        serpPagesFetched: 0,
        errors: 0,
        backoffs: 0,
        siteQueue: 0,
        serpQueue: 0,
        visitedTotal: 0
      }
    });
    
    // Start the search process asynchronously
    runPrefixSearch({
      runId,
      prefixes,
      keywords,
      countries,
      locations: locations || [],
      engines,
      maxPages: Math.min(Math.max(1, maxPages || 2), 5),
      maxEmailsPerDomain: Math.max(1, maxEmailsPerDomain || 3),
      exploration: exploration || {},
      dryRun: false,
      // Phone extraction options
      extractPhones,
      phoneTypes,
      maxPhonesPerDomain,
      maxWhatsAppPerDomain,
      strictPhoneMode,
      activeRuns
    }).catch(error => {
      logger.error(`[PREFIX-EMAILS] Run ${runId} failed:`, error);
      const run = activeRuns.get(runId);
      if (run) {
        run.status = 'error';
        run.error = error.message;
      }
    });
    
    res.json({
      success: true,
      runId
    });
    
  } catch (error) {
    logger.error(`[PREFIX-EMAILS] Start run error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stream results for a run
router.get('/stream/:runId', (req, res) => {
  const { runId } = req.params;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  const run = activeRuns.get(runId);
  if (!run) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'Run not found'
    })}\n\n`);
    res.end();
    return;
  }
  
  // Send initial status
  res.write(`data: ${JSON.stringify({
    type: 'progress',
    phase: 'starting',
    processed: 0,
    queued: 0,
    emailsFound: run.results.emails.length,
    domainsFound: run.results.domains.size
  })}\n\n`);
  
  // Store the response object for this run
  run.res = res;
  
  // Clean up when client disconnects
  req.on('close', () => {
    if (run.res === res) {
      run.res = null;
    }
  });
});

// Hold a run
router.post('/hold', (req, res) => {
  const { runId } = req.body;
  
  const run = activeRuns.get(runId);
  if (!run) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    });
  }
  
  run.status = 'paused';
  
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({
      type: 'status',
      status: 'paused'
    })}\n\n`);
  }
  
  res.json({ success: true });
});

// Resume a run
router.post('/resume', (req, res) => {
  const { runId } = req.body;
  
  const run = activeRuns.get(runId);
  if (!run) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    });
  }
  
  run.status = 'running';
  
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({
      type: 'status',
      status: 'running'
    })}\n\n`);
  }
  
  res.json({ success: true });
});

// Stop a run
router.post('/stop', (req, res) => {
  const { runId } = req.body;
  
  const run = activeRuns.get(runId);
  if (!run) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    });
  }
  
  run.status = 'stopped';
  
  if (run.res) {
    run.res.write(`data: ${JSON.stringify({
      type: 'done',
      stats: {
        emailsFound: run.results.emails.length,
        domainsFound: run.results.domains.size,
        pagesVisited: run.results.pagesVisited,
        serpPagesFetched: run.results.serpPagesFetched,
        errors: run.results.errors,
        backoffs: run.results.backoffs,
        duration: Date.now() - run.startTime
      }
    })}\n\n`);
    run.res.end();
  }
  
  // Clean up after a delay
  setTimeout(() => {
    activeRuns.delete(runId);
  }, 30000);
  
  res.json({ success: true });
});

// Get available engines
router.get('/engines', (req, res) => {
  try {
    const engines = getEngines();
    res.json({
      success: true,
      engines
    });
  } catch (error) {
    logger.error(`[PREFIX-EMAILS] Get engines error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get run status
router.get('/status/:runId', (req, res) => {
  const { runId } = req.params;
  
  const run = activeRuns.get(runId);
  if (!run) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    });
  }
  
  res.json({
    success: true,
    runId,
    status: run.status,
    startTime: run.startTime,
    results: {
      emailsFound: run.results.emails.length,
      domainsFound: run.results.domains.size,
      pagesVisited: run.results.pagesVisited,
      serpPagesFetched: run.results.serpPagesFetched,
      errors: run.results.errors,
      backoffs: run.results.backoffs
    }
  });
});

export default router;
