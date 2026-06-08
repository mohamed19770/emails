import * as cheerio from 'cheerio';

const TIMEOUT_MS = 15000;
const DELAY_MS = 800;

const EXCLUDED_DOMAINS = [
  'linkedin.com', 'bayt.com', 'gulftalent.com', 'indeed.com',
  'wuzzuf.net', 'jooble.org', 'glassdoor.com', 'monster.com',
  'facebook.com', 'twitter.com', 'youtube.com', 'instagram.com',
  'bing.com', 'microsoft.com'
];

function unwrapBingUrl(href) {
  if (!href) return null;

  try {
    const parsed = new URL(href, 'https://www.bing.com');
    if (parsed.hostname.includes('bing.com') && parsed.pathname.includes('/ck/')) {
      const encoded = parsed.searchParams.get('u');
      if (encoded && encoded.length > 2) {
        const decoded = Buffer.from(encoded.slice(2), 'base64').toString('utf8');
        if (decoded.startsWith('http')) return decoded;
      }
    }
    if (href.startsWith('http')) return href;
  } catch {
    // fall through
  }

  return href.startsWith('http') ? href : null;
}

export async function runBingSearch(query, maxPages = 2) {
  const results = [];
  const searchQuery = typeof query === 'string' ? query : query.query;

  for (let page = 0; page < maxPages; page++) {
    const first = page * 10 + 1;
    const url = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}&first=${first}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Bing HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $('li.b_algo').each((_, el) => {
      const title = $(el).find('h2 a').text().trim();
      const href = $(el).find('h2 a').attr('href');
      const snippet = $(el).find('.b_caption p, p').first().text().trim();

      if (!title || !href) return;

      const resolvedUrl = unwrapBingUrl(href);
      if (!resolvedUrl) return;

      try {
        const parsed = new URL(resolvedUrl);
        if (EXCLUDED_DOMAINS.some(d => parsed.hostname.includes(d))) return;

        results.push({
          title,
          url: parsed.href,
          snippet,
          engine: 'bing'
        });
      } catch {
        // skip invalid URLs
      }
    });

    if (page < maxPages - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  return results;
}
