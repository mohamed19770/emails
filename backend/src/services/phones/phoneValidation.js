/**
 * Detect obviously fake / placeholder phone numbers
 */

const KNOWN_FAKE_NUMBERS = new Set([
  '966501234567',
  '966542345678',
  '966512345678',
  '966551234567',
  '966500000000',
  '966511111111',
  '966512345678',
  '501234567',
  '542345678',
  '512345678',
  '0501234567',
  '0542345678'
]);

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function nationalDigits(e164, local) {
  const d = digitsOnly(e164 || local);
  if (d.startsWith('966')) return d.slice(3);
  if (d.startsWith('0')) return d.slice(1);
  return d;
}

const COUNTRY_NATIONAL_LENGTH = {
  SA: { min: 9, max: 9 },
  AE: { min: 9, max: 9 },
  QA: { min: 8, max: 8 },
  KW: { min: 8, max: 8 },
  BH: { min: 8, max: 8 },
  OM: { min: 8, max: 8 }
};

export function isValidNationalLength(e164, countryCode = 'SA') {
  const full = digitsOnly(e164);
  const rules = COUNTRY_NATIONAL_LENGTH[countryCode];
  if (!rules) return true;

  const ccMap = { SA: '966', AE: '971', QA: '974', KW: '965', BH: '973', OM: '968' };
  const cc = ccMap[countryCode];
  if (!cc || !full.startsWith(cc)) return false;

  const national = full.slice(cc.length);
  return national.length >= rules.min && national.length <= rules.max;
}

export function isLikelyFakePhone(e164, local) {
  const full = digitsOnly(e164);
  const national = nationalDigits(e164, local);

  if (!national || national.length < 8) return true;

  if (full.startsWith('966') && full.length !== 12) return true;
  if (national.length > 10) return true;

  if (KNOWN_FAKE_NUMBERS.has(full) || KNOWN_FAKE_NUMBERS.has(national)) {
    return true;
  }

  // Sequential runs (e.g. 1234567, 2345678)
  if (/0123456|1234567|2345678|3456789|4567890/.test(national)) {
    return true;
  }

  // Same digit repeated 6+ times
  if (/(\d)\1{5,}/.test(national)) {
    return true;
  }

  // Placeholder patterns like 500000000, 511111111
  if (/^5[0-9]0{5,}$/.test(national) || /^5[0-9]1{5,}$/.test(national)) {
    return true;
  }

  return false;
}
