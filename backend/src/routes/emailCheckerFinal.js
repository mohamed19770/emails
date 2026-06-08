/**
 * Final Email Checker API routes
 * Conservative validation with all safety measures
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { validateEmails } from '../services/emailValidator.js';
import logger from '../config/logger.js';

const router = express.Router();

// Rate limiting for email checking
const emailCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes
  message: {
    error: 'Too many email check requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/email-checker-final/run
 * @desc Check multiple email addresses with comprehensive conservative validation
 * @access Public
 */
router.post('/run', emailCheckLimiter, async (req, res) => {
  try {
    const { emails, safeMode = false } = req.body;

    // Validate input
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Emails array is required'
      });
    }

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Emails array cannot be empty'
      });
    }

    if (emails.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 1000 emails per request'
      });
    }

    logger.info(`Starting final email validation: ${emails.length} emails, safeMode: ${safeMode}`);

    // Process emails with comprehensive validation
    const result = await validateEmails(emails, safeMode);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Final email checker error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during email validation'
    });
  }
});

export default router;
