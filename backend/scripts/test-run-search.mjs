import { runRecruitmentPhoneSearch } from '../src/services/recruitment/runSearch.js';

const runId = 'test_run';
const activeRuns = new Map();

activeRuns.set(runId, {
  runId,
  status: 'running',
  results: {
    phones: [],
    whatsapp: [],
    companies: new Set(),
    domains: new Set(),
    pagesVisited: 0,
    errors: 0,
    backoffs: 0
  },
  res: null
});

await runRecruitmentPhoneSearch({
  runId,
  country: 'Saudi Arabia',
  recruitmentOnly: true,
  carrierAware: true,
  keywords: ['construction', 'building', 'engineering', 'contractor'],
  maxPages: 1,
  engines: ['bing'],
  phones: { perDomainCaps: { phones: 10, whatsapp: 10 } },
  activeRuns
});

const run = activeRuns.get(runId);
console.log('Status:', run.status);
console.log('Phones:', run.results.phones.length);
console.log('WhatsApp:', run.results.whatsapp.length);
console.log('Pages:', run.results.pagesVisited);
console.log('Errors:', run.results.errors);
run.results.phones.slice(0, 10).forEach(p => {
  console.log(`  ${p.e164} - ${p.companyName || 'unknown'} (${p.sourceUrl || ''})`);
});
