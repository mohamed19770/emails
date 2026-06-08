/**
 * Non-Delivering SMTP Handshake (ND-SMTP) service
 * Safe email verification without sending actual emails
 */

import { createConnection } from 'net';
import { connect } from 'tls';
import pLimit from 'p-limit';
import logger from '../../config/logger.js';

// Safety limits
const MAX_CONCURRENT_CONNECTIONS = 3;
const MAX_CONNECTIONS_PER_DOMAIN = 1;
const CONNECT_TIMEOUT = 3000; // 3 seconds
const COMMAND_TIMEOUT = 3000; // 3 seconds
const COMMAND_PACING_MIN = 50; // 50ms
const COMMAND_PACING_MAX = 150; // 150ms

// Connection pool for rate limiting
const connectionLimiter = pLimit(MAX_CONCURRENT_CONNECTIONS);
const domainLimiter = new Map();

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
 * Send SMTP command with pacing
 */
async function sendSMTPCommand(socket, command) {
  await waitForPacing();
  
  return new Promise((resolve, reject) => {
    socket.write(command + '\r\n', (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Parse SMTP response code and message
 */
function parseSMTPResponse(response) {
  const lines = response.split('\n');
  const lastLine = lines[lines.length - 1];
  const code = parseInt(lastLine.substring(0, 3));
  const message = lastLine.substring(4);
  
  return { code, message, fullResponse: response };
}

/**
 * Check if domain is in sensitive providers list
 */
function isSensitiveProvider(domain) {
  const sensitiveDomains = [
    'gmail.com', 'googlemail.com',
    'outlook.com', 'hotmail.com', 'live.com',
    'yahoo.com', 'ymail.com',
    'icloud.com', 'me.com',
    'aol.com', 'aim.com'
  ];
  
  return sensitiveDomains.some(sensitive => 
    domain.toLowerCase().includes(sensitive.toLowerCase())
  );
}

/**
 * Perform ND-SMTP handshake
 */
async function performNDSMTPHandshake(email, domain, mxRecords) {
  let socket = null;
  let tlsSocket = null;
  let startTLS = false;
  
  try {
    // Select MX record (shuffle for load balancing)
    const shuffledRecords = [...mxRecords].sort(() => Math.random() - 0.5);
    const mxRecord = shuffledRecords[0];
    
    logger.debug(`Attempting SMTP connection to ${mxRecord.exchange}:25`);
    
    // Create TCP connection
    socket = await new Promise((resolve, reject) => {
      const conn = createConnection({ 
        port: 25, 
        host: mxRecord.exchange, 
        timeout: CONNECT_TIMEOUT 
      });
      
      conn.on('connect', () => resolve(conn));
      conn.on('timeout', () => {
        conn.destroy();
        reject(new Error('Connection timeout'));
      });
      conn.on('error', (error) => {
        conn.destroy();
        reject(error);
      });
    });

    // Read banner
    const banner = await readSMTPResponse(socket);
    const bannerResponse = parseSMTPResponse(banner);
    
    if (bannerResponse.code === 554 || bannerResponse.code === 421) {
      return {
        deliverable: false,
        reason: 'server-reject',
        startTLS: false,
        confidence: 0.1,
        rawLog: `Banner: ${banner}`
      };
    }

    // EHLO command
    await sendSMTPCommand(socket, 'EHLO my-checker.example');
    const ehloResponse = await readSMTPResponse(socket);
    const ehloParsed = parseSMTPResponse(ehloResponse);
    
    if (ehloParsed.code !== 250) {
      return {
        deliverable: false,
        reason: 'ehlo-failed',
        startTLS: false,
        confidence: 0.1,
        rawLog: `EHLO: ${ehloResponse}`
      };
    }

    // Check for STARTTLS support
    const hasSTARTTLS = ehloResponse.toLowerCase().includes('starttls');
    
    if (hasSTARTTLS) {
      try {
        // Attempt STARTTLS
        await sendSMTPCommand(socket, 'STARTTLS');
        const starttlsResponse = await readSMTPResponse(socket);
        const starttlsParsed = parseSMTPResponse(starttlsResponse);
        
        if (starttlsParsed.code === 220) {
          // Upgrade to TLS
          tlsSocket = connect({
            socket: socket,
            servername: mxRecord.exchange,
            rejectUnauthorized: false
          });
          
          await new Promise((resolve, reject) => {
            tlsSocket.on('secureConnect', resolve);
            tlsSocket.on('error', reject);
          });
          
          startTLS = true;
          socket = tlsSocket;
          
          // Re-issue EHLO over TLS
          await sendSMTPCommand(socket, 'EHLO my-checker.example');
          await readSMTPResponse(socket);
        }
      } catch (tlsError) {
        logger.debug(`STARTTLS failed for ${mxRecord.exchange}: ${tlsError.message}`);
        // Continue with plaintext but be more conservative
      }
    }

    // MAIL FROM with null reverse path
    await sendSMTPCommand(socket, 'MAIL FROM: <>');
    const mailFromResponse = await readSMTPResponse(socket);
    const mailFromParsed = parseSMTPResponse(mailFromResponse);
    
    if (mailFromParsed.code !== 250) {
      return {
        deliverable: false,
        reason: 'mail-from-failed',
        startTLS,
        confidence: 0.1,
        rawLog: `MAIL FROM: ${mailFromResponse}`
      };
    }

    // RCPT TO - the critical test
    await sendSMTPCommand(socket, `RCPT TO: <${email}>`);
    const rcptResponse = await readSMTPResponse(socket);
    const rcptParsed = parseSMTPResponse(rcptResponse);
    
    let deliverable = false;
    let reason = 'unknown';
    let confidence = 0.5;

    if (rcptParsed.code === 250 || rcptParsed.code === 251 || rcptParsed.code === 252) {
      deliverable = true;
      reason = 'deliverable';
      confidence = 0.9;
    } else if (rcptParsed.code === 550 || rcptParsed.code === 551 || rcptParsed.code === 553 || rcptParsed.code === 554) {
      deliverable = false;
      reason = 'smtp-reject';
      confidence = 0.9;
    } else if (rcptParsed.code === 450 || rcptParsed.code === 451 || rcptParsed.code === 452) {
      deliverable = false;
      reason = 'temporary-failure';
      confidence = 0.6;
    } else {
      deliverable = false;
      reason = 'unexpected-response';
      confidence = 0.3;
    }

    // QUIT command
    await sendSMTPCommand(socket, 'QUIT');
    await readSMTPResponse(socket);

    return {
      deliverable,
      reason,
      startTLS,
      confidence,
      rawLog: `RCPT TO: ${rcptResponse}`
    };

  } catch (error) {
    logger.debug(`SMTP handshake failed for ${email}: ${error.message}`);
    return {
      deliverable: false,
      reason: 'smtp-error',
      startTLS,
      confidence: 0.1,
      rawLog: `Error: ${error.message}`
    };
  } finally {
    // Clean up connections
    if (tlsSocket && !tlsSocket.destroyed) {
      tlsSocket.destroy();
    }
    if (socket && !socket.destroyed) {
      socket.destroy();
    }
  }
}

/**
 * Check domain rate limit
 */
function checkDomainRateLimit(domain) {
  const now = Date.now();
  const domainKey = domain.toLowerCase();
  
  if (!domainLimiter.has(domainKey)) {
    domainLimiter.set(domainKey, { count: 0, resetTime: now + 60000 }); // 1 minute window
  }
  
  const limit = domainLimiter.get(domainKey);
  
  // Reset if window expired
  if (now > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = now + 60000;
  }
  
  // Check if limit exceeded
  if (limit.count >= MAX_CONNECTIONS_PER_DOMAIN) {
    return false;
  }
  
  // Increment counter
  limit.count++;
  return true;
}

/**
 * Main SMTP verification function
 */
export async function verifySMTP(email, domain, mxRecords, safeMode = false) {
  // Check if domain is sensitive provider
  if (isSensitiveProvider(domain)) {
    return {
      deliverable: false,
      reason: 'provider-sensitive',
      startTLS: false,
      confidence: 0.1,
      rawLog: 'Sensitive provider - skipped SMTP verification'
    };
  }

  // Check domain rate limit
  if (!checkDomainRateLimit(domain)) {
    return {
      deliverable: false,
      reason: 'rate-limited',
      startTLS: false,
      confidence: 0.1,
      rawLog: 'Domain rate limit exceeded'
    };
  }

  // Skip SMTP in safe mode
  if (safeMode) {
    return {
      deliverable: false,
      reason: 'safe-mode',
      startTLS: false,
      confidence: 0.1,
      rawLog: 'Safe mode - SMTP verification skipped'
    };
  }

  // Apply connection limiter
  return connectionLimiter(async () => {
    return performNDSMTPHandshake(email, domain, mxRecords);
  });
}

/**
 * Clear rate limit data
 */
export function clearRateLimits() {
  domainLimiter.clear();
}

/**
 * Get rate limit statistics
 */
export function getRateLimitStats() {
  const now = Date.now();
  const stats = {};
  
  for (const [domain, limit] of domainLimiter.entries()) {
    if (now <= limit.resetTime) {
      stats[domain] = {
        count: limit.count,
        remaining: MAX_CONNECTIONS_PER_DOMAIN - limit.count,
        resetTime: new Date(limit.resetTime).toISOString()
      };
    }
  }
  
  return stats;
}

export default {
  verifySMTP,
  clearRateLimits,
  getRateLimitStats
};
