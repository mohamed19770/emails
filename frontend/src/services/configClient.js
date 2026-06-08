import api from '../api.js';

/**
 * Configuration client service
 * Handles all configuration-related API calls
 */

/**
 * Fetch public configuration
 * @returns {Promise<Object>} Public configuration data
 */
export async function fetchConfig() {
  try {
    const response = await api.get('/config');
    return response.data;
  } catch (error) {
    console.error('Error fetching configuration:', error);
    throw new Error('Failed to load configuration');
  }
}

/**
 * Fetch full configuration (admin only)
 * @returns {Promise<Object>} Full configuration data
 */
export async function fetchFullConfig() {
  try {
    const response = await api.get('/config/full');
    return response.data;
  } catch (error) {
    console.error('Error fetching full configuration:', error);
    throw new Error('Failed to load full configuration');
  }
}

/**
 * Update configuration
 * @param {Object} patch - Configuration updates
 * @returns {Promise<Object>} Updated configuration data
 */
export async function updateConfig(patch) {
  try {
    const response = await api.put('/config', patch);
    return response.data;
  } catch (error) {
    console.error('Error updating configuration:', error);
    throw new Error('Failed to update configuration');
  }
}

/**
 * Toggle Safe Mode
 * @param {boolean} value - Safe Mode value
 * @returns {Promise<Object>} Response data
 */
export async function toggleSafeMode(value) {
  try {
    const response = await api.post('/config/safe-mode', { safeMode: value });
    return response.data;
  } catch (error) {
    console.error('Error toggling Safe Mode:', error);
    throw new Error('Failed to toggle Safe Mode');
  }
}

/**
 * Get health status
 * @returns {Promise<Object>} Health status data
 */
export async function health() {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Error fetching health status:', error);
    throw new Error('Failed to fetch health status');
  }
}

/**
 * Configuration client with retry logic
 */
export class ConfigClient {
  constructor(maxRetries = 3, retryDelay = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Retry wrapper for API calls
   * @param {Function} apiCall - API call function
   * @param {number} retries - Number of retries remaining
   * @returns {Promise<any>} API response
   */
  async withRetry(apiCall, retries = this.maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      if (retries > 0 && this.shouldRetry(error)) {
        console.warn(`API call failed, retrying in ${this.retryDelay}ms... (${retries} retries left)`);
        await this.delay(this.retryDelay);
        return this.withRetry(apiCall, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error should trigger a retry
   * @param {Error} error - Error object
   * @returns {boolean} Whether to retry
   */
  shouldRetry(error) {
    // Retry on network errors or 5xx status codes
    return !error.response || (error.response.status >= 500 && error.response.status < 600);
  }

  /**
   * Delay utility
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch configuration with retry
   * @returns {Promise<Object>} Configuration data
   */
  async fetchConfig() {
    return this.withRetry(() => fetchConfig());
  }

  /**
   * Fetch full configuration with retry
   * @returns {Promise<Object>} Full configuration data
   */
  async fetchFullConfig() {
    return this.withRetry(() => fetchFullConfig());
  }

  /**
   * Update configuration with retry
   * @param {Object} patch - Configuration updates
   * @returns {Promise<Object>} Updated configuration data
   */
  async updateConfig(patch) {
    return this.withRetry(() => updateConfig(patch));
  }

  /**
   * Toggle Safe Mode with retry
   * @param {boolean} value - Safe Mode value
   * @returns {Promise<Object>} Response data
   */
  async toggleSafeMode(value) {
    return this.withRetry(() => toggleSafeMode(value));
  }

  /**
   * Get health status with retry
   * @returns {Promise<Object>} Health status data
   */
  async health() {
    return this.withRetry(() => health());
  }
}

// Export singleton instance
export const configClient = new ConfigClient();

// Export individual functions for backward compatibility
export {
  fetchConfig,
  fetchFullConfig,
  updateConfig,
  toggleSafeMode,
  health
};
