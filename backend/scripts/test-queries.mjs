import { runBingSearch } from '../src/services/recruitment/engines/bing.js';

const queries = [
  'construction careers jobs recruitment hiring contact whatsapp HR Saudi Arabia KSA site:.sa',
  'construction company careers contact Saudi Arabia',
  'Saudi construction company recruitment contact phone',
  'شركة مقاولات وظائف توظيف السعودية',
  'construction careers "Saudi Arabia" contact phone'
];

for (const query of queries) {
  const r = await runBingSearch({ query }, 1);
  console.log(`\n[${r.length}] ${query}`);
  r.slice(0, 3).forEach(x => console.log('  ', x.url));
}
