/**
 * Enhanced Search Routes
 * API routes for multi-country keywords and prefix search
 */

import express from 'express';
import enhancedSearchOrchestrator from '../services/enhancedSearch/runSearch.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * POST /api/enhanced-search/run
 * Run enhanced search for job postings and email extraction
 */
router.post('/run', async (req, res) => {
  try {
    const {
      keywords = [],
      countries = ['Saudi Arabia'],
      locations = [],
      prefixes = [],
      engines = ['ddg', 'mock'],
      maxPages = 2,
      extractEmails = true
    } = req.body;

    const { trace = '0', dry = '0' } = req.query;
    const enableTrace = trace === '1';
    const isDryRun = dry === '1';

    // Validate inputs
    if (!keywords || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Keywords are required',
        message: 'Please provide at least one keyword to search for'
      });
    }

    if (!countries || countries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Countries are required',
        message: 'Please select at least one country'
      });
    }

    if (!Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        error: 'Keywords must be an array',
        message: 'Keywords should be provided as an array of strings'
      });
    }

    if (!Array.isArray(countries)) {
      return res.status(400).json({
        success: false,
        error: 'Countries must be an array',
        message: 'Countries should be provided as an array of strings'
      });
    }

    // Validate engines
    const availableEngines = enhancedSearchOrchestrator.getAvailableEngines();
    const invalidEngines = engines.filter(engine => !availableEngines[engine]);
    
    if (invalidEngines.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid engines',
        message: `Invalid engines: ${invalidEngines.join(', ')}. Available: ${Object.keys(availableEngines).join(', ')}`
      });
    }

    // Run search
    const result = await enhancedSearchOrchestrator.runSearch({
      keywords,
      countries,
      locations,
      prefixes,
      engines,
      maxPages: Math.min(Math.max(1, maxPages), 10), // Limit between 1-10
      enableTrace,
      dry: isDryRun,
      extractEmails
    });

    if (!result.ok) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Search failed',
        trace: result.trace || []
      });
    }

    // Return results
    res.json({
      success: true,
      data: {
        jobs: result.items || [],
        emails: result.emails || [],
        trace: result.trace || [],
        dry: result.dry || false,
        count: result.items ? result.items.length : 0,
        emailCount: result.emails ? result.emails.length : 0,
        engines: engines,
        keywords: keywords,
        countries: countries,
        locations: locations
      }
    });

  } catch (error) {
    logger.error('Enhanced search error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/enhanced-search/engines
 * Get available search engines
 */
router.get('/engines', (req, res) => {
  try {
    const engines = enhancedSearchOrchestrator.getAvailableEngines();
    res.json({
      success: true,
      engines: engines
    });
  } catch (error) {
    logger.error('Get engines error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get engines',
      message: error.message
    });
  }
});

/**
 * POST /api/enhanced-search/clear-cache
 * Clear search cache
 */
router.post('/clear-cache', (req, res) => {
  try {
    enhancedSearchOrchestrator.clearCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

export default router;
