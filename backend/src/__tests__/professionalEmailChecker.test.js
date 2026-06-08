import request from 'supertest';
import app from '../server.js';

describe('Professional Email Checker API', () => {
  describe('POST /api/email-checker/run', () => {
    it('should validate emails with professional verification', async () => {
      const testEmails = [
        'test@gmail.com',
        'invalid-email',
        'admin@example.com'
      ];

      const response = await request(app)
        .post('/api/email-checker/run')
        .send({ emails: testEmails, safeMode: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(3);
      
      // Check that results include professional fields
      const result = response.body.data.results[0];
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('hasMX');
      expect(result).toHaveProperty('catchAll');
      expect(result).toHaveProperty('disposable');
      expect(result).toHaveProperty('blacklisted');
      expect(result).toHaveProperty('roleBased');
      expect(result).toHaveProperty('providerSensitive');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('startTLS');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('checkedAt');
    });

    it('should handle safe mode correctly', async () => {
      const testEmails = ['test@gmail.com'];

      const response = await request(app)
        .post('/api/email-checker/run')
        .send({ emails: testEmails, safeMode: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.safeMode).toBe(true);
      
      const result = response.body.data.results[0];
      expect(result.method).toBe('mx'); // Should not use SMTP in safe mode
      expect(result.confidence).toBeLessThanOrEqual(0.6); // Lower confidence in safe mode
    });

    it('should detect disposable emails', async () => {
      const disposableEmails = ['test@10minutemail.com'];

      const response = await request(app)
        .post('/api/email-checker/run')
        .send({ emails: disposableEmails, safeMode: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const result = response.body.data.results[0];
      expect(result.disposable).toBe(true);
      expect(result.status).toBe('risky');
      expect(result.reason).toBe('disposable');
    });

    it('should detect role-based emails', async () => {
      const roleEmails = ['admin@example.com'];

      const response = await request(app)
        .post('/api/email-checker/run')
        .send({ emails: roleEmails, safeMode: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const result = response.body.data.results[0];
      expect(result.roleBased).toBe(true);
    });

    it('should detect provider sensitive domains', async () => {
      const providerEmails = ['test@gmail.com'];

      const response = await request(app)
        .post('/api/email-checker/run')
        .send({ emails: providerEmails, safeMode: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const result = response.body.data.results[0];
      expect(result.providerSensitive).toBe(true);
    });

    it('should apply confidence threshold correctly', async () => {
      const testEmails = ['test@example.com'];

      const response = await request(app)
        .post('/api/email-checker/run')
        .send({ emails: testEmails, safeMode: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const result = response.body.data.results[0];
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      
      // Valid emails should have high confidence
      if (result.status === 'valid') {
        expect(result.confidence).toBeGreaterThanOrEqual(0.75);
      }
    });

    it('should return summary statistics', async () => {
      const testEmails = [
        'valid@example.com',
        'invalid-email',
        'disposable@10minutemail.com'
      ];

      const response = await request(app)
        .post('/api/email-checker/run')
        .send({ emails: testEmails, safeMode: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toHaveProperty('total');
      expect(response.body.data.summary).toHaveProperty('valid');
      expect(response.body.data.summary).toHaveProperty('invalid');
      expect(response.body.data.summary).toHaveProperty('risky');
      expect(response.body.data.summary).toHaveProperty('unknown');
      expect(response.body.data.summary).toHaveProperty('duplicates');
    });
  });

  describe('GET /health', () => {
    it('should return health status with safe mode information', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok');
      expect(response.body).toHaveProperty('safeMode');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
