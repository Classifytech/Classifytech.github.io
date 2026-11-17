import test from 'node:test';
import assert from 'node:assert/strict';
import {
  synthesizeWithDeterministicFallback,
  getCachedSynthesis,
  setCachedSynthesis,
  getAvailableGeminiKeys,
  SYNTHESIS_MODEL,
  CACHE_TTL_MS,
  type SynthesizedArticleResult,
} from './aiSynthesizer.ts';

test('SYNTHESIS_MODEL is set to gemini-2.5-flash and cache TTL is 6 hours', () => {
  assert.equal(SYNTHESIS_MODEL, 'gemini-2.5-flash');
  assert.equal(CACHE_TTL_MS, 6 * 60 * 60 * 1000);
  assert.ok(Array.isArray(getAvailableGeminiKeys()));
});

test('AI Synthesizer Fallback formats structured paragraphs, bullets and source attribution without duplicate headline prefix', () => {
  const result = synthesizeWithDeterministicFallback(
    'Qualcomm Reveals Snapdragon 8 Elite Architecture',
    'Qualcomm announced its custom Oryon CPU cores at the annual summit. The Adreno 830 GPU achieves 40% higher rendering throughput. Early OEM flagships will launch in India and international markets.',
    'GSMArena',
    'https://www.gsmarena.com/snapdragon_8_elite_launch.php'
  );

  assert.equal(result.headline, 'Qualcomm Reveals Snapdragon 8 Elite Architecture');
  assert.ok(result.leadSummary.length > 20);
  assert.ok(
    !result.leadSummary.startsWith('Qualcomm Reveals Snapdragon 8 Elite Architecture:'),
    'leadSummary must NEVER prepend duplicate headline prefix'
  );
  assert.equal(result.paragraphs.length, 4);
  assert.ok(result.paragraphs[0].includes('Qualcomm Reveals Snapdragon 8 Elite Architecture'));
  assert.ok(result.paragraphs[0].includes('GSMArena'));
  assert.ok(result.paragraphs[3].includes('CLASSIFY TECH'));
  assert.ok(result.bullets.length >= 3);
  assert.ok(result.sourceAttribution.includes('GSMArena'));
  assert.ok(result.sourceAttribution.includes('CLASSIFY TECH Desk'));
  assert.equal(result.isAiGenerated, false);
});

test('AI Synthesizer never injects camera/photography boilerplate into Face ID, software, or general smartphone news', () => {
  const result = synthesizeWithDeterministicFallback(
    'Apple iPhone 18 Pro Tipped to Feature Under-Display Face ID Sensor',
    'Supply chain reports indicate Apple is testing a sub-screen infrared Face ID receiver module. The new layout reduces the Dynamic Island cutout size significantly across Pro models.',
    'MacRumors',
    'https://www.macrumors.com/iphone-18-face-id'
  );

  const combinedText = [result.leadSummary, ...result.paragraphs, ...result.bullets].join(' ');
  assert.ok(
    !combinedText.includes('computational image signal processing, lens aperture performance'),
    'Must not inject unrelated photography boilerplate into Face ID news'
  );
  assert.ok(
    !result.leadSummary.startsWith(result.headline),
    'leadSummary must not duplicate the headline'
  );
});

test('AI Synthesizer strips broken WordPress data-medium-file and data-large-file attributes from content', () => {
  const dirtyWordPress = `<figure class="wp-block-image"><img src="https://www.smartprix.com/bytes/wp-content/uploads/2026/11/phone.jpeg" data-medium-file="https://i0.wp.com/www.smartprix.com/bytes/wp-content/uploads/2026/11/SCR-20261117-mnzr.jpeg?fit=300%2C180&ssl=1" data-large-file="https://i0.wp.com/www.smartprix.com/bytes/wp-content/uploads/2026/11/SCR-20261117-mnzr.jpeg?fit=1024%2C614&ssl=1" /></figure><p>OnePlus 13R launches with a 6,500mAh silicon-carbon battery and 100W SuperVOOC charging. The handset features a flat 1.5K LTPO AMOLED display.</p>`;

  const result = synthesizeWithDeterministicFallback(
    'OnePlus 13R Debuts With 6,500mAh Battery',
    dirtyWordPress,
    'Smartprix',
    'https://www.smartprix.com/bytes/oneplus-13r/'
  );

  const allText = [result.leadSummary, ...result.paragraphs, ...result.bullets].join(' ');
  assert.ok(!allText.includes('data-medium-file'));
  assert.ok(!allText.includes('data-large-file'));
  assert.ok(!allText.includes('SCR-20261117-mnzr.jpeg'));
  assert.ok(allText.includes('6,500mAh'));
});

test('AI Synthesizer in-memory cache stores and retrieves articles', () => {
  const testData: SynthesizedArticleResult = {
    headline: 'Cache Test Article',
    leadSummary: 'Cache lead summary',
    paragraphs: ['P1', 'P2', 'P3', 'P4'],
    bullets: ['B1', 'B2', 'B3'],
    sourceAttribution: 'Attribution',
    isAiGenerated: false,
  };

  setCachedSynthesis('test_article_key', testData);
  const retrieved = getCachedSynthesis('test_article_key');
  assert.ok(retrieved !== null);
  assert.equal(retrieved?.headline, 'Cache Test Article');
});

test('AI Synthesizer formats camera-specific analysis for genuine imaging announcements', () => {
  const result = synthesizeWithDeterministicFallback(
    'Sony LYTIA Unveils Next-Gen LYT-900 1-Inch Camera Sensor',
    'Sony announced its LYT-900 1-inch stacked CMOS camera sensor featuring 50MP resolution and 2-layer transistor pixels. The dual-conversion gain system improves high-dynamic range capture in low-light environments.',
    'Sony Semiconductor',
    'https://www.sony-semicon.com/lyt900.html'
  );

  assert.equal(result.headline, 'Sony LYTIA Unveils Next-Gen LYT-900 1-Inch Camera Sensor');
  assert.equal(result.paragraphs.length, 4);
  assert.ok(result.paragraphs[0].includes('Optical and camera hardware developments'));
  assert.ok(result.bullets.some((b) => b.includes('Camera System')));
});

test('AI Synthesizer returns concise summary without duplicate title prefix when source content is brief', () => {
  const result = synthesizeWithDeterministicFallback(
    'Firmware Update 1.0.4 Released',
    'A minor stability patch is rolling out to fix Bluetooth pairing issues.',
    'OEM Forum'
  );

  assert.equal(result.headline, 'Firmware Update 1.0.4 Released');
  assert.equal(result.paragraphs.length, 2);
  assert.ok(!result.leadSummary.startsWith('Firmware Update 1.0.4 Released:'));
  assert.ok(result.leadSummary.includes('Bluetooth pairing issues'));
  assert.ok(result.bullets.length >= 2);
});
