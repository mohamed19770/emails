/**
 * Non-Delivering SMTP (ND-SMTP) handshake
 * Safe email verification with same-session catch-all detection
 */

import { createConnection } from 'net';
import { connect } from 'tls';
import { randomBytes } from 'crypto';
import pLimit from 'p-limit';
import logger from '../config/logger.js';

// Safety limits
const MAX_CONCURRENT_CONNECTIONS = 3;
const CONNECT_TIMEOUT = 3000; // 3 seconds
const COMMAND_TIMEOUT = 3000; // 3 seconds
const OVERALL_TIMEOUT = 8000; // 8 seconds total
const COMMAND_PACING_MIN = 50; // 50ms
const COMMAND_PACING_MAX = 150; // 150ms

// Connection limiter
const connectionLimiter = pLimit(MAX_CONCURRENT_CONNECTIONS);

/**
 * Generate random high-entropy local part for catch-all testing
 */
function generateRandomLocalPart() {
  const randomHex = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  return `_probe_${randomHex}_${timestamp}`;
}

/**
 * Generate random jitter for command pacing
 */
function getCommandPacing() {
  return Math.floor(Math.random() * (COMMAND_PACING_MAX - COMMAND_PACING_MIN + 1)) + COMMAND_PACING_MIN;
}

/**
 * Wait for command pacing
 */
function waitForPacing() {
  return new Promise(resolve => setTimeout(resolve, getCommandPacing()));
}

/**
 * Read SMTP response with timeout
 */
function readSMTPResponse(socket, timeout = COMMAND_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('SMTP response timeout'));
    }, timeout);

    socket.once('data', (data) => {
      clearTimeout(timer);
      resolve(data.toString().trim());
    });

    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Send SMTP command and read response
 */
async function sendSMTPCommand(socket, command, timeout = COMMAND_TIMEOUT) {
  logger.debug(`[SMTP] C: ${command}`);
  socket.write(`${command}\r\n`);
  
  const response = await readSMTPResponse(socket, timeout);
  logger.debug(`[SMTP] S: ${response}`);
  
  return response;
}

/**
 * Parse SMTP response code
 */
function parseSMTPCode(response) {
  const match = response.match(/^(\d{3})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Perform SMTP probe for an email
 * @param {Object} params - Parameters object
 * @param {string} params.email - The email to probe
 * @param {string} params.domain - The domain
 * @param {string} params.mxHost - The MX host
 * @param {Object} params.timeouts - Timeout configuration
 * @param {boolean} params.useStartTLS - Whether to use STARTTLS
 * @returns {Promise<Object>} Probe result
 */
export async function smtpProbe({ email, domain, mxHost, timeouts = {}, useStartTLS = true }) {
  return connectionLimiter(async () => {
    const startTime = Date.now();
    let socket = null;
    
    try {
      // Set timeouts
      const connectTimeout = timeouts.connect || CONNECT_TIMEOUT;
      const commandTimeout = timeouts.command || COMMAND_TIMEOUT;
      const overallTimeout = timeouts.overall || OVERALL_TIMEOUT;
      
      // Create connection with timeout
      socket = await new Promise((resolve, reject) => {
        const conn = createConnection({ port: 25, host: mxHost });
        
        const connectTimer = setTimeout(() => {
          conn.destroy();
          reject(new Error('SMTP connection timeout'));
        }, connectTimeout);
        
        conn.on('connect', () => {
          clearTimeout(connectTimer);
          resolve(conn);
        });
        
        conn.on('error', (error) => {
          clearTimeout(connectTimer);
          reject(error);
        });
      });
      
      // Set overall timeout
      const overallTimer = setTimeout(() => {
        socket.destroy();
        throw new Error('SMTP overall timeout');
      }, overallTimeout);
      
      try {
        // Read initial banner
        const banner = await readSMTPResponse(socket, commandTimeout);
        const bannerCode = parseSMTPCode(banner);
        
        if (bannerCode !== 220) {
          throw new Error(`Unexpected banner: ${banner}`);
        }
        
        await waitForPacing();
        
        // EHLO
        const ehloResponse = await sendSMTPCommand(socket, 'EHLO my-checker.example', commandTimeout);
        const ehloCode = parseSMTPCode(ehloResponse);
        
        if (ehloCode !== 250) {
          throw new Error(`EHLO failed: ${ehloResponse}`);
        }
        
        let startTLS = false;
        
        // Check for STARTTLS capability
        if (useStartTLS && ehloResponse.includes('STARTTLS')) {
          try {
            const startTLSResponse = await sendSMTPCommand(socket, 'STARTTLS', commandTimeout);
            const startTLSCode = parseSMTPCode(startTLSResponse);
            
            if (startTLSCode === 220) {
              // Upgrade to TLS
              const tlsSocket = connect({
                socket: socket,
                host: mxHost,
                port: 25,
                rejectUnauthorized: false
              });
              
              await new Promise((resolve, reject) => {
                tlsSocket.on('secureConnect', resolve);
                tlsSocket.on('error', reject);
              });
              
              socket = tlsSocket;
              startTLS = true;
              
              // Re-send EHLO after TLS
              await waitForPacing();
              const tlsEhloResponse = await sendSMTPCommand(socket, 'EHLO my-checker.example', commandTimeout);
              const tlsEhloCode = parseSMTPCode(tlsEhloResponse);
              
              if (tlsEhloCode !== 250) {
                throw new Error(`TLS EHLO failed: ${tlsEhloResponse}`);
              }
            }
          } catch (tlsError) {
            logger.debug(`STARTTLS failed for ${mxHost}: ${tlsError.message}`);
            // Continue without TLS
          }
        }
        
        await waitForPacing();
        
        // MAIL FROM
        const mailFromResponse = await sendSMTPCommand(socket, 'MAIL FROM:<>', commandTimeout);
        const mailFromCode = parseSMTPCode(mailFromResponse);
        
        if (mailFromCode !== 250) {
          throw new Error(`MAIL FROM failed: ${mailFromResponse}`);
        }
        
        await waitForPacing();
        
        // RCPT TO
        const rcptToResponse = await sendSMTPCommand(socket, `RCPT TO:<${email}>`, commandTimeout);
        const rcptToCode = parseSMTPCode(rcptToResponse);
        
        await waitForPacing();
        
        // QUIT
        try {
          await sendSMTPCommand(socket, 'QUIT', commandTimeout);
        } catch (quitError) {
          // Ignore QUIT errors
        }
        
        clearTimeout(overallTimer);
        
        return {
          code: rcptToCode,
          ok: rcptToCode >= 200 && rcptToCode < 300,
          reason: rcptToResponse,
          tls: startTLS,
          mxHost,
          duration: Date.now() - startTime
        };
        
      } finally {
        clearTimeout(overallTimer);
      }
      
    } catch (error) {
      logger.debug(`SMTP probe failed for ${email} via ${mxHost}: ${error.message}`);
      return {
        code: null,
        ok: false,
        reason: error.message,
        tls: false,
        mxHost,
        duration: Date.now() - startTime
      };
    } finally {
      if (socket) {
        try {
          socket.destroy();
        } catch (destroyError) {
          // Ignore destroy errors
        }
      }
    }
  });
}

/**
 * Perform catch-all test in the same session
 * @param {Object} params - Parameters object
 * @param {string} params.domain - The domain
 * @param {string} params.mxHost - The MX host
 * @param {Object} params.timeouts - Timeout configuration
 * @param {boolean} params.useStartTLS - Whether to use STARTTLS
 * @returns {Promise<Object>} Catch-all test result
 */
export async function smtpCatchAll({ domain, mxHost, timeouts = {}, useStartTLS = true }) {
  const randomEmail = `${generateRandomLocalPart()}@${domain}`;
  
  return connectionLimiter(async () => {
    const startTime = Date.now();
    let socket = null;
    
    try {
      // Set timeouts
      const connectTimeout = timeouts.connect || CONNECT_TIMEOUT;
      const commandTimeout = timeouts.command || COMMAND_TIMEOUT;
      const overallTimeout = timeouts.overall || OVERALL_TIMEOUT;
      
      // Create connection with timeout
      socket = await new Promise((resolve, reject) => {
        const conn = createConnection({ port: 25, host: mxHost });
        
        const connectTimer = setTimeout(() => {
          conn.destroy();
          reject(new Error('SMTP connection timeout'));
        }, connectTimeout);
        
        conn.on('connect', () => {
          clearTimeout(connectTimer);
          resolve(conn);
        });
        
        conn.on('error', (error) => {
          clearTimeout(connectTimer);
          reject(error);
        });
      });
      
      // Set overall timeout
      const overallTimer = setTimeout(() => {
        socket.destroy();
        throw new Error('SMTP overall timeout');
      }, overallTimeout);
      
      try {
        // Read initial banner
        const banner = await readSMTPResponse(socket, commandTimeout);
        const bannerCode = parseSMTPCode(banner);
        
        if (bannerCode !== 220) {
          throw new Error(`Unexpected banner: ${banner}`);
        }
        
        await waitForPacing();
        
        // EHLO
        const ehloResponse = await sendSMTPCommand(socket, 'EHLO my-checker.example', commandTimeout);
        const ehloCode = parseSMTPCode(ehloResponse);
        
        if (ehloCode !== 250) {
          throw new Error(`EHLO failed: ${ehloResponse}`);
        }
        
        let startTLS = false;
        
        // Check for STARTTLS capability
        if (useStartTLS && ehloResponse.includes('STARTTLS')) {
          try {
            const startTLSResponse = await sendSMTPCommand(socket, 'STARTTLS', commandTimeout);
            const startTLSCode = parseSMTPCode(startTLSResponse);
            
            if (startTLSCode === 220) {
              // Upgrade to TLS
              const tlsSocket = connect({
                socket: socket,
                host: mxHost,
                port: 25,
                rejectUnauthorized: false
              });
              
              await new Promise((resolve, reject) => {
                tlsSocket.on('secureConnect', resolve);
                tlsSocket.on('error', reject);
              });
              
              socket = tlsSocket;
              startTLS = true;
              
              // Re-send EHLO after TLS
              await waitForPacing();
              const tlsEhloResponse = await sendSMTPCommand(socket, 'EHLO my-checker.example', commandTimeout);
              const tlsEhloCode = parseSMTPCode(tlsEhloResponse);
              
              if (tlsEhloCode !== 250) {
                throw new Error(`TLS EHLO failed: ${tlsEhloResponse}`);
              }
            }
          } catch (tlsError) {
            logger.debug(`STARTTLS failed for ${mxHost}: ${tlsError.message}`);
            // Continue without TLS
          }
        }
        
        await waitForPacing();
        
        // MAIL FROM
        const mailFromResponse = await sendSMTPCommand(socket, 'MAIL FROM:<>', commandTimeout);
        const mailFromCode = parseSMTPCode(mailFromResponse);
        
        if (mailFromCode !== 250) {
          throw new Error(`MAIL FROM failed: ${mailFromResponse}`);
        }
        
        await waitForPacing();
        
        // RCPT TO for random email
        const rcptToResponse = await sendSMTPCommand(socket, `RCPT TO:<${randomEmail}>`, commandTimeout);
        const rcptToCode = parseSMTPCode(rcptToResponse);
        
        await waitForPacing();
        
        // QUIT
        try {
          await sendSMTPCommand(socket, 'QUIT', commandTimeout);
        } catch (quitError) {
          // Ignore QUIT errors
        }
        
        clearTimeout(overallTimer);
        
        return {
          code: rcptToCode,
          ok: rcptToCode >= 200 && rcptToCode < 300,
          reason: rcptToResponse,
          tls: startTLS,
          mxHost,
          testEmail: randomEmail,
          duration: Date.now() - startTime
        };
        
      } finally {
        clearTimeout(overallTimer);
      }
      
    } catch (error) {
      logger.debug(`SMTP catch-all test failed for ${domain} via ${mxHost}: ${error.message}`);
      return {
        code: null,
        ok: false,
        reason: error.message,
        tls: false,
        mxHost,
        testEmail: randomEmail,
        duration: Date.now() - startTime
      };
    } finally {
      if (socket) {
        try {
          socket.destroy();
        } catch (destroyError) {
          // Ignore destroy errors
        }
      }
    }
  });
}

export default {
  smtpProbe,
  smtpCatchAll
};
