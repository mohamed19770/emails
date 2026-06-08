import * as cheerio from 'cheerio';

const TIMEOUT_MS = 15000;
const DELAY_MS = 600;

const EXCLUDED_DOMAINS = [
  'linkedin.com', 'bayt.com', 'gulftalent.com', 'indeed.com',
  'wuzzuf.net', 'jooble.org', 'glassdoor.com', 'monster.com'
];

export async function runDuckDuckGo(query, maxPages = 2) {
  const results = [];
  const searchQuery = typeof query === 'string' ? query : query.query;

  for (let page = 0; page < maxPages; page++) {
    const offset = page * 30;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}&s=${offset}`;

    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Referer': 'https://duckduckgo.com/'
      }
    });

    if (!response.ok) {
      throw new Error(`DDG HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $('.result, .web-result').each((_, element) => {
      const $result = $(element);
      const title = $result.find('.result__title a, .result__a').first().text().trim();
      let href = $result.find('.result__title a, .result__a').first().attr('href');
      const snippet = $result.find('.result__snippet, .result__body').text().trim();

      if (!title || !href) return;

      if (href.startsWith('//')) href = `https:${href}`;
      if (href.includes('uddg=')) {
        try {
          const u = new URL(href, 'https://duckduckgo.com');
          href = u.searchParams.get('uddg') || href;
        } catch { /* keep original */ }
      }

      try {
        const parsed = new URL(href);
        if (EXCLUDED_DOMAINS.some(d => parsed.hostname.includes(d))) return;

        results.push({
          title,
          url: parsed.href,
          snippet,
          engine: 'ddg'
        });
      } catch {
        // skip
      }
    });

    if (page < maxPages - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  return results;
}
