import { probeSMTP } from '../src/services/emailChecker/smtp.js';
import { mockSMTP } from '../__mocks__/smtp.mock.js';

// Mock the SMTP module
jest.mock('../src/services/emailChecker/smtp.js', () => ({
  probeSMTP: jest.fn()
}));

describe('SMTP Probing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful SMTP responses', () => {
    test('should handle deliverable emails', async () => {
      const mockResponse = {
        deliverable: true,
        reason: 'deliverable',
        catchAll: false,
        rawLog: 'Mock SMTP: deliverable for valid@gmail.com'
      };
      
      probeSMTP.mockResolvedValue(mockResponse);
      
      const result = await probeSMTP('valid@gmail.com', 'gmail.com', []);
      
      expect(result.deliverable).toBe(true);
      expect(result.reason).toBe('deliverable');
      expect(result.catchAll).toBe(false);
    });

    test('should handle catch-all domains', async () => {
      const mockResponse = {
        deliverable: true,
        reason: 'deliverable',
        catchAll: true,
        rawLog: 'Mock SMTP: Catch-all domain detected for abc@test-catchall.com'
      };
      
      probeSMTP.mockResolvedValue(mockResponse);
      
      const result = await probeSMTP('abc@test-catchall.com', 'test-catchall.com', []);
      
      expect(result.deliverable).toBe(true);
      expect(result.catchAll).toBe(true);
    });
  });

  describe('Failed SMTP responses', () => {
    test('should handle SMTP rejections', async () => {
      const mockResponse = {
        deliverable: false,
        reason: 'smtp_reject',
        catchAll: false,
        rawLog: 'Mock SMTP: smtp_reject for noone@yahoo.com'
      };
      
      probeSMTP.mockResolvedValue(mockResponse);
      
      const result = await probeSMTP('noone@yahoo.com', 'yahoo.com', []);
      
      expect(result.deliverable).toBe(false);
      expect(result.reason).toBe('smtp_reject');
    });

    test('should handle timeout errors', async () => {
      const mockResponse = {
        deliverable: false,
        reason: 'timeout',
        catchAll: false,
        rawLog: 'Mock SMTP: timeout for slow@corp.com'
      };
      
      probeSMTP.mockResolvedValue(mockResponse);
      
      const result = await probeSMTP('slow@corp.com', 'corp.com', []);
      
      expect(result.deliverable).toBe(false);
      expect(result.reason).toBe('timeout');
    });

    test('should handle SMTP errors', async () => {
      const mockResponse = {
        deliverable: false,
        reason: 'smtp_error',
        catchAll: false,
        rawLog: 'Mock SMTP: smtp_error for error@example.com'
      };
      
      probeSMTP.mockResolvedValue(mockResponse);
      
      const result = await probeSMTP('error@example.com', 'example.com', []);
      
      expect(result.deliverable).toBe(false);
      expect(result.reason).toBe('smtp_error');
    });
  });

  describe('SMTP response parsing', () => {
    test('should parse mailbox full responses', async () => {
      const mockResponse = {
        deliverable: false,
        reason: 'mailbox_full',
        catchAll: false,
        rawLog: 'Mock SMTP: mailbox_full for full@example.com'
      };
      
      probeSMTP.mockResolvedValue(mockResponse);
      
      const result = await probeSMTP('full@example.com', 'example.com', []);
      
      expect(result.reason).toBe('mailbox_full');
    });

    test('should parse user unknown responses', async () => {
      const mockResponse = {
        deliverable: false,
        reason: 'user_unknown',
        catchAll: false,
        rawLog: 'Mock SMTP: user_unknown for unknown@example.com'
      };
      
      probeSMTP.mockResolvedValue(mockResponse);
      
      const result = await probeSMTP('unknown@example.com', 'example.com', []);
      
      expect(result.reason).toBe('user_unknown');
    });
  });

  describe('Error handling', () => {
    test('should handle connection errors', async () => {
      probeSMTP.mockRejectedValue(new Error('SMTP connection error'));
      
      await expect(probeSMTP('error@example.com', 'example.com', [])).rejects.toThrow('SMTP connection error');
    });

    test('should handle timeout errors', async () => {
      probeSMTP.mockRejectedValue(new Error('SMTP connection timeout'));
      
      await expect(probeSMTP('timeout@example.com', 'example.com', [])).rejects.toThrow('SMTP connection timeout');
    });
  });

  describe('Mock behavior verification', () => {
    test('should call probeSMTP with correct parameters', async () => {
      const mockResponse = { deliverable: true, reason: 'deliverable', catchAll: false };
      probeSMTP.mockResolvedValue(mockResponse);
      
      const mxRecords = [{ exchange: 'mail.example.com', priority: 10 }];
      await probeSMTP('test@example.com', 'example.com', mxRecords);
      
      expect(probeSMTP).toHaveBeenCalledWith('test@example.com', 'example.com', mxRecords);
      expect(probeSMTP).toHaveBeenCalledTimes(1);
    });
  });
});
