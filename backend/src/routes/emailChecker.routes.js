import express from 'express';
import rateLimit from 'express-rate-limit';
import advancedEmailValidationService from '../services/advancedEmailValidation.js';
import logger from '../config/logger.js';

const router = express.Router();

// Rate limiting for email checking
const emailCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many email check requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/email-checker/run
 * @desc Check multiple email addresses
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

    if (emails.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10000 emails allowed per request'
      });
    }

    // Validate that all items are strings and normalize
    const normalizedEmails = emails
      .filter(email => typeof email === 'string' && email.trim())
      .map(email => email.trim().toLowerCase())
      .filter((email, index, arr) => arr.indexOf(email) === index); // Remove duplicates

    if (normalizedEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid emails found'
      });
    }

    logger.info(`Starting email validation: ${normalizedEmails.length} emails, safeMode: ${safeMode}`);

    // Process emails with advanced validation
    const results = await advancedEmailValidationService.runEmailChecks(normalizedEmails, safeMode);

    // Calculate summary
    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      risky: results.filter(r => r.status === 'risky').length,
      unknown: results.filter(r => r.status === 'unknown').length,
      duplicates: emails.length - normalizedEmails.length
    };

    logger.info(`Email validation completed:`, summary);

    res.json({
      success: true,
      data: {
        summary,
        results,
        processedAt: new Date().toISOString(),
        safeMode
      }
    });

  } catch (error) {
    logger.error('Email checker error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during email validation'
    });
  }
});

export default router;
