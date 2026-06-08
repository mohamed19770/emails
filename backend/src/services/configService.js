import Configuration from '../models/Configuration.js';
import logger from '../config/logger.js';

/**
 * Configuration service with in-memory caching
 */
class ConfigService {
  constructor() {
    this.cache = null;
    this.cacheTimestamp = 0;
    this.cacheTTL = 30000; // 30 seconds
  }

  /**
   * Get configuration from cache or database
   * @returns {Promise<Object>} Configuration object
   */
  async getConfigCached() {
    const now = Date.now();
    
    // Return cached config if still valid
    if (this.cache && (now - this.cacheTimestamp) < this.cacheTTL) {
      return this.cache;
    }
    
    try {
      // Fetch from database
      const config = await Configuration.getCurrent();
      this.cache = config.toObject();
      this.cacheTimestamp = now;
      
      logger.debug('Configuration cache updated');
      return this.cache;
    } catch (error) {
      logger.error('Error fetching configuration:', error);
      
      // Return cached config if available, otherwise default
      if (this.cache) {
        logger.warn('Using stale cached configuration due to database error');
        return this.cache;
      }
      
      return Configuration.getDefaultConfig();
    }
  }

  /**
   * Get public configuration (non-sensitive)
   * @returns {Promise<Object>} Public configuration
   */
  async getPublicConfig() {
    try {
      const config = await Configuration.getPublicConfig();
      
      // Update cache with full config
      this.cache = config;
      this.cacheTimestamp = Date.now();
      
      return config;
    } catch (error) {
      logger.error('Error getting public configuration:', error);
      
      // Return default config with redacted secrets
      const defaultConfig = Configuration.getDefaultConfig();
      return {
        ...defaultConfig,
        apiKeys: {
          openai: "****",
          stripe: "****"
        }
      };
    }
  }

  /**
   * Update configuration with validation
   * @param {Object} patch - Configuration updates
   * @param {string} modifiedBy - Who made the changes
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfig(patch, modifiedBy = 'system') {
    try {
      const updatedConfig = await Configuration.updateConfig(patch, modifiedBy);
      
      // Clear cache to force refresh
      this.clearCache();
      
      logger.info(`Configuration updated by ${modifiedBy}`);
      return updatedConfig.toObject();
    } catch (error) {
      logger.error('Error updating configuration:', error);
      throw error;
    }
  }

  /**
   * Set Safe Mode
   * @param {boolean} enabled - Whether to enable safe mode
   * @returns {Promise<Object>} Updated configuration
   */
  async setSafeMode(enabled) {
    try {
      const updatedConfig = await Configuration.setSafeMode(enabled);
      
      // Clear cache to force refresh
      this.clearCache();
      
      logger.info(`Safe Mode ${enabled ? 'enabled' : 'disabled'}`);
      return updatedConfig.toObject();
    } catch (error) {
      logger.error('Error setting Safe Mode:', error);
      throw error;
    }
  }

  /**
   * Get Safe Mode status
   * @returns {Promise<boolean>} Safe Mode status
   */
  async getSafeModeStatus() {
    try {
      const config = await this.getConfigCached();
      return config.runtime?.safeMode || false;
    } catch (error) {
      logger.error('Error getting Safe Mode status:', error);
      return false;
    }
  }

  /**
   * Get maintenance mode status
   * @returns {Promise<boolean>} Maintenance mode status
   */
  async getMaintenanceModeStatus() {
    try {
      const config = await this.getConfigCached();
      return config.runtime?.maintenanceMode || false;
    } catch (error) {
      logger.error('Error getting maintenance mode status:', error);
      return false;
    }
  }

  /**
   * Get rate limit RPS
   * @returns {Promise<number>} Rate limit RPS
   */
  async getRateLimitRPS() {
    try {
      const config = await this.getConfigCached();
      return config.runtime?.rateLimitRPS || 5;
    } catch (error) {
      logger.error('Error getting rate limit RPS:', error);
      return 5;
    }
  }

  /**
   * Get log level
   * @returns {Promise<string>} Log level
   */
  async getLogLevel() {
    try {
      const config = await this.getConfigCached();
      return config.runtime?.logLevel || 'info';
    } catch (error) {
      logger.error('Error getting log level:', error);
      return 'info';
    }
  }

  /**
   * Get API key (sensitive)
   * @param {string} keyName - API key name (openai, stripe)
   * @returns {Promise<string>} API key value
   */
  async getApiKey(keyName) {
    try {
      const config = await Configuration.getCurrent();
      return config.apiKeys?.[keyName] || '';
    } catch (error) {
      logger.error(`Error getting API key ${keyName}:`, error);
      return '';
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.cache = null;
    this.cacheTimestamp = 0;
    logger.debug('Configuration cache cleared');
  }

  /**
   * Initialize configuration with defaults
   * @returns {Promise<Object>} Initialized configuration
   */
  async initializeDefaults() {
    try {
      const config = await Configuration.upsertDefaults();
      this.clearCache();
      logger.info('Configuration initialized with defaults');
      return config.toObject();
    } catch (error) {
      logger.error('Error initializing configuration defaults:', error);
      throw error;
    }
  }

  /**
   * Get configuration for outbound operations
   * @returns {Promise<Object>} Configuration for outbound operations
   */
  async getOutboundConfig() {
    try {
      const config = await this.getConfigCached();
      return {
        safeMode: config.runtime?.safeMode || false,
        maintenanceMode: config.runtime?.maintenanceMode || false,
        openaiKey: config.apiKeys?.openai || '',
        stripeKey: config.apiKeys?.stripe || ''
      };
    } catch (error) {
      logger.error('Error getting outbound configuration:', error);
      return {
        safeMode: false,
        maintenanceMode: false,
        openaiKey: '',
        stripeKey: ''
      };
    }
  }
}

// Export singleton instance
export default new ConfigService();
