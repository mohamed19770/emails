import express from 'express';
import configService from '../services/configService.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/config
 * Get public configuration (non-sensitive)
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const config = await configService.getPublicConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error getting public configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration'
    });
  }
}));

/**
 * GET /api/config/full
 * Get full configuration (admin only, with redacted secrets)
 */
router.get('/full', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const config = await configService.getPublicConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error getting full configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get full configuration'
    });
  }
}));

/**
 * PUT /api/config
 * Update configuration (admin only)
 */
router.put('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const updates = req.body;
    const modifiedBy = req.user?.id || 'admin';
    
    // Validate that updates object exists
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration updates'
      });
    }
    
    // Log configuration change attempt
    logger.info(`Configuration update attempt by ${modifiedBy}`, {
      updates: Object.keys(updates),
      ip: req.ip
    });
    
    // Update configuration
    const updatedConfig = await configService.updateConfig(updates, modifiedBy);
    
    // Return updated configuration (public version)
    const publicConfig = await configService.getPublicConfig();
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: publicConfig
    });
    
    logger.info(`Configuration updated successfully by ${modifiedBy}`);
  } catch (error) {
    logger.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
}));

/**
 * POST /api/config/safe-mode
 * Toggle Safe Mode (admin only)
 */
router.post('/safe-mode', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { safeMode } = req.body;
    const modifiedBy = req.user?.id || 'admin';
    
    if (typeof safeMode !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'safeMode must be a boolean value'
      });
    }
    
    // Update Safe Mode
    const updatedConfig = await configService.setSafeMode(safeMode);
    
    logger.info(`Safe Mode ${safeMode ? 'enabled' : 'disabled'} by ${modifiedBy}`);
    
    res.json({
      success: true,
      message: `Safe Mode ${safeMode ? 'enabled' : 'disabled'} successfully`,
      data: {
        safeMode: updatedConfig.runtime.safeMode
      }
    });
  } catch (error) {
    logger.error('Error toggling Safe Mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle Safe Mode'
    });
  }
}));

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const safeMode = await configService.getSafeModeStatus();
    const maintenanceMode = await configService.getMaintenanceModeStatus();
    
    // Check database connection
    const mongoose = await import('mongoose');
    const mongoOk = mongoose.default.connection.readyState === 1;
    
    res.json({
      ok: true,
      uptime: process.uptime(),
      version: '1.0.0',
      safeMode,
      maintenanceMode,
      mongo: {
        ok: mongoOk,
        state: mongoose.default.connection.readyState
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in health check:', error);
    res.status(500).json({
      ok: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}));

export default router;
