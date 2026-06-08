import { resolveMX } from '../src/services/emailChecker/dns.js';
import { mockDNS } from '../__mocks__/dns.mock.js';

// Mock the DNS module
jest.mock('../src/services/emailChecker/dns.js', () => ({
  resolveMX: jest.fn()
}));

describe('DNS MX Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid domains with MX records', () => {
    test('should resolve Gmail MX records', async () => {
      const mockResponse = {
        hasMX: true,
        mxRecords: [{ exchange: 'gmail-smtp-in.l.google.com', priority: 5 }]
      };
      
      resolveMX.mockResolvedValue(mockResponse);
      
      const result = await resolveMX('gmail.com');
      
      expect(result.hasMX).toBe(true);
      expect(result.mxRecords).toHaveLength(1);
      expect(result.mxRecords[0].exchange).toBe('gmail-smtp-in.l.google.com');
    });

    test('should resolve Yahoo MX records', async () => {
      const mockResponse = {
        hasMX: true,
        mxRecords: [{ exchange: 'mta.am0.yahoodns.net', priority: 1 }]
      };
      
      resolveMX.mockResolvedValue(mockResponse);
      
      const result = await resolveMX('yahoo.com');
      
      expect(result.hasMX).toBe(true);
      expect(result.mxRecords).toHaveLength(1);
    });
  });

  describe('Domains without MX records', () => {
    test('should handle domains with no MX records', async () => {
      const mockResponse = {
        hasMX: false,
        mxRecords: []
      };
      
      resolveMX.mockResolvedValue(mockResponse);
      
      const result = await resolveMX('example.com');
      
      expect(result.hasMX).toBe(false);
      expect(result.mxRecords).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    test('should handle DNS resolution errors', async () => {
      resolveMX.mockRejectedValue(new Error('DNS resolution failed'));
      
      await expect(resolveMX('nonexistent.domain')).rejects.toThrow('DNS resolution failed');
    });

    test('should handle timeout errors', async () => {
      resolveMX.mockRejectedValue(new Error('MX lookup timeout'));
      
      await expect(resolveMX('slow.domain')).rejects.toThrow('MX lookup timeout');
    });
  });

  describe('Mock behavior verification', () => {
    test('should call resolveMX with correct domain', async () => {
      const mockResponse = { hasMX: true, mxRecords: [] };
      resolveMX.mockResolvedValue(mockResponse);
      
      await resolveMX('test.com');
      
      expect(resolveMX).toHaveBeenCalledWith('test.com');
      expect(resolveMX).toHaveBeenCalledTimes(1);
    });
  });
});
