/**
 * Mock DNS service for testing
 * Provides deterministic responses for known domains
 */

// Mock MX records for testing
const mockMxRecords = {
  'gmail.com': [
    { exchange: 'gmail-smtp-in.l.google.com', priority: 5 },
    { exchange: 'alt1.gmail-smtp-in.l.google.com', priority: 10 }
  ],
  'yahoo.com': [
    { exchange: 'mta1.am0.yahoodns.net', priority: 1 },
    { exchange: 'mta2.am0.yahoodns.net', priority: 1 }
  ],
  'test-catchall.com': [
    { exchange: 'mx1.test-catchall.com', priority: 10 }
  ],
  'mailinator.com': [
    { exchange: 'mx1.mailinator.com', priority: 10 }
  ],
  'bad-domain.test': [
    { exchange: 'mx1.bad-domain.test', priority: 10 }
  ],
  'example.com': [
    { exchange: 'mx1.example.com', priority: 10 }
  ]
};

// Mock TXT records
const mockTxtRecords = {
  'gmail.com': ['v=spf1 include:_spf.google.com ~all'],
  'yahoo.com': ['v=spf1 include:_spf.yahoo.com ~all'],
  'test-catchall.com': ['v=spf1 include:_spf.test-catchall.com ~all']
};

export async function resolveMx(domain) {
  const records = mockMxRecords[domain.toLowerCase()] || [];
  return records;
}

export async function resolveTxt(domain) {
  const records = mockTxtRecords[domain.toLowerCase()] || [];
  return records;
}

export function clearMxCache() {
  // Mock implementation
}

export function clearTxtCache() {
  // Mock implementation
}

export function clearAllCaches() {
  // Mock implementation
}

export function getCacheStats() {
  return {
    mx: { size: 0, max: 1000, ttl: 600000 },
    txt: { size: 0, max: 1000, ttl: 600000 }
  };
}

export default {
  resolveMx,
  resolveTxt,
  clearMxCache,
  clearTxtCache,
  clearAllCaches,
  getCacheStats
};