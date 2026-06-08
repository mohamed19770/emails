import express from 'express';
import rateLimit from 'express-rate-limit';
import emailCheckService from '../services/emailCheck.js';
import EmailCheck from '../models/EmailCheck.js';
import Configuration from '../models/Configuration.js';
import logger from '../config/logger.js';
import safeModeMiddleware from '../middleware/safeMode.js';

const router = express.Router();

// Dynamic rate limiting based on configuration
const createEmailCheckLimiter = () => {
  return rateLimit({
    windowMs: parseInt(process.env.EMAIL_CHECK_RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    max: parseInt(process.env.EMAIL_CHECK_RATE_LIMIT_MAX_REQUESTS) || 10, // 10 requests per minute
    message: {
      error: 'Too many email check requests, please try again later.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Create the limiter with fallback values
const emailCheckLimiter = createEmailCheckLimiter();

/**
 * @route POST /api/checks/one
 * @desc Check a single email address
 * @access Public
 */
router.post('/one', emailCheckLimiter, safeModeMiddleware, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    if (typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email must be a string'
      });
    }

    const result = await emailCheckService.validateEmail(email.trim());
    
    res.json({
      success: true,
      data: {
        email: result.email,
        domain: result.domain,
        isValidFormat: result.formatOK,
        mx: result.mx,
        smtpBanner: result.banner?.banner,
        smtpStatus: result.classification?.smtpStatus,
        deliverability: result.classification?.deliverability,
        responseCode: result.classification?.responseCode,
        checkedAt: result.checkedAt,
        attempts: result.attempts
      }
    });
  } catch (error) {
    logger.error('Single email check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during email validation'
    });
  }
});

/**
 * @route POST /api/checks/batch
 * @desc Check multiple email addresses
 * @access Public
 */
router.post('/batch', emailCheckLimiter, safeModeMiddleware, async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails) {
      return res.status(400).json({
        success: false,
        error: 'Emails array is required'
      });
    }

    if (!Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Emails must be an array'
      });
    }

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Emails array cannot be empty'
      });
    }

    if (emails.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 emails allowed per batch request'
      });
    }

    // Validate that all items are strings
    const invalidEmails = emails.filter(email => typeof email !== 'string' || !email.trim());
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'All emails must be non-empty strings'
      });
    }

    const results = await emailCheckService.validateEmailsBatch(
      emails.map(email => email.trim())
    );
    
    const summary = {
      total: results.length,
      deliverable: results.filter(r => r.deliverability === 'deliverable').length,
      undeliverable: results.filter(r => r.deliverability === 'undeliverable').length,
      unknown: results.filter(r => r.deliverability === 'unknown').length
    };
    
    res.json({
      success: true,
      data: {
        summary,
        results: results.map(result => ({
          email: result.email,
          domain: result.domain,
          isValidFormat: result.isValidFormat,
          deliverability: result.deliverability,
          smtpStatus: result.smtpStatus,
          responseCode: result.responseCode,
          checkedAt: result.checkedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Batch email check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during batch email validation'
    });
  }
});

/**
 * @route GET /api/checks/history/:email
 * @desc Get validation history for an email
 * @access Public
 */
router.get('/history/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { limit = 10, page = 1 } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email parameter is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 50); // Max 50 records per page

    const checks = await EmailCheck.find({ email: email.toLowerCase() })
      .sort({ checkedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v -rawLog');

    const total = await EmailCheck.countDocuments({ email: email.toLowerCase() });

    res.json({
      success: true,
      data: {
        email: email.toLowerCase(),
        checks,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Email history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching email history'
    });
  }
});

/**
 * @route GET /api/checks/stats
 * @desc Get validation statistics
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = Math.min(parseInt(days), 30); // Max 30 days
    const cutoffDate = new Date(Date.now() - (daysNum * 24 * 60 * 60 * 1000));

    const stats = await EmailCheck.aggregate([
      {
        $match: {
          checkedAt: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          deliverable: { $sum: { $cond: [{ $eq: ['$deliverability', 'deliverable'] }, 1, 0] } },
          undeliverable: { $sum: { $cond: [{ $eq: ['$deliverability', 'undeliverable'] }, 1, 0] } },
          unknown: { $sum: { $cond: [{ $eq: ['$deliverability', 'unknown'] }, 1, 0] } },
          formatValid: { $sum: { $cond: ['$isValidFormat', 1, 0] } },
          smtpOpen: { $sum: { $cond: [{ $eq: ['$smtpStatus', 'open'] }, 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      deliverable: 0,
      undeliverable: 0,
      unknown: 0,
      formatValid: 0,
      smtpOpen: 0
    };

    res.json({
      success: true,
      data: {
        period: `${daysNum} days`,
        ...result,
        deliverabilityRate: result.total > 0 ? Math.round((result.deliverable / result.total) * 100) : 0
      }
    });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching statistics'
    });
  }
});

export default router;