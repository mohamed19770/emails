import configService from './configService.js';
import logger from '../config/logger.js';

/**
 * Outbound operations guard
 * Prevents outbound operations when Safe Mode is enabled
 */

/**
 * Ensure outbound operations are allowed
 * Throws error if Safe Mode is enabled
 * @param {string} operation - Operation name for logging
 * @throws {Error} If Safe Mode is enabled
 */
export const ensureOutboundAllowed = async (operation = 'outbound operation') => {
  try {
    const safeModeEnabled = await configService.getSafeModeStatus();
    
    if (safeModeEnabled) {
      logger.warn(`Safe Mode: Blocked ${operation}`);
      throw new Error('SAFE_MODE_ENABLED');
    }
  } catch (error) {
    if (error.message === 'SAFE_MODE_ENABLED') {
      throw error;
    }
    
    logger.error(`Error checking Safe Mode status for ${operation}:`, error);
    // In case of error, allow the operation to proceed
    // This prevents the guard from breaking the application
  }
};

/**
 * Check if outbound operations are allowed
 * @param {string} operation - Operation name for logging
 * @returns {Promise<boolean>} True if outbound operations are allowed
 */
export const isOutboundAllowed = async (operation = 'outbound operation') => {
  try {
    const safeModeEnabled = await configService.getSafeModeStatus();
    return !safeModeEnabled;
  } catch (error) {
    logger.error(`Error checking Safe Mode status for ${operation}:`, error);
    // In case of error, allow the operation to proceed
    return true;
  }
};

/**
 * Get outbound configuration
 * @returns {Promise<Object>} Outbound configuration
 */
export const getOutboundConfig = async () => {
  try {
    return await configService.getOutboundConfig();
  } catch (error) {
    logger.error('Error getting outbound configuration:', error);
    return {
      safeMode: false,
      maintenanceMode: false,
      openaiKey: '',
      stripeKey: ''
    };
  }
};

/**
 * Guard wrapper for outbound operations
 * @param {Function} operation - Operation to guard
 * @param {string} operationName - Name of the operation
 * @returns {Promise<any>} Operation result
 */
export const guardOutboundOperation = async (operation, operationName = 'outbound operation') => {
  await ensureOutboundAllowed(operationName);
  return operation();
};

export default {
  ensureOutboundAllowed,
  isOutboundAllowed,
  getOutboundConfig,
  guardOutboundOperation
};
