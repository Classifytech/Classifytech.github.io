import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanHtmlText,
  formatSourceCredit,
  extractImageUrl,
  inferCategory,
  formatPubDate,
  transformRssItemToArticle,
  FREE_TECH_RSS_FEEDS,
  AUTO_REFRESH_INTERVAL_MS,
  MAX_SLIDING_WINDOW_ARTICLES,
  enforceRollingNewsWindow,
  type Rss2JsonItem,
} from './rssParser.ts';

test('cleanHtmlText removes tags, unwraps CDATA, and decodes HTML entities', () => {
  const dirty = '<p>Snapdragon 8 Elite is &quot;super fast&quot; &amp; efficient.&nbsp;</p>';
  const clean = cleanHtmlText(dirty);
  assert.equal(clean, 'Snapdragon 8 Elite is "super fast" & efficient.');

  const dirtyEntities = 'It&#8217;s a &#8220;breakthrough&#8221; with AI&#8230;';
  assert.equal(cleanHtmlText(dirtyEntities), 'It’s a “breakthrough” with AI…');

  const cdata = '<![CDATA[<h1>Exclusive Scoop: Xiaomi 15 Pro</h1>]]>';
  assert.equal(cleanHtmlText(cdata), 'Exclusive Scoop: Xiaomi 15 Pro');
});

test('formatSourceCredit cleans GSMArena and other outlet credits', () => {
  assert.equal(formatSourceCredit('GSMArena.com - Latest articles', 'https://www.gsmarena.com/news'), 'GSMArena');
  assert.equal(formatSourceCredit('Android Authority', 'https://www.androidauthority.com'), 'Android Authority');
  assert.equal(formatSourceCredit('Gadgets 360', 'https://gadgets360.com'), 'Gadgets 360');
  assert.equal(formatSourceCredit('9to5Google', 'https://9to5google.com'), '9to5Google');
  assert.equal(formatSourceCredit('The Verge', 'https://www.theverge.com'), 'The Verge');
});

test('extractImageUrl prioritizes thumbnail and enclosure and upgrades GSMArena thumbnails', () => {
  const itemWithThumb: Rss2JsonItem = {
    title: 'Test',
    pubDate: '',
    link: 'https://example.com',
    thumbnail: 'https://images.example.com/thumb.jpg',
  };
  assert.equal(extractImageUrl(itemWithThumb), 'https://images.example.com/thumb.jpg');

  const gsmThumb: Rss2JsonItem = {
    title: 'Test GSM',
    pubDate: '',
    link: 'https://gsmarena.com',
    thumbnail: 'https://fdn.gsmarena.com/imgroot/news/26/10/article/-184x111/gsmarena_000.jpg',
  };
  assert.equal(extractImageUrl(gsmThumb), 'https://fdn.gsmarena.com/imgroot/news/26/10/article/gsmarena_000.jpg');

  const itemWithImgTag: Rss2JsonItem = {
    title: 'Test',
    pubDate: '',
    link: 'https://example.com',
    description: '<p>Some text <img src="https://images.example.com/inline.png" alt="img" /></p>',
  };
  assert.equal(extractImageUrl(itemWithImgTag), 'https://images.example.com/inline.png');
});

test('inferCategory accurately tags chipsets, AI, India launches, gaming, and 5G', () => {
  const chip = inferCategory('Qualcomm announces Snapdragon 8s Gen 3', 'new 4nm processor');
  assert.equal(chip.category, 'CHIPSET');

  const aiArticle = inferCategory('OpenAI and Google Gemini announce new autonomous coding agents', 'latest artificial intelligence models');
  assert.equal(aiArticle.category, 'CHIPSET');
  assert.equal(aiArticle.badge, 'CHIPSET & AI');

  const india = inferCategory('POCO F6 5G launches in India with aggressive pricing', 'Xiaomi India release');
  assert.equal(india.category, 'INDIA');

  const gaming = inferCategory('BGMI receives 120FPS ultra extreme update', 'game performance');
  assert.equal(gaming.category, 'GAMING');

  const battery = inferCategory('OnePlus introduces 150W fast charging tech with 6500mAh silicon battery', 'high capacity battery');
  assert.equal(battery.category, 'BATTERY');
  assert.equal(battery.badge, 'BATTERY TECH');

  const net = inferCategory('New 5G spectrum auction details revealed', 'telecom band n78');
  assert.equal(net.category, '5G');

  const china = inferCategory('Xiaomi 15 Pro debuts in China with 6100mAh battery', 'China exclusive Leica flagship');
  assert.equal(china.category, 'CHINA');
  assert.equal(china.badge, 'CHINA EXCLUSIVE');

  const huawei = inferCategory('Huawei Mate 70 Pro+ ships with HarmonyOS NEXT', 'Kirin 9020 domestic silicon');
  assert.equal(huawei.category, 'CHINA');

  const globalNews = inferCategory('Oppo Find X8 Pro global launch expands worldwide', 'International release confirmed');
  assert.equal(globalNews.category, 'GLOBAL');
  assert.equal(globalNews.badge, 'GLOBAL LAUNCH');
});

test('transformRssItemToArticle structures full article with polished source citation and safe url', () => {
  const rawItem: Rss2JsonItem = {
    title: '<b>Dimensity 9400</b> Benchmarks Revealed',
    pubDate: '2026-10-15 10:00:00',
    link: 'https://www.gsmarena.com/test-article.php',
    description: '<p>The Dimensity 9400 chip scored 2.8 million on AnTuTu. It features an advanced All-Big-Core CPU design.</p>',
    thumbnail: 'https://fdn.gsmarena.com/imgroot/news/test.jpg',
  };

  const article = transformRssItemToArticle(rawItem, 'GSMArena.com - Latest articles');
  assert.equal(article.title, 'Dimensity 9400 Benchmarks Revealed');
  assert.equal(article.category, 'CHIPSET');
  assert.equal(article.sourceName, 'GSMArena');
  assert.equal(article.sourceUrl, 'https://www.gsmarena.com/test-article.php');
  assert.ok(article.bullets?.[0]?.includes('GSMArena'));
});

test('FREE_TECH_RSS_FEEDS contains 5 diverse sources', () => {
  assert.equal(FREE_TECH_RSS_FEEDS.length, 5);
});

test('AUTO_REFRESH_INTERVAL_MS equals exactly 15 minutes', () => {
  assert.equal(AUTO_REFRESH_INTERVAL_MS, 15 * 60 * 1000);
});

test('transformRssItemToArticle cleans snippet artifacts and retains full paragraphs without truncation', () => {
  const item: Rss2JsonItem = {
    title: 'Samsung Galaxy S25 Launch',
    pubDate: '2026-10-17 12:00:00',
    link: 'https://www.theverge.com/s25',
    content: '<p>The Galaxy S25 is powered by Snapdragon 8 Elite.</p><p>It features full satellite connectivity and 7 years of Android OS updates.</p>[&#8230;] The post appeared first on The Verge.',
    description: 'Samsung has officially announced the Galaxy S25 lineup with Snapdragon 8 Elite globally.',
  };

  const article = transformRssItemToArticle(item, 'The Verge');
  assert.equal(article.title, 'Samsung Galaxy S25 Launch');
  assert.ok(article.fullBody.length >= 2, 'Should preserve all distinct paragraphs');
  assert.ok(!article.fullBody.some(p => p.includes('[&#8230;]')), 'Artifacts should be stripped');
  assert.ok(!article.fullBody.some(p => p.includes('The post appeared first on')), 'Feed signature should be stripped');
  assert.ok(!article.desc.endsWith('...'), 'Summary description should not be abruptly cut with ellipses');
});

test('fetchGlobalTrendingNews aggregates trending news or falls back cleanly to curated 12-hour global stories', async () => {
  const { fetchGlobalTrendingNews } = await import('./rssParser.ts');
  const failingFetch = (async () => new Response('', { status: 503 })) as typeof fetch;
  const fallbackRes = await fetchGlobalTrendingNews({ fetchFn: failingFetch });
  assert.equal(fallbackRes.source, 'curated-fallback');
  assert.ok(fallbackRes.articles.length >= 10);
  assert.ok(fallbackRes.articles.every((a) => Boolean(a.title && a.desc)));
});

test('Smartprix RSS feed is configured and fetchFeedWithCorsFallback falls back to AllOrigins XML proxy', async () => {
  const {
    SMARTPRIX_RSS_FEED_URL,
    GSMARENA_RSS_FEED_URL,
    CLASSIFY_YOUTUBE_RSS_URL,
    fetchFeedWithCorsFallback,
    parseRawXmlToRssItems,
  } = await import('./rssParser.ts');

  assert.equal(SMARTPRIX_RSS_FEED_URL, 'https://www.smartprix.com/bytes/feed/');
  assert.equal(GSMARENA_RSS_FEED_URL, 'https://www.gsmarena.com/rss-news-reviews.php3');
  assert.ok(CLASSIFY_YOUTUBE_RSS_URL.includes('UCp0jHiCTqxDYZ0Bi0sKUmbw'));
  assert.ok(FREE_TECH_RSS_FEEDS.some((f) => f.rssUrl === SMARTPRIX_RSS_FEED_URL));
  assert.equal(
    formatSourceCredit('Smartprix Bytes', 'https://www.smartprix.com/bytes/oneplus-13-vs-iqoo-13/'),
    'Smartprix'
  );

  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <item>
          <title><![CDATA[OnePlus 13 vs iQOO 13 Camera & Gaming Comparison]]></title>
          <link>https://www.smartprix.com/bytes/oneplus-13-vs-iqoo-13/</link>
          <pubDate>Sun, 15 Nov 2026 12:00:00 GMT</pubDate>
          <description><![CDATA[<p>Detailed Snapdragon 8 Elite flagship comparison between OnePlus 13 and iQOO 13 in India.</p>]]></description>
        </item>
      </channel>
    </rss>`;

  const parsedXml = parseRawXmlToRssItems(sampleXml);
  assert.equal(parsedXml.length, 1);
  assert.equal(parsedXml[0].title, 'OnePlus 13 vs iQOO 13 Camera & Gaming Comparison');

  const mockCorsFallbackFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('api.rss2json.com')) {
      return new Response('', { status: 500 });
    }
    if (url.includes('api.allorigins.win')) {
      return new Response(JSON.stringify({ contents: sampleXml }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  const articles = await fetchFeedWithCorsFallback(
    { name: 'Smartprix', rssUrl: SMARTPRIX_RSS_FEED_URL },
    mockCorsFallbackFetch,
    4
  );
  assert.equal(articles.length, 1);
  assert.equal(articles[0].sourceName, 'Smartprix');
  assert.equal(articles[0].sourceUrl, 'https://www.smartprix.com/bytes/oneplus-13-vs-iqoo-13/');
  assert.ok(typeof articles[0].publishedAtMs === 'number' && articles[0].publishedAtMs > 0);
});

test('fetchGlobalTrendingNews ranks live RSS stories above static fallback stories and dynamically promotes #1 newest live article as Hero', async () => {
  const { fetchGlobalTrendingNews } = await import('./rssParser.ts');
  const nowIso = new Date().toUTCString();
  const sampleLiveXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <item>
          <title><![CDATA[Breaking Today: Galaxy S25 Slim & Snapdragon 8 Elite 2 Benchmarks Leak]]></title>
          <link>https://www.gsmarena.com/breaking-live-story.php</link>
          <pubDate>${nowIso}</pubDate>
          <description><![CDATA[<p>Fresh live RSS story published today with real timestamp.</p>]]></description>
        </item>
      </channel>
    </rss>`;

  const mockLiveFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/news/rss')) {
      return new Response('', { status: 500 });
    }
    if (url.includes('api.rss2json.com')) {
      return new Response('', { status: 500 });
    }
    if (url.includes('api.allorigins.win')) {
      return new Response(JSON.stringify({ contents: sampleLiveXml }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  const res = await fetchGlobalTrendingNews({ fetchFn: mockLiveFetch });
  assert.equal(res.source, 'rss-syndication');
  assert.equal(
    res.articles[0].title,
    'Breaking Today: Galaxy S25 Slim & Snapdragon 8 Elite 2 Benchmarks Leak'
  );
  assert.equal(res.articles[0].isHero, true);
  assert.ok(res.articles.slice(1).every((a) => !a.isHero));
});

test('cleanHtmlText and transformRssItemToArticle strip broken WordPress data-medium-file attributes while extracting high-res image first and avoiding duplicate title prefix in desc', () => {
  const wpItem: Rss2JsonItem = {
    title: 'iQOO 13 Launching With 6,150mAh Silicon-Carbon Battery',
    pubDate: new Date().toUTCString(),
    link: 'https://www.smartprix.com/bytes/iqoo-13-launch/',
    description:
      '<p>iQOO 13 Launching With 6,150mAh Silicon-Carbon Battery: <img src="https://i0.wp.com/www.smartprix.com/bytes/wp-content/uploads/2026/11/SCR-20261117-mnzr.jpeg?fit=300%2C180&amp;ssl=1" data-medium-file="https://i0.wp.com/www.smartprix.com/bytes/wp-content/uploads/2026/11/SCR-20261117-mnzr.jpeg?fit=300%2C180&amp;ssl=1" data-large-file="https://i0.wp.com/www.smartprix.com/bytes/wp-content/uploads/2026/11/SCR-20261117-mnzr.jpeg?fit=1024%2C614&amp;ssl=1" /> The upcoming iQOO 13 pairs Qualcomm Snapdragon 8 Elite silicon with a 144Hz 2K Q10 LTPO OLED panel and 120W FlashCharge.</p>',
  };

  const article = transformRssItemToArticle(wpItem, 'Smartprix Bytes');
  assert.ok(article.img.includes('SCR-20261117-mnzr.jpeg'), 'High-res image should be extracted before stripping tags');
  assert.ok(article.img.includes('w=1200'), 'WordPress fit query param should be upgraded to w=1200');
  assert.ok(!article.desc.includes('data-medium-file'), 'data-medium-file must be 100% removed from desc');
  assert.ok(!article.desc.includes('data-large-file'), 'data-large-file must be 100% removed from desc');
  assert.ok(!article.desc.startsWith(article.title), 'desc must not start with duplicate headline prefix');
  assert.equal(article.category, 'BATTERY');
});

test('enforceRollingNewsWindow strictly sorts newest-first, deduplicates, promotes only index 0 as Hero, evicts static fallbacks, and hard-caps at 100 articles', () => {
  assert.equal(MAX_SLIDING_WINDOW_ARTICLES, 100);

  const baseTime = Date.UTC(2026, 10, 20, 12, 0, 0);
  const makeArticle = (idx: number, publishedAtMs: number, overrides: Partial<ReturnType<typeof transformRssItemToArticle>> = {}) => ({
    ...transformRssItemToArticle(
      {
        title: `Tech Story #${idx}`,
        pubDate: new Date(publishedAtMs).toUTCString(),
        link: `https://example.com/story-${idx}`,
        description: `Summary for story ${idx}.`,
      },
      'GSMArena'
    ),
    id: `story-${idx}`,
    publishedAtMs,
    ...overrides,
  });

  // Existing 95 older articles + 2 static fallback IDs
  const existing = [
    ...Array.from({ length: 95 }, (_, i) => makeArticle(i + 1, baseTime - (i + 20) * 60_000, { isHero: i === 0 })),
    makeArticle(999, baseTime - 500 * 60_000, { id: 'static-fallback-1' }),
    makeArticle(1000, baseTime - 501 * 60_000, { id: 'static-fallback-2' }),
  ];

  // Incoming 20 newer articles (including 1 duplicate of an existing story and out-of-order timestamps)
  const incoming = [
    makeArticle(105, baseTime + 5 * 60_000),
    makeArticle(120, baseTime + 20 * 60_000), // newest overall
    ...Array.from({ length: 18 }, (_, i) => makeArticle(200 + i, baseTime + (i + 1) * 60_000)),
    makeArticle(1, baseTime - 20 * 60_000), // duplicate of story-1
  ];

  const windowed = enforceRollingNewsWindow(
    incoming,
    existing,
    MAX_SLIDING_WINDOW_ARTICLES,
    new Set(['static-fallback-1', 'static-fallback-2'])
  );

  // Hard cap at 100 articles
  assert.equal(windowed.length, 100);

  // Strictly sorted newest-first
  for (let i = 1; i < windowed.length; i += 1) {
    assert.ok(
      (windowed[i - 1].publishedAtMs ?? 0) >= (windowed[i].publishedAtMs ?? 0),
      `Expected item ${i - 1} to be newer than or equal to item ${i}`
    );
  }

  // Only index 0 is Hero and it is the absolute newest incoming article
  assert.equal(windowed[0].id, 'story-120');
  assert.equal(windowed[0].isHero, true);
  assert.ok(windowed.slice(1).every((a) => !a.isHero), 'Only index 0 should have isHero=true');

  // Static fallback items evicted when live articles exist
  assert.equal(windowed.some((a) => a.id === 'static-fallback-1' || a.id === 'static-fallback-2'), false);

  // Deduplicated: no duplicate IDs and oldest articles beyond top 100 dropped
  const uniqueIds = new Set(windowed.map((a) => a.id));
  assert.equal(uniqueIds.size, 100);
  assert.equal(uniqueIds.has('story-95'), false, 'Oldest article past 100 cap must be evicted');
});
