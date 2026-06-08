/**
 * Company Jobs API Routes
 */

const express = require('express');
const router = express.Router();
const companyJobsService = require('../services/companyJobsService');

/**
 * POST /api/company-jobs/run
 * Extract jobs from company domains
 */
router.post('/run', async (req, res) => {
  try {
    const { country, cities, domains, keyword } = req.body;

    // Validation
    if (!country) {
      return res.status(400).json({
        ok: false,
        error: 'Country is required'
      });
    }

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'At least one domain is required'
      });
    }

    // Check Safe Mode
    if (process.env.SAFE_MODE === 'true') {
      return res.status(403).json({
        ok: false,
        error: 'SAFE_MODE_ENABLED',
        message: 'Company jobs extraction is disabled in Safe Mode'
      });
    }

    // Extract jobs
    const result = await companyJobsService.extractJobs({
      country,
      cities: cities || [],
      domains,
      keyword: keyword || ''
    });

    res.json(result);

  } catch (error) {
    console.error('Company jobs extraction error:', error);
    res.status(500).json({
      ok: false,
      error: 'EXTRACTION_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/company-jobs/dry-run
 * Test extraction on first domain only
 */
router.post('/dry-run', async (req, res) => {
  try {
    const { country, cities, domains, keyword } = req.body;

    // Validation
    if (!country || !domains || domains.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Country and at least one domain are required'
      });
    }

    // Check Safe Mode
    if (process.env.SAFE_MODE === 'true') {
      return res.status(403).json({
        ok: false,
        error: 'SAFE_MODE_ENABLED',
        message: 'Company jobs extraction is disabled in Safe Mode'
      });
    }

    // Test with first domain only
    const result = await companyJobsService.extractJobs({
      country,
      cities: cities || [],
      domains: [domains[0]], // Only first domain
      keyword: keyword || ''
    });

    res.json({
      ...result,
      dryRun: true,
      message: `Dry run completed on ${domains[0]}`
    });

  } catch (error) {
    console.error('Company jobs dry run error:', error);
    res.status(500).json({
      ok: false,
      error: 'DRY_RUN_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/company-jobs/status
 * Get service status and cache info
 */
router.get('/status', (req, res) => {
  res.json({
    ok: true,
    safeMode: process.env.SAFE_MODE === 'true',
    cacheSize: companyJobsService.cache.size,
    backoffDomains: companyJobsService.backoffDomains.size,
    config: {
      globalConcurrency: companyJobsService.config.GLOBAL_CONCURRENCY,
      perDomainConcurrency: companyJobsService.config.PER_DOMAIN_CONCURRENCY,
      requestDelay: companyJobsService.config.REQUEST_DELAY_PER_DOMAIN,
      timeout: companyJobsService.config.TIMEOUT,
      cacheTTL: companyJobsService.config.CACHE_TTL
    }
  });
});

/**
 * POST /api/company-jobs/clear-cache
 * Clear service cache
 */
router.post('/clear-cache', (req, res) => {
  try {
    companyJobsService.clearCache();
    res.json({
      ok: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'CACHE_CLEAR_FAILED',
      message: error.message
    });
  }
});

module.exports = router;
