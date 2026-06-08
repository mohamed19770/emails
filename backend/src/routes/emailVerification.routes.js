/**
 * Email verification API routes
 * Safe, modern, and reputation-friendly email verification
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyEmail, verifyEmails, getVerificationStats } from '../services/emailVerification/emailVerificationService.js';
import { clearAllRateLimits, getRateLimitStats } from '../services/emailVerification/safetyControls.js';
import { clearDNSCache, getCacheStats } from '../services/emailVerification/dnsIntelligence.js';
import logger from '../config/logger.js';

const router = express.Router();

// Rate limiting for email verification
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 verification requests per 15 minutes
  message: {
    success: false,
    error: 'Too many verification requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/email-verification/verify
 * @desc Verify a single email address
 * @access Public
 */
router.post('/verify', verificationLimiter, async (req, res) => {
  try {
    const { email, safeMode = false, skipSafetyChecks = false } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    // Validate input
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    if (email.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Email address cannot be empty'
      });
    }

    logger.info(`Email verification request: ${email}, safeMode: ${safeMode}, IP: ${clientIP}`);

    // Verify email
    const result = await verifyEmail(email, {
      safeMode,
      clientIP,
      skipSafetyChecks
    });

    logger.info(`Email verification completed: ${email} -> ${result.status} (${result.confidence})`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during email verification'
    });
  }
});

/**
 * @route POST /api/email-verification/verify-batch
 * @desc Verify multiple email addresses
 * @access Public
 */
router.post('/verify-batch', verificationLimiter, async (req, res) => {
  try {
    const { 
      emails, 
      safeMode = false, 
      skipSafetyChecks = false,
      maxConcurrency = 5 
    } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

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

    if (emails.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 emails allowed per batch request'
      });
    }

    // Validate that all items are strings
    const invalidEmails = emails.filter(email => typeof email !== 'string' || email.trim().length === 0);
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'All emails must be non-empty strings'
      });
    }

    logger.info(`Batch email verification request: ${emails.length} emails, safeMode: ${safeMode}, IP: ${clientIP}`);

    // Verify emails
    const results = await verifyEmails(emails, {
      safeMode,
      clientIP,
      skipSafetyChecks,
      maxConcurrency
    });

    // Calculate statistics
    const stats = getVerificationStats(results);

    logger.info(`Batch email verification completed: ${stats.valid} valid, ${stats.invalid} invalid, ${stats.risky} risky, ${stats.unknown} unknown`);

    res.json({
      success: true,
      data: {
        results,
        stats,
        processedAt: new Date().toISOString(),
        safeMode
      }
    });

  } catch (error) {
    logger.error('Batch email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during batch email verification'
    });
  }
});

/**
 * @route GET /api/email-verification/stats
 * @desc Get verification statistics and system status
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const rateLimitStats = getRateLimitStats();
    const dnsCacheStats = getCacheStats();

    res.json({
      success: true,
      data: {
        rateLimits: rateLimitStats,
        dnsCache: dnsCacheStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Stats retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error retrieving stats'
    });
  }
});

/**
 * @route POST /api/email-verification/clear-cache
 * @desc Clear all caches and rate limits (admin only)
 * @access Private
 */
router.post('/clear-cache', async (req, res) => {
  try {
    // In a real implementation, you'd want proper authentication here
    const { adminKey } = req.body;
    
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Clear all caches and rate limits
    clearAllRateLimits();
    clearDNSCache();

    logger.info('All caches and rate limits cleared');

    res.json({
      success: true,
      message: 'All caches and rate limits cleared successfully'
    });

  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error clearing caches'
    });
  }
});

/**
 * @route GET /api/email-verification/health
 * @desc Health check for email verification service
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const rateLimitStats = getRateLimitStats();
    const dnsCacheStats = getCacheStats();

    // Check if system is healthy
    const isHealthy = rateLimitStats.global.count < 90; // Less than 90% of global limit

    res.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'degraded',
        rateLimits: rateLimitStats,
        dnsCache: dnsCacheStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during health check'
    });
  }
});

export default router;
