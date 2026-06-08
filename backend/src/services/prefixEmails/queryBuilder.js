// Query builder for prefix email searches
export async function buildQueries({ prefixes, keywords, countries, locations = [], maxPages = 2, whatsappOnly = false }) {
  const queries = [];
  
  // Country synonyms mapping
  const countrySynonyms = {
    'Saudi Arabia': ['Saudi', 'KSA', 'Saudi Arabia', 'السعودية'],
    'UAE': ['UAE', 'United Arab Emirates', 'الإمارات'],
    'Qatar': ['Qatar', 'قطر'],
    'Kuwait': ['Kuwait', 'الكويت'],
    'Bahrain': ['Bahrain', 'البحرين'],
    'Oman': ['Oman', 'عمان'],
    'Egypt': ['Egypt', 'مصر'],
    'Jordan': ['Jordan', 'الأردن'],
    'Lebanon': ['Lebanon', 'لبنان']
  };
  
  // Location synonyms (Arabic/English)
  const locationSynonyms = {
    'Riyadh': ['Riyadh', 'الرياض'],
    'Jeddah': ['Jeddah', 'جدة'],
    'Dubai': ['Dubai', 'دبي'],
    'Abu Dhabi': ['Abu Dhabi', 'أبو ظبي'],
    'Doha': ['Doha', 'الدوحة'],
    'Kuwait City': ['Kuwait City', 'مدينة الكويت'],
    'Manama': ['Manama', 'المنامة'],
    'Muscat': ['Muscat', 'مسقط'],
    'Cairo': ['Cairo', 'القاهرة'],
    'Amman': ['Amman', 'عمان'],
    'Beirut': ['Beirut', 'بيروت']
  };
  
  // Build queries for each engine
  const engines = ['ddg', 'mock']; // Default engines
  
  for (const engine of engines) {
    for (const country of countries) {
      // Get country synonyms
      const countryTerms = countrySynonyms[country] || [country];
      const countryGroup = countryTerms.map(term => `"${term}"`).join(' OR ');
      
      // Get location terms if provided
      let locationGroup = '';
      if (locations.length > 0) {
        const locationTerms = locations.flatMap(loc => 
          locationSynonyms[loc] || [loc]
        );
        locationGroup = locationTerms.map(term => `"${term}"`).join(' OR ');
      }
      
      // Build prefix group
      const prefixGroup = prefixes.map(prefix => `"${prefix}"`).join(' OR ');
      
      // Build keyword group
      const keywordGroup = keywords.map(keyword => `"${keyword}"`).join(' OR ');
      
      // Build context bias for email/contact pages
      const contextBias = whatsappOnly
        ? '"whatsapp" OR "wa.me" OR "واتساب" OR "contact" OR "careers" OR "jobs"'
        : '"contact" OR "careers" OR "jobs" OR "recruitment" OR "التوظيف" OR "وظائف"';
      
      // Build the main query
      let query = `(${prefixGroup}) (${countryGroup})`;
      
      if (locationGroup) {
        query += ` (${locationGroup})`;
      }
      
      query += ` (${contextBias})`;
      
      // Add job board exclusions
      const exclusions = [
        '-site:linkedin.com',
        '-site:bayt.com',
        '-site:gulftalent.com',
        '-site:indeed.com',
        '-site:wuzzuf.net',
        '-site:jooble.org',
        '-site:glassdoor.com',
        '-site:monster.com'
      ].join(' ');
      
      query += ` ${exclusions}`;
      
      // Generate DuckDuckGo preview URL
      const previewUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      
      // Create queries for each page
      for (let page = 1; page <= maxPages; page++) {
        queries.push({
          query,
          previewUrl,
          engine,
          country,
          page,
          locations: locations.length > 0 ? locations : null
        });
      }
    }
  }
  
  return queries;
}











