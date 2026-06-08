import configService from '../services/configService.js';
import logger from '../config/logger.js';

/**
 * Safe Mode middleware
 * Blocks all non-GET/non-OPTIONS requests when Safe Mode is enabled
 */
export const safeModeMiddleware = async (req, res, next) => {
  try {
    // Disabled for now - no database required
    const safeModeEnabled = false;
    
    // Attach safe mode status to request
    req.safeMode = safeModeEnabled;
    
    // Allow GET and OPTIONS requests even in Safe Mode
    if (req.method === 'GET' || req.method === 'OPTIONS') {
      return next();
    }
    
    // Block all other requests if Safe Mode is enabled
    if (safeModeEnabled) {
      logger.warn(`Safe Mode: Blocked ${req.method} ${req.path} from ${req.ip}`);
      
      return res.status(503).json({
        error: 'SAFE_MODE_ENABLED',
        message: 'Write operations are disabled.',
        details: {
          method: req.method,
          path: req.path,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in Safe Mode middleware:', error);
    
    // In case of error, allow the request to proceed
    // This prevents the middleware from breaking the application
    req.safeMode = false;
    next();
  }
};

export default safeModeMiddleware;