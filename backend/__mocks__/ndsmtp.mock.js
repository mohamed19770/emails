/**
 * Mock SMTP service for testing
 * Provides deterministic responses for known email patterns
 */

// Mock SMTP responses
const mockSmtpResponses = {
  // Gmail responses
  'valid@gmail.com': { code: 250, ok: true, reason: 'OK', tls: true },
  'fake@gmail.com': { code: 550, ok: false, reason: 'User unknown', tls: true },
  'nonexistent@gmail.com': { code: 550, ok: false, reason: 'User unknown', tls: true },
  
  // Yahoo responses
  'valid@yahoo.com': { code: 250, ok: true, reason: 'OK', tls: true },
  'fake@yahoo.com': { code: 550, ok: false, reason: 'User unknown', tls: true },
  'nonexistent@yahoo.com': { code: 550, ok: false, reason: 'User unknown', tls: true },
  
  // Catch-all domain - always accepts
  'any@test-catchall.com': { code: 250, ok: true, reason: 'OK', tls: false },
  'random@test-catchall.com': { code: 250, ok: true, reason: 'OK', tls: false },
  
  // Mailinator - disposable
  'test@mailinator.com': { code: 250, ok: true, reason: 'OK', tls: false },
  
  // Bad domain - always rejects
  'any@bad-domain.test': { code: 550, ok: false, reason: 'Mailbox unavailable', tls: false },
  
  // Example domain - mixed responses
  'valid@example.com': { code: 250, ok: true, reason: 'OK', tls: true },
  'fake@example.com': { code: 550, ok: false, reason: 'User unknown', tls: true }
};

// Mock catch-all responses
const mockCatchAllResponses = {
  'test-catchall.com': { code: 250, ok: true, reason: 'OK', tls: false },
  'gmail.com': { code: 550, ok: false, reason: 'User unknown', tls: true },
  'yahoo.com': { code: 550, ok: false, reason: 'User unknown', tls: true },
  'example.com': { code: 550, ok: false, reason: 'User unknown', tls: true }
};

export async function smtpProbe({ email, domain, mxHost, timeouts, useStartTLS }) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const response = mockSmtpResponses[email.toLowerCase()] || 
    mockSmtpResponses[`fake@${domain}`] || 
    { code: 550, ok: false, reason: 'User unknown', tls: false };
  
  return {
    code: response.code,
    ok: response.ok,
    reason: response.reason,
    tls: response.tls,
    mxHost,
    duration: 100
  };
}

export async function smtpCatchAll({ domain, mxHost, timeouts, useStartTLS }) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const response = mockCatchAllResponses[domain.toLowerCase()] || 
    { code: 550, ok: false, reason: 'User unknown', tls: false };
  
  return {
    code: response.code,
    ok: response.ok,
    reason: response.reason,
    tls: response.tls,
    mxHost,
    testEmail: `_probe_${Date.now()}@${domain}`,
    duration: 100
  };
}

export default {
  smtpProbe,
  smtpCatchAll
};