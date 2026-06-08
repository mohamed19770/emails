/**
 * Catch-all detection service
 * Tests if a domain accepts all email addresses (catch-all)
 */

import { randomBytes } from 'crypto';
import logger from '../../config/logger.js';

/**
 * Generate a random high-entropy local part for catch-all testing
 * @returns {string} Random local part that's unlikely to exist
 */
export function generateRandomLocalPart() {
  // Generate 16 random bytes and convert to hex
  const randomHex = randomBytes(16).toString('hex');
  // Add some additional entropy with timestamp
  const timestamp = Date.now().toString(36);
  return `_test_${randomHex}_${timestamp}_catchall`;
}

/**
 * Test if a domain is catch-all by probing a random non-existent address
 * @param {string} domain - The domain to test
 * @param {Array} mxRecords - MX records for the domain
 * @param {Function} smtpProbe - Function to perform SMTP probe
 * @returns {Promise<{isCatchAll: boolean, testEmail: string, result: object}>}
 */
export async function testCatchAll(domain, mxRecords, smtpProbe) {
  const testEmail = `${generateRandomLocalPart()}@${domain}`;
  
  try {
    logger.debug(`Testing catch-all for ${domain} with ${testEmail}`);
    
    const result = await smtpProbe(testEmail, domain, mxRecords);
    
    // If the random email also gets accepted (250/2xx), it's likely catch-all
    const isCatchAll = result.deliverable && (result.smtpCode >= 250 && result.smtpCode < 300);
    
    logger.debug(`Catch-all test for ${domain}: ${isCatchAll ? 'CATCH-ALL' : 'NOT CATCH-ALL'}`);
    
    return {
      isCatchAll,
      testEmail,
      result
    };
  } catch (error) {
    logger.debug(`Catch-all test failed for ${domain}: ${error.message}`);
    return {
      isCatchAll: false,
      testEmail,
      result: { deliverable: false, smtpCode: null, reason: 'test_failed' }
    };
  }
}

/**
 * Check if a domain should be tested for catch-all
 * Some providers (like Gmail/Outlook) are known to be ambiguous
 * @param {string} domain - The domain to check
 * @param {boolean} isSensitiveProvider - Whether this is a sensitive provider
 * @returns {boolean} Whether to test for catch-all
 */
export function shouldTestCatchAll(domain, isSensitiveProvider) {
  // Don't test catch-all for sensitive providers as they're often ambiguous
  if (isSensitiveProvider) {
    return false;
  }
  
  // Don't test for obvious disposable domains
  const disposableIndicators = ['temp', 'fake', 'test', 'spam', 'trash', 'throwaway'];
  const lowerDomain = domain.toLowerCase();
  
  if (disposableIndicators.some(indicator => lowerDomain.includes(indicator))) {
    return false;
  }
  
  return true;
}

export default {
  generateRandomLocalPart,
  testCatchAll,
  shouldTestCatchAll
};