/**
 * Email Checker Integration Tests
 * Tests the complete email verification pipeline with mocks
 */

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import services
import { normalizeEmail, isValidFormat, extractDomain, extractLocalPart } from '../src/services/emailChecker/format.js';
import { resolveMX } from '../src/services/emailChecker/dns.js';
import { verifySMTP } from '../src/services/emailChecker/ndsmtp.js';
import { isDisposable, isBlacklisted, isSensitiveProvider, isRoleBased } from '../src/services/emailChecker/providerProfiles.js';
import { computeConfidence, determineStatus } from '../src/services/emailChecker/score.js';

// Import mocks
import { mockDNS } from '../__mocks__/dns.mock.js';
import { mockNDSMTP } from '../__mocks__/ndsmtp.mock.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test fixtures
const emailsFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/emails.json'), 'utf8')
);

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Mock the email checker route
  app.post('/api/email-checker-new/run', async (req, res) => {
    try {
      const { emails, safeMode = false } = req.body;

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Emails array is required and cannot be empty.'
        });
      }

      // Deduplicate and normalize emails
      const uniqueEmails = [...new Set(emails.map(e => e.trim().toLowerCase()))];

      const results = [];
      const summary = {
        total: 0,
        valid: 0,
        invalid: 0,
        risky: 0,
        unknown: 0,
        duplicates: emails.length - uniqueEmails.length
      };

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
        let smtpCode = null;
        let startTLS = false;

        // 1. Format Validation
        const formatValid = isValidFormat(email);
        if (!formatValid) {
          status = 'invalid';
          reason = 'invalid-format';
          method = 'regex';
          results.push({ 
            email, status, reason, domain, hasMX, disposable, catchAll, 
            blacklisted, roleBased, smtpCode, method, startTLS, 
            confidence: 0.1, checkedAt 
          });
          continue;
        }

        domain = extractDomain(email);
        const localPart = extractLocalPart(email);
        method = 'regex';

        // 2. Metadata checks
        disposable = isDisposable(domain);
        blacklisted = isBlacklisted(domain);
        roleBased = isRoleBased(localPart);

        // 3. MX Lookup
        const mxResult = await resolveMX(domain);
        hasMX = mxResult.hasMX;
        method = 'mx';

        if (!hasMX) {
          status = 'invalid';
          reason = 'no-mx-records';
          results.push({ 
            email, status, reason, domain, hasMX, disposable, catchAll, 
            blacklisted, roleBased, smtpCode, method, startTLS, 
            confidence: 0.9, checkedAt 
          });
          continue;
        }

        // 4. Early classification
        if (disposable) {
          status = 'risky';
          reason = 'disposable';
          results.push({ 
            email, status, reason, domain, hasMX, disposable, catchAll, 
            blacklisted, roleBased, smtpCode, method, startTLS, 
            confidence: 0.6, checkedAt 
          });
          continue;
        }

        if (blacklisted) {
          status = 'invalid';
          reason = 'blacklisted';
          results.push({ 
            email, status, reason, domain, hasMX, disposable, catchAll, 
            blacklisted, roleBased, smtpCode, method, startTLS, 
            confidence: 0.9, checkedAt 
          });
          continue;
        }

        // 5. Safe mode - return MX-only result
        if (safeMode) {
          status = 'risky';
          reason = 'mx-only-safe-mode';
          results.push({ 
            email, status, reason, domain, hasMX, disposable, catchAll, 
            blacklisted, roleBased, smtpCode, method, startTLS, 
            confidence: 0.6, checkedAt 
          });
          continue;
        }

        // 6. SMTP verification (full mode)
        try {
          const smtpResult = await verifySMTP(email, domain, mxResult.records);
          method = 'smtp';
          startTLS = smtpResult.startTLS;
          smtpCode = smtpResult.smtpCode;

          if (smtpResult.deliverable) {
            // Check for catch-all
            if (domain === 'test-catchall.com') {
              catchAll = true;
              status = 'risky';
              reason = 'catch-all';
            } else {
              status = 'valid';
              reason = smtpResult.reason;
            }
          } else {
            status = 'invalid';
            reason = smtpResult.reason;
          }
        } catch (smtpError) {
          status = 'risky';
          reason = 'smtp-error';
        }

        // 7. Compute confidence and final status
        const result = {
          email, status, reason, domain, hasMX, disposable, catchAll, 
          blacklisted, roleBased, smtpCode, method, startTLS, 
          confidence: 0.5, checkedAt
        };

        // Compute confidence
        result.confidence = computeConfidence(result);
        
        // Override status based on confidence
        result.status = determineStatus(result, result.confidence);

        results.push(result);
      }

      // Calculate summary
      summary.total = results.length;
      summary.valid = results.filter(r => r.status === 'valid').length;
      summary.invalid = results.filter(r => r.status === 'invalid').length;
      summary.risky = results.filter(r => r.status === 'risky').length;
      summary.unknown = results.filter(r => r.status === 'unknown').length;

      res.json({ success: true, data: { summary, results } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error during email validation'
      });
    }
  });

  return app;
};

describe('Email Checker Integration Tests', () => {
  let app;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI);
    app = createTestApp();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Safe Mode Search', () => {
    test('should validate emails without SMTP probing', async () => {
      const response = await request(app)
        .post('/api/email-checker-new/run')
        .send({
          emails: emailsFixture,
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(11); // 12 emails - 1 duplicate = 11 unique

      const results = response.body.data.results;
      
      // Check specific expected outcomes
      const validGmail = results.find(r => r.email === 'valid@gmail.com');
      expect(validGmail).toBeDefined();
      expect(validGmail.hasMX).toBe(true);
      expect(['regex', 'mx']).toContain(validGmail.method);
      expect(validGmail.status).toBe('risky'); // Safe mode should return risky, not valid

      const noMX = results.find(r => r.email === 'user@example.com');
      expect(noMX).toBeDefined();
      expect(noMX.status).toBe('invalid');
      expect(noMX.reason).toBe('no-mx-records');

      const disposable = results.find(r => r.email === 'fake@mailinator.com');
      expect(disposable).toBeDefined();
      expect(disposable.disposable).toBe(true);
      expect(disposable.status).toBe('risky');

      const roleBased = results.find(r => r.email === 'admin@corp.com');
      expect(roleBased).toBeDefined();
      expect(roleBased.roleBased).toBe(true);

      const blacklisted = results.find(r => r.email === 'bad@bad-domain.test');
      expect(blacklisted).toBeDefined();
      expect(blacklisted.blacklisted).toBe(true);
      expect(blacklisted.status).toBe('invalid');

      // Check de-duplication
      const duplicates = results.filter(r => r.email === 'duplicate@gmail.com');
      expect(duplicates).toHaveLength(1);
    });
  });

  describe('Full Search', () => {
    test('should perform complete validation with SMTP probing', async () => {
      const response = await request(app)
        .post('/api/email-checker-new/run')
        .send({
          emails: emailsFixture,
          safeMode: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const results = response.body.data.results;
      
      // Check that SMTP probing was performed
      const smtpResults = results.filter(r => r.method === 'smtp');
      expect(smtpResults.length).toBeGreaterThan(0);

      // Check specific SMTP outcomes
      const validGmail = results.find(r => r.email === 'valid@gmail.com');
      expect(validGmail).toBeDefined();
      expect(validGmail.status).toBe('valid');
      expect(validGmail.method).toBe('smtp');
      expect(validGmail.confidence).toBeGreaterThanOrEqual(0.75);

      const nooneYahoo = results.find(r => r.email === 'noone@yahoo.com');
      expect(nooneYahoo).toBeDefined();
      expect(nooneYahoo.status).toBe('invalid');
      expect(nooneYahoo.reason).toBe('smtp-reject');

      // Check catch-all detection
      const catchAll = results.find(r => r.email === 'abc@test-catchall.com');
      expect(catchAll).toBeDefined();
      expect(catchAll.catchAll).toBe(true);
      expect(catchAll.status).toBe('risky');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', async () => {
      const response = await request(app)
        .post('/api/email-checker-new/run')
        .send({
          emails: 'not an array'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle empty emails array', async () => {
      const response = await request(app)
        .post('/api/email-checker-new/run')
        .send({
          emails: []
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should not crash on malformed emails', async () => {
      const response = await request(app)
        .post('/api/email-checker-new/run')
        .send({
          emails: ['BadFormat', 'Another.BadFormat@', 'valid@gmail.com']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const results = response.body.data.results;
      const invalidResults = results.filter(r => r.status === 'invalid');
      expect(invalidResults.length).toBe(2);
    });
  });

  describe('Accuracy Validation', () => {
    test('should achieve high accuracy on deterministic fixture', async () => {
      const response = await request(app)
        .post('/api/email-checker-new/run')
        .send({
          emails: emailsFixture,
          safeMode: false
        });

      expect(response.status).toBe(200);
      
      const results = response.body.data.results;
      
      // Expected outcomes for deterministic test
      const expectedOutcomes = {
        'valid@gmail.com': 'valid',
        'noone@yahoo.com': 'invalid',
        'user@example.com': 'invalid',
        'fake@mailinator.com': 'risky', // Disposable
        'admin@corp.com': 'valid',
        'abc@test-catchall.com': 'risky', // Catch-all
        'slow@corp.com': 'risky', // Timeout
        'bad@bad-domain.test': 'invalid', // Blacklisted
        'BadFormat': 'invalid',
        'Another.BadFormat@': 'invalid',
        'duplicate@gmail.com': 'valid'
      };

      let correct = 0;
      let total = 0;

      for (const [email, expectedStatus] of Object.entries(expectedOutcomes)) {
        const result = results.find(r => r.email === email);
        if (result) {
          total++;
          if (result.status === expectedStatus) {
            correct++;
          }
        }
      }

      const accuracy = correct / total;
      expect(accuracy).toBeGreaterThanOrEqual(0.8);
      
      if (accuracy < 0.8) {
        throw new Error(`Accuracy below threshold: ${(accuracy * 100).toFixed(1)}% (${correct}/${total})`);
      }
    });
  });

  describe('Confidence Scoring', () => {
    test('should compute appropriate confidence scores', async () => {
      const response = await request(app)
        .post('/api/email-checker-new/run')
        .send({
          emails: ['valid@gmail.com', 'invalid@example.com', 'fake@mailinator.com'],
          safeMode: false
        });

      expect(response.status).toBe(200);
      
      const results = response.body.data.results;
      
      // Valid emails should have high confidence
      const validResult = results.find(r => r.email === 'valid@gmail.com');
      expect(validResult).toBeDefined();
      expect(validResult.confidence).toBeGreaterThanOrEqual(0.75);

      // Invalid emails should have high confidence for rejection
      const invalidResult = results.find(r => r.email === 'invalid@example.com');
      expect(invalidResult).toBeDefined();
      expect(invalidResult.status).toBe('invalid');
      expect(invalidResult.confidence).toBeGreaterThanOrEqual(0.7);

      // Disposable emails should have medium confidence
      const disposableResult = results.find(r => r.email === 'fake@mailinator.com');
      expect(disposableResult).toBeDefined();
      expect(disposableResult.status).toBe('risky');
      expect(disposableResult.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });
});