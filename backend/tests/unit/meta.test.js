/**
 * Unit tests for metadata validation
 */
import { isDisposable, isBlacklisted, isSensitiveProvider, isRoleBased } from '../../src/services/emailChecker/providerProfiles.js';

describe('Email Metadata Validation', () => {
  describe('isDisposable', () => {
    test('should detect disposable email domains', () => {
      const disposableEmails = [
        'test@mailinator.com',
        'user@10minutemail.com',
        'fake@guerrillamail.com',
        'temp@tempmail.org',
        'throwaway@throwaway.email'
      ];

      disposableEmails.forEach(email => {
        const domain = email.split('@')[1];
        expect(isDisposable(domain)).toBe(true);
      });
    });

    test('should not detect normal domains as disposable', () => {
      const normalEmails = [
        'user@gmail.com',
        'contact@yahoo.com',
        'admin@example.com',
        'support@company.com'
      ];

      normalEmails.forEach(email => {
        const domain = email.split('@')[1];
        expect(isDisposable(domain)).toBe(false);
      });
    });
  });

  describe('isBlacklisted', () => {
    test('should detect blacklisted domains', () => {
      const blacklistedEmails = [
        'spam@spamdomain.com',
        'bad@badmail.net',
        'virus@virusmail.org',
        'test@bad-domain.test'
      ];

      blacklistedEmails.forEach(email => {
        const domain = email.split('@')[1];
        expect(isBlacklisted(domain)).toBe(true);
      });
    });

    test('should not detect normal domains as blacklisted', () => {
      const normalEmails = [
        'user@gmail.com',
        'contact@yahoo.com',
        'admin@example.com',
        'support@company.com'
      ];

      normalEmails.forEach(email => {
        const domain = email.split('@')[1];
        expect(isBlacklisted(domain)).toBe(false);
      });
    });
  });

  describe('isSensitiveProvider', () => {
    test('should detect sensitive providers', () => {
      const sensitiveEmails = [
        'user@gmail.com',
        'contact@outlook.com',
        'admin@yahoo.com',
        'support@icloud.com'
      ];

      sensitiveEmails.forEach(email => {
        const domain = email.split('@')[1];
        expect(isSensitiveProvider(domain)).toBe(true);
      });
    });

    test('should not detect normal domains as sensitive', () => {
      const normalEmails = [
        'user@example.com',
        'contact@company.com',
        'admin@business.org'
      ];

      normalEmails.forEach(email => {
        const domain = email.split('@')[1];
        expect(isSensitiveProvider(domain)).toBe(false);
      });
    });
  });

  describe('isRoleBased', () => {
    test('should detect role-based emails', () => {
      const roleBasedEmails = [
        'admin@company.com',
        'info@example.org',
        'support@help.com',
        'sales@business.com',
        'contact@website.com',
        'webmaster@site.com',
        'noreply@service.com',
        'postmaster@domain.com',
        'hostmaster@server.com',
        'marketing@firm.com',
        'billing@payment.com',
        'abuse@security.com'
      ];

      roleBasedEmails.forEach(email => {
        const localPart = email.split('@')[0];
        expect(isRoleBased(localPart)).toBe(true);
      });
    });

    test('should not detect normal emails as role-based', () => {
      const normalEmails = [
        'john@gmail.com',
        'jane.doe@yahoo.com',
        'user123@example.com',
        'customer@company.com',
        'client@business.com',
        'person@individual.com'
      ];

      normalEmails.forEach(email => {
        const localPart = email.split('@')[0];
        expect(isRoleBased(localPart)).toBe(false);
      });
    });
  });
});
