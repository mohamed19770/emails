/**
 * Company Jobs Service Tests
 */

const companyJobsService = require('../services/companyJobsService');

describe('Company Jobs Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    companyJobsService.clearCache();
  });

  test('should initialize with correct config', () => {
    expect(companyJobsService.config.GLOBAL_CONCURRENCY).toBe(3);
    expect(companyJobsService.config.PER_DOMAIN_CONCURRENCY).toBe(1);
    expect(companyJobsService.config.REQUEST_DELAY_PER_DOMAIN).toBe(6000);
    expect(companyJobsService.config.TIMEOUT).toBe(10000);
  });

  test('should validate country matching', () => {
    const service = companyJobsService;
    
    // Test Saudi Arabia synonyms
    expect(service.matchesCountry('Riyadh, Saudi Arabia', 'Saudi Arabia')).toBe(true);
    expect(service.matchesCountry('Jeddah, KSA', 'Saudi Arabia')).toBe(true);
    expect(service.matchesCountry('Dammam, السعودية', 'Saudi Arabia')).toBe(true);
    
    // Test Qatar synonyms
    expect(service.matchesCountry('Doha, Qatar', 'Qatar')).toBe(true);
    expect(service.matchesCountry('قطر', 'Qatar')).toBe(true);
    
    // Test UAE synonyms
    expect(service.matchesCountry('Dubai, UAE', 'UAE')).toBe(true);
    expect(service.matchesCountry('Abu Dhabi, United Arab Emirates', 'UAE')).toBe(true);
  });

  test('should validate city matching', () => {
    const service = companyJobsService;
    
    expect(service.matchesCities('Riyadh, Saudi Arabia', ['Riyadh', 'Jeddah'])).toBe('Riyadh');
    expect(service.matchesCities('Jeddah, Saudi Arabia', ['Riyadh', 'Jeddah'])).toBe('Jeddah');
    expect(service.matchesCities('Dammam, Saudi Arabia', ['Riyadh', 'Jeddah'])).toBe(null);
  });

  test('should deduplicate jobs by URL', () => {
    const jobs = [
      { title: 'Job 1', url: 'https://example.com/job1', source: 'example.com' },
      { title: 'Job 2', url: 'https://example.com/job2', source: 'example.com' },
      { title: 'Job 1 Duplicate', url: 'https://example.com/job1', source: 'example.com' }
    ];

    const deduplicated = companyJobsService.deduplicateJobs(jobs);
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated[0].url).toBe('https://example.com/job1');
    expect(deduplicated[1].url).toBe('https://example.com/job2');
  });

  test('should chunk array correctly', () => {
    const array = [1, 2, 3, 4, 5, 6, 7];
    const chunks = companyJobsService.chunkArray(array, 3);
    
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual([1, 2, 3]);
    expect(chunks[1]).toEqual([4, 5, 6]);
    expect(chunks[2]).toEqual([7]);
  });

  test('should clear cache', () => {
    // Add some mock data to cache
    companyJobsService.cache.set('test.com', { jobs: [], timestamp: Date.now() });
    companyJobsService.backoffDomains.set('test.com', Date.now() + 1000);
    
    expect(companyJobsService.cache.size).toBe(1);
    expect(companyJobsService.backoffDomains.size).toBe(1);
    
    companyJobsService.clearCache();
    
    expect(companyJobsService.cache.size).toBe(0);
    expect(companyJobsService.backoffDomains.size).toBe(0);
  });
});
