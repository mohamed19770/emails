/**
 * Catch-all detection service
 * Safely detects catch-all domains without harming reputation
 */

import { createConnection } from 'net';
import { connect } from 'tls';
import { randomUUID } from 'crypto';
import logger from '../../config/logger.js';

const CATCHALL_TIMEOUT = 2000; // 2 seconds for catch-all detection
const COMMAND_TIMEOUT = 2000;

/**
 * Generate random non-existent email for catch-all testing
 */
function generateRandomEmail(domain) {
  const uuid = randomUUID().replace(/-/g, '');
  return `_does_not_exist_${uuid}@${domain}`;
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
 * Send SMTP command
 */
async function sendSMTPCommand(socket, command) {
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
 * Parse SMTP response code
 */
function parseSMTPResponse(response) {
  const lines = response.split('\n');
  const lastLine = lines[lines.length - 1];
  const code = parseInt(lastLine.substring(0, 3));
  return { code, message: lastLine.substring(4), fullResponse: response };
}

/**
 * Check if domain is in sensitive providers list
 * These providers often have ambiguous catch-all behavior
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
 * Known catch-all providers (static list for heuristics)
 */
function isKnownCatchAllProvider(domain) {
  const catchAllProviders = [
    'example.com',
    'test.com',
    'localhost',
    'internal.company',
    'corp.local'
  ];
  
  return catchAllProviders.some(provider => 
    domain.toLowerCase().includes(provider.toLowerCase())
  );
}

/**
 * Perform catch-all detection in the same SMTP session
 */
async function detectCatchAllInSession(socket, domain, startTLS = false) {
  try {
    // Generate random non-existent email
    const randomEmail = generateRandomEmail(domain);
    
    // RCPT TO for random email
    await sendSMTPCommand(socket, `RCPT TO: <${randomEmail}>`);
    const rcptResponse = await readSMTPResponse(socket, CATCHALL_TIMEOUT);
    const rcptParsed = parseSMTPResponse(rcptResponse);
    
    // If random email also returns 250, it's likely a catch-all
    const isCatchAll = rcptParsed.code === 250 || rcptParsed.code === 251 || rcptParsed.code === 252;
    
    return {
      isCatchAll,
      randomEmail,
      response: rcptResponse,
      confidence: isCatchAll ? 0.8 : 0.2
    };
    
  } catch (error) {
    logger.debug(`Catch-all detection failed for ${domain}: ${error.message}`);
    return {
      isCatchAll: false,
      randomEmail: null,
      response: null,
      confidence: 0.1,
      error: error.message
    };
  }
}

/**
 * Detect catch-all using SMTP session
 */
export async function detectCatchAllSMTP(email, domain, mxRecords, existingSocket = null) {
  // Skip for sensitive providers
  if (isSensitiveProvider(domain)) {
    return {
      isCatchAll: false,
      confidence: 0.1,
      method: 'skipped-sensitive-provider',
      reason: 'Sensitive provider - catch-all detection skipped'
    };
  }

  // Skip for known catch-all providers (heuristic)
  if (isKnownCatchAllProvider(domain)) {
    return {
      isCatchAll: true,
      confidence: 0.7,
      method: 'heuristic-known-provider',
      reason: 'Known catch-all provider'
    };
  }

  // If we have an existing socket, use it
  if (existingSocket) {
    try {
      const result = await detectCatchAllInSession(existingSocket, domain);
      return {
        isCatchAll: result.isCatchAll,
        confidence: result.confidence,
        method: 'smtp-session',
        reason: result.isCatchAll ? 'SMTP session confirmed catch-all' : 'SMTP session confirmed not catch-all',
        randomEmail: result.randomEmail,
        response: result.response
      };
    } catch (error) {
      logger.debug(`Catch-all detection in existing session failed: ${error.message}`);
      return {
        isCatchAll: false,
        confidence: 0.1,
        method: 'smtp-session-failed',
        reason: `Detection failed: ${error.message}`
      };
    }
  }

  // If no existing socket, we can't safely detect catch-all
  // without making additional connections (which we want to avoid)
  return {
    isCatchAll: false,
    confidence: 0.3,
    method: 'no-session',
    reason: 'No existing SMTP session for catch-all detection'
  };
}

/**
 * Detect catch-all using DNS heuristics
 */
export function detectCatchAllDNS(domain, dnsIntelligence) {
  // Check if domain has MX records
  if (!dnsIntelligence.mx.hasMX) {
    return {
      isCatchAll: false,
      confidence: 0.1,
      method: 'dns-no-mx',
      reason: 'No MX records - cannot be catch-all'
    };
  }

  // Check SPF record for catch-all indicators
  if (dnsIntelligence.spf.hasSPF) {
    const spfRecord = dnsIntelligence.spf.record;
    
    // Look for catch-all indicators in SPF
    if (spfRecord.includes('+all') || spfRecord.includes('~all')) {
      return {
        isCatchAll: true,
        confidence: 0.6,
        method: 'dns-spf-indicator',
        reason: 'SPF record suggests catch-all behavior'
      };
    }
  }

  // Check DMARC policy for strictness
  if (dnsIntelligence.dmarc.hasDMARC) {
    const policy = dnsIntelligence.dmarc.policy;
    
    if (policy === 'reject' || policy === 'quarantine') {
      return {
        isCatchAll: false,
        confidence: 0.7,
        method: 'dns-dmarc-strict',
        reason: 'Strict DMARC policy suggests no catch-all'
      };
    }
  }

  return {
    isCatchAll: false,
    confidence: 0.3,
    method: 'dns-heuristic',
    reason: 'DNS heuristics inconclusive'
  };
}

/**
 * Comprehensive catch-all detection
 */
export async function detectCatchAll(email, domain, dnsIntelligence, smtpResult = null, existingSocket = null) {
  const results = [];

  // DNS-based detection
  const dnsResult = detectCatchAllDNS(domain, dnsIntelligence);
  results.push(dnsResult);

  // SMTP-based detection (if we have a session)
  if (existingSocket || smtpResult) {
    const smtpResult = await detectCatchAllSMTP(email, domain, dnsIntelligence.mx.records, existingSocket);
    results.push(smtpResult);
  }

  // Combine results with confidence weighting
  let finalConfidence = 0;
  let finalIsCatchAll = false;
  let finalMethod = 'combined';
  let finalReason = 'Combined detection results';

  for (const result of results) {
    if (result.confidence > finalConfidence) {
      finalConfidence = result.confidence;
      finalIsCatchAll = result.isCatchAll;
      finalMethod = result.method;
      finalReason = result.reason;
    }
  }

  // If we have conflicting results, be conservative
  const smtpResults = results.filter(r => r.method.includes('smtp'));
  const dnsResults = results.filter(r => r.method.includes('dns'));
  
  if (smtpResults.length > 0 && dnsResults.length > 0) {
    const smtpCatchAll = smtpResults.some(r => r.isCatchAll);
    const dnsCatchAll = dnsResults.some(r => r.isCatchAll);
    
    if (smtpCatchAll !== dnsCatchAll) {
      // Prefer SMTP result but reduce confidence
      finalIsCatchAll = smtpCatchAll;
      finalConfidence = Math.min(finalConfidence, 0.6);
      finalReason = 'Conflicting results - preferring SMTP with reduced confidence';
    }
  }

  return {
    isCatchAll: finalIsCatchAll,
    confidence: finalConfidence,
    method: finalMethod,
    reason: finalReason,
    details: results
  };
}

export default {
  detectCatchAll,
  detectCatchAllSMTP,
  detectCatchAllDNS
};
