import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildYouTubeRssXmlUrl,
  buildYouTubeRss2JsonUrl,
  extractYouTubeVideoId,
  mapRss2JsonItemsToVideos,
  fetchLatestYouTubeTechNews,
  fetchGlobalTechYouTubeVideos,
  DEFAULT_YOUTUBE_TECH_VIDEOS,
  techChannels,
  YOUTUBE_CHANNEL_ID,
  YOUTUBE_CHANNEL_URL,
} from './youtubeApi.ts';

test('YOUTUBE_CHANNEL_ID and techChannels mix global + Indian creators with CLASSIFY TECH at end', () => {
  assert.equal(YOUTUBE_CHANNEL_ID, 'UCp0jHiCTqxDYZ0Bi0sKUmbw');
  assert.equal(
    YOUTUBE_CHANNEL_URL,
    'https://www.youtube.com/channel/UCp0jHiCTqxDYZ0Bi0sKUmbw'
  );
  assert.ok(techChannels.length >= 6);
  assert.equal(techChannels[techChannels.length - 1], 'UCp0jHiCTqxDYZ0Bi0sKUmbw');
  assert.ok(techChannels.includes('UCBJycsmduvYEL83R_U4JriQ'));
  assert.ok(techChannels.includes('UCMiJRAwDNSNzuYeN2uWa0pA'));
  assert.ok(techChannels.includes('UCXUJJNoP1QupwsYIWFXmsZg'));
  assert.ok(techChannels.includes('UCEPL07qzVsOcHd3sMUws65g'));
});

test('buildYouTubeRss2JsonUrl encodes YouTube channel RSS XML URL properly', () => {
  const xmlUrl = buildYouTubeRssXmlUrl('UCp0jHiCTqxDYZ0Bi0sKUmbw');
  assert.equal(
    xmlUrl,
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCp0jHiCTqxDYZ0Bi0sKUmbw'
  );

  const rss2jsonUrl = buildYouTubeRss2JsonUrl('UCp0jHiCTqxDYZ0Bi0sKUmbw');
  const parsed = new URL(rss2jsonUrl);
  assert.equal(parsed.origin + parsed.pathname, 'https://api.rss2json.com/v1/api.json');
  assert.equal(parsed.searchParams.get('rss_url'), xmlUrl);
});

test('extractYouTubeVideoId and mapRss2JsonItemsToVideos parse YouTube RSS items accurately', () => {
  assert.equal(extractYouTubeVideoId('yt:video:abc123XYZ90'), 'abc123XYZ90');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=def456UVW12'), 'def456UVW12');

  const mapped = mapRss2JsonItemsToVideos([
    {
      title: 'Xiaomi 15 Ultra Camera Review',
      pubDate: '2026-11-12 10:00:00',
      link: 'https://www.youtube.com/watch?v=abc123XYZ90',
      guid: 'yt:video:abc123XYZ90',
      author: 'CLASSIFY TECH',
      description: '<p>Full 200MP periscope zoom & Leica Summilux test.</p>',
    },
    {
      title: '',
      link: 'https://www.youtube.com',
    },
  ]);

  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].id, 'abc123XYZ90');
  assert.equal(mapped[0].title, 'Xiaomi 15 Ultra Camera Review');
  assert.equal(mapped[0].thumbnail, 'https://i.ytimg.com/vi/abc123XYZ90/hqdefault.jpg');
  assert.equal(mapped[0].videoUrl, 'https://www.youtube.com/watch?v=abc123XYZ90');
  assert.equal(mapped[0].description, 'Full 200MP periscope zoom & Leica Summilux test.');
});

test('fetchLatestYouTubeTechNews falls back cleanly when rss2json request fails', async () => {
  const failingFetch = (async () => new Response('', { status: 503 })) as typeof fetch;
  const result = await fetchLatestYouTubeTechNews({ fetchFn: failingFetch });
  assert.equal(result.source, 'fallback');
  assert.deepEqual(result.videos, DEFAULT_YOUTUBE_TECH_VIDEOS);
});

test('fetchLatestYouTubeTechNews fetches live rss2json feed for UCp0jHiCTqxDYZ0Bi0sKUmbw', async () => {
  let capturedUrl = '';
  const mockFetch = (async (input: RequestInfo | URL) => {
    capturedUrl = String(input);
    return new Response(
      JSON.stringify({
        status: 'ok',
        feed: { title: 'CLASSIFY TECH' },
        items: [
          {
            title: 'Vivo X200 Pro Mini Unboxing & Battery Test',
            pubDate: '2026-11-12 08:30:00',
            link: 'https://www.youtube.com/watch?v=vid99988877',
            guid: 'yt:video:vid99988877',
            author: 'CLASSIFY TECH',
            description: '5700mAh BlueVolt compact flagship test.',
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  const result = await fetchLatestYouTubeTechNews({
    maxResults: 3,
    fetchFn: mockFetch,
  });

  assert.equal(result.source, 'youtube-rss');
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].id, 'vid99988877');
  assert.ok(capturedUrl.includes('api.rss2json.com'));
  assert.ok(capturedUrl.includes('UCp0jHiCTqxDYZ0Bi0sKUmbw'));
});

test('fetchGlobalTechYouTubeVideos loops over techChannels, prioritizes CLASSIFY TECH, and sorts newest first', async () => {
  const calledUrls: string[] = [];
  const mockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calledUrls.push(url);
    if (url.includes('UCp0jHiCTqxDYZ0Bi0sKUmbw')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          feed: { title: 'CLASSIFY TECH' },
          items: [
            {
              title: 'CLASSIFY TECH Flagship Camera Test',
              pubDate: '2026-11-10 08:00:00',
              link: 'https://www.youtube.com/watch?v=cls11111111',
              guid: 'yt:video:cls11111111',
              author: 'CLASSIFY TECH',
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.includes('UCBJycsmduvYEL83R_U4JriQ')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          feed: { title: 'Marques Brownlee' },
          items: [
            {
              title: 'Older MKBHD Review',
              pubDate: '2026-11-08 12:00:00',
              link: 'https://www.youtube.com/watch?v=mkb22222222',
              guid: 'yt:video:mkb22222222',
              author: 'Marques Brownlee',
            },
            {
              title: 'Newer MKBHD Review',
              pubDate: '2026-11-13 09:00:00',
              link: 'https://www.youtube.com/watch?v=mkb33333333',
              guid: 'yt:video:mkb33333333',
              author: 'Marques Brownlee',
            },
          ],
        }),
        { status: 200 }
      );
    }
    return new Response('', { status: 429 });
  }) as typeof fetch;

  const result = await fetchGlobalTechYouTubeVideos({
    channels: ['UCp0jHiCTqxDYZ0Bi0sKUmbw', 'UCBJycsmduvYEL83R_U4JriQ'],
    perChannelLimit: 2,
    fetchFn: mockFetch,
  });

  const rssCalls = calledUrls.filter((u) => u.includes('api.rss2json.com'));
  assert.equal(rssCalls.length, 2);
  assert.equal(result.source, 'youtube-rss');
  assert.equal(result.videos.length, 3);
  assert.equal(result.videos[0].id, 'mkb33333333'); // Chronological mix (Nov 13 newest)
  assert.equal(result.videos[1].id, 'cls11111111'); // CLASSIFY TECH blended naturally (Nov 10)
  assert.equal(result.videos[2].id, 'mkb22222222'); // Older MKBHD (Nov 8)
});

test('fetchGlobalTechYouTubeVideos falls back to /api/youtube/global when rss2json fails', async () => {
  const mockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('api.rss2json.com')) {
      return new Response('', { status: 429 });
    }
    if (url === '/api/youtube/global') {
      return new Response(
        JSON.stringify({
          success: true,
          videos: [
            {
              id: 'srv12345678',
              title: 'Server Aggregated Video',
              description: 'Via YouTube XML RSS proxy.',
              thumbnail: 'https://i.ytimg.com/vi/srv12345678/hqdefault.jpg',
              channelTitle: 'Dave2D',
              publishedAt: '2026-11-12T10:00:00Z',
              formattedDate: 'Nov 12, 2026',
              videoUrl: 'https://www.youtube.com/watch?v=srv12345678',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('', { status: 500 });
  }) as typeof fetch;

  const result = await fetchGlobalTechYouTubeVideos({
    channels: ['UCVYamHliCI9rw1tHR1xbkfw'],
    fetchFn: mockFetch,
  });

  assert.equal(result.source, 'server-rss');
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].id, 'srv12345678');
});

test('renderYouTubeNewsCard transforms video metadata into Fair-Use News Article summary with direct YouTube link', async () => {
  const { renderYouTubeNewsCard, fetchTrendingTechVideos } = await import('./youtubeApi.ts');
  const card = renderYouTubeNewsCard({
    id: 'yt-test-1',
    channelId: 'UCBJycsmduvYEL83R_U4JriQ',
    title: 'Samsung Galaxy S25 Ultra Review: Titanium & Snapdragon 8 Elite',
    description: 'Testing 200MP periscope optics, anti-reflective Gorilla Armor 2 display, and 45W thermal curves.',
    thumbnail: 'https://i.ytimg.com/vi/yt-test-1/hqdefault.jpg',
    channelTitle: 'Marques Brownlee',
    publishedAt: '2026-11-12T10:00:00Z',
    formattedDate: 'Nov 12, 2026',
    videoUrl: 'https://www.youtube.com/watch?v=yt-test-1',
    durationLabel: '15:20',
    category: 'FLAGSHIP',
  });

  assert.equal(card.ctaLabel, '📺 Watch Original Video');
  assert.equal(card.videoUrl, 'https://www.youtube.com/watch?v=yt-test-1');
  assert.ok(card.editorialSummary.startsWith('Marques Brownlee just reviewed Samsung Galaxy S25 Ultra.'));
  assert.ok(card.editorialSummary.includes('The standout feature is 200MP periscope optics'));
  assert.ok(card.editorialSummary.endsWith('Is it worth it?'));

  const failingFetch = (async () => new Response('', { status: 503 })) as typeof fetch;
  const trending = await fetchTrendingTechVideos({ fetchFn: failingFetch });
  assert.ok(trending.cards.length >= 6);
  assert.equal(trending.cards[0].ctaLabel, '📺 Watch Original Video');
});

