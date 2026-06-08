/**
 * Recruitment intent classifier
 * Determines if a page is recruitment-related
 */

// English recruitment keywords
const EN_RECRUITMENT_KEYWORDS = [
  'recruitment', 'hiring', 'careers', 'vacancies', 'apply', 'jobs', 'hr',
  'talent acquisition', 'send cv', 'whatsapp cv', 'employment', 'join us',
  'work with us', 'career opportunities', 'job openings', 'resume', 'cv',
  'application', 'interview', 'position', 'role', 'staff', 'employee'
];

// Arabic recruitment keywords
const AR_RECRUITMENT_KEYWORDS = [
  'توظيف', 'وظائف', 'فرص عمل', 'سيرة ذاتية', 'ارسال السيرة', 'التقديم',
  'موارد بشرية', 'انضم', 'قدم الآن', 'واتساب', 'وظيفة', 'عمل', 'توظيف',
  'انضمام', 'مقابلة', 'منصب', 'دور', 'موظف', 'طاقم', 'فرصة'
];

// URL patterns that indicate recruitment pages
const RECRUITMENT_URL_PATTERNS = [
  '/careers', '/jobs', '/join', '/apply', '/vacancies', '/recruit',
  '/hr', '/employment', '/opportunities', '/openings', '/positions',
  '/وظائف', '/توظيف', '/فرص-عمل', '/انضم', '/قدم'
];

/**
 * Check if a page is recruitment-related
 * @param {Object} pageData - Page data object
 * @param {string} pageData.text - Page text content
 * @param {string} pageData.url - Page URL
 * @param {string} pageData.title - Page title
 * @param {string} pageData.meta - Meta description/content
 * @returns {Object} - { matched: boolean, keywords: string[], confidence: number }
 */
export function isRecruitmentPage({ text, url, title, meta }) {
  const allText = `${text || ''} ${title || ''} ${meta || ''}`.toLowerCase();
  const urlLower = (url || '').toLowerCase();
  
  let matchedKeywords = [];
  let confidence = 0;
  
  // Check URL patterns (highest confidence)
  const urlMatch = RECRUITMENT_URL_PATTERNS.some(pattern => 
    urlLower.includes(pattern.toLowerCase())
  );
  
  if (urlMatch) {
    confidence += 50;
    matchedKeywords.push('URL pattern');
  }
  
  // Check English keywords
  const enMatches = EN_RECRUITMENT_KEYWORDS.filter(keyword => 
    allText.includes(keyword.toLowerCase())
  );
  
  if (enMatches.length > 0) {
    confidence += Math.min(enMatches.length * 10, 40);
    matchedKeywords.push(...enMatches);
  }
  
  // Check Arabic keywords
  const arMatches = AR_RECRUITMENT_KEYWORDS.filter(keyword => 
    allText.includes(keyword)
  );
  
  if (arMatches.length > 0) {
    confidence += Math.min(arMatches.length * 10, 40);
    matchedKeywords.push(...arMatches);
  }
  
  // Additional checks
  if (allText.includes('whatsapp') && (allText.includes('cv') || allText.includes('resume'))) {
    confidence += 20;
    matchedKeywords.push('WhatsApp CV');
  }
  
  if (allText.includes('contact') && allText.includes('hr')) {
    confidence += 15;
    matchedKeywords.push('HR Contact');
  }
  
  const strongKeywords = enMatches.filter(k =>
    ['recruitment', 'hiring', 'careers', 'vacancies', 'jobs', 'whatsapp cv', 'توظيف', 'وظائف'].includes(k.toLowerCase()) || k === 'WhatsApp CV'
  );

  const matched = urlMatch || (confidence >= 40 && strongKeywords.length >= 1) || strongKeywords.length >= 2;
  
  return {
    matched,
    keywords: [...new Set(matchedKeywords)], // Remove duplicates
    confidence: Math.min(confidence, 100)
  };
}

/**
 * Extract recruitment context from page
 * @param {Object} pageData - Page data
 * @returns {Object} - Recruitment context info
 */
export function extractRecruitmentContext(pageData) {
  const intent = isRecruitmentPage(pageData);
  
  if (!intent.matched) {
    return { isRecruitment: false };
  }
  
  return {
    isRecruitment: true,
    keywords: intent.keywords,
    confidence: intent.confidence,
    evidence: intent.keywords.join(', ')
  };
}
