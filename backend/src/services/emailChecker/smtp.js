import { createConnection } from 'net';
import pLimit from 'p-limit';
import logger from '../../config/logger.js';

const SMTP_TIMEOUT = 4000; // 4 seconds
const SMTP_CONCURRENCY = 5; // Max 5 concurrent SMTP probes

class SMTPService {
  constructor() {
    this.smtpLimit = pLimit(SMTP_CONCURRENCY);
  }

  async probeSMTP(email, domain, mxRecords) {
    return this.smtpLimit(async () => {
      let socket;
      let response = { deliverable: false, reason: 'unknown', catchAll: false };
      const log = [];

      try {
        if (!mxRecords || mxRecords.length === 0) {
          log.push('No MX records found for SMTP probe.');
          return { deliverable: false, reason: 'no_mx', rawLog: log.join('\n') };
        }

        const exchange = mxRecords[0].exchange; // Use primary MX

        socket = await new Promise((resolve, reject) => {
          const conn = createConnection({ port: 25, host: exchange, timeout: SMTP_TIMEOUT });
          conn.on('connect', () => resolve(conn));
          conn.on('timeout', () => { 
            conn.destroy(); 
            reject(new Error('SMTP connection timeout')); 
          });
          conn.on('error', (err) => { 
            conn.destroy(); 
            reject(new Error(`SMTP connection error: ${err.message}`)); 
          });
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

        // RCPT TO for actual email
        await new Promise(resolve => socket.write(`RCPT TO:<${email}>\r\n`, () => resolve()));
        data = await readLine();
        log.push(`RCPT TO (${email}): ${data.trim()}`);

        if (data.startsWith('250')) {
          response.deliverable = true;
          response.reason = 'deliverable';
        } else if (data.startsWith('550') || data.startsWith('551') || data.startsWith('553')) {
          response.deliverable = false;
          response.reason = this.parseSmtpRejection(data);
        } else {
          response.deliverable = false;
          response.reason = 'risky_smtp_response';
        }

        // Catch-all detection: test a random non-existent address
        const randomEmail = `nonexistent_${Date.now()}@${domain}`;
        await new Promise(resolve => socket.write(`RCPT TO:<${randomEmail}>\r\n`, () => resolve()));
        const catchAllData = await readLine();
        log.push(`RCPT TO (${randomEmail}): ${catchAllData.trim()}`);

        if (catchAllData.startsWith('250')) {
          response.catchAll = true;
        }

        // QUIT
        await new Promise(resolve => socket.write(`QUIT\r\n`, () => resolve()));
        data = await readLine();
        log.push(`QUIT: ${data.trim()}`);

      } catch (err) {
        log.push(`SMTP probe error: ${err.message}`);
        response.deliverable = false;
        response.reason = 'smtp_error';
      } finally {
        if (socket && !socket.destroyed) {
          socket.destroy();
        }
      }
      
      response.rawLog = log.join('\n');
      return response;
    });
  }

  parseSmtpRejection(response) {
    if (response.includes('mailbox full')) return 'mailbox_full';
    if (response.includes('disabled')) return 'mailbox_disabled';
    if (response.includes('user unknown')) return 'user_unknown';
    if (response.includes('invalid')) return 'invalid_address';
    return 'smtp_reject';
  }
}

const smtpService = new SMTPService();
export { smtpService as probeSMTP };
export default smtpService;
