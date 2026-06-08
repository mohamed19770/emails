import { isDisposable, isBlacklisted, isRoleBased, extractDomain, extractLocalPart } from '../src/services/emailChecker/meta.js';

describe('Email Metadata Validation', () => {
  describe('Disposable email detection', () => {
    const disposableEmails = [
      'test@mailinator.com',
      'user@10minutemail.com',
      'fake@guerrillamail.com',
      'temp@tempmail.org',
      'throwaway@throwaway.email'
    ];

    test.each(disposableEmails)('should detect %s as disposable', (email) => {
      const domain = extractDomain(email);
      expect(isDisposable(domain)).toBe(true);
    });

    const nonDisposableEmails = [
      'user@gmail.com',
      'contact@yahoo.com',
      'admin@example.com',
      'support@company.com'
    ];

    test.each(nonDisposableEmails)('should not detect %s as disposable', (email) => {
      const domain = extractDomain(email);
      expect(isDisposable(domain)).toBe(false);
    });
  });

  describe('Blacklisted domain detection', () => {
    const blacklistedEmails = [
      'spam@spamdomain.com',
      'bad@badmail.net',
      'virus@virusmail.org',
      'test@bad-domain.test'
    ];

    test.each(blacklistedEmails)('should detect %s as blacklisted', (email) => {
      const domain = extractDomain(email);
      expect(isBlacklisted(domain)).toBe(true);
    });

    const nonBlacklistedEmails = [
      'user@gmail.com',
      'contact@yahoo.com',
      'admin@example.com',
      'support@company.com'
    ];

    test.each(nonBlacklistedEmails)('should not detect %s as blacklisted', (email) => {
      const domain = extractDomain(email);
      expect(isBlacklisted(domain)).toBe(false);
    });
  });

  describe('Role-based email detection', () => {
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
      'abuse@security.com',
      'security@protection.com',
      'help@assistance.com',
      'office@workplace.com',
      'jobs@careers.com',
      'careers@employment.com',
      'press@media.com',
      'media@news.com',
      'feedback@opinion.com',
      'enquiries@questions.com',
      'hello@greeting.com',
      'dev@development.com',
      'developer@coding.com',
      'test@testing.com',
      'testing@validation.com',
      'no-reply@noreply.com',
      'daemon@system.com',
      'root@admin.com',
      'ftp@files.com',
      'www@web.com',
      'usenet@news.com',
      'news@information.com',
      'mail@email.com',
      'email@correspondence.com',
      'contactus@reach.com',
      'feedback@input.com',
      'inquiry@question.com',
      'inquiries@questions.com',
      'office@workplace.com',
      'reception@front.com',
      'hr@humanresources.com',
      'humanresources@personnel.com',
      'recruitment@hiring.com',
      'accounts@finance.com',
      'accounting@money.com',
      'finance@funds.com',
      'legal@law.com',
      'privacy@protection.com',
      'compliance@rules.com',
      'gdpr@privacy.com',
      'security@safety.com',
      'abuse@misuse.com',
      'spam@junk.com',
      'marketing@promotion.com',
      'newsletter@bulletin.com',
      'subscribe@signup.com',
      'unsubscribe@optout.com',
      'sales@selling.com',
      'billing@payment.com',
      'support@help.com',
      'helpdesk@assistance.com',
      'tech@technical.com',
      'technical@tech.com',
      'it@information.com',
      'is@systems.com'
    ];

    test.each(roleBasedEmails)('should detect %s as role-based', (email) => {
      const localPart = extractLocalPart(email);
      expect(isRoleBased(localPart)).toBe(true);
    });

    const nonRoleBasedEmails = [
      'john@gmail.com',
      'jane.doe@yahoo.com',
      'user123@example.com',
      'customer@company.com',
      'client@business.com',
      'person@individual.com',
      'someone@somewhere.com',
      'anyone@anywhere.com',
      'everyone@everywhere.com',
      'nobody@nowhere.com'
    ];

    test.each(nonRoleBasedEmails)('should not detect %s as role-based', (email) => {
      const localPart = extractLocalPart(email);
      expect(isRoleBased(localPart)).toBe(false);
    });
  });

  describe('Domain extraction', () => {
    test('should extract domain from valid emails', () => {
      expect(extractDomain('user@example.com')).toBe('example.com');
      expect(extractDomain('test@subdomain.example.org')).toBe('subdomain.example.org');
      expect(extractDomain('admin@company.co.uk')).toBe('company.co.uk');
    });

    test('should throw error for invalid email formats', () => {
      expect(() => extractDomain('invalid-email')).toThrow('Invalid email format for domain extraction');
      expect(() => extractDomain('@example.com')).toThrow('Invalid email format for domain extraction');
      expect(() => extractDomain('user@')).toThrow('Invalid email format for domain extraction');
    });
  });

  describe('Local part extraction', () => {
    test('should extract local part from valid emails', () => {
      expect(extractLocalPart('user@example.com')).toBe('user');
      expect(extractLocalPart('test.user@example.com')).toBe('test.user');
      expect(extractLocalPart('admin+tag@example.com')).toBe('admin+tag');
    });

    test('should throw error for invalid email formats', () => {
      expect(() => extractLocalPart('invalid-email')).toThrow('Invalid email format for local part extraction');
      expect(() => extractLocalPart('@example.com')).toThrow('Invalid email format for local part extraction');
      expect(() => extractLocalPart('user@')).toThrow('Invalid email format for local part extraction');
    });
  });

  describe('Edge cases', () => {
    test('should handle case insensitive domain matching', () => {
      expect(isDisposable('MAILINATOR.COM')).toBe(true);
      expect(isBlacklisted('SPAMDOMAIN.COM')).toBe(true);
    });

    test('should handle case insensitive role-based matching', () => {
      expect(isRoleBased('ADMIN')).toBe(true);
      expect(isRoleBased('INFO')).toBe(true);
      expect(isRoleBased('SUPPORT')).toBe(true);
    });

    test('should handle empty strings', () => {
      expect(isDisposable('')).toBe(false);
      expect(isBlacklisted('')).toBe(false);
      expect(isRoleBased('')).toBe(false);
    });
  });
});
