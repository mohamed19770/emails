import { validateEmailFormat } from '../src/services/emailChecker/format.js';

describe('Email Format Validation', () => {
  describe('Valid emails', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'firstname+lastname@example.org',
      'email@subdomain.example.com',
      'firstname-lastname@example.com',
      'email@123.123.123.123',
      'email@[123.123.123.123]',
      '"email"@example.com',
      '1234567890@example.com',
      'email@example-one.com',
      '_______@example.com',
      'email@example.name',
      'email@example.museum',
      'email@example.co.jp',
      'firstname-lastname@example.com'
    ];

    test.each(validEmails)('should validate %s as valid', (email) => {
      expect(validateEmailFormat(email)).toBe(true);
    });
  });

  describe('Invalid emails', () => {
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
      'email@example..com',
      'Abc..123@example.com',
      'email@123.123.123.123.123',
      'email@[123.123.123.123.123]',
      'just"not"right@example.com',
      'this is"not\allowed@example.com',
      'this\ still\"not\\allowed@example.com',
      'much."more\ unusual"@example.com',
      'very.unusual."@".unusual.com@example.com',
      'very."(),:;<>[]".VERY."very@\\ "very".unusual@strange.example.com'
    ];

    test.each(invalidEmails)('should validate %s as invalid', (email) => {
      expect(validateEmailFormat(email)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty string', () => {
      expect(validateEmailFormat('')).toBe(false);
    });

    test('should handle null/undefined', () => {
      expect(validateEmailFormat(null)).toBe(false);
      expect(validateEmailFormat(undefined)).toBe(false);
    });

    test('should handle very long emails', () => {
      const longEmail = 'a'.repeat(100) + '@example.com';
      expect(validateEmailFormat(longEmail)).toBe(true);
    });

    test('should handle emails with special characters', () => {
      expect(validateEmailFormat('test+tag@example.com')).toBe(true);
      expect(validateEmailFormat('test-tag@example.com')).toBe(true);
      expect(validateEmailFormat('test_tag@example.com')).toBe(true);
    });
  });
});
