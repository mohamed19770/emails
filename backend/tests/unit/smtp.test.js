/**
 * Unit tests for SMTP verification
 */
import { verifySMTP } from '../../src/services/emailChecker/ndsmtp.js';
import { mockNDSMTP } from '../../__mocks__/ndsmtp.mock.js';

// Mock the ND-SMTP module
jest.mock('../../src/services/emailChecker/ndsmtp.js', () => ({
  verifySMTP: jest.fn()
}));

describe('SMTP Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifySMTP', () => {
    test('should handle deliverable emails', async () => {
      const mockResponse = {
        deliverable: true,
        reason: 'deliverable',
        smtpCode: 250,
        startTLS: true,
        confidence: 0.9,
        rawLog: 'Mock SMTP: deliverable for valid@gmail.com'
      };
      
      verifySMTP.mockResolvedValue(mockResponse);
      
      const result = await verifySMTP('valid@gmail.com', 'gmail.com', []);
      
      expect(result.deliverable).toBe(true);
      expect(result.reason).toBe('deliverable');
      expect(result.smtpCode).toBe(250);
      expect(result.startTLS).toBe(true);
    });

    test('should handle SMTP rejections', async () => {
      const mockResponse = {
        deliverable: false,
        reason: 'smtp-reject',
        smtpCode: 550,
        startTLS: true,
        confidence: 0.9,
        rawLog: 'Mock SMTP: smtp-reject for noone@yahoo.com'
      };
      
      verifySMTP.mockResolvedValue(mockResponse);
      
      const result = await verifySMTP('noone@yahoo.com', 'yahoo.com', []);
      
      expect(result.deliverable).toBe(false);
      expect(result.reason).toBe('smtp-reject');
      expect(result.smtpCode).toBe(550);
    });

    test('should handle timeout errors', async () => {
      const mockResponse = {
        deliverable: false,
        reason: 'timeout',
        smtpCode: null,
        startTLS: false,
        confidence: 0.4,
        rawLog: 'Mock SMTP: timeout for slow@corp.com'
      };
      
      verifySMTP.mockResolvedValue(mockResponse);
      
      const result = await verifySMTP('slow@corp.com', 'corp.com', []);
      
      expect(result.deliverable).toBe(false);
      expect(result.reason).toBe('timeout');
      expect(result.smtpCode).toBe(null);
    });

    test('should handle connection errors', async () => {
      verifySMTP.mockRejectedValue(new Error('SMTP connection error'));
      
      await expect(verifySMTP('error@example.com', 'example.com', [])).rejects.toThrow('SMTP connection error');
    });
  });
});
