import express from 'express';
import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';

const router = express.Router();

// Rate limiting for job searches
const jobSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    error: 'Too many job search requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/jobs/search
 * @desc Search for jobs
 * @access Public
 */
router.post('/search', jobSearchLimiter, async (req, res) => {
  try {
    const { keyword, source } = req.body;

    // Validate input
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Keyword is required'
      });
    }

    logger.info(`Job search: ${keyword}, source: ${source}`);

    // Mock job data - replace with actual scraping logic
    const mockJobs = [
      {
        id: 1,
        title: `${keyword} - Senior Level`,
        url: `https://bayt.com/jobs/${keyword.toLowerCase().replace(/\s+/g, '-')}-1`,
        source: 'Bayt',
        location: 'Riyadh, Saudi Arabia',
        fetchedAt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      },
      {
        id: 2,
        title: `${keyword} - Mid Level`,
        url: `https://gulftalent.com/jobs/${keyword.toLowerCase().replace(/\s+/g, '-')}-2`,
        source: 'GulfTalent',
        location: 'Jeddah, Saudi Arabia',
        fetchedAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      },
      {
        id: 3,
        title: `${keyword} - Entry Level`,
        url: `https://linkedin.com/jobs/${keyword.toLowerCase().replace(/\s+/g, '-')}-3`,
        source: 'LinkedIn',
        location: 'Dammam, Saudi Arabia',
        fetchedAt: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
      }
    ];

    // Filter by source if specified
    const filteredJobs = source === 'All' ? mockJobs : mockJobs.filter(job => job.source === source);

    res.json({
      success: true,
      data: {
        jobs: filteredJobs,
        total: filteredJobs.length,
        keyword,
        source,
        searchedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Job search error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during job search'
    });
  }
});

/**
 * @route POST /api/jobs/refresh
 * @desc Refresh job data (scrape new data)
 * @access Public
 */
router.post('/refresh', jobSearchLimiter, async (req, res) => {
  try {
    const { keyword, source } = req.body;

    // Validate input
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Keyword is required'
      });
    }

    logger.info(`Job refresh: ${keyword}, source: ${source}`);

    // Simulate scraping delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock refreshed job data
    const refreshedJobs = [
      {
        id: 1,
        title: `${keyword} - Senior Level (Updated)`,
        url: `https://bayt.com/jobs/${keyword.toLowerCase().replace(/\s+/g, '-')}-1-new`,
        source: 'Bayt',
        location: 'Riyadh, Saudi Arabia',
        fetchedAt: new Date() // Just now
      },
      {
        id: 2,
        title: `${keyword} - Mid Level (Updated)`,
        url: `https://gulftalent.com/jobs/${keyword.toLowerCase().replace(/\s+/g, '-')}-2-new`,
        source: 'GulfTalent',
        location: 'Jeddah, Saudi Arabia',
        fetchedAt: new Date() // Just now
      }
    ];

    // Filter by source if specified
    const filteredJobs = source === 'All' ? refreshedJobs : refreshedJobs.filter(job => job.source === source);

    res.json({
      success: true,
      data: {
        jobs: filteredJobs,
        total: filteredJobs.length,
        keyword,
        source,
        refreshedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Job refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during job refresh'
    });
  }
});

export default router;


