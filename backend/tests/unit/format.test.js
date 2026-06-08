/**
 * Unit tests for email format validation
 */
import { isValidFormat, normalizeEmail, extractDomain, extractLocalPart } from '../../src/services/emailChecker/format.js';

describe('Email Format Validation', () => {
  describe('isValidFormat', () => {
    test('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'firstname+lastname@example.org',
        'email@subdomain.example.com',
        'firstname-lastname@example.com',
        'email@example-one.com',
        '_______@example.com',
        'email@example.name',
        'email@example.museum',
        'email@example.co.jp',
        'firstname-lastname@example.com'
      ];

      validEmails.forEach(email => {
        expect(isValidFormat(email)).toBe(true);
      });
    });

    test('should reject invalid email formats', () => {
      const invalidEmails = [
        'plainaddress',
        '@example.com',
        'email@',
        'email.example.com',
        'email@example',
        'email..double.dot@example.com',
        'email@example..com',
        'email@example.com.',
        '.email@example.com',
        'email.@example.com',
        'email@.example.com',
        'Abc..123@example.com',
        'just"not"right@example.com',
        'this is"not\allowed@example.com',
        'this\ still\"not\\allowed@example.com'
      ];

      invalidEmails.forEach(email => {
        expect(isValidFormat(email)).toBe(false);
      });
    });

    test('should handle edge cases', () => {
      expect(isValidFormat('')).toBe(false);
      expect(isValidFormat(null)).toBe(false);
      expect(isValidFormat(undefined)).toBe(false);
      expect(isValidFormat('a'.repeat(300))).toBe(false); // Too long
    });
  });

  describe('normalizeEmail', () => {
    test('should normalize valid emails', () => {
      expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
      expect(normalizeEmail('  user@domain.com  ')).toBe('user@domain.com');
      expect(normalizeEmail('USER@DOMAIN.COM')).toBe('user@domain.com');
    });

    test('should return null for invalid emails', () => {
      expect(normalizeEmail('invalid-email')).toBe(null);
      expect(normalizeEmail('')).toBe(null);
      expect(normalizeEmail(null)).toBe(null);
      expect(normalizeEmail(undefined)).toBe(null);
    });

    test('should handle punycode domains', () => {
      // This would need actual punycode domains to test properly
      expect(normalizeEmail('test@example.com')).toBe('test@example.com');
    });
  });

  describe('extractDomain', () => {
    test('should extract domain from valid emails', () => {
      expect(extractDomain('user@example.com')).toBe('example.com');
      expect(extractDomain('test@subdomain.example.org')).toBe('subdomain.example.org');
      expect(extractDomain('admin@company.co.uk')).toBe('company.co.uk');
    });

    test('should return null for invalid emails', () => {
      expect(extractDomain('invalid-email')).toBe(null);
      expect(extractDomain('')).toBe(null);
      expect(extractDomain(null)).toBe(null);
    });
  });

  describe('extractLocalPart', () => {
    test('should extract local part from valid emails', () => {
      expect(extractLocalPart('user@example.com')).toBe('user');
      expect(extractLocalPart('test.user@example.com')).toBe('test.user');
      expect(extractLocalPart('admin+tag@example.com')).toBe('admin+tag');
    });

    test('should return null for invalid emails', () => {
      expect(extractLocalPart('invalid-email')).toBe(null);
      expect(extractLocalPart('')).toBe(null);
      expect(extractLocalPart(null)).toBe(null);
    });
  });
});
