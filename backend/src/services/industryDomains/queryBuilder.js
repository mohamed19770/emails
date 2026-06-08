// Query builder for industry domain searches
export async function buildIndustryQueries({ industryKeywords, countries, biasWords = [], maxSerpPages = 2 }) {
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
  
  // Build queries for each engine
  const engines = ['ddg', 'mock']; // Default engines
  
  for (const engine of engines) {
    for (const industryKeyword of industryKeywords) {
      for (const country of countries) {
        // Get country synonyms
        const countryTerms = countrySynonyms[country] || [country];
        const countryGroup = countryTerms.map(term => `"${term}"`).join(' OR ');
        
        // Build bias words group if provided
        let biasGroup = '';
        if (biasWords.length > 0) {
          biasGroup = biasWords.map(word => `"${word}"`).join(' OR ');
        }
        
        // Build the main query
        let query = `"${industryKeyword}" (${countryGroup})`;
        
        if (biasGroup) {
          query += ` (${biasGroup})`;
        }
        
        // Add industry-specific context
        query += ` (company OR organization OR business OR شركة OR مؤسسة OR مجموعة)`;
        
        // Add domain-specific terms
        query += ` (website OR domain OR site OR موقع OR موقع إلكتروني)`;
        
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
        for (let page = 1; page <= maxSerpPages; page++) {
          queries.push({
            query,
            previewUrl,
            engine,
            country,
            industryKeyword,
            page,
            biasWords: biasWords.length > 0 ? biasWords : null
          });
        }
      }
    }
  }
  
  return queries;
}

