/**
 * Mock SMTP service for deterministic testing
 */
export const mockSMTP = {
  probeSMTP: jest.fn()
};

// Mock SMTP responses
const mockSMTPResponses = {
  'valid@gmail.com': { deliverable: true, reason: 'deliverable', catchAll: false },
  'noone@yahoo.com': { deliverable: false, reason: 'smtp_reject', catchAll: false },
  'slow@corp.com': { deliverable: false, reason: 'timeout', catchAll: false },
  'admin@corp.com': { deliverable: true, reason: 'deliverable', catchAll: false },
  'fake@mailinator.com': { deliverable: true, reason: 'deliverable', catchAll: false },
  'bad@bad-domain.test': { deliverable: false, reason: 'smtp_reject', catchAll: false }
};

// Catch-all domains (any email at these domains should be deliverable)
const catchAllDomains = ['test-catchall.com'];

// Setup default mock behavior
mockSMTP.probeSMTP.mockImplementation(async (email, domain, mxRecords) => {
  // Check for catch-all domains first
  if (catchAllDomains.includes(domain)) {
    return Promise.resolve({
      deliverable: true,
      reason: 'deliverable',
      catchAll: true,
      rawLog: `Mock SMTP: Catch-all domain detected for ${email}`
    });
  }

  // Check specific email responses
  const response = mockSMTPResponses[email];
  if (response) {
    return Promise.resolve({
      ...response,
      rawLog: `Mock SMTP: ${response.reason} for ${email}`
    });
  }

  // Default response for unknown emails
  return Promise.resolve({
    deliverable: false,
    reason: 'unknown',
    catchAll: false,
    rawLog: `Mock SMTP: Unknown email ${email}`
  });
});

export default mockSMTP;
