/**
 * DNS intelligence service for email verification
 * Handles MX, SPF, DMARC, BIMI lookups with caching
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
      dns.resolve(type, domain),
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
 * Get MX records for domain
 */
export async function getMXRecords(domain) {
  try {
    const mxRecords = await cachedDnsLookup('MX', domain);
    
    if (!mxRecords || mxRecords.length === 0) {
      return { hasMX: false, records: [], priority: null };
    }

    // Sort by priority (lower number = higher priority)
    const sortedRecords = mxRecords
      .sort((a, b) => a.priority - b.priority)
      .slice(0, MAX_MX_RECORDS);

    return {
      hasMX: true,
      records: sortedRecords,
      priority: sortedRecords[0].priority
    };
  } catch (error) {
    logger.debug(`MX lookup failed for ${domain}: ${error.message}`);
    return { hasMX: false, records: [], priority: null };
  }
}

/**
 * Get SPF record for domain
 */
export async function getSPFRecord(domain) {
  try {
    const txtRecords = await cachedDnsLookup('TXT', domain);
    
    if (!txtRecords || txtRecords.length === 0) {
      return { hasSPF: false, record: null, mechanisms: [] };
    }

    // Find SPF record
    const spfRecord = txtRecords.find(record => 
      record.some(part => part.startsWith('v=spf1'))
    );

    if (!spfRecord) {
      return { hasSPF: false, record: null, mechanisms: [] };
    }

    // Parse SPF mechanisms
    const mechanisms = [];
    const recordText = spfRecord.join(' ');
    const parts = recordText.split(' ');

    for (const part of parts) {
      if (part.startsWith('include:') || part.startsWith('redirect=')) {
        mechanisms.push(part);
      } else if (part === 'all' || part === '-all' || part === '~all' || part === '+all') {
        mechanisms.push(part);
      }
    }

    return {
      hasSPF: true,
      record: recordText,
      mechanisms
    };
  } catch (error) {
    logger.debug(`SPF lookup failed for ${domain}: ${error.message}`);
    return { hasSPF: false, record: null, mechanisms: [] };
  }
}

/**
 * Get DMARC record for domain
 */
export async function getDMARCRecord(domain) {
  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const txtRecords = await cachedDnsLookup('TXT', dmarcDomain);
    
    if (!txtRecords || txtRecords.length === 0) {
      return { hasDMARC: false, record: null, policy: null };
    }

    // Find DMARC record
    const dmarcRecord = txtRecords.find(record => 
      record.some(part => part.startsWith('v=DMARC1'))
    );

    if (!dmarcRecord) {
      return { hasDMARC: false, record: null, policy: null };
    }

    // Parse DMARC policy
    const recordText = dmarcRecord.join(' ');
    const policyMatch = recordText.match(/p=([^;]+)/);
    const policy = policyMatch ? policyMatch[1] : null;

    return {
      hasDMARC: true,
      record: recordText,
      policy
    };
  } catch (error) {
    logger.debug(`DMARC lookup failed for ${domain}: ${error.message}`);
    return { hasDMARC: false, record: null, policy: null };
  }
}

/**
 * Get BIMI record for domain
 */
export async function getBIMIRecord(domain) {
  try {
    const bimiDomain = `default._bimi.${domain}`;
    const txtRecords = await cachedDnsLookup('TXT', bimiDomain);
    
    if (!txtRecords || txtRecords.length === 0) {
      return { hasBIMI: false, record: null };
    }

    // Find BIMI record
    const bimiRecord = txtRecords.find(record => 
      record.some(part => part.startsWith('v=BIMI1'))
    );

    if (!bimiRecord) {
      return { hasBIMI: false, record: null };
    }

    return {
      hasBIMI: true,
      record: bimiRecord.join(' ')
    };
  } catch (error) {
    logger.debug(`BIMI lookup failed for ${domain}: ${error.message}`);
    return { hasBIMI: false, record: null };
  }
}

/**
 * Get comprehensive DNS intelligence for domain
 */
export async function getDNSIntelligence(domain) {
  try {
    const [mxResult, spfResult, dmarcResult, bimiResult] = await Promise.allSettled([
      getMXRecords(domain),
      getSPFRecord(domain),
      getDMARCRecord(domain),
      getBIMIRecord(domain)
    ]);

    return {
      domain,
      mx: mxResult.status === 'fulfilled' ? mxResult.value : { hasMX: false, records: [], priority: null },
      spf: spfResult.status === 'fulfilled' ? spfResult.value : { hasSPF: false, record: null, mechanisms: [] },
      dmarc: dmarcResult.status === 'fulfilled' ? dmarcResult.value : { hasDMARC: false, record: null, policy: null },
      bimi: bimiResult.status === 'fulfilled' ? bimiResult.value : { hasBIMI: false, record: null },
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`DNS intelligence gathering failed for ${domain}: ${error.message}`);
    return {
      domain,
      mx: { hasMX: false, records: [], priority: null },
      spf: { hasSPF: false, record: null, mechanisms: [] },
      dmarc: { hasDMARC: false, record: null, policy: null },
      bimi: { hasBIMI: false, record: null },
      checkedAt: new Date().toISOString(),
      error: error.message
    };
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
  getMXRecords,
  getSPFRecord,
  getDMARCRecord,
  getBIMIRecord,
  getDNSIntelligence,
  clearDNSCache,
  getCacheStats
};
