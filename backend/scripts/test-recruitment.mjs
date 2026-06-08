import { runBingSearch } from '../src/services/recruitment/engines/bing.js';
import { extractRecruitmentPhones } from '../src/services/phones/recruitmentExtract.js';

const urls = [
  'https://www.fmcksa.com/',
  'https://www.se.com.sa/',
  'https://www.nwc.com.sa/',
  'https://lifeinsaudiarabia.net/top-25-construction-companies-of-saudi/'
];

let phones = 0;
for (const url of urls) {
  const r = { url };
  try {
    const res = await fetch(r.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
      signal: AbortSignal.timeout(15000)
    });
    const html = await res.text();
    const extracted = extractRecruitmentPhones(html, r.url, {
      country: 'Saudi Arabia',
      recruitmentOnly: true,
      carrierAware: true
    });
    console.log(`\n${r.url}`);
    console.log(`  phones: ${extracted.phones.length}, whatsapp: ${extracted.whatsapp.length}`);
    extracted.phones.slice(0, 3).forEach(p => console.log(`   phone: ${p.e164}`));
    if (extracted.trace.find(t => t.scope === 'recruitment-filter')) {
      console.log('  SKIPPED: not recruitment page');
    }
    phones += extracted.phones.length + extracted.whatsapp.length;
  } catch (e) {
    console.log(`\n${r.url} - ERROR: ${e.message}`);
  }
}

console.log('\nTotal phones from first 5 pages:', phones);
