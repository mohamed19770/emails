/**
 * Unit tests for DNS resolution
 */
import { resolveMX, resolveTXT } from '../../src/services/emailChecker/dns.js';
import { mockDNS } from '../../__mocks__/dns.mock.js';

// Mock the DNS module
jest.mock('../../src/services/emailChecker/dns.js', () => ({
  resolveMX: jest.fn(),
  resolveTXT: jest.fn()
}));

describe('DNS Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveMX', () => {
    test('should resolve MX records for valid domains', async () => {
      const mockResponse = {
        hasMX: true,
        records: [{ exchange: 'gmail-smtp-in.l.google.com', priority: 5 }]
      };
      
      resolveMX.mockResolvedValue(mockResponse);
      
      const result = await resolveMX('gmail.com');
      
      expect(result.hasMX).toBe(true);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].exchange).toBe('gmail-smtp-in.l.google.com');
    });

    test('should handle domains with no MX records', async () => {
      const mockResponse = {
        hasMX: false,
        records: []
      };
      
      resolveMX.mockResolvedValue(mockResponse);
      
      const result = await resolveMX('example.com');
      
      expect(result.hasMX).toBe(false);
      expect(result.records).toHaveLength(0);
    });

    test('should handle DNS resolution errors', async () => {
      resolveMX.mockRejectedValue(new Error('DNS resolution failed'));
      
      await expect(resolveMX('nonexistent.domain')).rejects.toThrow('DNS resolution failed');
    });
  });

  describe('resolveTXT', () => {
    test('should resolve TXT records for valid domains', async () => {
      const mockResponse = {
        hasTXT: true,
        records: [['v=spf1 include:_spf.google.com ~all']]
      };
      
      resolveTXT.mockResolvedValue(mockResponse);
      
      const result = await resolveTXT('gmail.com');
      
      expect(result.hasTXT).toBe(true);
      expect(result.records).toHaveLength(1);
      expect(result.records[0][0]).toContain('v=spf1');
    });

    test('should handle domains with no TXT records', async () => {
      const mockResponse = {
        hasTXT: false,
        records: []
      };
      
      resolveTXT.mockResolvedValue(mockResponse);
      
      const result = await resolveTXT('example.com');
      
      expect(result.hasTXT).toBe(false);
      expect(result.records).toHaveLength(0);
    });
  });
});
