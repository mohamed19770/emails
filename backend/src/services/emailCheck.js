import { promises as dns } from 'dns';
import { createConnection } from 'net';
import { connect } from 'tls';
import logger from '../config/logger.js';
import EmailCheck from '../models/EmailCheck.js';
import Configuration from '../models/Configuration.js';

/**
 * Email validation service with comprehensive checking
 */
class EmailCheckService {
  constructor() {
    this.timeout = parseInt(process.env.SMTP_PROBE_TIMEOUT_MS) || 8000;
    this.defaultPorts = [587, 25, 465]; // 465 is TLS
    this.config = null;
    this.lastConfigUpdate = 0;
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
        logger.error('Error getting email check configuration:', error);
        // Use default config if database is unavailable
        this.config = Configuration.getDefaultConfig();
      }
    }
    return this.config;
  }

  /**
   * Validate email format using robust regex
   */
  isValidEmailFormat(email) {
    // RFC 5322 compliant regex (simplified but robust)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  /**
   * Extract domain from email safely
   */
  extractDomain(email) {
    const parts = email.split('@');
    if (parts.length !== 2) {
      throw new Error('Invalid email format');
    }
    return parts[1].toLowerCase().trim();
  }

  /**
   * Resolve MX records for a domain
   */
  async resolveMx(domain) {
    try {
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.debug(`MX resolution failed for ${domain}:`, error.message);
      return [];
    }
  }

  /**
   * Probe SMTP server for banner
   */
  async probeSmtp(host, port, useTls = false, timeoutMs = null) {
    // Get timeout from configuration if not provided
    if (timeoutMs === null) {
      const config = await this.getConfig();
      timeoutMs = config.emailValidation?.smtpTimeout || this.timeout;
    }
    return new Promise((resolve) => {
      let socket;
      let banner = '';
      let responseCode = null;
      let isResolved = false;
      const startTime = Date.now();

      const resolveWithResult = (result) => {
        if (!isResolved) {
          isResolved = true;
          if (socket) {
            socket.destroy();
          }
          resolve(result);
        }
      };

      try {
        if (useTls) {
          socket = connect({
            host,
            port,
            timeout: timeoutMs,
            rejectUnauthorized: false // Allow self-signed certificates
          });
        } else {
          socket = createConnection({
            host,
            port,
            timeout: timeoutMs
          });
        }

        socket.on('connect', () => {
          logger.debug(`Connected to SMTP server: ${host}:${port} (TLS: ${useTls})`);
        });

        socket.on('data', (data) => {
          const response = data.toString();
          banner += response;
          
          // Extract response code (first 3 digits)
          if (!responseCode && response.length >= 3) {
            responseCode = response.substring(0, 3);
          }

          // SMTP servers typically send a 220 response code for greeting
          if (response.includes('220')) {
            resolveWithResult({
              success: true,
              banner: banner.trim(),
              responseCode,
              smtpStatus: 'open',
              duration: Date.now() - startTime
            });
          }
        });

        socket.on('error', (error) => {
          logger.debug(`SMTP connection error for ${host}:${port}:`, error.message);
          
          let smtpStatus = 'error';
          if (error.code === 'ECONNREFUSED') {
            smtpStatus = 'closed';
          } else if (error.code === 'ETIMEDOUT') {
            smtpStatus = 'timeout';
          }

          resolveWithResult({
            success: false,
            banner: null,
            responseCode: null,
            smtpStatus,
            error: error.message,
            duration: Date.now() - startTime
          });
        });

        socket.on('timeout', () => {
          logger.debug(`SMTP connection timeout for ${host}:${port}`);
          resolveWithResult({
            success: false,
            banner: null,
            responseCode: null,
            smtpStatus: 'timeout',
            error: 'Connection timeout',
            duration: Date.now() - startTime
          });
        });

        // Fallback timeout
        setTimeout(() => {
          resolveWithResult({
            success: false,
            banner: null,
            responseCode: null,
            smtpStatus: 'timeout',
            error: 'Connection timeout',
            duration: Date.now() - startTime
          });
        }, timeoutMs);

      } catch (error) {
        resolveWithResult({
          success: false,
          banner: null,
          responseCode: null,
          smtpStatus: 'error',
          error: error.message,
          duration: Date.now() - startTime
        });
      }
    });
  }

  /**
   * Classify result based on validation steps
   */
  classifyResult({ formatOK, mx, banner, err }) {
    let deliverability = 'unknown';
    let smtpStatus = null;
    let responseCode = null;

    // Format validation
    if (!formatOK) {
      return {
        deliverability: 'undeliverable',
        smtpStatus: null,
        responseCode: null,
        reason: 'invalid_format'
      };
    }

    // MX records check
    if (!mx || mx.length === 0) {
      return {
        deliverability: 'unknown',
        smtpStatus: null,
        responseCode: null,
        reason: 'mx_not_found'
      };
    }

    // SMTP probe results
    if (banner && banner.success) {
      smtpStatus = banner.smtpStatus;
      responseCode = banner.responseCode;
      
      // We got a banner but didn't verify the actual mailbox
      // So we can't be certain about deliverability
      deliverability = 'unknown';
    } else if (err) {
      smtpStatus = err.smtpStatus || 'error';
      responseCode = err.responseCode;
      deliverability = 'unknown';
    }

    return {
      deliverability,
      smtpStatus,
      responseCode,
      reason: smtpStatus === 'open' ? 'smtp_open' : 'smtp_issue'
    };
  }

  /**
   * Check if email was recently validated
   */
  async getRecentCheck(email, hours = 24) {
    try {
      return await EmailCheck.getRecentCheck(email, hours);
    } catch (error) {
      logger.error('Error getting recent check:', error);
      return null;
    }
  }

  /**
   * Save email check result to database
   */
  async saveEmailCheck(email, result, jobId = null) {
    try {
      const emailCheck = new EmailCheck({
        email: email.toLowerCase(),
        domain: result.domain,
        isValidFormat: result.formatOK,
        mx: (result.mx || []).filter(mx => mx && mx.exchange && mx.exchange.trim()),
        smtpBanner: result.banner?.banner || null,
        smtpStatus: result.classification.smtpStatus,
        deliverability: result.classification.deliverability,
        responseCode: result.classification.responseCode,
        attempts: 1,
        jobId,
        rawLog: Array.isArray(result.rawLog) ? result.rawLog.join('\n') : result.rawLog || null
      });

      return await emailCheck.save();
    } catch (error) {
      logger.error('Error saving email check:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive email validation
   */
  async validateEmail(email, jobId = null) {
    const startTime = Date.now();
    logger.info(`Starting email validation for: ${email}`);

    const result = {
      email: email.toLowerCase(),
      domain: null,
      formatOK: false,
      mx: [],
      banner: null,
      classification: {
        deliverability: 'unknown',
        smtpStatus: null,
        responseCode: null,
        reason: 'unknown'
      },
      rawLog: []
    };

    try {
      // Check for recent validation first
      const recentCheck = await this.getRecentCheck(email);
      if (recentCheck) {
        logger.info(`Using cached result for: ${email}`);
        return recentCheck;
      }

      // Step 1: Validate email format
      result.formatOK = this.isValidEmailFormat(email);
      result.rawLog.push(`Format validation: ${result.formatOK ? 'PASS' : 'FAIL'}`);

      if (!result.formatOK) {
        result.classification = this.classifyResult({ formatOK: false });
        await this.saveEmailCheck(email, result, jobId);
        return result;
      }

      // Step 2: Extract domain
      try {
        result.domain = this.extractDomain(email);
        result.rawLog.push(`Domain extracted: ${result.domain}`);
      } catch (error) {
        result.classification = { deliverability: 'undeliverable', reason: 'invalid_domain' };
        await this.saveEmailCheck(email, result, jobId);
        return result;
      }

      // Step 3: Resolve MX records
      result.mx = await this.resolveMx(result.domain);
      result.rawLog.push(`MX records found: ${result.mx.length}`);

      if (result.mx.length === 0) {
        result.classification = this.classifyResult({ formatOK: true, mx: [] });
        await this.saveEmailCheck(email, result, jobId);
        return result;
      }

      // Step 4: Probe SMTP servers
      const primaryMX = result.mx[0];
      result.rawLog.push(`Probing primary MX: ${primaryMX.exchange}`);

      // Try different ports for the primary MX
      for (const port of this.defaultPorts) {
        const useTls = port === 465;
        result.rawLog.push(`Trying port ${port} (TLS: ${useTls})`);
        
        const probeResult = await this.probeSmtp(primaryMX.exchange, port, useTls, this.timeout);
        
        if (probeResult.success) {
          result.banner = probeResult;
          result.rawLog.push(`SMTP probe successful on port ${port}`);
          break;
        } else {
          result.rawLog.push(`SMTP probe failed on port ${port}: ${probeResult.error}`);
        }
      }

      // Step 5: Classify result
      result.classification = this.classifyResult({
        formatOK: result.formatOK,
        mx: result.mx,
        banner: result.banner,
        err: result.banner && !result.banner.success ? result.banner : null
      });

      // Save result to database
      await this.saveEmailCheck(email, result, jobId);

      const duration = Date.now() - startTime;
      logger.info(`Email validation completed for ${email} in ${duration}ms. Deliverability: ${result.classification.deliverability}`);

      return result;
    } catch (error) {
      logger.error(`Email validation failed for ${email}:`, error);
      
      result.classification = {
        deliverability: 'unknown',
        smtpStatus: 'error',
        responseCode: null,
        reason: 'validation_error'
      };
      result.rawLog.push(`Validation error: ${error.message}`);

      await this.saveEmailCheck(email, result, jobId);
      return result;
    }
  }

  /**
   * Validate multiple emails in batch
   */
  async validateEmailsBatch(emails, jobId = null) {
    logger.info(`Starting batch validation for ${emails.length} emails`);
    
    const config = await this.getConfig();
    const batchSize = config.emailValidation?.batchSize || 5;
    const maxConcurrent = config.emailValidation?.maxConcurrentChecks || 5;
    
    const results = [];
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      // Limit concurrent requests based on configuration
      const limitedBatch = batch.slice(0, maxConcurrent);
      const batchPromises = limitedBatch.map(email => this.validateEmail(email, jobId));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to avoid overwhelming servers
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Batch validation error for batch starting at index ${i}:`, error);
        // Add error results for failed batch
        batch.forEach(email => {
          results.push({
            email: email.toLowerCase(),
            domain: null,
            formatOK: false,
            mx: [],
            banner: null,
            classification: {
              deliverability: 'unknown',
              smtpStatus: 'error',
              responseCode: null,
              reason: 'batch_error'
            },
            rawLog: [`Batch processing error: ${error.message}`]
          });
        });
      }
    }

    logger.info(`Batch validation completed. Processed ${results.length} emails`);
    return results;
  }
}

export default new EmailCheckService();