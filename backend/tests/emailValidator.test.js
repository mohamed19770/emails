/**
 * Comprehensive tests for email validator
 * Tests all conservative validation rules
 */

import { jest } from '@jest/globals';
import { validateEmails } from '../src/services/emailValidator.js';

// Mock all dependencies
jest.mock('../src/services/dnsCache.js', () => import('../__mocks__/dns.mock.js'));
jest.mock('../src/services/ndsmtp.js', () => import('../__mocks__/ndsmtp.mock.js'));

describe('Email Validator - Conservative Rules', () => {
  
  describe('Safe Mode Tests', () => {
    test('should never return valid in safe mode', async () => {
      const emails = [
        'valid@gmail.com',
        'fake@gmail.com',
        'test@mailinator.com',
        'admin@example.com'
      ];
      
      const result = await validateEmails(emails, true);
      
      expect(result.summary.valid).toBe(0);
      expect(result.data.safeMode).toBe(true);
      
      // All results should have confidence <= 0.55
      result.data.results.forEach(r => {
        expect(r.confidence).toBeLessThanOrEqual(0.55);
      });
    });
    
    test('should detect disposable domains in safe mode', async () => {
      const emails = ['test@mailinator.com'];
      
      const result = await validateEmails(emails, true);
      
      expect(result.summary.risky).toBe(1);
      expect(result.data.results[0].disposable).toBe(true);
      expect(result.data.results[0].status).toBe('risky');
    });
    
    test('should detect blacklisted domains in safe mode', async () => {
      const emails = ['admin@example.com'];
      
      const result = await validateEmails(emails, true);
      
      expect(result.summary.invalid).toBe(1);
      expect(result.data.results[0].blacklisted).toBe(true);
      expect(result.data.results[0].status).toBe('invalid');
    });
  });
  
  describe('Full Mode Tests', () => {
    test('should detect catch-all domains and mark as risky', async () => {
      const emails = ['any@test-catchall.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.summary.risky).toBe(1);
      expect(result.data.results[0].catchAll).toBe(true);
      expect(result.data.results[0].status).toBe('risky');
      expect(result.data.results[0].status).not.toBe('valid');
    });
    
    test('should never mark disposable domains as valid', async () => {
      const emails = ['test@mailinator.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.summary.valid).toBe(0);
      expect(result.data.results[0].disposable).toBe(true);
      expect(result.data.results[0].status).toBe('risky');
    });
    
    test('should never mark blacklisted domains as valid', async () => {
      const emails = ['admin@example.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.summary.valid).toBe(0);
      expect(result.data.results[0].blacklisted).toBe(true);
      expect(result.data.results[0].status).toBe('invalid');
    });
    
    test('should mark legitimate emails as valid with high confidence', async () => {
      const emails = ['valid@gmail.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.summary.valid).toBe(1);
      expect(result.data.results[0].status).toBe('valid');
      expect(result.data.results[0].confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.data.results[0].catchAll).toBe(false);
    });
    
    test('should mark fake emails as invalid', async () => {
      const emails = ['fake@gmail.com', 'nonexistent@yahoo.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.summary.valid).toBe(0);
      expect(result.summary.invalid).toBe(2);
      result.data.results.forEach(r => {
        expect(r.status).toBe('invalid');
      });
    });
  });
  
  describe('Confidence Rules', () => {
    test('should never return valid with confidence < 0.75', async () => {
      const emails = ['fake@gmail.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.data.results[0].confidence).toBeLessThan(0.75);
      expect(result.data.results[0].status).not.toBe('valid');
    });
    
    test('should return valid only with confidence >= 0.75', async () => {
      const emails = ['valid@gmail.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.data.results[0].confidence).toBeGreaterThanOrEqual(0.75);
      expect(result.data.results[0].status).toBe('valid');
    });
  });
  
  describe('Deduplication and Batching', () => {
    test('should deduplicate emails', async () => {
      const emails = [
        'valid@gmail.com',
        'VALID@GMAIL.COM', // Duplicate
        'valid@gmail.com', // Duplicate
        'fake@yahoo.com'
      ];
      
      const result = await validateEmails(emails, false);
      
      expect(result.summary.total).toBe(2);
      expect(result.summary.duplicates).toBe(2);
    });
    
    test('should process large batches correctly', async () => {
      const emails = Array(100).fill().map((_, i) => `test${i}@example.com`);
      
      const result = await validateEmails(emails, true);
      
      expect(result.summary.total).toBe(100);
      expect(result.data.results).toHaveLength(100);
    });
  });
  
  describe('Provider Sensitivity', () => {
    test('should handle Gmail conservatively', async () => {
      const emails = ['fake@gmail.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.data.results[0].providerSensitive).toBe(true);
      expect(result.data.results[0].status).not.toBe('valid');
    });
    
    test('should handle Outlook conservatively', async () => {
      const emails = ['fake@outlook.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.data.results[0].providerSensitive).toBe(true);
    });
  });
  
  describe('Role-based Detection', () => {
    test('should detect role-based emails', async () => {
      const emails = ['admin@example.com', 'info@test.com', 'support@domain.com'];
      
      const result = await validateEmails(emails, false);
      
      result.data.results.forEach(r => {
        if (r.email.includes('admin') || r.email.includes('info') || r.email.includes('support')) {
          expect(r.roleBased).toBe(true);
        }
      });
    });
  });
  
  describe('Error Handling', () => {
    test('should handle invalid email formats', async () => {
      const emails = ['invalid-email', 'not-an-email', ''];
      
      const result = await validateEmails(emails, false);
      
      expect(result.summary.invalid).toBe(3);
      result.data.results.forEach(r => {
        expect(r.status).toBe('invalid');
        expect(r.reason).toBe('bad-format');
      });
    });
    
    test('should handle domains with no MX records', async () => {
      const emails = ['test@nonexistent-domain-12345.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.summary.invalid).toBe(1);
      expect(result.data.results[0].status).toBe('invalid');
      expect(result.data.results[0].reason).toBe('no-mx');
    });
  });
  
  describe('Acceptance Criteria', () => {
    test('should eliminate false positives', async () => {
      const fakeEmails = [
        'fake@gmail.com',
        'nonexistent@yahoo.com',
        'test@mailinator.com',
        'admin@example.com',
        'spam@spam.com'
      ];
      
      const result = await validateEmails(fakeEmails, false);
      
      // No fake emails should be marked as valid
      expect(result.summary.valid).toBe(0);
      
      // Check specific classifications
      const results = result.data.results;
      const fakeGmail = results.find(r => r.email === 'fake@gmail.com');
      const mailinator = results.find(r => r.email === 'test@mailinator.com');
      const adminExample = results.find(r => r.email === 'admin@example.com');
      
      expect(fakeGmail.status).not.toBe('valid');
      expect(mailinator.disposable).toBe(true);
      expect(adminExample.blacklisted).toBe(true);
    });
    
    test('should handle catch-all domains correctly', async () => {
      const emails = ['any@test-catchall.com'];
      
      const result = await validateEmails(emails, false);
      
      expect(result.data.results[0].catchAll).toBe(true);
      expect(result.data.results[0].status).toBe('risky');
      expect(result.data.results[0].status).not.toBe('valid');
    });
    
    test('should respect confidence thresholds', async () => {
      const emails = ['valid@gmail.com', 'fake@gmail.com'];
      
      const result = await validateEmails(emails, false);
      
      const validResult = result.data.results.find(r => r.email === 'valid@gmail.com');
      const fakeResult = result.data.results.find(r => r.email === 'fake@gmail.com');
      
      expect(validResult.confidence).toBeGreaterThanOrEqual(0.75);
      expect(validResult.status).toBe('valid');
      
      expect(fakeResult.confidence).toBeLessThan(0.75);
      expect(fakeResult.status).not.toBe('valid');
    });
  });
});
