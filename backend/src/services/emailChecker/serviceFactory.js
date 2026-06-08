/**
 * Service factory for dependency injection in tests
 */
import { validateEmailFormat } from './format.js';
import { resolveMX } from './dns.js';
import { probeSMTP } from './smtp.js';
import { isDisposable, isBlacklisted, isRoleBased, extractDomain, extractLocalPart } from './meta.js';

// Mock services for testing
import { mockDNS } from '../../__mocks__/dns.mock.js';
import { mockSMTP } from '../../__mocks__/smtp.mock.js';

class EmailCheckerService {
  constructor(options = {}) {
    this.validateEmailFormat = options.validateEmailFormat || validateEmailFormat;
    this.resolveMX = options.resolveMX || resolveMX;
    this.probeSMTP = options.probeSMTP || probeSMTP;
    this.isDisposable = options.isDisposable || isDisposable;
    this.isBlacklisted = options.isBlacklisted || isBlacklisted;
    this.isRoleBased = options.isRoleBased || isRoleBased;
    this.extractDomain = options.extractDomain || extractDomain;
    this.extractLocalPart = options.extractLocalPart || extractLocalPart;
  }

  async runEmailChecks(emails, safeMode = false) {
    const uniqueEmails = [...new Set(emails.map(e => e.trim().toLowerCase()))];
    const results = [];

    for (const email of uniqueEmails) {
      const checkedAt = new Date().toISOString();
      let status = 'unknown';
      let reason = 'initial';
      let domain = null;
      let hasMX = false;
      let method = 'none';
      let disposable = false;
      let catchAll = false;
      let blacklisted = false;
      let roleBased = false;

      try {
        // 1. Format Validation
        const formatValid = this.validateEmailFormat(email);
        if (!formatValid) {
          status = 'invalid';
          reason = 'invalid_format';
          method = 'regex';
          results.push({ email, status, reason, domain, hasMX, disposable, catchAll, blacklisted, roleBased, method, checkedAt });
          continue;
        }

        domain = this.extractDomain(email);
        method = 'regex';

        // 2. Metadata checks
        disposable = this.isDisposable(domain);
        blacklisted = this.isBlacklisted(domain);
        roleBased = this.isRoleBased(this.extractLocalPart(email));

        // 3. MX Lookup
        const mxResult = await this.resolveMX(domain);
        hasMX = mxResult.hasMX;
        method = 'mx';

        if (!hasMX) {
          status = 'invalid';
          reason = 'no_mx_records';
          results.push({ email, status, reason, domain, hasMX, disposable, catchAll, blacklisted, roleBased, method, checkedAt });
          continue;
        }

        // 4. SMTP Probe (only if not in safe mode)
        if (!safeMode) {
          const smtpResult = await this.probeSMTP(email, domain, mxResult.mxRecords);
          method = 'smtp';
          catchAll = smtpResult.catchAll;
          
          if (smtpResult.deliverable) {
            status = 'valid';
            reason = smtpResult.reason;
          } else {
            status = 'risky';
            reason = smtpResult.reason;
          }
        } else {
          // In safe mode, if format and MX are good, consider it valid for safe mode purposes
          status = 'valid';
          reason = 'safe_mode_check_passed';
        }

        results.push({ email, status, reason, domain, hasMX, disposable, catchAll, blacklisted, roleBased, method, checkedAt });

      } catch (error) {
        // Handle individual email errors gracefully
        status = 'unknown';
        reason = 'processing_error';
        results.push({ email, status, reason, domain, hasMX, disposable, catchAll, blacklisted, roleBased, method, checkedAt });
      }
    }

    return results;
  }
}

// Factory function
export function createEmailCheckerService(options = {}) {
  return new EmailCheckerService(options);
}

// Default service instance
export const defaultEmailCheckerService = createEmailCheckerService();

// Mock service for testing
export function createMockEmailCheckerService() {
  return createEmailCheckerService({
    validateEmailFormat: validateEmailFormat,
    resolveMX: mockDNS.resolveMX,
    probeSMTP: mockSMTP.probeSMTP,
    isDisposable,
    isBlacklisted,
    isRoleBased,
    extractDomain,
    extractLocalPart
  });
}

export default EmailCheckerService;
