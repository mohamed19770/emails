import { promises as dns } from 'dns';
import { createConnection } from 'net';
import { connect } from 'tls';
import pLimit from 'p-limit';
// Custom disposable email domains list
const DISPOSABLE_DOMAINS = [
  '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'getnada.com', 'maildrop.cc',
  'sharklasers.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'pokemail.net', 'spam4.me', 'bccto.me', 'chacuo.net', 'dispostable.com',
  'fakeinbox.com', 'mailnesia.com', 'mailnull.com', 'meltmail.com',
  'mohmal.com', 'mytrashmail.com', 'nada.email', 'nada.ltd',
  'spamgourmet.com', 'spamhole.com', 'spam.la', 'spammotel.com',
  'spamobox.com', 'spamspot.com', 'spamthis.co.uk', 'spamthisplease.com',
  'superrito.com', 'thisisnotmyrealemail.com', 'tittbit.in', 'toomail.biz',
  'toomail.net', 'trash-amil.com', 'trashmail.com', 'trashmail.net',
  'trashymail.com', 'trashymail.net', 'trbvm.com', 'tyldd.com',
  'uggsrock.com', 'wegwerfadresse.de', 'wegwerfmail.de', 'wetrainbayarea.com',
  'wetrainbayarea.org', 'wh4f.org', 'whyspam.me', 'willselfdestruct.com',
  'wuzup.net', 'wuzupmail.net', 'yeah.net', 'yopmail.com', 'yopmail.net',
  'yopmail.org', 'ypmail.webarnak.fr', 'cool.fr.nf', 'jetable.fr',
  'jetable.net', 'jetable.org', 'nospam.ze.tc', 'nomail.xl.cx',
  'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'monmail.fr.nf', 'tempmail.net', 'temp-mail.net',
  'tempmail.co', 'temp-mail.co', 'tempmail.org', 'temp-mail.org',
  'tempmail.us', 'temp-mail.us', 'tempmail.eu', 'temp-mail.eu',
  'tempmail.de', 'temp-mail.de', 'tempmail.fr', 'temp-mail.fr',
  'tempmail.it', 'temp-mail.it', 'tempmail.es', 'temp-mail.es',
  'tempmail.ru', 'temp-mail.ru', 'tempmail.jp', 'temp-mail.jp',
  'tempmail.cn', 'temp-mail.cn', 'tempmail.in', 'temp-mail.in',
  'tempmail.com.br', 'temp-mail.com.br', 'tempmail.com.au', 'temp-mail.com.au',
  'tempmail.ca', 'temp-mail.ca', 'tempmail.co.uk', 'temp-mail.co.uk'
];
import logger from '../config/logger.js';

const SMTP_TIMEOUT = 4000; // 4 seconds
const SMTP_CONCURRENCY = 5; // Max 5 concurrent SMTP probes
const BATCH_SIZE = 50; // Default batch size for processing

// Role-based email patterns
const ROLE_PATTERNS = [
  'admin', 'administrator', 'info', 'information', 'support', 'help', 'sales', 'marketing',
  'contact', 'contactus', 'hello', 'hi', 'webmaster', 'postmaster', 'hostmaster',
  'abuse', 'security', 'privacy', 'legal', 'billing', 'accounts', 'finance',
  'hr', 'humanresources', 'jobs', 'careers', 'recruitment', 'noreply', 'no-reply',
  'donotreply', 'do-not-reply', 'mailer-daemon', 'mailerdaemon', 'daemon',
  'root', 'system', 'service', 'services', 'team', 'staff', 'office',
  'reception', 'receptionist', 'manager', 'director', 'ceo', 'cto', 'cfo',
  'president', 'vice', 'vp', 'assistant', 'secretary', 'clerk', 'operator'
];

// Known blacklisted domains (extend this list as needed)
const BLACKLISTED_DOMAINS = [
  'tempmail.org', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'getnada.com', 'maildrop.cc',
  'sharklasers.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'pokemail.net', 'spam4.me', 'bccto.me', 'chacuo.net', 'dispostable.com',
  'fakeinbox.com', 'mailnesia.com', 'mailnull.com', 'meltmail.com',
  'mohmal.com', 'mytrashmail.com', 'nada.email', 'nada.ltd',
  'spamgourmet.com', 'spamhole.com', 'spam.la', 'spammotel.com',
  'spamobox.com', 'spamspot.com', 'spamthis.co.uk', 'spamthisplease.com',
  'superrito.com', 'thisisnotmyrealemail.com', 'tittbit.in', 'toomail.biz',
  'toomail.net', 'trash-amil.com', 'trashmail.com', 'trashmail.net',
  'trashymail.com', 'trashymail.net', 'trbvm.com', 'tyldd.com',
  'uggsrock.com', 'wegwerfadresse.de', 'wegwerfmail.de', 'wetrainbayarea.com',
  'wetrainbayarea.org', 'wh4f.org', 'whyspam.me', 'willselfdestruct.com',
  'wuzup.net', 'wuzupmail.net', 'yeah.net', 'yopmail.com', 'yopmail.net',
  'yopmail.org', 'ypmail.webarnak.fr', 'cool.fr.nf', 'jetable.fr',
  'jetable.net', 'jetable.org', 'nospam.ze.tc', 'nomail.xl.cx',
  'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'monmail.fr.nf'
];

class AdvancedEmailValidationService {
  constructor() {
    this.smtpLimit = pLimit(SMTP_CONCURRENCY);
  }

  // Enhanced email format validation
  validateEmailFormat(email) {
    const emailRegex = new RegExp(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
    return emailRegex.test(email);
  }

  // Extract domain from email
  extractDomain(email) {
    const parts = email.split('@');
    if (parts.length !== 2) {
      throw new Error('Invalid email format for domain extraction');
    }
    return parts[1];
  }

  // Extract local part from email
  extractLocalPart(email) {
    const parts = email.split('@');
    if (parts.length !== 2) {
      throw new Error('Invalid email format for local part extraction');
    }
    return parts[0];
  }

  // Check if email is disposable
  isDisposableEmail(email) {
    const domain = this.extractDomain(email);
    return DISPOSABLE_DOMAINS.includes(domain.toLowerCase());
  }

  // Check if email is blacklisted
  isBlacklistedEmail(email) {
    const domain = this.extractDomain(email);
    return BLACKLISTED_DOMAINS.includes(domain.toLowerCase());
  }

  // Check if email is role-based
  isRoleBasedEmail(email) {
    const localPart = this.extractLocalPart(email).toLowerCase();
    return ROLE_PATTERNS.some(pattern => 
      localPart === pattern || 
      localPart.startsWith(pattern + '.') || 
      localPart.startsWith(pattern + '_') ||
      localPart.startsWith(pattern + '-')
    );
  }

  // Enhanced MX lookup with more details
  async resolveMx(domain) {
    try {
      const mxRecords = await Promise.race([
        dns.resolveMx(domain),
        new Promise((_, reject) => setTimeout(() => reject(new Error('MX lookup timeout')), SMTP_TIMEOUT)),
      ]);
      return { 
        hasMX: mxRecords && mxRecords.length > 0,
        mxRecords: mxRecords || [],
        primaryMX: mxRecords && mxRecords.length > 0 ? mxRecords[0].exchange : null
      };
    } catch (error) {
      logger.debug(`MX resolution failed for ${domain}: ${error.message}`);
      return { hasMX: false, mxRecords: [], primaryMX: null };
    }
  }

  // Generate random test email for catch-all detection
  generateRandomEmail(domain) {
    const randomString = Math.random().toString(36).substring(2, 15);
    return `test-${randomString}@${domain}`;
  }

  // Enhanced SMTP probe with catch-all detection
  async smtpProbe(email, domain, mxRecords) {
    return this.smtpLimit(async () => {
      let socket;
      let response = { 
        deliverable: false, 
        reason: 'unknown',
        catchAll: false,
        mailboxStatus: 'unknown'
      };
      const log = [];

      try {
        if (!mxRecords || mxRecords.length === 0) {
          log.push('No MX records found for SMTP probe.');
          return { deliverable: false, reason: 'no_mx', catchAll: false, mailboxStatus: 'unknown', rawLog: log.join('\n') };
        }

        const exchange = mxRecords[0].exchange; // Use primary MX

        socket = await new Promise((resolve, reject) => {
          const conn = createConnection({ port: 25, host: exchange, timeout: SMTP_TIMEOUT });
          conn.on('connect', () => resolve(conn));
          conn.on('timeout', () => { conn.destroy(); reject(new Error('SMTP connection timeout')); });
          conn.on('error', (err) => { conn.destroy(); reject(new Error(`SMTP connection error: ${err.message}`)); });
        });

        const readLine = () => new Promise(resolve => socket.once('data', data => resolve(data.toString())));

        // HELO/EHLO
        await new Promise(resolve => socket.write(`EHLO example.com\r\n`, () => resolve()));
        let data = await readLine();
        log.push(`EHLO: ${data.trim()}`);
        if (!data.startsWith('250')) {
          response.reason = 'ehlo_failed';
          return response;
        }

        // MAIL FROM
        await new Promise(resolve => socket.write(`MAIL FROM:<test@example.com>\r\n`, () => resolve()));
        data = await readLine();
        log.push(`MAIL FROM: ${data.trim()}`);
        if (!data.startsWith('250')) {
          response.reason = 'mail_from_failed';
          return response;
        }

        // RCPT TO - Test original email
        await new Promise(resolve => socket.write(`RCPT TO:<${email}>\r\n`, () => resolve()));
        data = await readLine();
        log.push(`RCPT TO (original): ${data.trim()}`);

        const originalResponse = data.trim();
        let originalDeliverable = false;
        let originalMailboxStatus = 'unknown';

        if (originalResponse.startsWith('250')) {
          originalDeliverable = true;
          originalMailboxStatus = 'active';
        } else if (originalResponse.startsWith('550') || originalResponse.startsWith('551') || originalResponse.startsWith('553')) {
          originalDeliverable = false;
          if (originalResponse.includes('mailbox full') || originalResponse.includes('quota exceeded')) {
            originalMailboxStatus = 'full';
          } else if (originalResponse.includes('disabled') || originalResponse.includes('inactive')) {
            originalMailboxStatus = 'disabled';
          } else {
            originalMailboxStatus = 'invalid';
          }
        } else {
          originalDeliverable = false;
          originalMailboxStatus = 'risky';
        }

        // Test for catch-all with random email
        const randomEmail = this.generateRandomEmail(domain);
        await new Promise(resolve => socket.write(`RCPT TO:<${randomEmail}>\r\n`, () => resolve()));
        data = await readLine();
        log.push(`RCPT TO (random): ${data.trim()}`);

        const randomResponse = data.trim();
        const isCatchAll = randomResponse.startsWith('250');

        // QUIT
        await new Promise(resolve => socket.write(`QUIT\r\n`, () => resolve()));
        data = await readLine();
        log.push(`QUIT: ${data.trim()}`);

        response.deliverable = originalDeliverable;
        response.catchAll = isCatchAll;
        response.mailboxStatus = originalMailboxStatus;
        
        if (originalDeliverable) {
          response.reason = isCatchAll ? 'catch_all' : 'deliverable';
        } else {
          response.reason = originalResponse.startsWith('550') ? 'mailbox_invalid' : 
                           originalResponse.startsWith('551') ? 'mailbox_full' :
                           originalResponse.startsWith('553') ? 'mailbox_disabled' : 'smtp_reject';
        }

      } catch (err) {
        log.push(`SMTP probe error: ${err.message}`);
        response.deliverable = false;
        response.reason = 'smtp_error';
        response.catchAll = false;
        response.mailboxStatus = 'unknown';
      } finally {
        if (socket && !socket.destroyed) {
          socket.destroy();
        }
      }
      
      response.rawLog = log.join('\n');
      return response;
    });
  }

  // Provider sensitivity check
  isProviderSensitive(domain) {
    const sensitiveDomains = [
      'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
      'yahoo.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com'
    ];
    return sensitiveDomains.includes(domain.toLowerCase());
  }

  // Calculate confidence score (0-1)
  calculateConfidence(result) {
    let confidence = 0;
    
    // Base confidence from method
    if (result.method === 'smtp') {
      confidence += 0.8;
    } else if (result.method === 'mx') {
      confidence += 0.6;
    } else if (result.method === 'regex') {
      confidence += 0.3;
    }

    // Adjustments
    if (result.catchAll) confidence -= 0.3;
    if (result.disposable) confidence -= 0.5;
    if (result.blacklisted) confidence -= 0.7;
    if (result.roleBased) confidence -= 0.2;
    if (result.providerSensitive) confidence -= 0.1;

    // Status-based adjustments
    if (result.status === 'valid') confidence = Math.max(confidence, 0.75);
    if (result.status === 'risky') confidence = Math.min(confidence, 0.74);
    if (result.status === 'invalid') confidence = Math.min(confidence, 0.3);

    return Math.max(0, Math.min(1, confidence));
  }

  // Main validation function with all advanced checks
  async runEmailChecks(emails, safeMode) {
    const uniqueEmails = [...new Set(emails.map(e => e.trim().toLowerCase()))];
    const results = [];

    for (const email of uniqueEmails) {
      const checkedAt = new Date().toISOString();
      let status = 'unknown';
      let reason = 'initial';
      let domain = null;
      let hasMX = false;
      let catchAll = false;
      let disposable = false;
      let blacklisted = false;
      let roleBased = false;
      let providerSensitive = false;
      let startTLS = false;
      let mxHost = null;
      let method = 'none';
      let confidence = 0;

      try {
        // 1. Format Validation
        const formatValid = this.validateEmailFormat(email);
        if (!formatValid) {
          status = 'invalid';
          reason = 'invalid_format';
          method = 'regex';
          confidence = 0;
          results.push({ 
            email, status, reason, domain, hasMX, catchAll, disposable, 
            blacklisted, roleBased, providerSensitive, method, startTLS, 
            mxHost, confidence, checkedAt 
          });
          continue;
        }

        domain = this.extractDomain(email);
        method = 'regex';

        // 2. Disposable Email Check
        disposable = this.isDisposableEmail(email);
        if (disposable) {
          status = 'risky';
          reason = 'disposable';
          confidence = 0.2;
          results.push({ 
            email, status, reason, domain, hasMX, catchAll, disposable, 
            blacklisted, roleBased, providerSensitive, method, startTLS, 
            mxHost, confidence, checkedAt 
          });
          continue;
        }

        // 3. Blacklist Check
        blacklisted = this.isBlacklistedEmail(email);
        if (blacklisted) {
          status = 'invalid';
          reason = 'blacklisted';
          confidence = 0.1;
          results.push({ 
            email, status, reason, domain, hasMX, catchAll, disposable, 
            blacklisted, roleBased, providerSensitive, method, startTLS, 
            mxHost, confidence, checkedAt 
          });
          continue;
        }

        // 4. Role-based Check
        roleBased = this.isRoleBasedEmail(email);

        // 5. Provider Sensitivity Check
        providerSensitive = this.isProviderSensitive(domain);

        // 6. MX Lookup
        const mxResult = await this.resolveMx(domain);
        hasMX = mxResult.hasMX;
        mxHost = mxResult.primaryMX;
        method = 'mx';

        if (!hasMX) {
          status = 'invalid';
          reason = 'no_mx_records';
          confidence = 0.1;
          results.push({ 
            email, status, reason, domain, hasMX, catchAll, disposable, 
            blacklisted, roleBased, providerSensitive, method, startTLS, 
            mxHost, confidence, checkedAt 
          });
          continue;
        }

        // 7. SMTP Probe (only if not in safe mode)
        if (!safeMode) {
          const smtpResult = await this.smtpProbe(email, domain, mxResult.mxRecords);
          method = 'smtp';
          startTLS = smtpResult.startTLS || false;
          
          if (smtpResult.deliverable) {
            status = smtpResult.catchAll ? 'risky' : 'valid';
            reason = smtpResult.reason;
            catchAll = smtpResult.catchAll;
          } else {
            status = 'risky';
            reason = smtpResult.reason;
            catchAll = smtpResult.catchAll;
          }
        } else {
          // In safe mode, if format and MX are good, consider it valid
          status = roleBased ? 'risky' : 'valid';
          reason = roleBased ? 'role_based' : 'safe_mode_check_passed';
          confidence = 0.5; // Lower confidence for safe mode
        }

        // Calculate final confidence
        const result = { 
          email, status, reason, domain, hasMX, catchAll, disposable, 
          blacklisted, roleBased, providerSensitive, method, startTLS, 
          mxHost, confidence: 0, checkedAt 
        };
        
        confidence = this.calculateConfidence(result);
        result.confidence = confidence;

        // Apply confidence threshold for valid status
        if (status === 'valid' && (confidence < 0.75 || catchAll || disposable || blacklisted)) {
          status = 'risky';
          reason = confidence < 0.75 ? 'low_confidence' : 
                   catchAll ? 'catch_all' : 
                   disposable ? 'disposable' : 'blacklisted';
        }

        result.status = status;
        result.reason = reason;
        result.confidence = confidence;

        results.push(result);

      } catch (error) {
        logger.error(`Error processing email ${email}:`, error);
        results.push({ 
          email, status: 'unknown', reason: 'processing_error', domain, 
          hasMX, catchAll, disposable, blacklisted, roleBased, providerSensitive, 
          method, startTLS, mxHost, confidence: 0, checkedAt 
        });
      }
    }

    return results;
  }
}

export default new AdvancedEmailValidationService();
