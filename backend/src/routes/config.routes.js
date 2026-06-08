import express from 'express';
import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';
import Configuration from '../models/Configuration.js';
import safeModeService from '../services/safeMode.js';

const router = express.Router();

// Rate limiting for configuration endpoints (more restrictive)
const configLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    error: 'Too many configuration requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all config routes
router.use(configLimiter);

/**
 * GET /api/config
 * Get current configuration
 */
router.get('/', async (req, res) => {
  try {
    const config = await Configuration.getCurrent();
    
    // Remove sensitive information and internal fields
    const publicConfig = {
      emailValidation: config.emailValidation,
      rateLimiting: config.rateLimiting,
      fileSharing: config.fileSharing,
      safeMode: {
        enabled: config.safeMode.enabled,
        maxChecksPerDay: config.safeMode.maxChecksPerDay,
        maxChecksPerHour: config.safeMode.maxChecksPerHour,
        blockSuspiciousDomains: config.safeMode.blockSuspiciousDomains,
        suspiciousDomains: config.safeMode.suspiciousDomains
      },
      system: {
        logLevel: config.system.logLevel,
        enableMetrics: config.system.enableMetrics,
        cleanupIntervalHours: config.system.cleanupIntervalHours
      },
      version: config.version,
      lastModified: config.lastModified,
      modifiedBy: config.modifiedBy
    };

    res.json({
      success: true,
      data: publicConfig
    });
  } catch (error) {
    logger.error('Error getting configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration'
    });
  }
});

/**
 * PUT /api/config
 * Update configuration
 */
router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Validate that updates object exists
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration updates'
      });
    }

    // Log configuration change attempt
    logger.info(`Configuration update attempt from IP: ${clientIP}`, {
      updates: Object.keys(updates),
      userAgent: req.get('User-Agent')
    });

    // Update configuration
    const newConfig = await Configuration.updateConfig(updates, `IP:${clientIP}`);
    
    // Reset Safe Mode service cache to pick up new config
    safeModeService.reset();

    // Return updated configuration (public version)
    const publicConfig = {
      emailValidation: newConfig.emailValidation,
      rateLimiting: newConfig.rateLimiting,
      fileSharing: newConfig.fileSharing,
      safeMode: {
        enabled: newConfig.safeMode.enabled,
        maxChecksPerDay: newConfig.safeMode.maxChecksPerDay,
        maxChecksPerHour: newConfig.safeMode.maxChecksPerHour,
        blockSuspiciousDomains: newConfig.safeMode.blockSuspiciousDomains,
        suspiciousDomains: newConfig.safeMode.suspiciousDomains
      },
      system: {
        logLevel: newConfig.system.logLevel,
        enableMetrics: newConfig.system.enableMetrics,
        cleanupIntervalHours: newConfig.system.cleanupIntervalHours
      },
      version: newConfig.version,
      lastModified: newConfig.lastModified,
      modifiedBy: newConfig.modifiedBy
    };

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: publicConfig
    });

    logger.info(`Configuration updated successfully by IP: ${clientIP}, version: ${newConfig.version}`);
  } catch (error) {
    logger.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

/**
 * GET /api/config/history
 * Get configuration history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await Configuration.getHistory(limit);

    const publicHistory = history.map(config => ({
      version: config.version,
      lastModified: config.lastModified,
      modifiedBy: config.modifiedBy,
      changes: {
        smtpTimeout: config.emailValidation?.smtpTimeout,
        safeModeEnabled: config.safeMode?.enabled
      }
    }));

    res.json({
      success: true,
      data: publicHistory
    });
  } catch (error) {
    logger.error('Error getting configuration history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration history'
    });
  }
});

/**
 * POST /api/config/reset
 * Reset configuration to defaults
 */
router.post('/reset', async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    logger.warn(`Configuration reset requested from IP: ${clientIP}`);

    const defaultConfig = await Configuration.resetToDefault(`IP:${clientIP}`);
    
    // Reset Safe Mode service cache
    safeModeService.reset();

    // Return default configuration (public version)
    const publicConfig = {
      emailValidation: defaultConfig.emailValidation,
      rateLimiting: defaultConfig.rateLimiting,
      fileSharing: defaultConfig.fileSharing,
      safeMode: {
        enabled: defaultConfig.safeMode.enabled,
        maxChecksPerDay: defaultConfig.safeMode.maxChecksPerDay,
        maxChecksPerHour: defaultConfig.safeMode.maxChecksPerHour,
        blockSuspiciousDomains: defaultConfig.safeMode.blockSuspiciousDomains,
        suspiciousDomains: defaultConfig.safeMode.suspiciousDomains
      },
      system: {
        logLevel: defaultConfig.system.logLevel,
        enableMetrics: defaultConfig.system.enableMetrics,
        cleanupIntervalHours: defaultConfig.system.cleanupIntervalHours
      },
      version: defaultConfig.version,
      lastModified: defaultConfig.lastModified,
      modifiedBy: defaultConfig.modifiedBy
    };

    res.json({
      success: true,
      message: 'Configuration reset to defaults',
      data: publicConfig
    });

    logger.warn(`Configuration reset to defaults by IP: ${clientIP}`);
  } catch (error) {
    logger.error('Error resetting configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset configuration'
    });
  }
});

/**
 * GET /api/config/safe-mode/stats
 * Get Safe Mode statistics
 */
router.get('/safe-mode/stats', async (req, res) => {
  try {
    const stats = await safeModeService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting Safe Mode stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Safe Mode statistics'
    });
  }
});

/**
 * GET /api/config/safe-mode/ip/:ip
 * Get IP information for debugging
 */
router.get('/safe-mode/ip/:ip', async (req, res) => {
  try {
    const ip = req.params.ip;
    
    // Basic IP validation
    if (!ip || typeof ip !== 'string' || ip.length > 45) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address'
      });
    }

    const ipInfo = safeModeService.getIPInfo(ip);
    
    res.json({
      success: true,
      data: ipInfo
    });
  } catch (error) {
    logger.error('Error getting IP info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get IP information'
    });
  }
});

/**
 * POST /api/config/safe-mode/reset
 * Reset Safe Mode counters
 */
router.post('/safe-mode/reset', async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    logger.warn(`Safe Mode reset requested from IP: ${clientIP}`);
    
    safeModeService.reset();
    
    res.json({
      success: true,
      message: 'Safe Mode counters reset successfully'
    });

    logger.warn(`Safe Mode counters reset by IP: ${clientIP}`);
  } catch (error) {
    logger.error('Error resetting Safe Mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset Safe Mode counters'
    });
  }
});

export default router;
