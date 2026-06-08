/**
 * Company Jobs Search Tests
 */

const runExtract = require('../services/companyJobs/runExtract');
const filters = require('../services/companyJobs/filters');

describe('Company Jobs Search', () => {
  beforeEach(() => {
    // Clear cache before each test
    runExtract.clearCache();
  });

  test('should initialize with correct config', () => {
    expect(runExtract.config.GLOBAL_CONCURRENCY).toBe(3);
    expect(runExtract.config.PER_DOMAIN_CONCURRENCY).toBe(1);
    expect(runExtract.config.REQUEST_DELAY_PER_DOMAIN).toBe(6000);
    expect(runExtract.config.TIMEOUT).toBe(10000);
  });

  test('should validate domains correctly', () => {
    expect(filters.isValidDomain('stc.com')).toBe(true);
    expect(filters.isValidDomain('sabic.com')).toBe(true);
    expect(filters.isValidDomain('linkedin.com')).toBe(false); // Job board
    expect(filters.isValidDomain('bayt.com')).toBe(false); // Job board
    expect(filters.isValidDomain('invalid')).toBe(false);
    expect(filters.isValidDomain('')).toBe(false);
  });

  test('should create country synonyms correctly', () => {
    const saudiSynonyms = filters.makeCountrySynonyms('Saudi Arabia');
    expect(saudiSynonyms).toContain('saudi');
    expect(saudiSynonyms).toContain('ksa');
    expect(saudiSynonyms).toContain('السعودية');

    const qatarSynonyms = filters.makeCountrySynonyms('Qatar');
    expect(qatarSynonyms).toContain('qatar');
    expect(qatarSynonyms).toContain('قطر');
  });

  test('should match countries correctly', () => {
    const saudiSynonyms = filters.makeCountrySynonyms('Saudi Arabia');
    
    expect(filters.matchesCountry('Riyadh, Saudi Arabia', saudiSynonyms)).toBe(true);
    expect(filters.matchesCountry('Jeddah, KSA', saudiSynonyms)).toBe(true);
    expect(filters.matchesCountry('Dammam, السعودية', saudiSynonyms)).toBe(true);
    expect(filters.matchesCountry('Dubai, UAE', saudiSynonyms)).toBe(false);
  });

  test('should match cities correctly', () => {
    const cities = ['Riyadh', 'Jeddah', 'Dammam'];
    
    expect(filters.matchesCities('Riyadh, Saudi Arabia', cities)).toBe('Riyadh');
    expect(filters.matchesCities('Jeddah, Saudi Arabia', cities)).toBe('Jeddah');
    expect(filters.matchesCities('Dubai, UAE', cities)).toBe(null);
  });

  test('should apply keyword filter correctly', () => {
    const jobs = [
      { title: 'Software Engineer', location: 'Riyadh, Saudi Arabia' },
      { title: 'Data Scientist', location: 'Jeddah, Saudi Arabia' },
      { title: 'Marketing Manager', location: 'Dubai, UAE' }
    ];

    const filtered = filters.applyKeyword(jobs, 'engineer');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Software Engineer');

    const filtered2 = filters.applyKeyword(jobs, 'saudi');
    expect(filtered2).toHaveLength(2);
  });

  test('should deduplicate jobs by URL', () => {
    const jobs = [
      { title: 'Job 1', url: 'https://example.com/job1', location: 'Riyadh' },
      { title: 'Job 2', url: 'https://example.com/job2', location: 'Jeddah' },
      { title: 'Job 1 Duplicate', url: 'https://example.com/job1', location: 'Riyadh' }
    ];

    const deduplicated = filters.deduplicateJobs(jobs);
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated[0].url).toBe('https://example.com/job1');
    expect(deduplicated[1].url).toBe('https://example.com/job2');
  });

  test('should clean job data correctly', () => {
    const dirtyJob = {
      title: '  Software Engineer  ',
      url: 'https://example.com/job',
      location: '  Riyadh, Saudi Arabia  '
    };

    const cleanJob = filters.cleanJob(dirtyJob);
    expect(cleanJob.title).toBe('Software Engineer');
    expect(cleanJob.location).toBe('Riyadh, Saudi Arabia');

    const invalidJob = { title: 'A', url: 'https://example.com/job' };
    expect(filters.cleanJob(invalidJob)).toBe(null);
  });

  test('should get service status', () => {
    const status = runExtract.getStatus();
    expect(status).toHaveProperty('cacheSize');
    expect(status).toHaveProperty('backoffDomains');
    expect(status).toHaveProperty('config');
    expect(status.cacheSize).toBe(0);
    expect(status.backoffDomains).toBe(0);
  });

  test('should clear cache', () => {
    // Add some mock data
    runExtract.cache.set('test.com', { jobs: [], timestamp: Date.now() });
    runExtract.backoffDomains.set('test.com', Date.now() + 1000);
    
    expect(runExtract.cache.size).toBe(1);
    expect(runExtract.backoffDomains.size).toBe(1);
    
    runExtract.clearCache();
    
    expect(runExtract.cache.size).toBe(0);
    expect(runExtract.backoffDomains.size).toBe(0);
  });
});
