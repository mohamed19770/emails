import logger from '../../config/logger.js';

/**
 * Phone number normalization and validation utility
 */

// Arabic to Latin digit mapping
const ARABIC_TO_LATIN = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

// Country code mappings
const COUNTRY_CODES = {
  'SA': '+966', 'AE': '+971', 'QA': '+974', 'KW': '+965',
  'BH': '+973', 'OM': '+968', 'EG': '+20', 'JO': '+962',
  'LB': '+961', 'IQ': '+964', 'SY': '+963', 'YE': '+967',
  'PS': '+970', 'MA': '+212', 'DZ': '+213', 'TN': '+216',
  'LY': '+218', 'SD': '+249', 'SO': '+252', 'DJ': '+253'
};

// TLD to country mapping
const TLD_TO_COUNTRY = {
  '.sa': 'SA', '.ae': 'AE', '.qa': 'QA', '.kw': 'KW',
  '.bh': 'BH', '.om': 'OM', '.eg': 'EG', '.jo': 'JO',
  '.lb': 'LB', '.iq': 'IQ', '.sy': 'SY', '.ye': 'YE',
  '.ps': 'PS', '.ma': 'MA', '.dz': 'DZ', '.tn': 'TN',
  '.ly': 'LY', '.sd': 'SD', '.so': 'SO', '.dj': 'DJ'
};

/**
 * Normalizes Arabic digits to Latin digits
 * @param {string} text - Text containing Arabic digits
 * @returns {string} - Text with Latin digits
 */
export function normalizeArabicDigits(text) {
  if (!text) return '';
  
  return text.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (match) => {
    return ARABIC_TO_LATIN[match] || match;
  });
}

/**
 * Extracts and normalizes phone number from text
 * @param {string} text - Raw text containing phone number
 * @returns {string} - Normalized phone number with only digits
 */
export function extractDigits(text) {
  if (!text) return '';
  
  // Normalize Arabic digits first
  const normalized = normalizeArabicDigits(text);
  
  // Extract only digits and + sign
  const digits = normalized.match(/[+\d]/g);
  return digits ? digits.join('') : '';
}

/**
 * Determines country code from various hints
 * @param {string} url - Website URL
 * @param {Array} countries - Selected countries from request
 * @param {string} pageContent - Page content for country hints
 * @returns {string} - Country code (e.g., 'SA', 'AE')
 */
export function determineCountry(url, countries = [], pageContent = '') {
  // 1. Use first selected country as default
  if (countries.length > 0) {
    return countries[0];
  }
  
  // 2. Check TLD mapping
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const tld = '.' + urlObj.hostname.split('.').pop().toLowerCase();
    if (TLD_TO_COUNTRY[tld]) {
      return TLD_TO_COUNTRY[tld];
    }
  } catch (error) {
    // Invalid URL, continue with other methods
  }
  
  // 3. Check page content for country hints
  const content = pageContent.toLowerCase();
  
  const countryHints = {
    'SA': ['السعودية', 'ksa', 'saudi arabia', 'saudi', 'riyadh', 'jeddah'],
    'AE': ['الإمارات', 'uae', 'united arab emirates', 'dubai', 'abu dhabi'],
    'QA': ['قطر', 'qatar', 'doha'],
    'KW': ['الكويت', 'kuwait', 'kuwait city'],
    'BH': ['البحرين', 'bahrain', 'manama'],
    'OM': ['عمان', 'oman', 'muscat'],
    'EG': ['مصر', 'egypt', 'cairo'],
    'JO': ['الأردن', 'jordan', 'amman'],
    'LB': ['لبنان', 'lebanon', 'beirut'],
    'IQ': ['العراق', 'iraq', 'baghdad'],
    'SY': ['سوريا', 'syria', 'damascus'],
    'YE': ['اليمن', 'yemen', 'sana\'a']
  };
  
  for (const [country, hints] of Object.entries(countryHints)) {
    for (const hint of hints) {
      if (content.includes(hint.toLowerCase())) {
        return country;
      }
    }
  }
  
  // Default to Saudi Arabia if no hints found
  return 'SA';
}

/**
 * Formats phone number to E.164 format
 * @param {string} digits - Raw phone digits
 * @param {string} countryCode - Country code (e.g., 'SA')
 * @returns {Object} - { e164: string, local: string, valid: boolean, type: string }
 */
export function formatToE164(digits, countryCode) {
  if (!digits || !countryCode) {
    return { e164: '', local: '', valid: false, type: 'unknown' };
  }
  
  // Clean digits (remove + if present)
  const cleanDigits = digits.replace(/^\+/, '');
  
  // Get country calling code
  const callingCode = COUNTRY_CODES[countryCode];
  if (!callingCode) {
    return { e164: '', local: '', valid: false, type: 'unknown' };
  }
  
  const countryCodeDigits = callingCode.replace('+', '');
  
  // Handle different formats
  let nationalNumber = '';
  let e164 = '';
  
  // Case 1: Already has country code
  if (cleanDigits.startsWith(countryCodeDigits)) {
    nationalNumber = cleanDigits.substring(countryCodeDigits.length);
    e164 = `+${cleanDigits}`;
  }
  // Case 2: Starts with 0 (national format)
  else if (cleanDigits.startsWith('0')) {
    nationalNumber = cleanDigits.substring(1);
    e164 = `+${countryCodeDigits}${nationalNumber}`;
  }
  // Case 3: Just national number
  else {
    nationalNumber = cleanDigits;
    e164 = `+${countryCodeDigits}${nationalNumber}`;
  }
  
  // Validate length and format
  const isValid = validatePhoneNumber(nationalNumber, countryCode);
  const type = determinePhoneType(nationalNumber, countryCode);
  
  return {
    e164,
    local: `0${nationalNumber}`,
    valid: isValid,
    type
  };
}

/**
 * Validates phone number based on country-specific rules
 * @param {string} nationalNumber - National phone number
 * @param {string} countryCode - Country code
 * @returns {boolean} - True if valid
 */
function validatePhoneNumber(nationalNumber, countryCode) {
  if (!nationalNumber || !countryCode) return false;
  
  // Remove any remaining non-digits
  const digits = nationalNumber.replace(/\D/g, '');
  
  // Country-specific validation rules
  const rules = {
    'SA': {
      mobile: /^5[0-9]{8}$/, // Saudi mobile: 5XXXXXXXX
      landline: /^1[0-9]{7}$/ // Saudi landline: 1XXXXXXX
    },
    'AE': {
      mobile: /^5[0-9]{8}$/, // UAE mobile: 5XXXXXXXX
      landline: /^[2-9][0-9]{7}$/ // UAE landline: 2XXXXXXX to 9XXXXXXX
    },
    'QA': {
      mobile: /^[3-7][0-9]{7}$/, // Qatar mobile: 3XXXXXXX to 7XXXXXXX
      landline: /^4[0-9]{7}$/ // Qatar landline: 4XXXXXXX
    },
    'KW': {
      mobile: /^[569][0-9]{7}$/, // Kuwait mobile: 5XXXXXXX, 6XXXXXXX, 9XXXXXXX
      landline: /^[2-4][0-9]{7}$/ // Kuwait landline: 2XXXXXXX to 4XXXXXXX
    },
    'BH': {
      mobile: /^[3-9][0-9]{7}$/, // Bahrain mobile: 3XXXXXXX to 9XXXXXXX
      landline: /^1[0-9]{6,7}$/ // Bahrain landline: 1XXXXXX or 1XXXXXXX
    },
    'OM': {
      mobile: /^[79][0-9]{7}$/, // Oman mobile: 7XXXXXXX, 9XXXXXXX
      landline: /^[2-6][0-9]{6,7}$/ // Oman landline: 2XXXXXX to 6XXXXXXX
    }
  };
  
  const countryRules = rules[countryCode];
  if (!countryRules) return true; // Unknown country, assume valid
  
  return countryRules.mobile.test(digits) || countryRules.landline.test(digits);
}

/**
 * Determines phone type (mobile, landline, toll-free)
 * @param {string} nationalNumber - National phone number
 * @param {string} countryCode - Country code
 * @returns {string} - Phone type
 */
function determinePhoneType(nationalNumber, countryCode) {
  if (!nationalNumber || !countryCode) return 'unknown';
  
  const digits = nationalNumber.replace(/\D/g, '');
  
  // Country-specific type determination
  const types = {
    'SA': {
      mobile: /^5[0-9]{8}$/,
      landline: /^1[0-9]{7}$/,
      tollfree: /^800[0-9]{7}$/
    },
    'AE': {
      mobile: /^5[0-9]{8}$/,
      landline: /^[2-9][0-9]{7}$/,
      tollfree: /^800[0-9]{7}$/
    },
    'QA': {
      mobile: /^[3-7][0-9]{7}$/,
      landline: /^4[0-9]{7}$/,
      tollfree: /^800[0-9]{7}$/
    }
  };
  
  const countryTypes = types[countryCode];
  if (!countryTypes) return 'unknown';
  
  if (countryTypes.mobile.test(digits)) return 'mobile';
  if (countryTypes.landline.test(digits)) return 'landline';
  if (countryTypes.tollfree && countryTypes.tollfree.test(digits)) return 'toll-free';
  
  return 'unknown';
}

/**
 * Checks if text contains WhatsApp-related keywords
 * @param {string} text - Text to check
 * @returns {boolean} - True if WhatsApp-related
 */
export function isWhatsAppRelated(text) {
  if (!text) return false;
  
  const whatsappKeywords = [
    'whatsapp', 'واتساب', 'wa.me', 'api.whatsapp.com',
    'whats app', 'واتس', 'واتساب بزنس'
  ];
  
  const lowerText = text.toLowerCase();
  return whatsappKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Checks if text contains fax-related keywords (to downweight)
 * @param {string} text - Text to check
 * @returns {boolean} - True if fax-related
 */
export function isFaxRelated(text) {
  if (!text) return false;
  
  const faxKeywords = ['fax', 'فاكس', 'facsimile'];
  
  const lowerText = text.toLowerCase();
  return faxKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Main phone normalization function
 * @param {string} rawPhone - Raw phone number from HTML
 * @param {string} url - Source URL
 * @param {Array} countries - Selected countries
 * @param {string} pageContent - Page content for hints
 * @returns {Object} - Normalized phone object
 */
export function normalizePhone(rawPhone, url, countries = [], pageContent = '') {
  try {
    const digits = extractDigits(rawPhone);
    if (!digits || digits.length < 7) {
      return null;
    }
    
    const countryCode = determineCountry(url, countries, pageContent);
    const formatted = formatToE164(digits, countryCode);
    
    if (!formatted.valid) {
      return null;
    }
    
    return {
      e164: formatted.e164,
      local: formatted.local,
      country: countryCode,
      type: formatted.type,
      original: rawPhone.trim(),
      confidence: 'high'
    };
    
  } catch (error) {
    logger.error('[PHONE-NORMALIZE] Error normalizing phone:', error);
    return null;
  }
}

