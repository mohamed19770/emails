// Test setup file
process.env.NODE_ENV = 'test';
process.env.USE_MOCKS = 'true';
process.env.MONGO_URI = 'mongodb://localhost:27017/email-checker-test';
process.env.PORT = '5001'; // Use different port for tests

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
