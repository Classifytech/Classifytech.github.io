import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBlurPlaceholderSvgDataUrl,
  getBlurPaletteForCategory,
} from './blurPlaceholder.ts';

test('getBlurPaletteForCategory maps known categories case-insensitively and falls back to ALL', () => {
  const china = getBlurPaletteForCategory('china');
  assert.equal(china.glow, '#ff2a85');

  const gaming = getBlurPaletteForCategory('GAMING');
  assert.equal(gaming.glow, '#a855f7');

  const fallback = getBlurPaletteForCategory('UNKNOWN_CATEGORY');
  const all = getBlurPaletteForCategory('ALL');
  assert.deepEqual(fallback, all);
});

test('buildBlurPlaceholderSvgDataUrl produces a valid inline SVG data URI containing palette stops', () => {
  const uri = buildBlurPlaceholderSvgDataUrl('CHIPSET');
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
  const decoded = decodeURIComponent(uri.replace('data:image/svg+xml;charset=utf-8,', ''));
  assert.ok(decoded.includes('<svg'));
  assert.ok(decoded.includes('#00f2fe'));
  assert.ok(decoded.includes('</svg>'));
});
