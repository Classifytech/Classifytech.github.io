export interface BlurPalette {
  start: string;
  mid: string;
  end: string;
  glow: string;
}

const CATEGORY_PALETTES: Record<string, BlurPalette> = {
  CHIPSET: { start: '#071324', mid: '#0e2a47', end: '#181436', glow: '#00f2fe' },
  CHINA: { start: '#1a0b1e', mid: '#2f1138', end: '#0f172a', glow: '#ff2a85' },
  GLOBAL: { start: '#081826', mid: '#0f2d46', end: '#13203b', glow: '#38bdf8' },
  INDIA: { start: '#0a1c20', mid: '#11333b', end: '#192238', glow: '#10b981' },
  GAMING: { start: '#140c29', mid: '#27144d', end: '#0b1426', glow: '#a855f7' },
  BATTERY: { start: '#071c1b', mid: '#0e3631', end: '#111827', glow: '#00e676' },
  CAMERA: { start: '#161124', mid: '#261c3d', end: '#0c1322', glow: '#f43f5e' },
  '5G': { start: '#071729', mid: '#0d2b4d', end: '#161b33', glow: '#22d3ee' },
  ALL: { start: '#091322', mid: '#12243d', end: '#171733', glow: '#00f2fe' },
};

export function getBlurPaletteForCategory(category?: string): BlurPalette {
  const key = (category || 'ALL').trim().toUpperCase();
  return CATEGORY_PALETTES[key] || CATEGORY_PALETTES.ALL;
}

/**
 * Builds an ultra-lightweight inline SVG blurred gradient data URI (LQIP)
 * tailored to the category palette so thumbnail containers render instantly
 * with zero extra network requests prior to lazy image completion.
 */
export function buildBlurPlaceholderSvgDataUrl(category?: string): string {
  const palette = getBlurPaletteForCategory(category);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 36" preserveAspectRatio="none">',
    '<defs>',
    `<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" stop-color="${palette.start}"/>`,
    `<stop offset="52%" stop-color="${palette.mid}"/>`,
    `<stop offset="100%" stop-color="${palette.end}"/>`,
    '</linearGradient>',
    `<radialGradient id="r" cx="68%" cy="34%" r="60%">`,
    `<stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.42"/>`,
    `<stop offset="100%" stop-color="${palette.end}" stop-opacity="0"/>`,
    '</radialGradient>',
    '</defs>',
    '<rect width="64" height="36" fill="url(#g)"/>',
    '<rect width="64" height="36" fill="url(#r)"/>',
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
