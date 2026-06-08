/**
 * Carrier prefixes for mobile numbers by country
 * Used for carrier-aware validation
 */
export const carrierPrefixes = {
  'SA': ["50","53","54","55","56","57","58","59"], // Saudi Arabia
  'AE': ["50","52","54","55","56","58"], // UAE
  'QA': ["3","5","6","7"], // Qatar
  'KW': ["5","6","9"], // Kuwait
  'BH': ["3","6","33","34","35","36","37","38","39"], // Bahrain
  'OM': ["9"], // Oman
  'EG': ["10","11","12","15"], // Egypt
  'JO': ["7"], // Jordan
  'LB': ["3","70","71","76","78","79"] // Lebanon
};

/**
 * Country name to code mapping
 */
export const countryNameToCode = {
  'Saudi Arabia': 'SA',
  'United Arab Emirates': 'AE',
  'Qatar': 'QA',
  'Kuwait': 'KW',
  'Bahrain': 'BH',
  'Oman': 'OM',
  'Egypt': 'EG',
  'Jordan': 'JO',
  'Lebanon': 'LB'
};

/**
 * Validate if a phone number matches carrier prefixes for a country
 * @param {string} nationalNumber - National phone number (without country code)
 * @param {string} countryCode - Country code (e.g., 'SA')
 * @returns {boolean} - True if valid carrier prefix
 */
export function validateCarrierPrefix(nationalNumber, countryCode) {
  if (!nationalNumber || !countryCode) return false;
  
  const prefixes = carrierPrefixes[countryCode];
  if (!prefixes) return false;
  
  // Check if the number starts with any valid carrier prefix
  return prefixes.some(prefix => nationalNumber.startsWith(prefix));
}

/**
 * Get carrier name from prefix (basic implementation)
 * @param {string} nationalNumber - National phone number
 * @param {string} countryCode - Country code
 * @returns {string} - Carrier name or 'Unknown'
 */
export function getCarrierName(nationalNumber, countryCode) {
  if (!validateCarrierPrefix(nationalNumber, countryCode)) {
    return 'Invalid';
  }
  
  // Basic carrier mapping (can be expanded)
  const carrierMappings = {
    'SA': {
      '50': 'STC',
      '53': 'STC',
      '54': 'Mobily',
      '55': 'Mobily',
      '56': 'Zain',
      '57': 'Zain',
      '58': 'STC',
      '59': 'Mobily'
    },
    'AE': {
      '50': 'Etisalat',
      '52': 'du',
      '54': 'Etisalat',
      '55': 'du',
      '56': 'Etisalat',
      '58': 'du'
    }
    // Add more countries as needed
  };
  
  const mappings = carrierMappings[countryCode];
  if (!mappings) return 'Valid';
  
  for (const [prefix, carrier] of Object.entries(mappings)) {
    if (nationalNumber.startsWith(prefix)) {
      return carrier;
    }
  }
  
  return 'Valid';
}
