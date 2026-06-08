import express from 'express';
import { crawlDomainForEmails } from '../services/domainEmails/crawler.js';
import logger from '../config/logger.js';

const router = express.Router();
const activeRuns = new Map();

router.post('/run', async (req, res) => {
  const {
    domains = [],
    depthLimit = 3,
    maxPagesPerDomain = 50,
    onlyTargetDomain = false,
    excludeFreeWebmail = true,
    maxEmailsPerDomain = 100
  } = req.body;

  if (process.env.SAFE_MODE === 'true') {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable (Safe Mode enabled)'
    });
  }

  const domainList = domains
    .map(d => String(d).trim())
    .filter(Boolean);

  if (domainList.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one domain is required'
    });
  }

  const runId = `domain_emails_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  activeRuns.set(runId, {
    runId,
    status: 'running',
    startTime: Date.now(),
    config: { domains: domainList, depthLimit, maxPagesPerDomain, onlyTargetDomain, excludeFreeWebmail, maxEmailsPerDomain },
    results: { emails: [], pagesVisited: 0, errors: 0, domains: [] }
  });

  crawlDomainForEmails({
    domains: domainList,
    depthLimit: Math.min(Math.max(1, depthLimit), 5),
    maxPagesPerDomain: Math.min(Math.max(5, maxPagesPerDomain), 200),
    onlyTargetDomain,
    excludeFreeWebmail,
    maxEmailsPerDomain: Math.min(Math.max(1, maxEmailsPerDomain), 500),
    onProgress: (data) => {
      const run = activeRuns.get(runId);
      if (!run?.res) return;
      run.res.write(`data: ${JSON.stringify({ type: 'progress', ...data })}\n\n`);
    },
    onEmail: (email) => {
      const run = activeRuns.get(runId);
      if (!run) return;
      run.results.emails.push(email);
      if (run.res) {
        run.res.write(`data: ${JSON.stringify({ type: 'result', ...email })}\n\n`);
      }
    },
    onPage: (page) => {
      const run = activeRuns.get(runId);
      if (!run?.res) return;
      run.res.write(`data: ${JSON.stringify({ type: 'page', ...page })}\n\n`);
    },
    shouldStop: () => activeRuns.get(runId)?.status === 'stopped'
  })
    .then((results) => {
      const run = activeRuns.get(runId);
      if (!run) return;

      run.status = run.status === 'stopped' ? 'stopped' : 'completed';
      run.results = results;
      run.endTime = Date.now();

      if (run.res) {
        run.res.write(`data: ${JSON.stringify({
          type: 'done',
          stats: {
            emailsFound: results.emails.length,
            pagesVisited: results.pagesVisited,
            errors: results.errors,
            domainsProcessed: results.domains.length,
            duration: Date.now() - run.startTime
          }
        })}\n\n`);
        run.res.end();
      }

      logger.info(`[DOMAIN-EMAILS] Run ${runId} completed: ${results.emails.length} emails from ${results.pagesVisited} pages`);
    })
    .catch((error) => {
      logger.error(`[DOMAIN-EMAILS] Run ${runId} failed:`, error);
      const run = activeRuns.get(runId);
      if (run) {
        run.status = 'error';
        run.error = error.message;
        if (run.res) {
          run.res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          run.res.end();
        }
      }
    });

  res.json({ success: true, runId });
});

router.get('/stream/:runId', (req, res) => {
  const { runId } = req.params;
  const run = activeRuns.get(runId);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  if (!run) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Run not found' })}\n\n`);
    res.end();
    return;
  }

  res.write(`data: ${JSON.stringify({
    type: 'progress',
    phase: 'starting',
    emailsFound: run.results.emails.length,
    pagesVisited: run.results.pagesVisited
  })}\n\n`);

  for (const email of run.results.emails) {
    res.write(`data: ${JSON.stringify({ type: 'result', ...email })}\n\n`);
  }

  run.res = res;

  if (run.status === 'completed' || run.status === 'error' || run.status === 'stopped') {
    res.write(`data: ${JSON.stringify({
      type: 'done',
      stats: {
        emailsFound: run.results.emails.length,
        pagesVisited: run.results.pagesVisited,
        errors: run.results.errors,
        duration: (run.endTime || Date.now()) - run.startTime
      }
    })}\n\n`);
    res.end();
    return;
  }

  req.on('close', () => {
    if (run.res === res) run.res = null;
  });
});

router.post('/stop', (req, res) => {
  const { runId } = req.body;
  const run = activeRuns.get(runId);

  if (!run) {
    return res.status(404).json({ success: false, error: 'Run not found' });
  }

  run.status = 'stopped';
  res.json({ success: true });
});

router.get('/status/:runId', (req, res) => {
  const { runId } = req.params;
  const run = activeRuns.get(runId);

  if (!run) {
    return res.status(404).json({ success: false, error: 'Run not found' });
  }

  res.json({
    success: true,
    runId,
    status: run.status,
    results: {
      emailsFound: run.results.emails.length,
      pagesVisited: run.results.pagesVisited,
      errors: run.results.errors
    }
  });
});

export default router;
