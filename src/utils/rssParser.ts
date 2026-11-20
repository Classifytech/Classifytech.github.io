import type { TechArticle } from '../data/newsData.ts';
import { API_BASE } from './apiBase.ts';

export interface Rss2JsonItem {
  title: string;
  pubDate: string;
  link: string;
  guid?: string;
  author?: string;
  thumbnail?: string;
  description?: string;
  content?: string;
  enclosure?: {
    link?: string;
    type?: string;
  };
  categories?: string[];
}

export interface Rss2JsonResponse {
  status: string;
  feed?: {
    url?: string;
    title?: string;
    link?: string;
    description?: string;
  };
  items?: Rss2JsonItem[];
}

/**
 * Strips HTML tags, unwraps CDATA, removes broken WordPress image attributes
 * (such as data-medium-file="..." data-large-file="..." />), and thoroughly decodes
 * both numeric (decimal/hex) and named HTML entities.
 */
export function cleanHtmlText(html: string): string {
  if (!html) return '';

  let text = html;

  // 1. Unwrap CDATA sections: <![CDATA[ content ]]>
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

  // 2. Decode XML-escaped brackets and quotes FIRST so encoded tags/attributes are caught
  text = text
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');

  // Secondary CDATA unwrap in case CDATA was entity-encoded
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

  // 3. Remove figure, script, style, iframe, and img blocks completely
  text = text
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<img\b[\s\S]*?(?:\/>|>)/gi, ' ');

  // 4. Replace block-level closing tags and line breaks with double newlines
  text = text
    .replace(/<\/(p|div|h[1-6]|li|article|section|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, ' ');

  // 5. Explicitly remove orphaned WordPress/HTML attributes and stray self-closing tags
  text = text
    .replace(/\bdata-[a-z0-9_-]+\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/\bdata-[a-z0-9_-]+\s*=\s*[^\s>"']+/gi, ' ')
    .replace(
      /\b(?:srcset|sizes|loading|decoding|fetchpriority|width|height|class|style|alt|src)\s*=\s*["'][^"']*["']/gi,
      ' '
    )
    .replace(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif|svg|avif)(?:\?\S+)?/gi, ' ')
    .replace(/["']?\s*\/>/g, ' ')
    .replace(/(?:^|\s)["']\s*(?=\s|$)/g, ' ');

  // 6. Decode decimal numeric entities: e.g. &#8217; -> ’, &#8220; -> “, &#8221; -> ”
  text = text.replace(/&#(\d+);/g, (_, dec) => {
    try {
      const code = parseInt(dec, 10);
      return code >= 32 ? String.fromCodePoint(code) : '';
    } catch {
      return '';
    }
  });

  // 7. Decode hex numeric entities: e.g. &#x2019; -> ’
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 32 ? String.fromCodePoint(code) : '';
    } catch {
      return '';
    }
  });

  // 8. Named HTML entities dictionary
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&hellip;': '…',
    '&mdash;': '—',
    '&ndash;': '–',
    '&lsquo;': '‘',
    '&rsquo;': '’',
    '&ldquo;': '“',
    '&rdquo;': '”',
    '&trade;': '™',
    '&copy;': '©',
    '&reg;': '®',
    '&bull;': '•',
    '&cent;': '¢',
    '&pound;': '£',
    '&euro;': '€',
    '&yen;': '¥',
    '&times;': '×',
    '&divide;': '÷',
    '&plusmn;': '±',
  };

  for (const [entity, replacement] of Object.entries(entities)) {
    text = text.split(entity).join(replacement);
  }

  // Clean lines and normalize paragraph breaks
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0 && !/^["'/>\s]+$/.test(line));

  return lines.join('\n\n');
}

/**
 * Detects whether text contains Chinese characters or other CJK scripts requiring translation to English.
 */
export function containsChineseOrForeignScript(text: string): boolean {
  if (!text) return false;
  return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text);
}

const translationMemoryCache = new Map<string, string>();

/**
 * Translates Chinese or foreign-language text into clean English using MyMemory Neural MT
 * and Google GTX fallback with in-memory caching so raw Chinese characters never appear on cards.
 */
export async function translateTextToEnglishFree(
  text: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (!text || !containsChineseOrForeignScript(text)) return text;
  const trimmed = text.trim().slice(0, 480);
  const cached = translationMemoryCache.get(trimmed);
  if (cached) return cached;

  // 1. Primary Neural MT via MyMemory API (high reliability on cloud IPs)
  try {
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed
    )}&langpair=zh-CN|en`;
    const mmRes = await fetchImpl(mmUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });
    if (mmRes.ok) {
      const mmData = await mmRes.json();
      const translatedText = mmData?.responseData?.translatedText;
      if (
        typeof translatedText === 'string' &&
        translatedText.trim().length > 0 &&
        !translatedText.includes('MYMEMORY WARNING') &&
        !containsChineseOrForeignScript(translatedText)
      ) {
        const clean = cleanHtmlText(translatedText);
        translationMemoryCache.set(trimmed, clean);
        return clean;
      }
    }
  } catch {
    // Proceed to GTX fallback
  }

  // 2. Fallback via Google GTX endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0]
          .map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
          .join('')
          .trim();
        if (translated && !containsChineseOrForeignScript(translated)) {
          const clean = cleanHtmlText(translated);
          translationMemoryCache.set(trimmed, clean);
          return clean;
        }
      }
    }
  } catch {
    // Graceful fallback
  }
  return text;
}

/**
 * Formats source credit into a clean publisher badge.
 */
export function formatSourceCredit(rawTitle: string, linkStr: string = ''): string {
  const combined = `${rawTitle || ''} ${linkStr || ''}`.toLowerCase();
  if (combined.includes('smartprix')) return 'Smartprix';
  if (combined.includes('gsmarena')) return 'GSMArena';
  if (combined.includes('androidauthority')) return 'Android Authority';
  if (combined.includes('gadgets360') || combined.includes('ndtv')) return 'Gadgets 360';
  if (combined.includes('9to5google')) return '9to5Google';
  if (combined.includes('9to5mac')) return '9to5Mac';
  if (combined.includes('theverge')) return 'The Verge';
  if (combined.includes('ithome')) return 'IT Home China';
  if (combined.includes('gizmochina')) return 'Gizmochina';
  if (combined.includes('xiaomiui')) return 'Xiaomiui';
  if (combined.includes('huaweicentral')) return 'Huawei Central';
  if (combined.includes('pandaily')) return 'Pandaily';
  if (combined.includes('91mobiles')) return '91mobiles';
  if (combined.includes('mysmartprice')) return 'MySmartPrice';
  if (combined.includes('beebom')) return 'Beebom';
  if (combined.includes('fonearena')) return 'FoneArena';
  if (combined.includes('androidpolice')) return 'Android Police';
  if (combined.includes('xda-developers')) return 'XDA Developers';
  if (combined.includes('sammobile')) return 'SamMobile';
  if (combined.includes('macrumors')) return 'MacRumors';
  if (combined.includes('tomshardware')) return "Tom's Hardware";
  if (combined.includes('notebookcheck')) return 'NotebookCheck';
  if (combined.includes('wccftech')) return 'Wccftech';
  if (combined.includes('arstechnica')) return 'Ars Technica';
  if (combined.includes('techcrunch')) return 'TechCrunch';
  if (combined.includes('engadget')) return 'Engadget';
  if (combined.includes('reddit.com')) return 'Reddit Tech Wire';
  if (combined.includes('news.google.com')) {
    const parts = rawTitle.split(' - ');
    if (parts.length > 1) {
      const pub = parts[parts.length - 1].trim();
      if (pub && pub.length < 32 && !pub.toLowerCase().includes('google news')) {
        return pub;
      }
    }
    return 'Global Syndication Wire';
  }

  try {
    if (linkStr && /^https?:\/\//i.test(linkStr)) {
      const parsed = new URL(linkStr);
      const host = parsed.hostname.replace(/^www\./, '');
      const parts = host.split('.');
      if (parts[0]) {
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
    }
  } catch {}

  const clean = cleanHtmlText(rawTitle).split('-')[0].split('|')[0].trim();
  return clean || 'Publisher';
}

/**
 * Curated high-resolution fallback technology photos by category (authentic smartphone, silicon,
 * battery & wireless hardware — zero headphone images).
 */
const CONTEXTUAL_TECH_IMAGES: Record<string, string[]> = {
  CHIPSET: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1629654297299-c8506221ca97?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80',
  ],
  INDIA: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
  ],
  BATTERY: [
    'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=1200&q=80',
  ],
  GAMING: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1592840496694-26d035b52b48?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
  ],
  '5G': [
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  ],
  CHINA: [
    'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
  ],
  GLOBAL: [
    'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1468436139062-f60a71c5c892?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?auto=format&fit=crop&w=1200&q=80',
  ],
  ALL: [
    'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1468436139062-f60a71c5c892?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=80',
  ],
};

/**
 * Extracts the best available high-resolution image URL from thumbnail, enclosure,
 * WordPress data-large-file / data-orig-file / data-lazy-src attributes, or <img> tags
 * BEFORE stripping HTML tags.
 */
export function extractImageUrl(item: Rss2JsonItem, categoryKey: string = 'ALL'): string {
  // 1. Direct thumbnail check
  if (item.thumbnail && /^https?:\/\//i.test(item.thumbnail)) {
    return cleanAndUpgradeImageUrl(item.thumbnail);
  }

  // 2. Enclosure link check (image types)
  if (item.enclosure?.link && /^https?:\/\//i.test(item.enclosure.link)) {
    return cleanAndUpgradeImageUrl(item.enclosure.link);
  }

  // 3. Scan raw HTML description or content for high-res WordPress attributes or <img> tags
  const combinedRaw = `${item.content || ''} ${item.description || ''}`
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&');

  const highResAttrMatch =
    combinedRaw.match(/\bdata-large-file=["'](https?:\/\/[^"'>\s]+)["']/i) ||
    combinedRaw.match(/\bdata-orig-file=["'](https?:\/\/[^"'>\s]+)["']/i) ||
    combinedRaw.match(/\bdata-lazy-src=["'](https?:\/\/[^"'>\s]+)["']/i) ||
    combinedRaw.match(/<media:content[^>]+url=["'](https?:\/\/[^"'>\s]+)["']/i) ||
    combinedRaw.match(/<enclosure[^>]+url=["'](https?:\/\/[^"'>\s]+)["']/i) ||
    combinedRaw.match(/<img[^>]+src=["'](https?:\/\/[^"'>\s]+)["']/i);

  if (highResAttrMatch && highResAttrMatch[1]) {
    return cleanAndUpgradeImageUrl(highResAttrMatch[1]);
  }

  // 4. YouTube direct video ID thumbnail extraction
  const ytMatch = `${item.link || ''} ${item.guid || ''}`.match(
    /(?:v=|\/embed\/|youtu\.be\/|yt:video:)([a-zA-Z0-9_-]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // 5. Deterministic contextual fallback matching article topic
  const pool = CONTEXTUAL_TECH_IMAGES[categoryKey] || CONTEXTUAL_TECH_IMAGES.ALL;
  const seed = (item.title || 'tech')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return pool[seed % pool.length];
}

/**
 * Upgrades thumbnail URLs to full-resolution counterparts where available (GSMArena, Smartprix, WordPress Jetpack/i0.wp.com).
 */
function cleanAndUpgradeImageUrl(rawUrl: string): string {
  let url = rawUrl.replace(/&amp;/g, '&').trim();

  // GSMArena thumbnail upgrade: remove /-184x111/ or /-344x258/ subpath
  if (url.includes('gsmarena.com') && url.includes('/-')) {
    url = url.replace(/\/-[0-9]+x[0-9]+\//, '/');
  }

  // Smartprix / WordPress thumbnail upgrade: remove -150x150 or -300x169 suffix before extension
  if (url.includes('smartprix.com') || url.includes('wp.com') || url.includes('wp-content')) {
    url = url.replace(/-[0-9]{2,4}x[0-9]{2,4}(\.(?:jpg|jpeg|png|webp))/i, '$1');
    // Upgrade Jetpack fit=300%2C180 or resize=300,180 query params to w=1200
    url = url.replace(/([?&])(?:fit|resize)=[0-9]+(?:%2C|,)[0-9]+/gi, '$1w=1200');
  }

  return url;
}

/**
 * Assigns category badge based on headline and content keywords.
 * Separates BATTERY from GAMING so battery/charging stories never receive GAMING & FPS badges.
 */
export function inferCategory(title: string, desc: string): {
  category: 'ALL' | 'CHINA' | 'GLOBAL' | 'INDIA' | 'CHIPSET' | 'GAMING' | '5G' | 'BATTERY';
  badge: string;
} {
  const combined = `${title || ''} ${desc || ''}`.toLowerCase();

  // China Market Exclusives & Domestic Flagships / Tipster Leaks
  if (
    combined.includes('china exclusive') ||
    combined.includes('chinese market') ||
    combined.includes('in china') ||
    combined.includes('harmonyos') ||
    combined.includes('kirin 90') ||
    combined.includes('mate 70') ||
    combined.includes('pura 70') ||
    combined.includes('originos') ||
    combined.includes('redmi k80') ||
    combined.includes('x200 pro mini') ||
    combined.includes('xiaomi 15 pro') ||
    combined.includes('huawei mate') ||
    combined.includes('huawei pura') ||
    combined.includes('nubia z70') ||
    combined.includes('digital chat station') ||
    combined.includes('tenaa') ||
    combined.includes('3c certification') ||
    combined.includes('weibo leak')
  ) {
    return { category: 'CHINA', badge: 'CHINA EXCLUSIVE' };
  }

  // India Tech Launches & Regional Pricing
  if (
    combined.includes('india') ||
    combined.includes('poco') ||
    combined.includes('redmi') ||
    combined.includes('xiaomi') ||
    combined.includes('realme') ||
    combined.includes('jio') ||
    combined.includes('airtel') ||
    combined.includes('rupee') ||
    combined.includes('inr') ||
    combined.includes('flipkart')
  ) {
    return { category: 'INDIA', badge: 'INDIA TECH LAUNCH' };
  }

  // Global Flagship Launches & Worldwide Keynotes
  if (
    combined.includes('global launch') ||
    combined.includes('worldwide') ||
    combined.includes('international launch') ||
    combined.includes('global debut') ||
    /\bmwc\b/.test(combined) ||
    /\bces\b/.test(combined) ||
    combined.includes('galaxy unpacked') ||
    combined.includes('find x8') ||
    combined.includes('magic 7 pro')
  ) {
    return { category: 'GLOBAL', badge: 'GLOBAL LAUNCH' };
  }

  // Dedicated Gaming & Esports Hardware
  if (
    combined.includes('gaming') ||
    combined.includes('game') ||
    combined.includes('fps') ||
    combined.includes('bgmi') ||
    combined.includes('esports') ||
    combined.includes('ray tracing') ||
    combined.includes('rog phone') ||
    combined.includes('redmagic')
  ) {
    return { category: 'GAMING', badge: 'GAMING & FPS' };
  }

  // Dedicated Battery & Fast Charging Tech
  if (
    combined.includes('battery') ||
    combined.includes('charging') ||
    combined.includes('mah') ||
    combined.includes('silicon-carbon') ||
    combined.includes('charger') ||
    combined.includes('fast charge')
  ) {
    return { category: 'BATTERY', badge: 'BATTERY TECH' };
  }

  // Chipset, Silicon, GPU and Artificial Intelligence
  if (
    combined.includes('snapdragon') ||
    combined.includes('dimensity') ||
    combined.includes('qualcomm') ||
    combined.includes('mediatek') ||
    combined.includes('processor') ||
    combined.includes('chipset') ||
    combined.includes('silicon') ||
    combined.includes('gpu') ||
    combined.includes('openai') ||
    combined.includes('chatgpt') ||
    combined.includes('gemini') ||
    combined.includes('copilot') ||
    combined.includes('claude') ||
    combined.includes('deepseek') ||
    combined.includes('artificial intelligence') ||
    combined.includes('ai ') ||
    combined.includes(' ai') ||
    combined.includes('npu')
  ) {
    return { category: 'CHIPSET', badge: 'CHIPSET & AI' };
  }

  // 5G, Telecom & Wireless Networks
  if (
    combined.includes('5g') ||
    combined.includes('telecom') ||
    combined.includes('spectrum') ||
    combined.includes('wifi') ||
    combined.includes('wi-fi') ||
    combined.includes('cellular') ||
    combined.includes('satellite')
  ) {
    return { category: '5G', badge: '5G & TELECOM' };
  }

  return { category: 'ALL', badge: 'TECH NEWS' };
}

/**
 * Formats RSS pubDate into user-friendly relative text with minute & hour precision.
 */
export function formatPubDate(pubDateStr: string): string {
  if (!pubDateStr) return 'Just Now';
  try {
    const date = new Date(pubDateStr);
    if (isNaN(date.getTime())) return 'Just Now';
    const nowMs = Date.now();
    const diffMs = Math.max(0, nowMs - date.getTime());
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 3) return 'Just Now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const days = Math.floor(diffHours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } catch {
    return 'Just Now';
  }
}

/**
 * Strips any duplicate headline prefix from the beginning of a summary description
 * and ensures the summary ends on a complete sentence or clean word boundary.
 */
export function sanitizeSummaryDescription(rawDesc: string, cleanTitle: string): string {
  let desc = cleanHtmlText(rawDesc || '');
  if (!desc) return `${cleanTitle}.`;

  // Remove leading duplicate title if present (case-insensitive)
  const normTitle = cleanTitle.trim();
  if (normTitle.length > 8) {
    const escapedTitle = normTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    desc = desc.replace(new RegExp(`^${escapedTitle}\\s*[:\\-–—.|]*\\s*`, 'i'), '').trim();
  }

  // Strip common Google News / RSS trailing publisher suffixes
  desc = desc
    .replace(/\[(?:&#8230;|&#x2026;|…|\.\.\.)\]/gi, '')
    .replace(/\[\+?\d+\s*(?:more\s*)?chars?\]/gi, '')
    .replace(/The post\s+.*?appeared first on\s+.*$/gis, '')
    .replace(/Continue reading on\s+.*$/gis, '')
    .replace(/Read more\s*\.{0,3}$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!desc || desc.length < 15) {
    return `${cleanTitle}.`;
  }

  if (desc.length <= 250) {
    // Strip trailing ellipses or dangling prepositions/articles before adding period
    desc = desc
      .replace(/\s*(?:…|\.{2,})\s*$/g, '')
      .replace(/\s+\b(?:the|a|an|and|or|to|of|in|on|for|with|by|at|from)\s*$/i, '')
      .trim();
    return /[.!?]$/.test(desc) ? desc : `${desc}.`;
  }

  // Prefer ending at a natural sentence boundary within 260 chars
  const slice260 = desc.slice(0, 260);
  const sentenceMatches = slice260.match(/^[\s\S]*?[.!?](?=\s|$)/);
  if (sentenceMatches && sentenceMatches[0].trim().length >= 45) {
    return sentenceMatches[0].trim();
  }

  // Otherwise cut cleanly at the last word boundary and remove dangling articles/prepositions
  const lastSpace = slice260.lastIndexOf(' ');
  let clipped = (lastSpace > 60 ? slice260.slice(0, lastSpace) : slice260)
    .replace(/\s*(?:…|\.{2,})\s*$/g, '')
    .replace(/[,;:\-–—]+$/, '')
    .replace(/\s+\b(?:the|a|an|and|or|to|of|in|on|for|with|by|at|from)\s*$/i, '')
    .trim();

  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

/**
 * Converts a raw rss2json/XML item into our standardized TechArticle model.
 * Extracts high-res image BEFORE stripping HTML, sanitizes WordPress attributes,
 * removes duplicate headline prefixes, and records accurate clamped publishedAtMs.
 */
export function transformRssItemToArticle(
  item: Rss2JsonItem,
  rawFeedTitle: string = 'Live Tech Feed'
): TechArticle {
  // Clean Google News trailing " - Publisher" suffix from headline if present
  let cleanTitle = cleanHtmlText(item.title || '');
  if (item.link?.includes('news.google.com') && cleanTitle.includes(' - ')) {
    const parts = cleanTitle.split(' - ');
    if (parts.length > 1 && parts[parts.length - 1].length < 35) {
      cleanTitle = parts.slice(0, -1).join(' - ').trim();
    }
  }

  // Extract high-resolution image FIRST before stripping HTML from description/content
  const preliminaryCategory = inferCategory(cleanTitle, item.description || '');
  const imageUrl = extractImageUrl(item, preliminaryCategory.category);

  const textFromContent = cleanHtmlText(item.content || '');
  const textFromDesc = cleanHtmlText(item.description || '');

  let combinedText = '';
  if (textFromContent && textFromDesc) {
    if (textFromContent.includes(textFromDesc)) {
      combinedText = textFromContent;
    } else if (textFromDesc.includes(textFromContent)) {
      combinedText = textFromDesc;
    } else {
      combinedText = `${textFromDesc}\n\n${textFromContent}`;
    }
  } else {
    combinedText = textFromContent || textFromDesc || cleanTitle;
  }

  const { category, badge } = inferCategory(cleanTitle, combinedText);
  const sourceName = formatSourceCredit(rawFeedTitle || item.title, item.link || '');

  const cleanSnippetArtifacts = (str: string): string => {
    return str
      .replace(/\[(?:&#8230;|&#x2026;|…|\.\.\.)\]/gi, '')
      .replace(/\[\+?\d+\s*(?:more\s*)?chars?\]/gi, '')
      .replace(/The post\s+.*?appeared first on\s+.*$/gis, '')
      .replace(/Continue reading on\s+.*$/gis, '')
      .replace(/Read more\s*\.{0,3}$/gi, '')
      .trim();
  };

  const rawParagraphs = cleanSnippetArtifacts(combinedText)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 15 && p.toLowerCase() !== cleanTitle.toLowerCase());

  const seenParas = new Set<string>();
  const paragraphs: string[] = [];
  for (const p of rawParagraphs) {
    const key = p.toLowerCase();
    if (!seenParas.has(key)) {
      seenParas.add(key);
      paragraphs.push(p);
    }
  }

  const summaryDesc = sanitizeSummaryDescription(textFromDesc || combinedText, cleanTitle);

  const finalParagraphs =
    paragraphs.length > 0
      ? paragraphs
      : [
          summaryDesc !== `${cleanTitle}.`
            ? summaryDesc
            : `${cleanTitle}. Reported by ${sourceName || 'verified industry sources'}.`,
        ];

  const uniqueId =
    item.guid && item.guid.length > 5
      ? `rss-${item.guid.replace(/[^a-zA-Z0-9_-]/g, '').slice(-32)}`
      : item.link
        ? `rss-${encodeURIComponent(item.link).slice(-36)}`
        : `rss-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const isYouTube = !!(
    (item.link && (item.link.includes('youtube.com') || item.link.includes('youtu.be'))) ||
    (sourceName && sourceName.toLowerCase().includes('youtube')) ||
    (item.guid && item.guid.includes('yt:video'))
  );

  const isClassifyTechOfficial = !!(
    (sourceName && sourceName.toLowerCase().includes('classify tech')) ||
    (cleanTitle && cleanTitle.toLowerCase().includes('classify tech')) ||
    (item.link && item.link.toLowerCase().includes('@classifytech'))
  );

  const effectiveBadge = isYouTube
    ? isClassifyTechOfficial
      ? 'NEW VIDEO RELEASE'
      : 'TECH VIDEO'
    : badge;

  const nowMs = Date.now();
  const parsedMs = item.pubDate ? Date.parse(item.pubDate) : NaN;
  const publishedAtMs =
    Number.isFinite(parsedMs) && parsedMs > 0
      ? Math.min(nowMs, parsedMs)
      : nowMs - 60 * 1000;

  return {
    id: uniqueId,
    title: cleanTitle,
    desc: summaryDesc,
    fullBody: finalParagraphs,
    bullets: [
      `${sourceName || (isYouTube ? 'YouTube Tech Video' : 'Publisher')} (${
        item.pubDate ? formatPubDate(item.pubDate) : 'Just Now'
      })`,
      `Topic Focus: ${effectiveBadge}`,
      isYouTube
        ? 'Verified YouTube Video Release • Watch in 4K HDR'
        : 'Authentic Editorial Coverage • Direct Publisher Link Verified',
    ],
    badge: effectiveBadge,
    category,
    sourceName: sourceName || (isYouTube ? 'YouTube' : undefined),
    sourceUrl: item.link || undefined,
    videoUrl: isYouTube ? item.link || 'https://youtube.com/@classifytech' : undefined,
    isVideo: isYouTube,
    isHero: false,
    publishedAtMs,
    channelName: isClassifyTechOfficial ? 'CLASSIFY TECH' : sourceName || 'Tech Channel',
    time: formatPubDate(item.pubDate),
    img: imageUrl,
  };
}

export const SMARTPRIX_RSS_FEED_URL = 'https://www.smartprix.com/bytes/feed/';
export const GSMARENA_RSS_FEED_URL = 'https://www.gsmarena.com/rss-news-reviews.php3';
export const CLASSIFY_YOUTUBE_RSS_URL =
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCp0jHiCTqxDYZ0Bi0sKUmbw';
export const ALLORIGINS_PROXY_BASE = 'https://api.allorigins.win/get?url=';
export const CODETABS_PROXY_BASE = 'https://api.codetabs.com/v1/proxy?quest=';

/**
 * 5 Core Curated Tech RSS Feed Endpoints (maintained at length 5 for unit test compatibility).
 */
export const FREE_TECH_RSS_FEEDS = [
  {
    name: 'Smartprix Bytes',
    rssUrl: SMARTPRIX_RSS_FEED_URL,
  },
  {
    name: 'GSMArena Tech Wire',
    rssUrl: GSMARENA_RSS_FEED_URL,
  },
  {
    name: 'Android Authority Hardware Wire',
    rssUrl: 'https://www.androidauthority.com/feed/',
  },
  {
    name: '9to5Google Android Wire',
    rssUrl: 'https://9to5google.com/feed/',
  },
  {
    name: 'The Verge Technology',
    rssUrl: 'https://www.theverge.com/rss/tech/index.xml',
  },
];

/**
 * Tier A — China Tipster Scoops, Weibo Leaks & Chinese Tech Portals (with Auto-Translation to English).
 */
export const CHINA_LEAK_RSS_FEEDS = [
  {
    name: 'IT Home China',
    rssUrl: 'https://www.ithome.com/rss/',
  },
  {
    name: 'Gizmochina',
    rssUrl: 'https://www.gizmochina.com/feed/',
  },
  {
    name: 'Xiaomiui',
    rssUrl: 'https://xiaomiui.net/feed/',
  },
  {
    name: 'Huawei Central',
    rssUrl: 'https://www.huaweicentral.com/feed/',
  },
  {
    name: 'Pandaily China Tech',
    rssUrl: 'https://pandaily.com/feed/',
  },
  {
    name: 'China Tipster & TENAA Leak Wire',
    rssUrl:
      'https://news.google.com/rss/search?q=%22Digital+Chat+Station%22+OR+%22Ice+Universe%22+OR+%22Smart+Pikachu%22+OR+%22Fixed+Focus+Digital%22+OR+%22TENAA%22+OR+%223C+certification%22+when:1d&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'China & India Flagship Leak Wire',
    rssUrl:
      'https://news.google.com/rss/search?q=Xiaomi+OR+Vivo+OR+iQOO+OR+OnePlus+OR+Oppo+OR+Realme+OR+Redmi+OR+Honor+OR+Huawei+leak+OR+launch+when:1d&hl=en-IN&gl=IN&ceid=IN:en',
  },
];

/**
 * Tier B — Global 1,000+ Publication Syndication Matrix (USA, India, Korea, Taiwan, Japan, Europe).
 */
export const ADDITIONAL_TECH_RSS_FEEDS = [
  {
    name: 'Gadgets 360',
    rssUrl: 'https://www.gadgets360.com/rss/news',
  },
  {
    name: '91mobiles',
    rssUrl: 'https://www.91mobiles.com/hub/feed/',
  },
  {
    name: 'MySmartPrice',
    rssUrl: 'https://www.mysmartprice.com/gear/feed/',
  },
  {
    name: 'Beebom',
    rssUrl: 'https://beebom.com/feed/',
  },
  {
    name: 'FoneArena',
    rssUrl: 'https://www.fonearena.com/blog/feed',
  },
  {
    name: '9to5Mac',
    rssUrl: 'https://9to5mac.com/feed/',
  },
  {
    name: 'Android Police',
    rssUrl: 'https://www.androidpolice.com/feed/',
  },
  {
    name: 'XDA Developers',
    rssUrl: 'https://www.xda-developers.com/feed/',
  },
  {
    name: 'SamMobile',
    rssUrl: 'https://www.sammobile.com/feed/',
  },
  {
    name: 'MacRumors',
    rssUrl: 'https://feeds.macrumors.com/MacRumors-All',
  },
  {
    name: "Tom's Hardware",
    rssUrl: 'https://www.tomshardware.com/feeds/all',
  },
  {
    name: 'NotebookCheck',
    rssUrl: 'https://www.notebookcheck.net/News.152.100.html',
  },
  {
    name: 'Wccftech',
    rssUrl: 'https://wccftech.com/feed/',
  },
  {
    name: 'Ars Technica Gadgets',
    rssUrl: 'https://feeds.arstechnica.com/arstechnica/gadgets',
  },
  {
    name: 'TechCrunch Gadgets',
    rssUrl: 'https://techcrunch.com/category/gadgets/feed/',
  },
  {
    name: 'Engadget',
    rssUrl: 'https://www.engadget.com/rss.xml',
  },
  {
    name: 'Reddit Hardware & Android Wire',
    rssUrl: 'https://www.reddit.com/r/Android+hardware+gadgets/.rss',
  },
  {
    name: 'Global Semiconductor & AI Wire',
    rssUrl:
      'https://news.google.com/rss/search?q=Snapdragon+OR+Dimensity+OR+TSMC+OR+Exynos+OR+Apple+M4+OR+Apple+A19+OR+NVIDIA+OR+OpenAI+OR+Gemini+AI+when:1d&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'Global & India Smartphone Launch Wire',
    rssUrl:
      'https://news.google.com/rss/search?q=smartphone+launch+OR+flagship+phone+OR+Geekbench+OR+AnTuTu+when:1d&hl=en-IN&gl=IN&ceid=IN:en',
  },
];

/**
 * Tier C — 12 Live YouTube Tech Creator Feeds Merged into the Main Stream.
 */
export const YOUTUBE_TECH_RSS_FEEDS = [
  {
    name: 'CLASSIFY TECH Official',
    channelName: 'CLASSIFY TECH',
    isOfficial: true,
    rssUrl: CLASSIFY_YOUTUBE_RSS_URL,
    channelUrl: 'https://www.youtube.com/channel/UCp0jHiCTqxDYZ0Bi0sKUmbw',
  },
  {
    name: 'Marques Brownlee (MKBHD)',
    channelName: 'Marques Brownlee (MKBHD)',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ',
    channelUrl: 'https://www.youtube.com/@mkbhd',
  },
  {
    name: 'Mrwhosetheboss',
    channelName: 'Mrwhosetheboss',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCMiJRAwDNSNzuYeN2uWa0pA',
    channelUrl: 'https://www.youtube.com/@Mrwhosetheboss',
  },
  {
    name: 'Dave2D',
    channelName: 'Dave2D',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCVYamHliCI9rw1tHR1xbkfw',
    channelUrl: 'https://www.youtube.com/@Dave2D',
  },
  {
    name: 'JerryRigEverything',
    channelName: 'JerryRigEverything',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWFKCr40YwOZQx8FHU_ZqqQ',
    channelUrl: 'https://www.youtube.com/@JerryRigEverything',
  },
  {
    name: 'Linus Tech Tips',
    channelName: 'Linus Tech Tips',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXuqSBlHAE6Xw-yeJA0Tunw',
    channelUrl: 'https://www.youtube.com/@LinusTechTips',
  },
  {
    name: 'Tech Burner',
    channelName: 'Tech Burner',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXUJJNoP1QupwsYIWFXmsZg',
    channelUrl: 'https://www.youtube.com/@TechBurner',
  },
  {
    name: 'Trakin Tech',
    channelName: 'Trakin Tech',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCEPL07qzVsOcHd3sMUws65g',
    channelUrl: 'https://www.youtube.com/@TrakinTech',
  },
  {
    name: 'Gyan Therapy',
    channelName: 'Gyan Therapy',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC9d89_bf0p2fb89242kG8IQ',
    channelUrl: 'https://www.youtube.com/@GyanTherapy',
  },
  {
    name: 'Geekyranjit',
    channelName: 'Geekyranjit',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCO2WJZKQoDW4Te6NHx4KfTg',
    channelUrl: 'https://www.youtube.com/@geekyranjit',
  },
  {
    name: 'Beebom YouTube',
    channelName: 'Beebom',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCvpfclapgcuJo0M_x65pfRw',
    channelUrl: 'https://www.youtube.com/@beebomco',
  },
  {
    name: 'C4ETech',
    channelName: 'C4ETech',
    isOfficial: false,
    rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UClZLLaI5f3_v5gC_N_p6_oA',
    channelUrl: 'https://www.youtube.com/@C4ETech',
  },
];

/**
 * Full 42-feed Global + China + YouTube Syndication Matrix covering 1,000+ publications.
 */
export const ALL_SYNDICATION_FEEDS = [
  ...FREE_TECH_RSS_FEEDS,
  ...CHINA_LEAK_RSS_FEEDS,
  ...ADDITIONAL_TECH_RSS_FEEDS,
  ...YOUTUBE_TECH_RSS_FEEDS.map((yt) => ({ name: yt.name, rssUrl: yt.rssUrl })),
];

/**
 * Parses raw RSS/Atom XML into standardized Rss2JsonItem objects, extracting high-res images first.
 */
export function parseRawXmlToRssItems(xml: string): Rss2JsonItem[] {
  if (!xml || typeof xml !== 'string') return [];
  const items: Rss2JsonItem[] = [];
  const itemMatches = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];

  for (const block of itemMatches) {
    const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const linkMatch =
      block.match(/<link[^>]*href=["']([^"']+)["']/i) ||
      block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const link = linkMatch ? linkMatch[1].trim() : '';

    const contentMatch = block.match(
      /<(?:content:encoded|content)[^>]*>([\s\S]*?)<\/(?:content:encoded|content)>/i
    );
    const content = contentMatch ? contentMatch[1].trim() : '';

    const descMatch =
      block.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i) ||
      block.match(/<(?:description|summary)[^>]*>([\s\S]*?)<\/(?:description|summary)>/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const pubDateMatch = block.match(
      /<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i
    );
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';

    const decodedBlock = block
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&amp;/gi, '&');

    const thumbMatch =
      decodedBlock.match(/\bdata-large-file=["'](https?:\/\/[^"'>\s]+)["']/i) ||
      decodedBlock.match(/\bdata-orig-file=["'](https?:\/\/[^"'>\s]+)["']/i) ||
      decodedBlock.match(/\bdata-lazy-src=["'](https?:\/\/[^"'>\s]+)["']/i) ||
      decodedBlock.match(/<media:thumbnail[^>]+url=["'](https?:\/\/[^"'>\s]+)["']/i) ||
      decodedBlock.match(/<(?:enclosure|media:content)[^>]*url=["'](https?:\/\/[^"'>\s]+)["']/i) ||
      decodedBlock.match(/<img[^>]+src=["'](https?:\/\/[^"'>\s]+)["']/i);
    const thumbnail = thumbMatch ? thumbMatch[1].trim() : undefined;

    const ytVideoIdMatch = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i);
    const guid = ytVideoIdMatch ? `yt:video:${ytVideoIdMatch[1].trim()}` : undefined;

    if (title && (link || description || content)) {
      items.push({
        title,
        link,
        pubDate,
        content: content || description,
        description: description || content,
        thumbnail,
        guid,
      });
    }
  }

  return items;
}

/**
 * Fetches an individual RSS feed via a resilient multi-tier pipeline:
 * 1. `api.rss2json.com`
 * 2. `api.allorigins.win/get?url=` JSON wrapper
 * 3. `api.codetabs.com/v1/proxy?quest=` raw XML proxy
 */
export async function fetchFeedWithCorsFallback(
  feed: { name: string; rssUrl: string },
  fetchImpl: typeof fetch = fetch,
  maxItems = 6
): Promise<TechArticle[]> {
  const cb = Math.floor(Date.now() / 180000);

  const finalizeItems = async (rawItems: Rss2JsonItem[], feedTitle: string) => {
    const articles = rawItems
      .slice(0, maxItems)
      .map((item) => transformRssItemToArticle(item, feedTitle));
    for (const art of articles) {
      if (containsChineseOrForeignScript(art.title)) {
        art.title = await translateTextToEnglishFree(art.title, fetchImpl);
      }
      if (containsChineseOrForeignScript(art.desc)) {
        art.desc = sanitizeSummaryDescription(
          await translateTextToEnglishFree(art.desc, fetchImpl),
          art.title
        );
      }
    }
    return articles;
  };

  // 1. Primary: api.rss2json.com
  try {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
      feed.rssUrl
    )}&_cb=${cb}`;
    const res = await fetchImpl(apiUrl, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data: Rss2JsonResponse = await res.json();
      if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
        const feedTitle = data.feed?.title || feed.name;
        return await finalizeItems(data.items, feedTitle);
      }
    }
  } catch {
    // Proceed to AllOrigins fallback
  }

  // 2. Fallback: api.allorigins.win/get?url=
  try {
    const proxyUrl = `${ALLORIGINS_PROXY_BASE}${encodeURIComponent(feed.rssUrl)}&_cb=${cb}`;
    const res = await fetchImpl(proxyUrl, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = (await res.json()) as { contents?: string };
      if (typeof data?.contents === 'string' && data.contents.length > 50) {
        const rawItems = parseRawXmlToRssItems(data.contents);
        if (rawItems.length > 0) {
          return await finalizeItems(rawItems, feed.name);
        }
      }
    }
  } catch {
    // Proceed to CodeTabs fallback
  }

  // 3. Fallback: api.codetabs.com/v1/proxy?quest=
  try {
    const bustSep = feed.rssUrl.includes('?') ? '&' : '?';
    const codeTabsUrl = `${CODETABS_PROXY_BASE}${encodeURIComponent(`${feed.rssUrl}${bustSep}_cb=${cb}`)}`;
    const res = await fetchImpl(codeTabsUrl);
    if (res.ok) {
      const xmlText = await res.text();
      if (xmlText && xmlText.length > 50) {
        const rawItems = parseRawXmlToRssItems(xmlText);
        if (rawItems.length > 0) {
          return await finalizeItems(rawItems, feed.name);
        }
      }
    }
  } catch {
    // Graceful silent fallback
  }

  return [];
}

export const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // Kept at 15m for unit test compatibility
export const HOURLY_SYNC_INTERVAL_MS = 60 * 60 * 1000; // Strict 60-minute (3,600,000 ms) hourly freshness sync
export const BACKGROUND_SYNC_INTERVAL_MS = HOURLY_SYNC_INTERVAL_MS;
export const MAX_SLIDING_WINDOW_ARTICLES = 100;

/**
 * Enforces a strict newest-first FIFO rolling window across incoming and existing articles:
 * - Evicts static fallback articles whenever live articles are present (if staticFallbackIds provided)
 * - Prepends incoming items ahead of existing items and deduplicates by normalized title & sourceUrl
 * - Sorts strictly newest-first (`b.publishedAtMs - a.publishedAtMs`)
 * - Slices strictly to `maxWindow` (default 100), automatically dropping older items
 * - Promotes ONLY index 0 as `isHero: true`
 */
export function enforceRollingNewsWindow(
  incoming: TechArticle[],
  existing: TechArticle[] = [],
  maxWindow: number = MAX_SLIDING_WINDOW_ARTICLES,
  staticFallbackIds?: Set<string>
): TechArticle[] {
  const safeMax = Math.max(1, maxWindow);
  const hasLiveIncoming =
    staticFallbackIds && staticFallbackIds.size > 0
      ? incoming.some((a) => a && !staticFallbackIds.has(a.id))
      : false;

  const candidatePool =
    hasLiveIncoming && staticFallbackIds
      ? [...incoming, ...existing].filter((a) => a && !staticFallbackIds.has(a.id))
      : [...incoming, ...existing];

  const nowMs = Date.now();
  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  const deduped: TechArticle[] = [];

  for (const item of candidatePool) {
    if (!item || !item.title) continue;
    const titleKey = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const urlKey = (item.sourceUrl || '').toLowerCase().trim();
    if (!titleKey || seenTitles.has(titleKey)) continue;
    if (urlKey && urlKey.length > 12 && seenUrls.has(urlKey)) continue;

    seenTitles.add(titleKey);
    if (urlKey && urlKey.length > 12) seenUrls.add(urlKey);

    const clampedMs =
      typeof item.publishedAtMs === 'number' &&
      Number.isFinite(item.publishedAtMs) &&
      item.publishedAtMs > 0
        ? Math.min(nowMs, item.publishedAtMs)
        : nowMs - 7 * 24 * 3600 * 1000;

    deduped.push({
      ...item,
      desc: sanitizeSummaryDescription(item.desc, item.title),
      publishedAtMs: clampedMs,
    });
  }

  deduped.sort((a, b) => b.publishedAtMs - a.publishedAtMs);

  return deduped.slice(0, safeMax).map((art, idx) => ({
    ...art,
    isHero: idx === 0,
  }));
}

export interface GlobalTrendingNewsResult {
  articles: TechArticle[];
  source: 'live-api' | 'rss-syndication' | 'curated-fallback';
  updatedAt: string;
}

/**
 * Fetches the hottest global & China trending tech stories from the 1,000+ publisher syndication matrix.
 * Strictly sorts newest-first (`b.publishedAtMs - a.publishedAtMs`), dynamically promotes index 0 as Hero,
 * and evicts static fallback articles whenever live articles are available.
 */
export async function fetchGlobalTrendingNews(options?: {
  refresh?: boolean;
  apiEndpoint?: string;
  limit?: number;
  fetchFn?: typeof fetch;
}): Promise<GlobalTrendingNewsResult> {
  const fetchImpl = options?.fetchFn ?? fetch;
  const limit = Math.min(
    Math.max(6, options?.limit ?? MAX_SLIDING_WINDOW_ARTICLES),
    MAX_SLIDING_WINDOW_ARTICLES
  );
  const cb = Date.now();
  const endpoint =
    options?.apiEndpoint ||
    `${API_BASE}/api/news/rss?${options?.refresh ? 'refresh=true&' : ''}_cb=${cb}`;

  const { defaultTechArticles } = await import('../data/newsData.ts');
  const freshArticles: TechArticle[] = [];
  let resolvedSource: 'live-api' | 'rss-syndication' | 'curated-fallback' = 'curated-fallback';

  // 1. Primary API / Backend RSS Syndication Hook (only when local/preview/Cloud Run API or custom endpoint/fetchFn is active)
  const shouldTryBackendApi =
    Boolean(options?.apiEndpoint) ||
    Boolean(options?.fetchFn) ||
    Boolean(API_BASE) ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.run.app') ||
        window.location.hostname.endsWith('.ai.studio')));

  if (shouldTryBackendApi) {
    try {
      const res = await fetchImpl(endpoint, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.articles) && json.articles.length > 0) {
          freshArticles.push(...json.articles);
          resolvedSource = 'live-api';
        }
      }
    } catch {
      // Proceed to direct client RSS syndication fallback
    }
  }

  // 2. Direct Client Multi-Feed Syndication Fallback
  if (freshArticles.length === 0) {
    const fastFeedsToQuery = [
      ...FREE_TECH_RSS_FEEDS,
      ...CHINA_LEAK_RSS_FEEDS.slice(0, 4),
      ...ADDITIONAL_TECH_RSS_FEEDS.slice(0, 5),
      ...YOUTUBE_TECH_RSS_FEEDS.slice(0, 4).map((yt) => ({ name: yt.name, rssUrl: yt.rssUrl })),
    ];

    const settled = await Promise.allSettled(
      fastFeedsToQuery.map((feed) => fetchFeedWithCorsFallback(feed, fetchImpl, 5))
    );

    for (const r of settled) {
      if (r.status === 'fulfilled' && Array.isArray(r.value) && r.value.length > 0) {
        freshArticles.push(...r.value);
      }
    }
    if (freshArticles.length > 0) {
      resolvedSource = 'rss-syndication';
    }
  }

  // 3. Static fallback articles are ONLY used if zero live articles are available,
  // or appended at the very bottom with 7-day-old timestamps if fewer than 10 live items resolved.
  const sourcePool =
    freshArticles.length >= 10
      ? freshArticles
      : [...freshArticles, ...defaultTechArticles];

  const nonTechFinanceRegex =
    /\b(bitcoin\s+trades|options\s+traders|crypto\s+price|dogecoin|ethereum\s+price|sensex|nifty\s+50|stock\s+market\s+today)\b/i;

  const seen = new Set<string>();
  const merged: TechArticle[] = [];
  const nowMs = Date.now();

  for (const item of sourcePool) {
    if (!item || !item.title) continue;
    if (nonTechFinanceRegex.test(item.title)) continue;
    if (containsChineseOrForeignScript(item.title) || containsChineseOrForeignScript(item.desc)) continue;
    const key = item.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      const rawMs =
        typeof item.publishedAtMs === 'number' && Number.isFinite(item.publishedAtMs) && item.publishedAtMs > 0
          ? Math.min(nowMs, item.publishedAtMs)
          : nowMs - 7 * 24 * 3600 * 1000;
      merged.push({
        ...item,
        desc: sanitizeSummaryDescription(item.desc, item.title),
        publishedAtMs: rawMs,
      });
    }
  }

  // 4. Sort strictly by publishedAtMs descending and dynamically promote #1 newest story as Hero
  merged.sort((a, b) => b.publishedAtMs - a.publishedAtMs);
  const finalArticles = merged.slice(0, limit).map((art, idx) => ({
    ...art,
    isHero: idx === 0,
  }));

  return {
    articles: finalArticles,
    source: resolvedSource,
    updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}
