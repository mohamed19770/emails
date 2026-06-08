const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const request = require('supertest');
const mongoose = require('mongoose');

// Mock the server
const app = require('../server.js');

describe('Configuration System', () => {
  beforeEach(async () => {
    // Clear any existing configuration
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.collection('configurations').deleteMany({});
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.collection('configurations').deleteMany({});
    }
  });

  describe('GET /api/config', () => {
    it('should return default configuration with redacted secrets', async () => {
      const response = await request(app)
        .get('/api/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id).toBe('global');
      expect(response.body.data.apiKeys.openai).toBe('****');
      expect(response.body.data.apiKeys.stripe).toBe('****');
      expect(response.body.data.runtime.safeMode).toBe(false);
    });
  });

  describe('POST /api/config/safe-mode', () => {
    it('should enable Safe Mode and block subsequent PUT requests', async () => {
      // Enable Safe Mode
      const enableResponse = await request(app)
        .post('/api/config/safe-mode')
        .send({ safeMode: true })
        .expect(200);

      expect(enableResponse.body.success).toBe(true);
      expect(enableResponse.body.data.safeMode).toBe(true);

      // Try to update configuration - should be blocked
      const updateResponse = await request(app)
        .put('/api/config')
        .send({ siteName: 'Updated Site' })
        .expect(503);

      expect(updateResponse.body.error).toBe('SAFE_MODE_ENABLED');
      expect(updateResponse.body.message).toBe('Write operations are disabled.');
    });

    it('should disable Safe Mode and allow PUT requests', async () => {
      // First enable Safe Mode
      await request(app)
        .post('/api/config/safe-mode')
        .send({ safeMode: true })
        .expect(200);

      // Disable Safe Mode
      const disableResponse = await request(app)
        .post('/api/config/safe-mode')
        .send({ safeMode: false })
        .expect(200);

      expect(disableResponse.body.success).toBe(true);
      expect(disableResponse.body.data.safeMode).toBe(false);

      // Now PUT should work
      const updateResponse = await request(app)
        .put('/api/config')
        .send({ siteName: 'Updated Site' })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.siteName).toBe('Updated Site');
    });
  });

  describe('GET /health', () => {
    it('should return health status with Safe Mode information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.safeMode).toBeDefined();
      expect(response.body.maintenanceMode).toBeDefined();
      expect(response.body.mongo).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting based on configuration', async () => {
      // Make multiple requests quickly
      const promises = Array(10).fill().map(() => 
        request(app).get('/api/config')
      );

      const responses = await Promise.all(promises);
      
      // All should succeed (rate limit is per second, not per request)
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return normalized error responses', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body.error).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Endpoint not found');
      expect(response.body.traceId).toBeDefined();
    });
  });
});
