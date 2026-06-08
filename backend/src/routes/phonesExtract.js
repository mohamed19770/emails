import express from 'express';
import logger from '../config/logger.js';
import { extractFromHtml } from '../services/phones/extractFromHtml.js';

const router = express.Router();

// Store active runs in memory
const activeRuns = new Map();

/**
 * Start a new phone extraction run
 */
router.post('/run', async (req, res) => {
  const {
    urls = [],
    countries = ['SA'],
    maxPhonesPerDomain = 5,
    maxWhatsAppPerDomain = 3,
    strictMode = false,
    includeTypes = ['mobile', 'landline', 'toll-free'],
    timeout = 15000,
    concurrency = 3
  } = req.body;
  
  const dryRun = req.query.dry === '1';
  const runId = `phones_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Basic validation
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one URL is required'
    });
  }
  
  if (countries.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one country is required'
    });
  }
  
  try {
    if (dryRun) {
      // For dry run, return the URLs that would be processed
      return res.json({
        success: true,
        runId,
        dryRun: true,
        urlsToProcess: urls,
        config: {
          countries,
          maxPhonesPerDomain,
          maxWhatsAppPerDomain,
          strictMode,
          includeTypes,
          timeout,
          concurrency
        }
      });
    }
    
    logger.info(`[PHONES-EXTRACT] Starting extraction run ${runId} for ${urls.length} URLs`);
    
    // Store run configuration
    activeRuns.set(runId, {
      status: 'running',
      startTime: new Date(),
      urls,
      countries,
      maxPhonesPerDomain,
      maxWhatsAppPerDomain,
      strictMode,
      includeTypes,
      timeout,
      concurrency,
      results: {
        phones: [],
        whatsapp: [],
        trace: [],
        summary: {
          totalUrls: urls.length,
          processedUrls: 0,
          totalPhones: 0,
          totalWhatsApp: 0,
          errors: 0
        }
      }
    });
    
    // Process URLs in batches
    const results = await processUrlsInBatches(urls, {
      countries,
      maxPhonesPerDomain,
      maxWhatsAppPerDomain,
      strictMode,
      includeTypes,
      timeout,
      concurrency,
      runId
    });
    
    // Update final results
    const finalResults = {
      phones: results.phones,
      whatsapp: results.whatsapp,
      trace: results.trace,
      summary: {
        totalUrls: urls.length,
        processedUrls: results.summary.processedUrls,
        totalPhones: results.phones.length,
        totalWhatsApp: results.whatsapp.length,
        errors: results.summary.errors,
        successRate: urls.length > 0 ? (results.summary.processedUrls / urls.length * 100).toFixed(1) : 0
      }
    };
    
    // Update run status
    activeRuns.set(runId, {
      ...activeRuns.get(runId),
      status: 'completed',
      endTime: new Date(),
      results: finalResults
    });
    
    logger.info(`[PHONES-EXTRACT] Run ${runId} completed: ${finalResults.summary.totalPhones} phones, ${finalResults.summary.totalWhatsApp} WhatsApp`);
    
    res.json({
      success: true,
      runId,
      results: finalResults
    });
    
  } catch (error) {
    logger.error(`[PHONES-EXTRACT] Run error:`, error);
    
    // Update run status to failed
    if (activeRuns.has(runId)) {
      activeRuns.set(runId, {
        ...activeRuns.get(runId),
        status: 'failed',
        endTime: new Date(),
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Process URLs in batches with concurrency control
 */
async function processUrlsInBatches(urls, options) {
  const {
    countries,
    maxPhonesPerDomain,
    maxWhatsAppPerDomain,
    strictMode,
    includeTypes,
    timeout,
    concurrency,
    runId
  } = options;
  
  const allPhones = [];
  const allWhatsApp = [];
  const allTrace = [];
  let processedUrls = 0;
  let errors = 0;
  
  // Process URLs in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (url) => {
      try {
        const result = await processSingleUrl(url, {
          countries,
          maxPhonesPerDomain,
          maxWhatsAppPerDomain,
          strictMode,
          includeTypes,
          timeout
        });
        
        allPhones.push(...result.phones);
        allWhatsApp.push(...result.whatsapp);
        allTrace.push(...result.trace);
        
        processedUrls++;
        
        logger.debug(`[PHONES-EXTRACT] Processed ${url}: ${result.phones.length} phones, ${result.whatsapp.length} WhatsApp`);
        
      } catch (error) {
        errors++;
        logger.error(`[PHONES-EXTRACT] Error processing ${url}:`, error);
        
        allTrace.push({
          scope: 'extract-phone',
          url,
          step: 'error',
          status: 'ERROR',
          note: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    await Promise.all(batchPromises);
    
    // Small delay between batches to be polite
    if (i + concurrency < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return {
    phones: allPhones,
    whatsapp: allWhatsApp,
    trace: allTrace,
    summary: {
      processedUrls,
      errors
    }
  };
}

/**
 * Process a single URL
 */
async function processSingleUrl(url, options) {
  const {
    countries,
    maxPhonesPerDomain,
    maxWhatsAppPerDomain,
    strictMode,
    includeTypes,
    timeout
  } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    // Fetch the URL
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error(`Non-HTML content type: ${contentType}`);
    }
    
    const html = await response.text();
    
    // Extract phones from HTML
    const extractionResult = extractFromHtml(html, url, {
      countries,
      maxPhonesPerDomain,
      maxWhatsAppPerDomain,
      strictMode,
      includeTypes
    });
    
    return extractionResult;
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Get run status
 */
router.get('/run/:runId', (req, res) => {
  const { runId } = req.params;
  
  if (!activeRuns.has(runId)) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    });
  }
  
  const run = activeRuns.get(runId);
  
  res.json({
    success: true,
    runId,
    status: run.status,
    startTime: run.startTime,
    endTime: run.endTime,
    results: run.results,
    config: {
      countries: run.countries,
      maxPhonesPerDomain: run.maxPhonesPerDomain,
      maxWhatsAppPerDomain: run.maxWhatsAppPerDomain,
      strictMode: run.strictMode,
      includeTypes: run.includeTypes
    }
  });
});

/**
 * List all runs
 */
router.get('/runs', (req, res) => {
  const runs = Array.from(activeRuns.entries()).map(([runId, run]) => ({
    runId,
    status: run.status,
    startTime: run.startTime,
    endTime: run.endTime,
    summary: run.results?.summary
  }));
  
  res.json({
    success: true,
    runs
  });
});

/**
 * Get supported countries
 */
router.get('/countries', (req, res) => {
  const countries = [
    { code: 'SA', name: 'Saudi Arabia', callingCode: '+966' },
    { code: 'AE', name: 'United Arab Emirates', callingCode: '+971' },
    { code: 'QA', name: 'Qatar', callingCode: '+974' },
    { code: 'KW', name: 'Kuwait', callingCode: '+965' },
    { code: 'BH', name: 'Bahrain', callingCode: '+973' },
    { code: 'OM', name: 'Oman', callingCode: '+968' },
    { code: 'EG', name: 'Egypt', callingCode: '+20' },
    { code: 'JO', name: 'Jordan', callingCode: '+962' },
    { code: 'LB', name: 'Lebanon', callingCode: '+961' },
    { code: 'IQ', name: 'Iraq', callingCode: '+964' },
    { code: 'SY', name: 'Syria', callingCode: '+963' },
    { code: 'YE', name: 'Yemen', callingCode: '+967' }
  ];
  
  res.json({
    success: true,
    countries
  });
});

export default router;

