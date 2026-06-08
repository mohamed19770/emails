/**
 * Enhanced Search Filters
 * Provides filtering and matching utilities for multi-country search
 */

class EnhancedFilters {
  constructor() {
    // Job board domains to exclude
    this.excludedDomains = [
      'linkedin.com', 'bayt.com', 'gulftalent.com', 'wuzzuf.net',
      'indeed.com', 'monster.com', 'glassdoor.com', 'ziprecruiter.com',
      'careerbuilder.com', 'simplyhired.com', 'jobstreet.com',
      'naukri.com', 'shine.com', 'timesjobs.com', 'jobsdb.com'
    ];
    
    // Free webmail providers to exclude
    this.freeWebmailProviders = [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
      'aol.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'mail.com',
      'gmx.com', 'web.de', 'tutanota.com', 'fastmail.com', 'hushmail.com'
    ];
    
    // Country synonyms for matching
    this.countrySynonyms = {
      'Saudi Arabia': ['Saudi', 'KSA', 'السعودية', 'المملكة العربية السعودية'],
      'United Arab Emirates': ['UAE', 'United Arab Emirates', 'الإمارات', 'دولة الإمارات العربية المتحدة'],
      'Qatar': ['Qatar', 'قطر', 'دولة قطر'],
      'Kuwait': ['Kuwait', 'الكويت', 'دولة الكويت'],
      'Bahrain': ['Bahrain', 'البحرين', 'مملكة البحرين'],
      'Oman': ['Oman', 'عمان', 'سلطنة عمان'],
      'Egypt': ['Egypt', 'مصر', 'جمهورية مصر العربية'],
      'Jordan': ['Jordan', 'الأردن', 'المملكة الأردنية الهاشمية'],
      'Lebanon': ['Lebanon', 'لبنان', 'الجمهورية اللبنانية']
    };
    
    // City variants (Arabic/English)
    this.cityVariants = {
      'Riyadh': ['الرياض', 'Riyadh', 'Riyad'],
      'Jeddah': ['جدة', 'Jeddah', 'Jiddah'],
      'Dammam': ['الدمام', 'Dammam', 'Damam'],
      'Khobar': ['الخبر', 'Khobar', 'Al Khobar'],
      'Makkah': ['مكة', 'Makkah', 'Mecca'],
      'Madinah': ['المدينة', 'Madinah', 'Medina'],
      'Dhahran': ['الظهران', 'Dhahran'],
      'Jubail': ['الجبيل', 'Jubail', 'Al Jubail'],
      'Yanbu': ['ينبع', 'Yanbu', 'Al Yanbu'],
      'Abha': ['أبها', 'Abha'],
      'Taif': ['الطائف', 'Taif', 'At Taif'],
      'Dubai': ['دبي', 'Dubai'],
      'Abu Dhabi': ['أبو ظبي', 'Abu Dhabi'],
      'Sharjah': ['الشارقة', 'Sharjah'],
      'Doha': ['الدوحة', 'Doha'],
      'Kuwait City': ['مدينة الكويت', 'Kuwait City'],
      'Manama': ['المنامة', 'Manama'],
      'Muscat': ['مسقط', 'Muscat'],
      'Cairo': ['القاهرة', 'Cairo'],
      'Alexandria': ['الإسكندرية', 'Alexandria'],
      'Amman': ['عمان', 'Amman'],
      'Beirut': ['بيروت', 'Beirut']
    };
  }

  /**
   * Matches keywords in text
   * @param {string} text - Text to search in
   * @param {Array<string>} keywords - Keywords to match
   * @returns {Array<string>} Matched keywords
   */
  matchKeywords(text, keywords) {
    if (!text || !keywords || keywords.length === 0) return [];
    
    const textLower = text.toLowerCase();
    const matched = [];
    
    keywords.forEach(keyword => {
      if (textLower.includes(keyword.toLowerCase())) {
        matched.push(keyword);
      }
    });
    
    return matched;
  }

  /**
   * Checks if text matches any of the selected countries
   * @param {string} text - Text to check
   * @param {Array<string>} countries - Selected countries
   * @returns {boolean} True if matches any country
   */
  matchesCountries(text, countries) {
    if (!text || !countries || countries.length === 0) return true;
    
    const textLower = text.toLowerCase();
    
    return countries.some(country => {
      // Direct match
      if (textLower.includes(country.toLowerCase())) return true;
      
      // Check synonyms
      const synonyms = this.countrySynonyms[country] || [];
      return synonyms.some(synonym => 
        textLower.includes(synonym.toLowerCase())
      );
    });
  }

  /**
   * Checks if text matches any of the locations
   * @param {string} text - Text to check
   * @param {Array<string>} locations - Location names
   * @returns {boolean} True if matches any location
   */
  matchesLocations(text, locations) {
    if (!text || !locations || locations.length === 0) return true;
    
    const textLower = text.toLowerCase();
    
    return locations.some(location => {
      // Direct match
      if (textLower.includes(location.toLowerCase())) return true;
      
      // Check variants
      const variants = this.cityVariants[location] || [];
      return variants.some(variant => 
        textLower.includes(variant.toLowerCase())
      );
    });
  }

  /**
   * Checks if domain should be excluded (job boards)
   * @param {string} url - URL to check
   * @returns {boolean} True if should be excluded
   */
  shouldExcludeDomain(url) {
    if (!url) return true;
    
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return this.excludedDomains.some(excluded => 
        domain.includes(excluded)
      );
    } catch {
      return true;
    }
  }

  /**
   * Checks if email is from a free webmail provider
   * @param {string} email - Email address
   * @returns {boolean} True if free webmail
   */
  isFreeWebmail(email) {
    if (!email) return true;
    
    const domain = email.split('@')[1];
    return this.freeWebmailProviders.includes(domain);
  }

  /**
   * Filters results by countries and locations
   * @param {Array<Object>} results - Results to filter
   * @param {Array<string>} countries - Countries to match
   * @param {Array<string>} locations - Locations to match
   * @returns {Array<Object>} Filtered results
   */
  filterByLocation(results, countries, locations) {
    return results.filter(result => {
      const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
      
      // Must match at least one country
      if (!this.matchesCountries(text, countries)) return false;
      
      // Must match at least one location (if locations provided)
      if (locations && locations.length > 0) {
        return this.matchesLocations(text, locations);
      }
      
      return true;
    });
  }

  /**
   * Filters results by keywords
   * @param {Array<Object>} results - Results to filter
   * @param {Array<string>} keywords - Keywords to match
   * @returns {Array<Object>} Filtered results with matched keywords
   */
  filterByKeywords(results, keywords) {
    return results.map(result => {
      const text = `${result.title} ${result.snippet}`;
      const matchedKeywords = this.matchKeywords(text, keywords);
      
      return {
        ...result,
        matchedKeywords
      };
    }).filter(result => result.matchedKeywords.length > 0);
  }

  /**
   * Removes job board results
   * @param {Array<Object>} results - Results to filter
   * @returns {Array<Object>} Filtered results
   */
  removeJobBoards(results) {
    return results.filter(result => !this.shouldExcludeDomain(result.url));
  }

  /**
   * Filters out free webmail emails
   * @param {Array<Object>} emails - Emails to filter
   * @returns {Array<Object>} Filtered emails
   */
  removeFreeWebmail(emails) {
    return emails.filter(email => !this.isFreeWebmail(email.email));
  }

  /**
   * Deduplicates results by canonical URL
   * @param {Array<Object>} results - Results to deduplicate
   * @returns {Array<Object>} Deduplicated results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      try {
        const url = new URL(result.url);
        const canonical = `${url.protocol}//${url.hostname}${url.pathname}`.toLowerCase();
        
        if (seen.has(canonical)) return false;
        seen.add(canonical);
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Deduplicates emails by email address
   * @param {Array<Object>} emails - Emails to deduplicate
   * @returns {Array<Object>} Deduplicated emails
   */
  deduplicateEmails(emails) {
    const seen = new Set();
    return emails.filter(email => {
      if (seen.has(email.email)) return false;
      seen.add(email.email);
      return true;
    });
  }

  /**
   * Applies all filters to results
   * @param {Array<Object>} results - Results to filter
   * @param {Object} options - Filter options
   * @returns {Object} Filtered results and emails
   */
  applyFilters(results, options) {
    let filtered = results;
    
    // Remove job boards
    filtered = this.removeJobBoards(filtered);
    
    // Filter by location
    if (options.countries) {
      filtered = this.filterByLocation(filtered, options.countries, options.locations);
    }
    
    // Filter by keywords
    if (options.keywords && options.keywords.length > 0) {
      filtered = this.filterByKeywords(filtered, options.keywords);
    }
    
    // Deduplicate
    filtered = this.deduplicateResults(filtered);
    
    // Filter emails if provided
    let filteredEmails = [];
    if (options.emails && options.emails.length > 0) {
      filteredEmails = this.removeFreeWebmail(options.emails);
      filteredEmails = this.deduplicateEmails(filteredEmails);
    }
    
    return {
      results: filtered,
      emails: filteredEmails
    };
  }
}

export default new EnhancedFilters();

