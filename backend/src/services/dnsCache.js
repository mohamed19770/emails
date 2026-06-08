/**
 * DNS cache with LRU eviction
 * Caches MX and TXT lookups with TTL
 */

import { promises as dns } from 'dns';
import { LRUCache } from 'lru-cache';
import logger from '../config/logger.js';

// DNS cache configuration
const CACHE_CONFIG = {
  max: 1000, // Maximum number of entries
  ttl: 10 * 60 * 1000, // 10 minutes TTL
  updateAgeOnGet: true,
  allowStale: false
};

// Create separate caches for MX and TXT records
const mxCache = new LRUCache(CACHE_CONFIG);
const txtCache = new LRUCache(CACHE_CONFIG);

// DNS lookup timeout
const DNS_TIMEOUT = 5000; // 5 seconds

/**
 * Cached MX lookup
 * @param {string} domain - The domain to resolve
 * @returns {Promise<Array>} Array of MX records
 */
export async function resolveMx(domain) {
  const cacheKey = `mx:${domain.toLowerCase()}`;
  
  // Check cache first
  const cached = mxCache.get(cacheKey);
  if (cached) {
    logger.debug(`[DNS Cache] MX cache hit for ${domain}`);
    return cached;
  }
  
  try {
    logger.debug(`[DNS Cache] MX lookup for ${domain}`);
    
    const mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MX lookup timeout')), DNS_TIMEOUT)
      )
    ]);
    
    // Cache the result
    mxCache.set(cacheKey, mxRecords);
    logger.debug(`[DNS Cache] MX cached for ${domain}: ${mxRecords.length} records`);
    
    return mxRecords;
  } catch (error) {
    logger.debug(`[DNS Cache] MX lookup failed for ${domain}: ${error.message}`);
    
    // Cache negative results too (with shorter TTL)
    const negativeResult = [];
    mxCache.set(cacheKey, negativeResult, { ttl: 2 * 60 * 1000 }); // 2 minutes for negative results
    
    return negativeResult;
  }
}

/**
 * Cached TXT lookup
 * @param {string} domain - The domain to resolve
 * @returns {Promise<Array>} Array of TXT records
 */
export async function resolveTxt(domain) {
  const cacheKey = `txt:${domain.toLowerCase()}`;
  
  // Check cache first
  const cached = txtCache.get(cacheKey);
  if (cached) {
    logger.debug(`[DNS Cache] TXT cache hit for ${domain}`);
    return cached;
  }
  
  try {
    logger.debug(`[DNS Cache] TXT lookup for ${domain}`);
    
    const txtRecords = await Promise.race([
      dns.resolveTxt(domain),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TXT lookup timeout')), DNS_TIMEOUT)
      )
    ]);
    
    // Flatten TXT records (they come as arrays of arrays)
    const flattenedRecords = txtRecords.flat();
    
    // Cache the result
    txtCache.set(cacheKey, flattenedRecords);
    logger.debug(`[DNS Cache] TXT cached for ${domain}: ${flattenedRecords.length} records`);
    
    return flattenedRecords;
  } catch (error) {
    logger.debug(`[DNS Cache] TXT lookup failed for ${domain}: ${error.message}`);
    
    // Cache negative results too (with shorter TTL)
    const negativeResult = [];
    txtCache.set(cacheKey, negativeResult, { ttl: 2 * 60 * 1000 }); // 2 minutes for negative results
    
    return negativeResult;
  }
}

/**
 * Clear MX cache
 */
export function clearMxCache() {
  mxCache.clear();
  logger.info('[DNS Cache] MX cache cleared');
}

/**
 * Clear TXT cache
 */
export function clearTxtCache() {
  txtCache.clear();
  logger.info('[DNS Cache] TXT cache cleared');
}

/**
 * Clear all DNS caches
 */
export function clearAllCaches() {
  mxCache.clear();
  txtCache.clear();
  logger.info('[DNS Cache] All DNS caches cleared');
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    mx: {
      size: mxCache.size,
      max: mxCache.max,
      ttl: mxCache.ttl
    },
    txt: {
      size: txtCache.size,
      max: txtCache.max,
      ttl: txtCache.ttl
    }
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
