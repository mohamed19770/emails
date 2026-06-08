import express from 'express';
import logger from '../config/logger.js';
import { detectMockRows } from '../services/verifyMockRows.js';
import { verifyDomains } from '../services/domainVerification.js';

const router = express.Router();

// Start a new industry domain search run
router.post('/run', async (req, res) => {
  const { 
    industryKeywords, 
    countries, 
    biasWords, 
    engines, 
    maxSerpPages, 
    verify, 
    langBias, 
    preferredTLDs, 
    excludedTLDs 
  } = req.body;
  const dryRun = req.query.dry === '1';
  
  try {
    logger.info(`[INDUSTRY-DOMAINS] Request received - dryRun: ${dryRun}`);
    
    // Basic validation
    if (!industryKeywords || !Array.isArray(industryKeywords) || industryKeywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one industry keyword is required'
      });
    }
    
    if (!countries || !Array.isArray(countries) || countries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one country is required'
      });
    }
    
    if (!engines || !Array.isArray(engines) || engines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one engine is required'
      });
    }
    
    const runId = `industry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (dryRun) {
      logger.info(`[INDUSTRY-DOMAINS] Dry run for runId: ${runId}`);
      
      // Simple dry run - just return mock queries
      const queries = [];
      for (const engine of engines) {
        for (const keyword of industryKeywords) {
          for (const country of countries) {
            for (let page = 1; page <= Math.min(maxSerpPages || 2, 3); page++) {
              queries.push({
                query: `"${keyword}" "${country}" company website`,
                previewUrl: `https://example.com/search?q=${encodeURIComponent(keyword + ' ' + country)}`,
                engine,
                country,
                industryKeyword: keyword,
                page
              });
            }
          }
        }
      }
      
      return res.json({
        success: true,
        runId,
        dryRun: true,
        queries
      });
    }
    
    // Actual search - perform real domain verification
    logger.info(`[INDUSTRY-DOMAINS] Actual search for runId: ${runId}`);
    
    // First, get initial search results (this would normally come from search engines)
    // For now, we'll use a mix of real and mock domains to demonstrate the verification process
    const initialResults = [
      {
        domain: 'google.com',
        title: 'Google - Search Engine',
        snippet: 'Google search engine and technology company',
        url: 'https://google.com',
        industry: industryKeywords[0] || 'technology',
        country: countries[0] || 'Saudi Arabia',
        engine: engines[0] || 'mock'
      },
      {
        domain: 'microsoft.com',
        title: 'Microsoft - Technology Company',
        snippet: 'Microsoft Corporation technology solutions',
        url: 'https://microsoft.com',
        industry: industryKeywords[0] || 'technology',
        country: countries[0] || 'Saudi Arabia',
        engine: engines[0] || 'mock'
      },
      {
        domain: 'example1.com',
        title: 'Example Company 1',
        snippet: 'This is an example company for testing purposes',
        url: 'https://example1.com',
        industry: industryKeywords[0] || 'technology',
        country: countries[0] || 'Saudi Arabia',
        engine: engines[0] || 'mock'
      },
      {
        domain: 'test.com',
        title: 'Test Domain',
        snippet: 'Test domain for demonstration',
        url: 'https://test.com',
        industry: industryKeywords[0] || 'technology',
        country: countries[0] || 'Saudi Arabia',
        engine: engines[0] || 'mock'
      }
    ];
    
    logger.info(`[INDUSTRY-DOMAINS] Initial search returned ${initialResults.length} candidates`);
    
    // Step 1: Detect and separate mock/example domains
    const mockDetection = detectMockRows(initialResults);
    logger.info(`[INDUSTRY-DOMAINS] Mock detection: ${mockDetection.summary.verified} verified, ${mockDetection.summary.examples} examples`);
    
    // Step 2: Verify remaining domains
    let verificationResults = { verified: [], failed: [], trace: [] };
    
    if (mockDetection.verified.length > 0) {
      logger.info(`[INDUSTRY-DOMAINS] Verifying ${mockDetection.verified.length} real domains`);
      
      verificationResults = await verifyDomains(mockDetection.verified, {
        countries,
        excludeJobBoards: true,
        excludeWebmail: true,
        minScore: 50
      });
      
      logger.info(`[INDUSTRY-DOMAINS] Verification complete: ${verificationResults.summary.verified} verified domains`);
    }
    
    // Combine all trace events
    const allTrace = [
      ...mockDetection.trace,
      ...verificationResults.trace,
      {
        scope: 'summary',
        step: 'search-complete',
        status: 'SUCCESS',
        note: `Search completed: ${verificationResults.verified.length} verified domains, ${mockDetection.examples.length} examples detected`,
        timestamp: new Date().toISOString()
      }
    ];
    
    return res.json({
      success: true,
      runId,
      results: verificationResults.verified,
      examples: mockDetection.examples,
      trace: allTrace,
      summary: {
        totalCandidates: initialResults.length,
        verifiedDomains: verificationResults.verified.length,
        exampleDomains: mockDetection.examples.length,
        verificationSuccessRate: verificationResults.summary.successRate
      }
    });
    
  } catch (error) {
    logger.error(`[INDUSTRY-DOMAINS] Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Get available engines
router.get('/engines', (req, res) => {
  try {
    const engines = [
      { id: 'mock', name: 'Mock Engine', description: 'Mock search engine for testing' },
      { id: 'ddg', name: 'DuckDuckGo', description: 'DuckDuckGo search engine' }
    ];
    
    res.json({
      success: true,
      engines
    });
  } catch (error) {
    logger.error(`[INDUSTRY-DOMAINS] Get engines error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get run status (simplified)
router.get('/status/:runId', (req, res) => {
  try {
    const { runId } = req.params;
    
    res.json({
      success: true,
      runId,
      status: 'completed',
      results: []
    });
  } catch (error) {
    logger.error(`[INDUSTRY-DOMAINS] Get status error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;