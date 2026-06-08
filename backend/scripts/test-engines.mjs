import { runDuckDuckGo } from '../src/services/recruitment/engines/ddg.js';
import { runBingSearch } from '../src/services/recruitment/engines/bing.js';

const q = 'construction recruitment careers jobs whatsapp contact Saudi Arabia';

try {
  const ddg = await runDuckDuckGo({ query: q }, 1);
  console.log('DDG results:', ddg.length);
  ddg.slice(0, 3).forEach(r => console.log(' -', r.url));
} catch (e) {
  console.log('DDG error:', e.message);
}

try {
  const bing = await runBingSearch({ query: q }, 1);
  console.log('Bing results:', bing.length);
  bing.slice(0, 3).forEach(r => console.log(' -', r.url));
} catch (e) {
  console.log('Bing error:', e.message);
}
