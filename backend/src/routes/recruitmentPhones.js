import express from 'express';
import { runRecruitmentPhoneSearch, getEngines } from '../services/recruitment/runSearch.js';
import logger from '../config/logger.js';

const router = express.Router();

// Store active runs in memory
const activeRuns = new Map();

// Start a new recruitment phone search run
router.post('/run', async (req, res) => {
  try {
  const { 
    country,
    recruitmentOnly = true,
    carrierAware = true,
    keywords = [],
    maxPages = 2,
    engines = ['ddg'],
    phones = {
      enabled: true,
      types: ['mobile'],
      strict: true,
      perDomainCaps: { phones: 5, whatsapp: 5 }
    }
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
  if (!country) {
    return res.status(400).json({
      success: false,
      error: 'Country is required'
    });
  }
  
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one keyword is required'
    });
  }
  
  const runId = `recruitment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    if (dryRun) {
      // For dry run, return the queries that would be executed
      const availableEngines = await getEngines();
      
      return res.json({
        success: true,
        runId,
        dryRun: true,
        availableEngines: availableEngines,
        config: {
          country,
          recruitmentOnly,
          carrierAware,
          keywords,
          maxPages,
          engines,
          phones
        }
      });
    }
    
    // Store run configuration
    activeRuns.set(runId, {
      runId,
      status: 'running',
      config: {
        country,
        recruitmentOnly,
        carrierAware,
        keywords,
        maxPages,
        engines,
        phones
      },
      results: {
        phones: [],
        whatsapp: [],
        companies: new Set(),
        domains: new Set(),
        pagesVisited: 0,
        errors: 0,
        backoffs: 0
      },
      trace: [],
      startTime: new Date(),
      res: null // SSE response will be attached on /stream connection
    });
    
    // Start the search process asynchronously
    runRecruitmentPhoneSearch({
      runId,
      country,
      recruitmentOnly,
      carrierAware,
      keywords,
      maxPages,
      engines,
      phones,
      activeRuns
    }).catch(error => {
      logger.error(`[RECRUITMENT-PHONES] Run ${runId} failed:`, error);
      const run = activeRuns.get(runId);
      if (run) {
        run.status = 'error';
        run.error = error.message;
        if (run.res) {
          run.res.write(`data: ${JSON.stringify({
            type: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
          })}\n\n`);
        }
      }
    });
    
    return res.json({
      success: true,
      runId,
      message: 'Recruitment phone search started'
    });
    
  } catch (error) {
    logger.error(`[RECRUITMENT-PHONES] Error starting search:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
  } catch (error) {
    logger.error(`[RECRUITMENT-PHONES] Outer error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stream results
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
  
  // Store response object in run
  run.res = res;

  const writeEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  writeEvent({
    type: 'status',
    runId,
    status: run.status,
    timestamp: new Date().toISOString()
  });

  for (const phone of run.results.phones) {
    writeEvent({ type: 'result', resultType: 'phone', ...phone });
  }

  for (const wa of run.results.whatsapp) {
    writeEvent({ type: 'result', resultType: 'whatsapp', ...wa });
  }

  if (run.status === 'completed') {
    writeEvent({
      type: 'progress',
      phase: 'complete',
      total: run.results.phones.length + run.results.whatsapp.length,
      timestamp: new Date().toISOString()
    });
    writeEvent({
      type: 'done',
      status: 'completed',
      results: {
        phones: run.results.phones.length,
        whatsapp: run.results.whatsapp.length,
        pagesVisited: run.results.pagesVisited
      },
      timestamp: new Date().toISOString()
    });
    res.end();
    run.res = null;
    return;
  }

  if (run.status === 'error') {
    writeEvent({
      type: 'error',
      message: run.error || 'Search failed',
      timestamp: new Date().toISOString()
    });
    res.end();
    run.res = null;
    return;
  }
  
  // Handle client disconnect
  req.on('close', () => {
    logger.info(`[RECRUITMENT-PHONES] Client disconnected for run ${runId}`);
    if (run) {
      run.res = null;
    }
  });
});

// Hold (pause) a run
router.post('/hold/:runId', (req, res) => {
  const { runId } = req.params;
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
      status: 'paused',
      timestamp: new Date().toISOString()
    })}\n\n`);
  }
  
  res.json({
    success: true,
    message: 'Run paused'
  });
});

// Resume a run
router.post('/resume/:runId', (req, res) => {
  const { runId } = req.params;
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
      status: 'resumed',
      timestamp: new Date().toISOString()
    })}\n\n`);
  }
  
  res.json({
    success: true,
    message: 'Run resumed'
  });
});

// Stop a run
router.post('/stop/:runId', (req, res) => {
  const { runId } = req.params;
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
      status: 'stopped',
      results: run.results,
      timestamp: new Date().toISOString()
    })}\n\n`);
    run.res.end();
  }
  
  // Clean up
  activeRuns.delete(runId);
  
  res.json({
    success: true,
    message: 'Run stopped'
  });
});

// Get available engines
router.get('/engines', async (req, res) => {
  try {
    const engines = await getEngines();
    res.json({
      success: true,
      engines
    });
  } catch (error) {
    logger.error(`[RECRUITMENT-PHONES] Get engines error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
