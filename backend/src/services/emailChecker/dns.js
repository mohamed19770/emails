/**
 * DNS resolution with LRU caching
 * Handles MX and TXT record lookups
 */

import { promises as dns } from 'dns';
import { LRUCache } from 'lru-cache';
import logger from '../../config/logger.js';

// DNS cache with 5-minute TTL
const dnsCache = new LRUCache({
  max: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

const DNS_TIMEOUT = 3000; // 3 seconds
const MAX_MX_RECORDS = 10;

/**
 * Cached DNS lookup with timeout
 */
async function cachedDnsLookup(type, domain) {
  const cacheKey = `${type}:${domain}`;
  
  // Check cache first
  if (dnsCache.has(cacheKey)) {
    return dnsCache.get(cacheKey);
  }

  try {
    const result = await Promise.race([
      dns.resolve(domain, type),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${type} lookup timeout`)), DNS_TIMEOUT)
      )
    ]);

    // Cache the result
    dnsCache.set(cacheKey, result);
    return result;
  } catch (error) {
    logger.debug(`DNS ${type} lookup failed for ${domain}: ${error.message}`);
    throw error;
  }
}

/**
 * Resolve MX records for domain
 */
export async function resolveMX(domain) {
  try {
    logger.debug(`Attempting MX lookup for ${domain}`);
    const mxRecords = await cachedDnsLookup('MX', domain);
    logger.debug(`MX lookup result for ${domain}:`, mxRecords);
    
    if (!mxRecords || mxRecords.length === 0) {
      logger.debug(`No MX records found for ${domain}`);
      return { hasMX: false, records: [], priority: null };
    }

    // Sort by priority (lower number = higher priority)
    const sortedRecords = mxRecords
      .sort((a, b) => a.priority - b.priority)
      .slice(0, MAX_MX_RECORDS);

    logger.debug(`MX records found for ${domain}:`, sortedRecords);
    return {
      hasMX: true,
      records: sortedRecords,
      priority: sortedRecords[0].priority
    };
  } catch (error) {
    logger.error(`MX resolution failed for ${domain}: ${error.message}`);
    return { hasMX: false, records: [], priority: null };
  }
}

/**
 * Resolve TXT records for domain
 */
export async function resolveTXT(domain) {
  try {
    const txtRecords = await cachedDnsLookup('TXT', domain);
    return { hasTXT: true, records: txtRecords };
  } catch (error) {
    logger.debug(`TXT resolution failed for ${domain}: ${error.message}`);
    return { hasTXT: false, records: [] };
  }
}

/**
 * Clear DNS cache
 */
export function clearDNSCache() {
  dnsCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: dnsCache.size,
    max: dnsCache.max,
    ttl: dnsCache.ttl
  };
}

export default {
  resolveMX,
  resolveTXT,
  clearDNSCache,
  getCacheStats
};