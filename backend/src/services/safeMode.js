import mongoose from 'mongoose';
import logger from '../config/logger.js';
import Configuration from '../models/Configuration.js';

/**
 * Safe Mode service for protecting server IP and managing rate limits
 */
class SafeModeService {
  constructor() {
    this.dailyChecks = new Map(); // IP -> { count, date }
    this.hourlyChecks = new Map(); // IP -> { count, hour }
    this.blockedIPs = new Set(); // Temporarily blocked IPs
    this.config = null;
    this.lastConfigUpdate = 0;
    
    // Cleanup intervals
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Get current configuration (with caching)
   */
  async getConfig() {
    const now = Date.now();
    if (!this.config || now - this.lastConfigUpdate > 60000) { // Cache for 1 minute
      try {
        this.config = await Configuration.getCurrent();
        this.lastConfigUpdate = now;
      } catch (error) {
        logger.error('Error getting Safe Mode configuration:', error);
        // Use default config if database is unavailable
        this.config = Configuration.getDefaultConfig();
      }
    }
    return this.config;
  }

  /**
   * Check if Safe Mode is enabled
   */
  async isEnabled() {
    const config = await this.getConfig();
    return config.safeMode?.enabled || false;
  }

  /**
   * Check if IP is allowed to make requests
   */
  async isIPAllowed(ip, requestType = 'email_check') {
    try {
      const config = await this.getConfig();
      
      if (!config.safeMode?.enabled) {
        return { allowed: true, reason: 'safe_mode_disabled' };
      }

      // Check if IP is temporarily blocked
      if (this.blockedIPs.has(ip)) {
        return { allowed: false, reason: 'ip_temporarily_blocked' };
      }

      // Check suspicious domains if enabled
      if (config.safeMode.blockSuspiciousDomains && requestType === 'email_check') {
        // This will be checked in the email validation service
      }

      // Check daily limits
      const dailyLimit = config.safeMode.maxChecksPerDay || 100;
      const dailyCount = this.getDailyCount(ip);
      
      if (dailyCount >= dailyLimit) {
        this.blockIP(ip, 'daily_limit_exceeded');
        return { 
          allowed: false, 
          reason: 'daily_limit_exceeded',
          limit: dailyLimit,
          current: dailyCount
        };
      }

      // Check hourly limits
      const hourlyLimit = config.safeMode.maxChecksPerHour || 20;
      const hourlyCount = this.getHourlyCount(ip);
      
      if (hourlyCount >= hourlyLimit) {
        return { 
          allowed: false, 
          reason: 'hourly_limit_exceeded',
          limit: hourlyLimit,
          current: hourlyCount
        };
      }

      return { allowed: true, reason: 'within_limits' };
    } catch (error) {
      logger.error('Error checking IP allowance:', error);
      // Fail open - allow request if there's an error
      return { allowed: true, reason: 'error_checking_limits' };
    }
  }

  /**
   * Record a request from an IP
   */
  async recordRequest(ip, requestType = 'email_check') {
    try {
      const config = await this.getConfig();
      
      if (!config.safeMode?.enabled) {
        return;
      }

      // Update daily count
      const today = new Date().toDateString();
      const dailyData = this.dailyChecks.get(ip) || { count: 0, date: today };
      
      if (dailyData.date !== today) {
        dailyData.count = 1;
        dailyData.date = today;
      } else {
        dailyData.count++;
      }
      this.dailyChecks.set(ip, dailyData);

      // Update hourly count
      const currentHour = new Date().getHours();
      const hourlyData = this.hourlyChecks.get(ip) || { count: 0, hour: currentHour };
      
      if (hourlyData.hour !== currentHour) {
        hourlyData.count = 1;
        hourlyData.hour = currentHour;
      } else {
        hourlyData.count++;
      }
      this.hourlyChecks.set(ip, hourlyData);

      logger.debug(`Recorded ${requestType} request from IP: ${ip}, Daily: ${dailyData.count}, Hourly: ${hourlyData.count}`);
    } catch (error) {
      logger.error('Error recording request:', error);
    }
  }

  /**
   * Check if domain is suspicious
   */
  async isSuspiciousDomain(domain) {
    try {
      const config = await this.getConfig();
      
      if (!config.safeMode?.blockSuspiciousDomains) {
        return false;
      }

      const suspiciousDomains = config.safeMode.suspiciousDomains || [];
      return suspiciousDomains.some(suspiciousDomain => 
        domain.toLowerCase().includes(suspiciousDomain.toLowerCase())
      );
    } catch (error) {
      logger.error('Error checking suspicious domain:', error);
      return false;
    }
  }

  /**
   * Get daily count for an IP
   */
  getDailyCount(ip) {
    const today = new Date().toDateString();
    const data = this.dailyChecks.get(ip);
    return (data && data.date === today) ? data.count : 0;
  }

  /**
   * Get hourly count for an IP
   */
  getHourlyCount(ip) {
    const currentHour = new Date().getHours();
    const data = this.hourlyChecks.get(ip);
    return (data && data.hour === currentHour) ? data.count : 0;
  }

  /**
   * Block an IP temporarily
   */
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    logger.warn(`Blocked IP ${ip} due to: ${reason}`);
    
    // Unblock after 1 hour
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      logger.info(`Unblocked IP ${ip}`);
    }, 60 * 60 * 1000);
  }

  /**
   * Get Safe Mode statistics
   */
  async getStats() {
    try {
      const config = await this.getConfig();
      const now = new Date();
      const today = now.toDateString();
      const currentHour = now.getHours();

      // Count active IPs
      const activeIPs = new Set();
      for (const [ip, data] of this.dailyChecks.entries()) {
        if (data.date === today) {
          activeIPs.add(ip);
        }
      }

      // Count hourly active IPs
      const hourlyActiveIPs = new Set();
      for (const [ip, data] of this.hourlyChecks.entries()) {
        if (data.hour === currentHour) {
          hourlyActiveIPs.add(ip);
        }
      }

      // Calculate total requests
      let totalDailyRequests = 0;
      let totalHourlyRequests = 0;
      
      for (const [ip, data] of this.dailyChecks.entries()) {
        if (data.date === today) {
          totalDailyRequests += data.count;
        }
      }
      
      for (const [ip, data] of this.hourlyChecks.entries()) {
        if (data.hour === currentHour) {
          totalHourlyRequests += data.count;
        }
      }

      return {
        enabled: config.safeMode?.enabled || false,
        limits: {
          maxChecksPerDay: config.safeMode?.maxChecksPerDay || 100,
          maxChecksPerHour: config.safeMode?.maxChecksPerHour || 20
        },
        current: {
          activeIPs: activeIPs.size,
          hourlyActiveIPs: hourlyActiveIPs.size,
          totalDailyRequests,
          totalHourlyRequests,
          blockedIPs: this.blockedIPs.size
        },
        suspiciousDomains: {
          enabled: config.safeMode?.blockSuspiciousDomains || false,
          count: config.safeMode?.suspiciousDomains?.length || 0
        }
      };
    } catch (error) {
      logger.error('Error getting Safe Mode stats:', error);
      return {
        enabled: false,
        error: 'Failed to get statistics'
      };
    }
  }

  /**
   * Cleanup old data
   */
  cleanup() {
    try {
      const now = new Date();
      const today = now.toDateString();
      const currentHour = now.getHours();

      // Clean up old daily data
      for (const [ip, data] of this.dailyChecks.entries()) {
        if (data.date !== today) {
          this.dailyChecks.delete(ip);
        }
      }

      // Clean up old hourly data
      for (const [ip, data] of this.hourlyChecks.entries()) {
        if (data.hour !== currentHour) {
          this.hourlyChecks.delete(ip);
        }
      }

      logger.debug('Safe Mode cleanup completed');
    } catch (error) {
      logger.error('Error during Safe Mode cleanup:', error);
    }
  }

  /**
   * Reset all counters (for testing or manual reset)
   */
  reset() {
    this.dailyChecks.clear();
    this.hourlyChecks.clear();
    this.blockedIPs.clear();
    this.config = null;
    this.lastConfigUpdate = 0;
    logger.info('Safe Mode counters reset');
  }

  /**
   * Get IP information for debugging
   */
  getIPInfo(ip) {
    const dailyData = this.dailyChecks.get(ip);
    const hourlyData = this.hourlyChecks.get(ip);
    const isBlocked = this.blockedIPs.has(ip);

    return {
      ip,
      isBlocked,
      daily: dailyData ? {
        count: dailyData.count,
        date: dailyData.date
      } : { count: 0, date: null },
      hourly: hourlyData ? {
        count: hourlyData.count,
        hour: hourlyData.hour
      } : { count: 0, hour: null }
    };
  }
}

export default new SafeModeService();
