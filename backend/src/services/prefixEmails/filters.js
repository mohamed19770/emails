import * as cheerio from 'cheerio';

// Email extraction regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Free webmail domains to exclude
const FREE_WEBMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'aol.com', 'protonmail.com', 'zoho.com', 'yandex.com'
];

// Job board domains to exclude
const JOB_BOARD_DOMAINS = [
  'linkedin.com', 'bayt.com', 'gulftalent.com', 'indeed.com',
  'wuzzuf.net', 'jooble.org', 'glassdoor.com', 'monster.com'
];

// Country synonyms for matching
const COUNTRY_SYNONYMS = {
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

// Location synonyms for matching
const LOCATION_SYNONYMS = {
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

export function extractEmails(html, options = {}) {
  const { prefixes = [], maxEmailsPerDomain = 3, countries = [], locations = [] } = options;
  
  const emails = [];
  const $ = cheerio.load(html);
  
  // Extract all text content
  const textContent = $('body').text();
  
  // Find all email addresses
  const emailMatches = textContent.match(EMAIL_REGEX) || [];
  
  // Process each email
  for (const email of emailMatches) {
    const emailLower = email.toLowerCase();
    const domain = emailLower.split('@')[1];
    
    // Skip if it's a free webmail domain
    if (FREE_WEBMAIL_DOMAINS.includes(domain)) {
      continue;
    }
    
    // Check if email matches any of the prefixes
    const emailPrefix = emailLower.split('@')[0];
    const matchesPrefix = prefixes.some(prefix => 
      emailPrefix === prefix.toLowerCase().replace('@', '')
    );
    
    if (!matchesPrefix) {
      continue;
    }
    
    // Extract snippet around the email
    const snippet = extractSnippet(textContent, email);
    
    // Check country match
    const countryMatch = checkCountryMatch(textContent, countries);
    if (!countryMatch) {
      continue;
    }
    
    // Check location match if locations are provided
    if (locations.length > 0) {
      const locationMatch = checkLocationMatch(textContent, locations);
      if (!locationMatch) {
        continue;
      }
    }
    
    // Add email to results
    emails.push({
      email: emailLower,
      domain,
      snippet,
      sourceUrl: '', // Will be set by caller
      title: '', // Will be set by caller
      engine: 'extracted'
    });
  }
  
  // Limit emails per domain
  const domainCounts = {};
  const filteredEmails = emails.filter(email => {
    const domain = email.domain;
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    return domainCounts[domain] <= maxEmailsPerDomain;
  });
  
  return filteredEmails;
}

export function filterResults(emails, options = {}) {
  const { 
    countries = [], 
    locations = [], 
    excludeJobBoards = true, 
    excludeFreeWebmail = true 
  } = options;
  
  return emails.filter(email => {
    // Exclude free webmail if requested
    if (excludeFreeWebmail && FREE_WEBMAIL_DOMAINS.includes(email.domain)) {
      return false;
    }
    
    // Exclude job boards if requested
    if (excludeJobBoards && JOB_BOARD_DOMAINS.some(domain => 
      email.domain.includes(domain)
    )) {
      return false;
    }
    
    // Check country match
    if (countries.length > 0) {
      const countryMatch = checkCountryMatch(email.snippet, countries);
      if (!countryMatch) {
        return false;
      }
    }
    
    // Check location match if locations are provided
    if (locations.length > 0) {
      const locationMatch = checkLocationMatch(email.snippet, locations);
      if (!locationMatch) {
        return false;
      }
    }
    
    return true;
  });
}

function checkCountryMatch(text, countries) {
  if (countries.length === 0) return true;
  
  const textLower = text.toLowerCase();
  
  return countries.some(country => {
    const synonyms = COUNTRY_SYNONYMS[country] || [country];
    return synonyms.some(synonym => 
      textLower.includes(synonym.toLowerCase())
    );
  });
}

function checkLocationMatch(text, locations) {
  if (locations.length === 0) return true;
  
  const textLower = text.toLowerCase();
  
  return locations.some(location => {
    const synonyms = LOCATION_SYNONYMS[location] || [location];
    return synonyms.some(synonym => 
      textLower.includes(synonym.toLowerCase())
    );
  });
}

export function extractAllEmailsFromHtml(html, options = {}) {
  const {
    targetDomains = [],
    maxEmails = 200,
    excludeFreeWebmail = true,
    onlyTargetDomain = false
  } = options;

  const emails = [];
  const seen = new Set();
  const $ = cheerio.load(html);
  const textContent = $('body').text();

  const normalizedTargets = targetDomains.map(d =>
    d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  );

  const matchesTargetDomain = (emailDomain) => {
    if (normalizedTargets.length === 0) return true;
    return normalizedTargets.some(target =>
      emailDomain === target || emailDomain.endsWith(`.${target}`)
    );
  };

  const addEmail = (rawEmail) => {
    if (!rawEmail || emails.length >= maxEmails) return;

    const emailLower = rawEmail.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower) || seen.has(emailLower)) return;

    const emailDomain = emailLower.split('@')[1];
    if (!emailDomain) return;

    if (excludeFreeWebmail && FREE_WEBMAIL_DOMAINS.includes(emailDomain)) return;
    if (onlyTargetDomain && !matchesTargetDomain(emailDomain)) return;

    seen.add(emailLower);
    emails.push({
      email: emailLower,
      domain: emailDomain,
      matchesTarget: matchesTargetDomain(emailDomain),
      snippet: extractSnippet(textContent, rawEmail),
      engine: 'domain-crawler'
    });
  };

  const textMatches = textContent.match(EMAIL_REGEX) || [];
  for (const email of textMatches) {
    addEmail(email);
  }

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
    addEmail(email);
  });

  return emails;
}

function extractSnippet(text, email, contextLength = 100) {
  const emailIndex = text.indexOf(email);
  if (emailIndex === -1) return '';
  
  const start = Math.max(0, emailIndex - contextLength);
  const end = Math.min(text.length, emailIndex + email.length + contextLength);
  
  let snippet = text.substring(start, end);
  
  // Clean up the snippet
  snippet = snippet.replace(/\s+/g, ' ').trim();
  
  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  return snippet;
}











