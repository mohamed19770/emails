import { promises as dns } from 'dns';
import { createConnection } from 'net';
import logger from '../config/logger.js';

/**
 * Email Validation Service
 * Handles format validation, MX lookups, and SMTP probing
 */
class EmailValidationService {
  constructor() {
    this.smtpTimeout = 3000; // 3 seconds
    this.maxConcurrent = 5; // Max 5 concurrent SMTP checks
    this.batchSize = 50; // Process emails in batches of 50
  }

  /**
   * Validate email format using robust regex
   */
  validateEmailFormat(email) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Resolve MX records for a domain
   */
  async resolveMX(domain) {
    try {
      const mxRecords = await Promise.race([
        dns.resolveMx(domain),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DNS timeout')), 5000)
        )
      ]);
      return { hasMX: mxRecords && mxRecords.length > 0 };
    } catch (error) {
      logger.debug(`MX resolution failed for ${domain}:`, error.message);
      return { hasMX: false };
    }
  }

  /**
   * SMTP probe for deliverability check
   */
  async smtpProbe(email, domain) {
    try {
      // Get MX records first
      const mxResult = await this.resolveMX(domain);
      if (!mxResult.hasMX) {
        return { deliverable: false, reason: 'No MX records found' };
      }

      const mxRecords = await dns.resolveMx(domain);
      const primaryMX = mxRecords[0].exchange;

      return new Promise((resolve) => {
        const socket = createConnection(25, primaryMX, () => {
          let step = 0;
          const commands = [
            `HELO localhost\r\n`,
            `MAIL FROM: <test@localhost>\r\n`,
            `RCPT TO: <${email}>\r\n`,
            `QUIT\r\n`
          ];

          const sendCommand = () => {
            if (step < commands.length) {
              socket.write(commands[step]);
              step++;
            }
          };

          socket.on('data', (data) => {
            const response = data.toString();
            logger.debug(`SMTP response for ${email}:`, response);

            if (response.includes('250') || response.includes('220')) {
              if (step < commands.length) {
                setTimeout(sendCommand, 100);
              } else {
                socket.end();
                resolve({ deliverable: true, reason: 'SMTP probe successful' });
              }
            } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
              socket.end();
              resolve({ deliverable: false, reason: 'Mailbox does not exist' });
            } else if (response.includes('421') || response.includes('450') || response.includes('451')) {
              socket.end();
              resolve({ deliverable: false, reason: 'Server temporarily unavailable' });
            } else {
              if (step < commands.length) {
                setTimeout(sendCommand, 100);
              } else {
                socket.end();
                resolve({ deliverable: false, reason: 'Unexpected SMTP response' });
              }
            }
          });

          socket.on('error', (error) => {
            logger.debug(`SMTP error for ${email}:`, error.message);
            resolve({ deliverable: false, reason: 'Connection error: ' + error.message });
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve({ deliverable: false, reason: 'Connection timeout' });
          });

          socket.setTimeout(this.smtpTimeout);
          sendCommand();
        });

        socket.on('error', (error) => {
          logger.debug(`SMTP connection error for ${email}:`, error.message);
          resolve({ deliverable: false, reason: 'Connection failed: ' + error.message });
        });

        socket.setTimeout(this.smtpTimeout, () => {
          socket.destroy();
          resolve({ deliverable: false, reason: 'Connection timeout' });
        });
      });
    } catch (error) {
      logger.debug(`SMTP probe error for ${email}:`, error.message);
      return { deliverable: false, reason: 'Probe failed: ' + error.message };
    }
  }

  /**
   * Process a single email with full validation
   */
  async processEmailFull(email) {
    const startTime = new Date();
    const domain = email.split('@')[1];

    try {
      // Step 1: Format validation
      if (!this.validateEmailFormat(email)) {
        return {
          email,
          status: 'invalid',
          reason: 'Invalid email format',
          domain,
          hasMX: false,
          method: 'regex',
          checkedAt: startTime.toISOString()
        };
      }

      // Step 2: MX lookup
      const mxResult = await this.resolveMX(domain);
      if (!mxResult.hasMX) {
        return {
          email,
          status: 'invalid',
          reason: 'No MX records found',
          domain,
          hasMX: false,
          method: 'mx',
          checkedAt: startTime.toISOString()
        };
      }

      // Step 3: SMTP probe
      const smtpResult = await this.smtpProbe(email, domain);
      return {
        email,
        status: smtpResult.deliverable ? 'valid' : 'risky',
        reason: smtpResult.reason,
        domain,
        hasMX: true,
        method: 'smtp',
        checkedAt: startTime.toISOString()
      };
    } catch (error) {
      logger.error(`Email processing error for ${email}:`, error);
      return {
        email,
        status: 'unknown',
        reason: 'Processing error: ' + error.message,
        domain,
        hasMX: false,
        method: 'error',
        checkedAt: startTime.toISOString()
      };
    }
  }

  /**
   * Process a single email in safe mode (no SMTP)
   */
  async processEmailSafe(email) {
    const startTime = new Date();
    const domain = email.split('@')[1];

    try {
      // Step 1: Format validation
      if (!this.validateEmailFormat(email)) {
        return {
          email,
          status: 'invalid',
          reason: 'Invalid email format',
          domain,
          hasMX: false,
          method: 'regex',
          checkedAt: startTime.toISOString()
        };
      }

      // Step 2: MX lookup only
      const mxResult = await this.resolveMX(domain);
      return {
        email,
        status: mxResult.hasMX ? 'valid' : 'invalid',
        reason: mxResult.hasMX ? 'Valid format and MX records' : 'No MX records found',
        domain,
        hasMX: mxResult.hasMX,
        method: 'mx',
        checkedAt: startTime.toISOString()
      };
    } catch (error) {
      logger.error(`Safe mode email processing error for ${email}:`, error);
      return {
        email,
        status: 'unknown',
        reason: 'Processing error: ' + error.message,
        domain,
        hasMX: false,
        method: 'error',
        checkedAt: startTime.toISOString()
      };
    }
  }

  /**
   * Process emails in batches with concurrency control
   */
  async processEmailsBatch(emails, safeMode = false) {
    const results = [];
    const total = emails.length;
    let processed = 0;

    logger.info(`Starting batch processing: ${total} emails, safeMode: ${safeMode}`);

    // Process in batches
    for (let i = 0; i < emails.length; i += this.batchSize) {
      const batch = emails.slice(i, i + this.batchSize);
      const batchPromises = batch.map(async (email) => {
        try {
          const result = safeMode 
            ? await this.processEmailSafe(email)
            : await this.processEmailFull(email);
          
          processed++;
          logger.debug(`Processed ${processed}/${total}: ${email}`);
          return result;
        } catch (error) {
          processed++;
          logger.error(`Batch processing error for ${email}:`, error);
          return {
            email,
            status: 'unknown',
            reason: 'Batch processing error: ' + error.message,
            domain: email.split('@')[1] || 'unknown',
            hasMX: false,
            method: 'error',
            checkedAt: new Date().toISOString()
          };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid overwhelming servers
      if (i + this.batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Batch processing completed: ${results.length} results`);
    return results;
  }
}

export default new EmailValidationService();
