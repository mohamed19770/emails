import axios from 'axios';
import * as cheerio from 'cheerio';

// Performance constants
const SERP_DELAY_MS = 600;
const TIMEOUT_MS = 30000; // Increased timeout to 30 seconds

export async function runDuckDuckGo(query, maxPages = 2) {
  const results = [];
  
  try {
    for (let page = 1; page <= maxPages; page++) {
      // Calculate offset for pagination
      const offset = (page - 1) * 10;
      
      // Build DuckDuckGo search URL
      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query.query)}&s=${offset}`;
      
      // Fetch the search results page
      const response = await axios.get(searchUrl, {
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Parse the HTML
      const $ = cheerio.load(response.data);
      
      // Extract search results
      $('.result').each((index, element) => {
        const $result = $(element);
        
        // Extract title
        const title = $result.find('.result__title a').text().trim();
        if (!title) return;
        
        // Extract URL
        const url = $result.find('.result__title a').attr('href');
        if (!url) return;
        
        // Extract snippet
        const snippet = $result.find('.result__snippet').text().trim();
        
        // Skip if URL is from excluded domains
        const excludedDomains = [
          'linkedin.com', 'bayt.com', 'gulftalent.com', 'indeed.com',
          'wuzzuf.net', 'jooble.org', 'glassdoor.com', 'monster.com'
        ];
        
        const urlObj = new URL(url);
        const isExcluded = excludedDomains.some(domain => 
          urlObj.hostname.includes(domain)
        );
        
        if (isExcluded) return;
        
        // Add to results
        results.push({
          title,
          url,
          snippet,
          page,
          engine: 'ddg',
          industryKeyword: query.industryKeyword,
          country: query.country
        });
      });
      
      // Polite delay between pages
      if (page < maxPages) {
        await new Promise(resolve => setTimeout(resolve, SERP_DELAY_MS));
      }
    }
    
  } catch (error) {
    // If it's a timeout or connection error, return empty results instead of throwing
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      // console.warn('DuckDuckGo connection failed, returning empty results'); // Removed for cleaner console
      return [];
    }
    
    console.error('DuckDuckGo search error:', error);
    throw error;
  }
  
  return results;
}

