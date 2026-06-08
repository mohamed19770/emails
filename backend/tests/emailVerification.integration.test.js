/**
 * Email verification integration tests
 * Tests the complete verification pipeline with mocks
 */

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Import the email verification service
import { verifyEmail, verifyEmails, getVerificationStats } from '../src/services/emailVerification/emailVerificationService.js';

dotenv.config();

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Mock the email verification routes
  app.post('/api/email-verification/verify', async (req, res) => {
    try {
      const { email, safeMode = false, skipSafetyChecks = false } = req.body;
      const clientIP = req.ip || 'test-ip';

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Email address is required'
        });
      }

      const result = await verifyEmail(email, {
        safeMode,
        clientIP,
        skipSafetyChecks
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error during email verification'
      });
    }
  });

  app.post('/api/email-verification/verify-batch', async (req, res) => {
    try {
      const { 
        emails, 
        safeMode = false, 
        skipSafetyChecks = false,
        maxConcurrency = 5 
      } = req.body;
      const clientIP = req.ip || 'test-ip';

      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({
          success: false,
          error: 'Emails array is required'
        });
      }

      if (emails.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Emails array cannot be empty'
        });
      }

      const results = await verifyEmails(emails, {
        safeMode,
        clientIP,
        skipSafetyChecks,
        maxConcurrency
      });

      const stats = getVerificationStats(results);

      res.json({
        success: true,
        data: {
          results,
          stats,
          processedAt: new Date().toISOString(),
          safeMode
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error during batch email verification'
      });
    }
  });

  return app;
};

describe('Email Verification Integration Tests', () => {
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
    // Reset any state
    jest.clearAllMocks();
  });

  describe('Single Email Verification', () => {
    test('should verify valid email format', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email: 'test@example.com',
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('method');
    });

    test('should handle invalid email format', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email: 'invalid-email',
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('invalid');
      expect(response.body.data.reason).toBe('invalid-input');
    });

    test('should handle empty email', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email: '',
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('invalid');
    });

    test('should handle missing email parameter', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify')
        .send({
          safeMode: true
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email address is required');
    });
  });

  describe('Batch Email Verification', () => {
    test('should verify multiple emails', async () => {
      const emails = [
        'test@example.com',
        'user@gmail.com',
        'invalid-email',
        'admin@company.com'
      ];

      const response = await request(app)
        .post('/api/email-verification/verify-batch')
        .send({
          emails,
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(4);
      expect(response.body.data.stats).toHaveProperty('total', 4);
    });

    test('should handle empty emails array', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify-batch')
        .send({
          emails: [],
          safeMode: true
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Emails array cannot be empty');
    });

    test('should handle missing emails parameter', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify-batch')
        .send({
          safeMode: true
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Emails array is required');
    });

    test('should handle large batch size limit', async () => {
      const emails = Array(101).fill('test@example.com');

      const response = await request(app)
        .post('/api/email-verification/verify-batch')
        .send({
          emails,
          safeMode: true
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Maximum 100 emails allowed per batch request');
    });
  });

  describe('Safe Mode vs Full Mode', () => {
    test('should behave differently in safe mode', async () => {
      const email = 'test@example.com';

      // Safe mode
      const safeResponse = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email,
          safeMode: true
        });

      // Full mode
      const fullResponse = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email,
          safeMode: false
        });

      expect(safeResponse.status).toBe(200);
      expect(fullResponse.status).toBe(200);

      // Both should succeed but may have different results
      expect(safeResponse.body.success).toBe(true);
      expect(fullResponse.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email: null,
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('invalid');
    });

    test('should handle non-string email input', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email: 12345,
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('invalid');
    });
  });

  describe('Response Schema Validation', () => {
    test('should return proper response schema', async () => {
      const response = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email: 'test@example.com',
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const result = response.body.data;
      
      // Required fields
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('hasMX');
      expect(result).toHaveProperty('catchAll');
      expect(result).toHaveProperty('disposable');
      expect(result).toHaveProperty('blacklisted');
      expect(result).toHaveProperty('roleBased');
      expect(result).toHaveProperty('providerSensitive');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('startTLS');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('checkedAt');
      expect(result).toHaveProperty('processingTime');

      // Type validation
      expect(typeof result.email).toBe('string');
      expect(typeof result.status).toBe('string');
      expect(typeof result.reason).toBe('string');
      expect(typeof result.hasMX).toBe('boolean');
      expect(typeof result.catchAll).toBe('boolean');
      expect(typeof result.disposable).toBe('boolean');
      expect(typeof result.blacklisted).toBe('boolean');
      expect(typeof result.roleBased).toBe('boolean');
      expect(typeof result.providerSensitive).toBe('boolean');
      expect(typeof result.method).toBe('string');
      expect(typeof result.startTLS).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.checkedAt).toBe('string');
      expect(typeof result.processingTime).toBe('number');

      // Value validation
      expect(['valid', 'invalid', 'risky', 'unknown']).toContain(result.status);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Statistics Calculation', () => {
    test('should calculate correct statistics', async () => {
      const emails = [
        'valid@example.com',
        'invalid@nonexistent.com',
        'risky@example.com',
        'unknown@example.com'
      ];

      const response = await request(app)
        .post('/api/email-verification/verify-batch')
        .send({
          emails,
          safeMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const stats = response.body.data.stats;
      
      expect(stats).toHaveProperty('total', 4);
      expect(stats).toHaveProperty('valid');
      expect(stats).toHaveProperty('invalid');
      expect(stats).toHaveProperty('risky');
      expect(stats).toHaveProperty('unknown');
      expect(stats).toHaveProperty('averageConfidence');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('methodDistribution');
      expect(stats).toHaveProperty('confidenceDistribution');

      // Sum of all statuses should equal total
      const totalStatuses = stats.valid + stats.invalid + stats.risky + stats.unknown;
      expect(totalStatuses).toBe(stats.total);
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle concurrent requests', async () => {
      const promises = Array(5).fill().map((_, i) => 
        request(app)
          .post('/api/email-verification/verify')
          .send({
            email: `test${i}@example.com`,
            safeMode: true
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    test('should respect processing time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/email-verification/verify')
        .send({
          email: 'test@example.com',
          safeMode: true
        });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(response.body.data.processingTime).toBeGreaterThan(0);
    });
  });
});
