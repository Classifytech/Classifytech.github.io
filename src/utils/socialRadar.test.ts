import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSocialRadarItems,
  OFFICIAL_SOCIAL_EMBEDS,
} from './socialRadar.ts';

test('OFFICIAL_SOCIAL_EMBEDS covers X, Instagram, and Facebook handles cleanly', () => {
  const ids = OFFICIAL_SOCIAL_EMBEDS.map((e) => e.id);
  assert.deepEqual(ids, ['x', 'instagram', 'facebook']);
  assert.ok(OFFICIAL_SOCIAL_EMBEDS[0].url.includes('x.com/classifytechz'));
  assert.ok(OFFICIAL_SOCIAL_EMBEDS[1].url.includes('instagram.com/classifytechz'));
  assert.ok(OFFICIAL_SOCIAL_EMBEDS[2].url.includes('facebook.com/classifytechz'));
});

test('normalizeSocialRadarItems cleans hashtags and skips malformed items', () => {
  const items = normalizeSocialRadarItems([
    {
      id: 'trend-1',
      platform: 'X & Reddit',
      topic: 'Silicon-Carbon Batteries',
      headline: '7000mAh Flagship Era',
      summary: 'Creators on r/Android and X highlight slimmer phones breaking two-day battery life.',
      hashtags: ['SiliconCarbon', '#AndroidFlagships'],
      heatLabel: 'High Velocity',
    },
    {
      headline: '',
      summary: 'Invalid empty item',
    },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'trend-1');
  assert.deepEqual(items[0].hashtags, ['#SiliconCarbon', '#AndroidFlagships']);
});

test('LATEST_TECH_LEAKS_TWEETS includes Ice Universe and Evan Blass and renderTweetEmbedCard formats official X embed metadata', async () => {
  const { LATEST_TECH_LEAKS_TWEETS, renderTweetEmbedCard, fetchTrendingTechTweets } = await import('./socialRadar.ts');
  assert.ok(LATEST_TECH_LEAKS_TWEETS.length >= 6);

  const tipsterNames = LATEST_TECH_LEAKS_TWEETS.map((t) => t.tipsterName);
  assert.ok(tipsterNames.includes('Ice Universe'));
  assert.ok(tipsterNames.includes('Evan Blass'));
  assert.ok(tipsterNames.includes('Ming-Chi Kuo'));

  const iceTweet = LATEST_TECH_LEAKS_TWEETS.find((t) => t.tipsterName === 'Ice Universe')!;
  const formatted = renderTweetEmbedCard(iceTweet);
  assert.equal(formatted.authorLabel, 'Ice Universe');
  assert.equal(formatted.handle, '@UniverseIce');
  assert.equal(formatted.embedClassName, 'twitter-tweet');
  assert.ok(formatted.officialTweetUrl.includes('x.com/UniverseIce'));
  assert.equal(formatted.ctaText, 'View @UniverseIce on X');

  const failingFetch = (async () => new Response('', { status: 503 })) as typeof fetch;
  const result = await fetchTrendingTechTweets({ fetchFn: failingFetch });
  assert.equal(result.source, 'curated-wire');
  assert.ok(result.embeds.length >= 6);
  assert.equal(result.embeds[0].embedClassName, 'twitter-tweet');
});

