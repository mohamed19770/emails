#!/usr/bin/env node

/**
 * Quality Assurance Report for Company Jobs Extractor
 * Analyzes extraction quality and provides metrics
 */

import runExtract from '../src/services/companyJobs/runExtract.js';
import confidenceScorer from '../src/services/companyJobs/score.js';
import dedupeService from '../src/services/companyJobs/dedupe.js';

class QAReport {
  constructor() {
    this.metrics = {
      domainsProcessed: 0,
      totalItems: 0,
      avgScore: 0,
      cityMatches: 0,
      structuredDataItems: 0,
      platformItems: 0,
      duplicatesRemoved: 0,
      processingTime: 0
    };
  }

  /**
   * Run quality analysis on test domains
   * @param {Array} testDomains - Array of test domains
   * @param {Object} options - Analysis options
   * @returns {Object} Quality metrics
   */
  async analyzeQuality(testDomains, options = {}) {
    const startTime = Date.now();
    
    console.log('🔍 Starting Quality Analysis...');
    console.log(`📊 Test Domains: ${testDomains.join(', ')}`);
    console.log(`🎯 Target: ${options.country || 'Saudi Arabia'}`);
    console.log(`🏙️ Cities: ${options.cities?.join(', ') || 'All'}`);
    console.log('');

    try {
      // Reset services
      dedupeService.reset();
      
      // Run extraction
      const result = await runExtract.runExtract({
        country: options.country || 'Saudi Arabia',
        cities: options.cities || ['Riyadh', 'Jeddah', 'Dammam'],
        domains: testDomains,
        keyword: options.keyword || '',
        maxPerDomain: options.maxPerDomain || 50,
        dry: false,
        enableTrace: true
      });

      if (!result.ok) {
        throw new Error(result.error || 'Extraction failed');
      }

      // Calculate metrics
      this.calculateMetrics(result, startTime);
      
      // Generate report
      this.generateReport();
      
      // Check quality thresholds
      const qualityPassed = this.checkQualityThresholds(options);
      
      return {
        metrics: this.metrics,
        qualityPassed,
        result
      };

    } catch (error) {
      console.error('❌ Quality analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Calculate quality metrics
   * @param {Object} result - Extraction result
   * @param {number} startTime - Start timestamp
   */
  calculateMetrics(result, startTime) {
    const items = result.items || [];
    const trace = result.trace || [];
    
    this.metrics.domainsProcessed = new Set(trace.map(t => t.domain)).size;
    this.metrics.totalItems = items.length;
    this.metrics.processingTime = Date.now() - startTime;
    
    if (items.length > 0) {
      // Calculate average confidence score
      const scores = items.map(item => item.confidenceScore || 0);
      this.metrics.avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      // Count city matches
      this.metrics.cityMatches = items.filter(item => 
        item.cityMatch || item.locationConfidence > 0.5
      ).length;
      
      // Count structured data items
      this.metrics.structuredDataItems = items.filter(item => 
        item.source === 'structured_data' || item.source === 'microdata'
      ).length;
      
      // Count platform parser items
      this.metrics.platformItems = items.filter(item => 
        ['workday', 'successfactors', 'taleo', 'greenhouse', 'lever'].includes(item.source)
      ).length;
    }
    
    // Get deduplication stats
    const dedupeStats = dedupeService.getStats();
    this.metrics.duplicatesRemoved = dedupeStats.totalItems - dedupeStats.uniqueHashes;
  }

  /**
   * Generate quality report
   */
  generateReport() {
    console.log('📈 QUALITY ANALYSIS REPORT');
    console.log('='.repeat(50));
    console.log('');
    
    // Basic metrics
    console.log('📊 EXTRACTION METRICS');
    console.log(`   Domains Processed: ${this.metrics.domainsProcessed}`);
    console.log(`   Total Items Found: ${this.metrics.totalItems}`);
    console.log(`   Processing Time: ${(this.metrics.processingTime / 1000).toFixed(2)}s`);
    console.log('');
    
    // Quality metrics
    console.log('🎯 QUALITY METRICS');
    console.log(`   Average Confidence Score: ${(this.metrics.avgScore * 100).toFixed(1)}%`);
    console.log(`   City Matches: ${this.metrics.cityMatches} (${((this.metrics.cityMatches / this.metrics.totalItems) * 100).toFixed(1)}%)`);
    console.log(`   Structured Data Items: ${this.metrics.structuredDataItems} (${((this.metrics.structuredDataItems / this.metrics.totalItems) * 100).toFixed(1)}%)`);
    console.log(`   Platform Parser Items: ${this.metrics.platformItems} (${((this.metrics.platformItems / this.metrics.totalItems) * 100).toFixed(1)}%)`);
    console.log(`   Duplicates Removed: ${this.metrics.duplicatesRemoved}`);
    console.log('');
    
    // Performance metrics
    console.log('⚡ PERFORMANCE METRICS');
    console.log(`   Items per Domain: ${(this.metrics.totalItems / this.metrics.domainsProcessed).toFixed(1)}`);
    console.log(`   Processing Speed: ${(this.metrics.totalItems / (this.metrics.processingTime / 1000)).toFixed(1)} items/sec`);
    console.log('');
  }

  /**
   * Check quality thresholds
   * @param {Object} options - Quality options
   * @returns {boolean} True if quality thresholds are met
   */
  checkQualityThresholds(options = {}) {
    const minCountThreshold = options.minCountThreshold || 0.5; // 50% of domains should have results
    const minAvgScore = options.minAvgScore || 0.5; // Minimum average confidence score
    const minCityMatchRate = options.minCityMatchRate || 0.3; // 30% should match cities
    
    const domainsWithResults = this.metrics.domainsProcessed * minCountThreshold;
    const avgScorePassed = this.metrics.avgScore >= minAvgScore;
    const cityMatchPassed = (this.metrics.cityMatches / this.metrics.totalItems) >= minCityMatchRate;
    const countPassed = this.metrics.totalItems >= domainsWithResults;
    
    console.log('🎯 QUALITY THRESHOLDS');
    console.log(`   Minimum Items (${minCountThreshold * 100}% of domains): ${countPassed ? '✅ PASS' : '❌ FAIL'} (${this.metrics.totalItems} items)`);
    console.log(`   Average Score (≥${minAvgScore}): ${avgScorePassed ? '✅ PASS' : '❌ FAIL'} (${(this.metrics.avgScore * 100).toFixed(1)}%)`);
    console.log(`   City Match Rate (≥${minCityMatchRate * 100}%): ${cityMatchPassed ? '✅ PASS' : '❌ FAIL'} (${((this.metrics.cityMatches / this.metrics.totalItems) * 100).toFixed(1)}%)`);
    console.log('');
    
    const allPassed = countPassed && avgScorePassed && cityMatchPassed;
    console.log(`🏆 OVERALL QUALITY: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    return allPassed;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testDomains = args.length > 0 ? args : [
    'stc.com',
    'sabic.com', 
    'aramco.com',
    'almarai.com'
  ];
  
  const options = {
    country: 'Saudi Arabia',
    cities: ['Riyadh', 'Jeddah', 'Dammam', 'Khobar'],
    keyword: 'engineer',
    maxPerDomain: 20,
    minCountThreshold: 0.5,
    minAvgScore: 0.5,
    minCityMatchRate: 0.3
  };
  
  const qaReport = new QAReport();
  const result = await qaReport.analyzeQuality(testDomains, options);
  
  if (!result.qualityPassed) {
    console.log('❌ Quality analysis failed - extraction needs improvement');
    process.exit(1);
  } else {
    console.log('✅ Quality analysis passed - extraction meets standards');
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ QA Report failed:', error);
    process.exit(1);
  });
}

export default QAReport;
