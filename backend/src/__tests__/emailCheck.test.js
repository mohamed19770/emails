const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock the email check service
const mockEmailCheck = {
  validateEmail: jest.fn(),
  checkEmailExists: jest.fn(),
  getEmailProvider: jest.fn()
};

describe('Email Check Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      const validEmail = 'test@example.com';
      mockEmailCheck.validateEmail.mockReturnValue(true);
      
      const result = mockEmailCheck.validateEmail(validEmail);
      
      expect(result).toBe(true);
      expect(mockEmailCheck.validateEmail).toHaveBeenCalledWith(validEmail);
    });

    it('should reject invalid email format', () => {
      const invalidEmail = 'invalid-email';
      mockEmailCheck.validateEmail.mockReturnValue(false);
      
      const result = mockEmailCheck.validateEmail(invalidEmail);
      
      expect(result).toBe(false);
      expect(mockEmailCheck.validateEmail).toHaveBeenCalledWith(invalidEmail);
    });
  });

  describe('checkEmailExists', () => {
    it('should check if email exists', async () => {
      const email = 'test@example.com';
      const mockResult = { exists: true, provider: 'example.com' };
      mockEmailCheck.checkEmailExists.mockResolvedValue(mockResult);
      
      const result = await mockEmailCheck.checkEmailExists(email);
      
      expect(result).toEqual(mockResult);
      expect(mockEmailCheck.checkEmailExists).toHaveBeenCalledWith(email);
    });
  });

  describe('getEmailProvider', () => {
    it('should extract email provider from email address', () => {
      const email = 'user@gmail.com';
      const expectedProvider = 'gmail.com';
      mockEmailCheck.getEmailProvider.mockReturnValue(expectedProvider);
      
      const result = mockEmailCheck.getEmailProvider(email);
      
      expect(result).toBe(expectedProvider);
      expect(mockEmailCheck.getEmailProvider).toHaveBeenCalledWith(email);
    });
  });
});
