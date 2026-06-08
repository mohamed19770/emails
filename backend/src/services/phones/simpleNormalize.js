/**
 * Simple phone number normalization without complex validation
 */

// Country code mappings
const COUNTRY_CODES = {
  'SA': '+966', 'AE': '+971', 'QA': '+974', 'KW': '+965',
  'BH': '+973', 'OM': '+968', 'EG': '+20', 'JO': '+962',
  'LB': '+961', 'IQ': '+964'
};

/**
 * Simple phone number extraction and normalization
 */
export function simpleNormalizePhone(rawPhone, url, countries = [], pageContent = '') {
  try {
    // Extract digits only
    const digits = rawPhone.replace(/\D/g, '');
    
    if (!digits || digits.length < 7) {
      return null;
    }
    
    // Determine country (default to Saudi Arabia)
    let countryCode = 'SA';
    if (countries && countries.length > 0) {
      if (countries.includes('Saudi Arabia')) countryCode = 'SA';
      else if (countries.includes('United Arab Emirates')) countryCode = 'AE';
      else if (countries.includes('Qatar')) countryCode = 'QA';
      else if (countries.includes('Kuwait')) countryCode = 'KW';
      else if (countries.includes('Bahrain')) countryCode = 'BH';
      else if (countries.includes('Oman')) countryCode = 'OM';
      else if (countries.includes('Egypt')) countryCode = 'EG';
      else if (countries.includes('Jordan')) countryCode = 'JO';
      else if (countries.includes('Lebanon')) countryCode = 'LB';
      else if (countries.includes('Iraq')) countryCode = 'IQ';
    }
    
    const callingCode = COUNTRY_CODES[countryCode];
    if (!callingCode) {
      return null;
    }
    
    const countryDigits = callingCode.replace('+', '');
    let nationalNumber = '';
    let e164 = '';
    
    // Handle different formats
    if (digits.startsWith(countryDigits)) {
      // Already has country code
      nationalNumber = digits.substring(countryDigits.length);
      e164 = `+${digits}`;
    } else if (digits.startsWith('0')) {
      // National format starting with 0
      nationalNumber = digits.substring(1);
      e164 = `+${countryDigits}${nationalNumber}`;
    } else {
      // Just national number
      nationalNumber = digits;
      e164 = `+${countryDigits}${nationalNumber}`;
    }
    
    // Determine type based on first digit
    let type = 'unknown';
    if (nationalNumber.startsWith('5')) {
      type = 'mobile';
    } else if (nationalNumber.startsWith('1') || nationalNumber.startsWith('2') || nationalNumber.startsWith('3') || nationalNumber.startsWith('4')) {
      type = 'landline';
    }
    
    return {
      e164,
      local: nationalNumber.startsWith('0') ? nationalNumber : `0${nationalNumber}`,
      country: countryCode,
      type,
      original: rawPhone.trim(),
      confidence: 'high',
      valid: true
    };
    
  } catch (error) {
    console.error('Error normalizing phone:', error);
    return null;
  }
}

/**
 * Extract WhatsApp number from URL
 */
export function extractWhatsAppFromUrl(url, sourceUrl, countries = [], pageContent = '') {
  try {
    // Extract number from wa.me URL
    const waMatch = url.match(/wa\.me\/(\d+)/);
    if (waMatch) {
      const number = waMatch[1];
      const normalized = simpleNormalizePhone(number, sourceUrl, countries, pageContent);
      
      if (normalized) {
        return {
          ...normalized,
          kind: 'whatsapp',
          confidence: 'high',
          original: url
        };
      }
    }
    
    // Extract number from api.whatsapp.com URL
    const apiMatch = url.match(/api\.whatsapp\.com\/send\?phone=(\d+)/);
    if (apiMatch) {
      const number = apiMatch[1];
      const normalized = simpleNormalizePhone(number, sourceUrl, countries, pageContent);
      
      if (normalized) {
        return {
          ...normalized,
          kind: 'whatsapp',
          confidence: 'high',
          original: url
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting WhatsApp:', error);
    return null;
  }
}
