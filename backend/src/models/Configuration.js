import mongoose from 'mongoose';
import logger from '../config/logger.js';

/**
 * @typedef {Object} ConfigurationDocument
 * @property {string} _id - Fixed ID "global"
 * @property {string} siteName - Site name
 * @property {string} defaultLanguage - Default language (en/ar)
 * @property {boolean} enableRegistration - Enable user registration
 * @property {string} supportEmail - Support email address
 * @property {Object} apiKeys - API keys object
 * @property {Object} runtime - Runtime settings
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Configuration schema for runtime settings
 * Single-document design with fixed _id: "global"
 */
const configurationSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    default: "global" 
  },
  
  // General settings
  siteName: { 
    type: String, 
    default: "My App",
    maxlength: 100
  },
  defaultLanguage: { 
    type: String, 
    enum: ["en", "ar"], 
    default: "en" 
  },
  enableRegistration: { 
    type: Boolean, 
    default: true 
  },
  supportEmail: { 
    type: String, 
    default: "support@example.com",
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  
  // API Keys (sensitive)
  apiKeys: {
    openai: { 
      type: String, 
      default: "",
      select: false // Never include in queries by default
    },
    stripe: { 
      type: String, 
      default: "",
      select: false // Never include in queries by default
    }
  },
  
  // Runtime settings
  runtime: {
  safeMode: {
      type: Boolean,
      default: false 
    },
    maintenanceMode: { 
      type: Boolean,
      default: false 
    },
    logLevel: {
      type: String,
      enum: ["error", "warn", "info", "debug"], 
      default: "info" 
    },
    rateLimitRPS: { 
      type: Number,
      default: 5, 
      min: 1,
      max: 1000 
    }
  },

  // Metadata
  updatedAt: { 
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false, // We handle updatedAt manually
  collection: 'configurations'
});

// Pre-save hook to update updatedAt
configurationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Get the current configuration (cached)
 * @returns {Promise<ConfigurationDocument>}
 */
configurationSchema.statics.getCurrent = async function() {
  try {
    if (mongoose.connection.readyState !== 1) {
      logger.warn('Database not connected, returning default configuration');
      return this.getDefaultConfig();
    }

    let config = await this.findById("global");
    
    if (!config) {
      // Create default configuration if none exists
      config = new this({});
      await config.save();
      logger.info('Created default configuration');
    }
    
    return config;
  } catch (error) {
    logger.error('Error getting current configuration:', error);
    return this.getDefaultConfig();
  }
};

/**
 * Get default configuration object
 * @returns {ConfigurationDocument}
 */
configurationSchema.statics.getDefaultConfig = function() {
  return {
    _id: "global",
    siteName: "My App",
    defaultLanguage: "en",
    enableRegistration: true,
    supportEmail: "support@example.com",
    apiKeys: {
      openai: "",
      stripe: ""
    },
    runtime: {
      safeMode: false,
      maintenanceMode: false,
      logLevel: "info",
      rateLimitRPS: 5
    },
    updatedAt: new Date()
  };
};

/**
 * Update configuration with validation
 * @param {Object} updates - Configuration updates
 * @param {string} modifiedBy - Who made the changes
 * @returns {Promise<ConfigurationDocument>}
 */
configurationSchema.statics.updateConfig = async function(updates, modifiedBy = 'system') {
  try {
    const currentConfig = await this.getCurrent();
    
    // Validate updates
    const validatedUpdates = this.validateUpdates(updates);
    
    // Deep merge with current config
    const mergedConfig = this.deepMerge(currentConfig.toObject(), validatedUpdates);
    
    // Update the document
    const updatedConfig = await this.findByIdAndUpdate(
      "global",
      { 
        ...mergedConfig,
        updatedAt: new Date()
      },
      { 
        new: true, 
        upsert: true,
        runValidators: true
      }
    );
    
    logger.info(`Configuration updated by ${modifiedBy}`);
    return updatedConfig;
  } catch (error) {
    logger.error('Error updating configuration:', error);
    throw error;
  }
};

/**
 * Validate configuration updates
 * @param {Object} updates - Updates to validate
 * @returns {Object} Validated updates
 */
configurationSchema.statics.validateUpdates = function(updates) {
  const validated = {};
  
  // Validate general settings
  if (updates.siteName !== undefined) {
    validated.siteName = String(updates.siteName).substring(0, 100);
  }
  
  if (updates.defaultLanguage !== undefined) {
    const validLanguages = ["en", "ar"];
    validated.defaultLanguage = validLanguages.includes(updates.defaultLanguage) 
      ? updates.defaultLanguage 
      : "en";
  }
  
  if (updates.enableRegistration !== undefined) {
    validated.enableRegistration = Boolean(updates.enableRegistration);
  }
  
  if (updates.supportEmail !== undefined) {
    const email = String(updates.supportEmail);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validated.supportEmail = email;
    }
  }
  
  // Validate API keys (only if provided)
  if (updates.apiKeys) {
    validated.apiKeys = {};
    if (updates.apiKeys.openai !== undefined) {
      validated.apiKeys.openai = String(updates.apiKeys.openai);
    }
    if (updates.apiKeys.stripe !== undefined) {
      validated.apiKeys.stripe = String(updates.apiKeys.stripe);
    }
  }
  
  // Validate runtime settings
  if (updates.runtime) {
    validated.runtime = {};
    if (updates.runtime.safeMode !== undefined) {
      validated.runtime.safeMode = Boolean(updates.runtime.safeMode);
    }
    if (updates.runtime.maintenanceMode !== undefined) {
      validated.runtime.maintenanceMode = Boolean(updates.runtime.maintenanceMode);
    }
    if (updates.runtime.logLevel !== undefined) {
      const validLevels = ["error", "warn", "info", "debug"];
      validated.runtime.logLevel = validLevels.includes(updates.runtime.logLevel) 
        ? updates.runtime.logLevel 
        : "info";
    }
    if (updates.runtime.rateLimitRPS !== undefined) {
      validated.runtime.rateLimitRPS = Math.max(1, Math.min(1000, Number(updates.runtime.rateLimitRPS)));
    }
  }
  
  return validated;
};

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
configurationSchema.statics.deepMerge = function(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = this.deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
};

/**
 * Set Safe Mode
 * @param {boolean} enabled - Whether to enable safe mode
 * @returns {Promise<ConfigurationDocument>}
 */
configurationSchema.statics.setSafeMode = async function(enabled) {
  return this.updateConfig({ 
    runtime: { safeMode: Boolean(enabled) } 
  }, 'system');
};

/**
 * Get public configuration (without sensitive data)
 * @returns {Promise<Object>}
 */
configurationSchema.statics.getPublicConfig = async function() {
  const config = await this.getCurrent();
  const publicConfig = config.toObject();
  
  // Redact sensitive information
  if (publicConfig.apiKeys) {
    publicConfig.apiKeys = {
      openai: publicConfig.apiKeys.openai ? "****" : "",
      stripe: publicConfig.apiKeys.stripe ? "****" : ""
    };
  }
  
  return publicConfig;
};

/**
 * Upsert default configuration
 * @returns {Promise<ConfigurationDocument>}
 */
configurationSchema.statics.upsertDefaults = async function() {
  try {
    const defaultConfig = this.getDefaultConfig();
    const config = await this.findByIdAndUpdate(
      "global",
      defaultConfig,
      { 
        new: true, 
        upsert: true,
        runValidators: true
      }
    );
    
    logger.info('Configuration upserted with defaults');
    return config;
  } catch (error) {
    logger.error('Error upserting default configuration:', error);
    throw error;
  }
};

const Configuration = mongoose.model('Configuration', configurationSchema);

export default Configuration;
