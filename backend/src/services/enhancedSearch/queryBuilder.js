/**
 * Enhanced Search Query Builder
 * Builds queries for multi-country keywords and prefix search
 */

class EnhancedQueryBuilder {
  constructor() {
    this.engines = {
      ddg: {
        name: 'DuckDuckGo HTML',
        previewUrl: 'https://duckduckgo.com/html/?q=',
        requiresKey: false
      },
      mock: {
        name: 'Mock Engine (Testing)',
        previewUrl: 'https://mock.jobs/search?q=',
        requiresKey: false
      }
    };
    
    // Country synonyms mapping
    this.countrySynonyms = {
      'Saudi Arabia': ['Saudi', 'KSA', 'Saudi Arabia', 'السعودية', 'المملكة العربية السعودية'],
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

    // Job board exclusions
    this.jobBoardExclusions = [
      'site:linkedin.com',
      'site:bayt.com', 
      'site:gulftalent.com',
      'site:indeed.com',
      'site:wuzzuf.net',
      'site:jooble.org',
      'site:glassdoor.com',
      'site:monster.com'
    ];

    // Context bias terms for email/prefix searches
    this.contextBiasTerms = [
      'contact', 'careers', 'jobs', 'recruitment', 'التوظيف', 'وظائف', 'توظيف'
    ];
  }

  /**
   * Builds search queries for given keywords and countries
   * @param {Array<string>} keywords - Search keywords
   * @param {Array<string>} countries - Country names
   * @param {Array<string>} locations - Optional locations
   * @param {Array<string>} prefixes - Optional email prefixes
   * @param {boolean} splitByCountry - Whether to split queries by country
   * @returns {Array<Object>} Query objects with text and metadata
   */
  buildQueries(keywords, countries, locations = [], prefixes = [], splitByCountry = true) {
    const queries = [];
    
    if (splitByCountry) {
      // Build one query per country
      countries.forEach(country => {
        const queryObj = this.buildQueryForCountry(keywords, country, locations, prefixes);
        queries.push(queryObj);
      });
    } else {
      // Build one combined query
      const queryObj = this.buildCombinedQuery(keywords, countries, locations, prefixes);
      queries.push(queryObj);
    }
    
    return queries;
  }

  /**
   * Builds a query for a specific country
   * @param {Array<string>} keywords - Search keywords
   * @param {string} country - Country name
   * @param {Array<string>} locations - Optional locations
   * @param {Array<string>} prefixes - Optional email prefixes
   * @returns {Object} Query object
   */
  buildQueryForCountry(keywords, country, locations = [], prefixes = []) {
    const parts = [];
    
    // Add keywords group
    if (keywords.length > 0) {
      const keywordPart = keywords.length === 1 
        ? keywords[0] 
        : `(${keywords.join(' OR ')})`;
      parts.push(keywordPart);
    }
    
    // Add prefixes group (if provided)
    if (prefixes.length > 0) {
      const prefixPart = prefixes.length === 1 
        ? `"${prefixes[0]}"` 
        : `(${prefixes.map(p => `"${p}"`).join(' OR ')})`;
      parts.push(prefixPart);
    }
    
    // Add country group
    const countryTerms = this.buildCountryTerms(country);
    const countryPart = countryTerms.length === 1 
      ? countryTerms[0] 
      : `(${countryTerms.join(' OR ')})`;
    parts.push(countryPart);
    
    // Add locations group (if provided)
    if (locations.length > 0) {
      const locationTerms = this.buildLocationTerms(locations);
      const locationPart = locationTerms.length === 1 
        ? locationTerms[0] 
        : `(${locationTerms.join(' OR ')})`;
      parts.push(locationPart);
    }
    
    // Add context bias for email/prefix searches
    if (prefixes.length > 0) {
      const contextPart = `(${this.contextBiasTerms.join(' OR ')})`;
      parts.push(contextPart);
    }
    
    // Add exclusions
    const exclusions = this.jobBoardExclusions.join(' ');
    
    const queryText = `${parts.join(' ')} ${exclusions}`.trim();
    
    return {
      keywords,
      country,
      locations,
      prefixes,
      query: queryText,
      metadata: {
        keywordCount: keywords.length,
        countryTerms: countryTerms.length,
        locationTerms: locations.length,
        prefixCount: prefixes.length
      }
    };
  }

  /**
   * Builds a combined query for multiple countries
   * @param {Array<string>} keywords - Search keywords
   * @param {Array<string>} countries - Country names
   * @param {Array<string>} locations - Optional locations
   * @param {Array<string>} prefixes - Optional email prefixes
   * @returns {Object} Query object
   */
  buildCombinedQuery(keywords, countries, locations = [], prefixes = []) {
    const parts = [];
    
    // Add keywords group
    if (keywords.length > 0) {
      const keywordPart = keywords.length === 1 
        ? keywords[0] 
        : `(${keywords.join(' OR ')})`;
      parts.push(keywordPart);
    }
    
    // Add prefixes group (if provided)
    if (prefixes.length > 0) {
      const prefixPart = prefixes.length === 1 
        ? `"${prefixes[0]}"` 
        : `(${prefixes.map(p => `"${p}"`).join(' OR ')})`;
      parts.push(prefixPart);
    }
    
    // Add countries group
    const allCountryTerms = [];
    countries.forEach(country => {
      allCountryTerms.push(...this.buildCountryTerms(country));
    });
    const countryPart = `(${allCountryTerms.join(' OR ')})`;
    parts.push(countryPart);
    
    // Add locations group (if provided)
    if (locations.length > 0) {
      const locationTerms = this.buildLocationTerms(locations);
      const locationPart = `(${locationTerms.join(' OR ')})`;
      parts.push(locationPart);
    }
    
    // Add context bias for email/prefix searches
    if (prefixes.length > 0) {
      const contextPart = `(${this.contextBiasTerms.join(' OR ')})`;
      parts.push(contextPart);
    }
    
    // Add exclusions
    const exclusions = this.jobBoardExclusions.join(' ');
    
    const queryText = `${parts.join(' ')} ${exclusions}`.trim();
    
    return {
      keywords,
      countries,
      locations,
      prefixes,
      query: queryText,
      metadata: {
        keywordCount: keywords.length,
        countryCount: countries.length,
        locationTerms: locations.length,
        prefixCount: prefixes.length
      }
    };
  }

  /**
   * Builds country terms with synonyms
   * @param {string} country - Country name
   * @returns {Array<string>} Country terms
   */
  buildCountryTerms(country) {
    const synonyms = this.countrySynonyms[country];
    if (synonyms) {
      return synonyms;
    }
    
    // Fallback to the country name as-is
    return [country];
  }

  /**
   * Builds location terms with Arabic/English variants
   * @param {Array<string>} locations - Location names
   * @returns {Array<string>} Location terms
   */
  buildLocationTerms(locations) {
    const terms = [];
    
    locations.forEach(location => {
      // Add the location as-is
      terms.push(location);
      
      // Add variants if known
      const variants = this.cityVariants[location] || [];
      terms.push(...variants);
    });
    
    return [...new Set(terms)]; // Remove duplicates
  }

  /**
   * Gets preview URL for an engine and query
   * @param {string} engineId - Engine identifier
   * @param {string} query - Query text
   * @returns {string} Preview URL
   */
  getPreviewUrl(engineId, query) {
    const engine = this.engines[engineId];
    if (!engine) return '';
    
    const encodedQuery = encodeURIComponent(query);
    return `${engine.previewUrl}${encodedQuery}`;
  }

  /**
   * Gets available engines
   * @returns {Object} Available engines
   */
  getAvailableEngines() {
    return this.engines;
  }

  /**
   * Checks if an engine is available
   * @param {string} engineId - Engine identifier
   * @returns {boolean} True if available
   */
  isEngineAvailable(engineId) {
    return !!this.engines[engineId];
  }
}

export default new EnhancedQueryBuilder();

