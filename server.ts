import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { isPrivateOrProhibitedHost } from './src/utils/security.ts';
import {
  isSupportedRetailerUrl,
  generateShortCode,
  buildBrandedShortUrl,
  extractDestinationFromWorkerResponse,
  getStoreDisplayName,
  WORKER_URLS,
} from './src/utils/affiliate.ts';
import {
  cleanHtmlText,
  FREE_TECH_RSS_FEEDS,
  CHINA_LEAK_RSS_FEEDS,
  ADDITIONAL_TECH_RSS_FEEDS,
  YOUTUBE_TECH_RSS_FEEDS,
  ALL_SYNDICATION_FEEDS,
  ALLORIGINS_PROXY_BASE,
  CODETABS_PROXY_BASE,
  parseRawXmlToRssItems,
  transformRssItemToArticle,
  containsChineseOrForeignScript,
  translateTextToEnglishFree,
  sanitizeSummaryDescription,
  type Rss2JsonResponse,
  type Rss2JsonItem,
} from './src/utils/rssParser.ts';
import { defaultTechArticles, type TechArticle } from './src/data/newsData.ts';
import { DEFAULT_YOUTUBE_TECH_VIDEOS } from './src/utils/youtubeApi.ts';
import {
  synthesizeWithDeterministicFallback,
  synthesizeOriginalTechArticle,
  getAvailableGeminiKeys,
} from './src/utils/aiSynthesizer.ts';
import {
  findBuiltInPhoneSpecs,
  generateDeterministicPhoneSpecs,
  isValidPhoneQuery,
} from './src/utils/phoneComparator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const CONTACT_FILE = path.resolve(__dirname, 'src/data/contact_submissions.json');
const REPORTS_FILE = path.resolve(__dirname, 'src/data/news_reports.json');
const ADMIN_NEWS_FILE = path.resolve(__dirname, 'src/data/admin_news.json');
const ADMIN_PHONES_FILE = path.resolve(__dirname, 'src/data/admin_phones.json');

// In-Memory Rate Limiting Tracker
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimits = new Map<string, RateLimitRecord>();

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimits.get(key);
  if (!record || now > record.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (record.count >= maxRequests) {
    return true;
  }
  record.count += 1;
  return false;
}

// Helper: Extract safe client IP for rate limiting
function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

// -------------------------------------------------------------
// REAL GEMINI 2.5 FLASH + DETERMINISTIC FALLBACK SYNTHESIS (SERVER-SIDE)
// Uses configured Gemini keys with 6-hour caching & key rotation,
// or falls back seamlessly to deterministic editorial synthesis.
// -------------------------------------------------------------
async function generateSynthesizedArticleServer(
  rawTitle: string,
  rawContent: string,
  sourceName = 'Official Technical Release',
  sourceUrl = ''
) {
  return synthesizeOriginalTechArticle(rawTitle, rawContent, sourceName, sourceUrl);
}

// Save contact submission safely with atomic write
function saveContactSubmission(entry: { name: string; email: string; category: string; message: string; timestamp: number }): boolean {
  try {
    const dir = path.dirname(CONTACT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let existing: any[] = [];
    if (fs.existsSync(CONTACT_FILE)) {
      existing = JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf-8'));
    }
    existing.push(entry);
    const tempFile = `${CONTACT_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(existing, null, 2), 'utf-8');
    fs.renameSync(tempFile, CONTACT_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save contact submission:', err);
    return false;
  }
}

// Save news report safely with atomic write
function saveNewsReport(entry: { articleId: string; articleTitle: string; reason: string; email?: string; details: string; timestamp: number }): boolean {
  try {
    const dir = path.dirname(REPORTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let existing: any[] = [];
    if (fs.existsSync(REPORTS_FILE)) {
      existing = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8'));
    }
    existing.push(entry);
    const tempFile = `${REPORTS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(existing, null, 2), 'utf-8');
    fs.renameSync(tempFile, REPORTS_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save news report:', err);
    return false;
  }
}

function loadAdminNews(): any[] {
  try {
    if (fs.existsSync(ADMIN_NEWS_FILE)) {
      return JSON.parse(fs.readFileSync(ADMIN_NEWS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load admin news file:', err);
  }
  return [];
}

function saveAdminNews(articles: any[]): boolean {
  try {
    const dir = path.dirname(ADMIN_NEWS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempFile = `${ADMIN_NEWS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(articles, null, 2), 'utf-8');
    fs.renameSync(tempFile, ADMIN_NEWS_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save admin news file:', err);
    return false;
  }
}

function loadAdminPhones(): Record<string, any> {
  try {
    if (fs.existsSync(ADMIN_PHONES_FILE)) {
      return JSON.parse(fs.readFileSync(ADMIN_PHONES_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load admin phones file:', err);
  }
  return {};
}

function saveAdminPhones(phones: Record<string, any>): boolean {
  try {
    const dir = path.dirname(ADMIN_PHONES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempFile = `${ADMIN_PHONES_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(phones, null, 2), 'utf-8');
    fs.renameSync(tempFile, ADMIN_PHONES_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save admin phones file:', err);
    return false;
  }
}

const ALLOWED_ARTICLE_DOMAINS = [
  'smartprix.com',
  'www.smartprix.com',
  'gsmarena.com',
  'www.gsmarena.com',
  'androidauthority.com',
  'www.androidauthority.com',
  'gadgets360.com',
  'www.gadgets360.com',
  '9to5google.com',
  'www.9to5google.com',
  'theverge.com',
  'www.theverge.com',
  'feeds.feedburner.com',
  'api.rss2json.com',
  'api.allorigins.win',
];

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Security Headers & Payload Size Limits
  app.use(express.json({ limit: '50kb' }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()');
    
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    const host = req.get('host');
    if (host) {
      if (/[\r\n\0\\;<>@]/.test(host) || host.length > 255) {
        console.warn(`[Security] Blocked malformed Host header: ${host}`);
        return res.status(400).send('Invalid Host header');
      }

      if (process.env.STRICT_HOST_CHECK === 'true') {
        const isAllowedHost =
          host === 'classifytech.ai.studio' ||
          host.endsWith('.ai.studio') ||
          host.endsWith('.run.app') ||
          host.includes('localhost') ||
          host.includes('127.0.0.1');
        if (!isAllowedHost) {
          console.warn(`[Security] Blocked request with unlisted Host header: ${host}`);
          return res.status(400).send('Invalid Host header');
        }
      }
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://tpc.googlesyndication.com https://*.adtrafficquality.google https://*.doubleclick.net"
      : "'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://tpc.googlesyndication.com https://*.adtrafficquality.google https://*.doubleclick.net";

    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src 'self' https://classify.classifytechz.workers.dev https://classifytech.classifytechz.workers.dev https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.adtrafficquality.google https://*.doubleclick.net https://api.rss2json.com https://api.allorigins.win https://api.codetabs.com https://api.mymemory.translated.net https://translate.googleapis.com https://en.wikipedia.org https://www.wikidata.org https://*.smartprix.com https://*.gsmarena.com https://*.androidauthority.com https://*.gadgets360.com https://*.9to5google.com https://*.theverge.com https://feeds.feedburner.com https: ws: wss:; frame-src 'self' https://www.google.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://*.googlesyndication.com https://*.adtrafficquality.google https://tpc.googlesyndication.com; frame-ancestors 'self' https://*.google.com https://*.google.dev https://*.aistudio.google.com https://aistudio.google.com https://*.run.app; form-action 'self';`
    );
    next();
  });

  // Health check endpoint with AI key telemetry
  app.get('/api/health', (_req: Request, res: Response) => {
    const activeKeys = getAvailableGeminiKeys();
    res.json({
      status: 'ok',
      service: 'CLASSIFY TECH API',
      aiConfigured: activeKeys.length > 0,
      activeKeyCount: activeKeys.length,
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  // Google AdSense & Search Engine Crawler endpoints
  app.get('/robots.txt', (_req: Request, res: Response) => {
    const robotsPath = path.resolve(__dirname, 'public/robots.txt');
    if (fs.existsSync(robotsPath)) {
      res.type('text/plain').sendFile(robotsPath);
    } else {
      res.type('text/plain').send('User-agent: *\nAllow: /\n\nUser-agent: Mediapartners-Google\nAllow: /\n');
    }
  });

  app.get('/ads.txt', (_req: Request, res: Response) => {
    const adsPath = path.resolve(__dirname, 'public/ads.txt');
    if (fs.existsSync(adsPath)) {
      res.type('text/plain').sendFile(adsPath);
    } else {
      res.type('text/plain').send('# Google AdSense Authorized Digital Sellers\n');
    }
  });

  // Public Content Fetch Endpoint (Serves Custom Articles & Phone Database)
  app.get('/api/content', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      customNews: loadAdminNews(),
      customPhones: loadAdminPhones(),
    });
  });

  // Contact Submission Endpoint with Persistent Storage & Anti-Spam Rate Limiting
  app.post('/api/contact', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (isRateLimited(`contact_${clientIp}`, 5, 15 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait a few minutes before submitting another inquiry.',
      });
    }

    const { name, email, category, message } = req.body;
    if (!name || !email || !message || typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Name, valid email address, and message description are required.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.',
      });
    }

    if (name.trim().length > 100 || email.trim().length > 150 || message.trim().length > 3000) {
      return res.status(400).json({
        success: false,
        error: 'Field length exceeds maximum limit.',
      });
    }

    const saved = saveContactSubmission({
      name: name.trim(),
      email: email.trim(),
      category: String(category || 'General Inquiry').slice(0, 100),
      message: message.trim(),
      timestamp: Date.now(),
    });

    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Storage error. Unable to save your contact submission.',
      });
    }

    return res.json({
      success: true,
      deliveryServiceConfigured: false,
      message: 'Your inquiry has been safely received and logged by our help desk.',
    });
  });

  // News Report Submission Endpoint with Persistent Storage & Anti-Spam Rate Limiting
  app.post('/api/report', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (isRateLimited(`report_${clientIp}`, 10, 15 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait a few minutes before submitting another report.',
      });
    }

    const { articleId, articleTitle, reason, email, details } = req.body;
    if (!articleId || !details || typeof details !== 'string' || !details.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Article ID and description details are required.',
      });
    }

    if (details.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Report description exceeds maximum length limit.',
      });
    }

    const saved = saveNewsReport({
      articleId: String(articleId).slice(0, 100),
      articleTitle: String(articleTitle || 'Untitled Story').slice(0, 200),
      reason: String(reason || 'Typo / Specification Correction').slice(0, 100),
      email: email ? String(email).trim().slice(0, 150) : undefined,
      details: details.trim(),
      timestamp: Date.now(),
    });

    if (!saved) {
      return res.status(500).json({
        success: false,
        error: 'Storage error. Unable to save your fact-check report.',
      });
    }

    return res.json({
      success: true,
      message: 'Fact-check report logged with editorial desk.',
    });
  });

  // API: Live RSS News Syndication (1,000+ Global & China Leak Network + Rotating Background Worker)
  let newsCache: { timestamp: number; articles: TechArticle[] } | null = null;
  const NEWS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
  const MAX_SLIDING_WINDOW_ARTICLES = 60;
  let rotationCursor = 0;
  let isBackgroundRotationRunning = false;

  // In-memory cache for full untruncated article content (1 hour TTL)
  const articleFullCache = new Map<string, { timestamp: number; paragraphs: string[]; lead?: string }>();

  async function extractFullArticleFromWeb(url: string): Promise<{ paragraphs: string[]; lead?: string } | null> {
    try {
      const cached = articleFullCache.get(url);
      if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
        return cached;
      }

      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:') return null;
      if (!ALLOWED_ARTICLE_DOMAINS.includes(parsedUrl.hostname)) return null;
      if (isPrivateOrProhibitedHost(parsedUrl.hostname)) return null;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (location) {
          const nextUrl = new URL(location, url).toString();
          const nextParsed = new URL(nextUrl);
          if (
            nextParsed.protocol === 'https:' &&
            ALLOWED_ARTICLE_DOMAINS.includes(nextParsed.hostname) &&
            !isPrivateOrProhibitedHost(nextParsed.hostname)
          ) {
            return extractFullArticleFromWeb(nextUrl);
          }
        }
        return null;
      }

      if (!res.ok) return null;

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return null;

      const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
      if (contentLength > 1024 * 1024) return null;

      const html = await res.text();
      if (html.length > 1024 * 1024) return null;

      let container = '';
      if (url.includes('smartprix.com')) {
        const m = html.match(/<div[^>]*class=["'][^"']*(?:entry-content|post-content|article-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        if (m) container = m[1];
      } else if (url.includes('gsmarena.com')) {
        const m = html.match(/<div[^>]*id=["']review-body["'][^>]*>([\s\S]*?)<\/div>/i);
        if (m) container = m[1];
      } else if (url.includes('theverge.com')) {
        const m = html.match(/<div[^>]*class=["'][^"']*c-entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        if (m) container = m[1];
      } else if (url.includes('9to5google.com')) {
        const m = html.match(/<div[^>]*class=["'][^"']*(?:post-content|entry-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        if (m) container = m[1];
      } else if (url.includes('androidauthority.com')) {
        const m = html.match(/<div[^>]*class=["'][^"']*(?:article-content|post-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        if (m) container = m[1];
      } else if (url.includes('gadgets360.com')) {
        const m = html.match(/<div[^>]*class=["'][^"']*(?:content_text|story__detail)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        if (m) container = m[1];
      }

      if (!container) {
        const art = html.match(/<article[\s\S]*?<\/article>/i);
        if (art) container = art[0];
        else {
          const main = html.match(/<main[\s\S]*?<\/main>/i);
          if (main) container = main[0];
          else container = html;
        }
      }

      const pMatches = container.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
      const paragraphs: string[] = [];
      const seen = new Set<string>();

      for (const p of pMatches) {
        const clean = cleanHtmlText(p);
        if (
          clean.length > 35 &&
          !clean.toLowerCase().startsWith('via') &&
          !clean.toLowerCase().startsWith('source:') &&
          !clean.toLowerCase().includes('cookie policy') &&
          !clean.toLowerCase().includes('all rights reserved') &&
          !clean.toLowerCase().includes('subscribe to our') &&
          !seen.has(clean.toLowerCase())
        ) {
          seen.add(clean.toLowerCase());
          paragraphs.push(clean);
        }
      }

      if (paragraphs.length > 0) {
        const result = {
          paragraphs,
          lead: paragraphs[0],
        };
        articleFullCache.set(url, { timestamp: Date.now(), ...result });
        return result;
      }
    } catch {
      // Network or parse error
    }
    return null;
  }

  const NON_TECH_FINANCE_REGEX =
    /\b(bitcoin\s+trades|options\s+traders|crypto\s+price|dogecoin|ethereum\s+price|sensex|nifty\s+50|stock\s+market\s+today)\b/i;

  /**
   * Fetches a single RSS/Atom/YouTube feed with 4-tier fallback and translates any Chinese/foreign items to English.
   */
  async function fetchSingleFeedArticles(
    feed: { name: string; rssUrl: string },
    timeoutMs = 3800,
    maxItems = 5
  ): Promise<TechArticle[]> {
    const cb = Math.floor(Date.now() / 180000);
    let rawItems: Rss2JsonItem[] = [];
    let resolvedFeedTitle = feed.name;

    // 1. Direct XML fetch
    try {
      const directRes = await fetch(feed.rssUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (directRes.ok) {
        const xml = await directRes.text();
        if (xml.includes('<item') || xml.includes('<entry')) {
          rawItems = parseRawXmlToRssItems(xml);
        }
      }
    } catch {
      // Proceed to rss2json
    }

    // 2. Free rss2json API
    if (rawItems.length === 0) {
      try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
          feed.rssUrl
        )}&_cb=${cb}`;
        const response = await fetch(apiUrl, {
          headers: { 'User-Agent': 'CLASSIFY-TECH/1.0', Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.ok) {
          const data: Rss2JsonResponse = await response.json();
          if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
            rawItems = data.items;
            resolvedFeedTitle = data.feed?.title || feed.name;
          }
        }
      } catch {
        // Proceed to AllOrigins
      }
    }

    // 3. Free AllOrigins CORS XML fallback
    if (rawItems.length === 0) {
      try {
        const proxyUrl = `${ALLORIGINS_PROXY_BASE}${encodeURIComponent(feed.rssUrl)}&_cb=${cb}`;
        const proxyRes = await fetch(proxyUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (proxyRes.ok) {
          const payload = (await proxyRes.json()) as { contents?: string };
          if (payload && typeof payload.contents === 'string' && payload.contents.length > 40) {
            rawItems = parseRawXmlToRssItems(payload.contents);
          }
        }
      } catch {
        // Proceed to CodeTabs
      }
    }

    // 4. Free CodeTabs XML fallback
    if (rawItems.length === 0) {
      try {
        const codeTabsUrl = `${CODETABS_PROXY_BASE}${encodeURIComponent(feed.rssUrl)}`;
        const ctRes = await fetch(codeTabsUrl, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (ctRes.ok) {
          const xml = await ctRes.text();
          if (xml && (xml.includes('<item') || xml.includes('<entry'))) {
            rawItems = parseRawXmlToRssItems(xml);
          }
        }
      } catch {
        // Silent fallback
      }
    }

    if (rawItems.length === 0) return [];

    const articles = rawItems
      .slice(0, maxItems)
      .map((item) => transformRssItemToArticle(item, resolvedFeedTitle));

    for (const article of articles) {
      try {
        if (containsChineseOrForeignScript(article.title)) {
          article.title = await translateTextToEnglishFree(article.title);
        }
        if (containsChineseOrForeignScript(article.desc)) {
          article.desc = await translateTextToEnglishFree(article.desc.slice(0, 420));
        }
        if (Array.isArray(article.fullBody) && article.fullBody.some((p) => containsChineseOrForeignScript(p))) {
          const translatedParas: string[] = [];
          for (const para of article.fullBody.slice(0, 3)) {
            translatedParas.push(
              containsChineseOrForeignScript(para)
                ? await translateTextToEnglishFree(para.slice(0, 420))
                : para
            );
          }
          article.fullBody = translatedParas;
        }
        const sourceText = article.fullBody.join('\n\n') || article.desc;

        const synthesized = synthesizeWithDeterministicFallback(
          article.title,
          sourceText,
          article.sourceName || 'Tech Announcement',
          article.sourceUrl || ''
        );

        if (synthesized) {
          article.title = synthesized.headline;
          article.desc = sanitizeSummaryDescription(synthesized.leadSummary, synthesized.headline);
          article.fullBody = synthesized.paragraphs;
          if (synthesized.bullets && synthesized.bullets.length > 0) {
            article.bullets = synthesized.bullets;
          }
        }
      } catch {
        // Safe fallback
      }
    }

    return articles;
  }

  const NON_TECH_CRIME_REGEX =
    /\b(criminal\s+detention|detained\s+by\s+police|arrest\s+by\s+the\s+police|police\s+arrest|refund\s+only|refund\s+fraud|freshippo|hema|supermarket\s+fraud)\b/i;

  /**
   * Merges incoming live articles with existing articles, deduplicates by normalized title & URL,
   * sorts strictly newest-first (`b.publishedAtMs - a.publishedAtMs`), assigns `isHero = true` ONLY
   * to index 0, and trims to the 60-article sliding window.
   */
  function mergeAndSortLiveArticles(
    incoming: TechArticle[],
    existing: TechArticle[] = []
  ): TechArticle[] {
    const nowMs = Date.now();
    const seenTitles = new Set<string>();
    const seenUrls = new Set<string>();
    const merged: TechArticle[] = [];

    for (const item of [...incoming, ...existing]) {
      if (!item || !item.title) continue;
      if (NON_TECH_FINANCE_REGEX.test(item.title) || NON_TECH_CRIME_REGEX.test(`${item.title} ${item.desc}`)) continue;
      if (containsChineseOrForeignScript(item.title) || containsChineseOrForeignScript(item.desc)) continue;
      const titleKey = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const urlKey = (item.sourceUrl || '').toLowerCase().trim();
      if (!titleKey || seenTitles.has(titleKey)) continue;
      if (urlKey && urlKey.length > 12 && seenUrls.has(urlKey)) continue;

      seenTitles.add(titleKey);
      if (urlKey && urlKey.length > 12) seenUrls.add(urlKey);

      const clampedMs =
        typeof item.publishedAtMs === 'number' && Number.isFinite(item.publishedAtMs) && item.publishedAtMs > 0
          ? Math.min(nowMs, item.publishedAtMs)
          : nowMs - 7 * 24 * 3600 * 1000;

      merged.push({
        ...item,
        desc: sanitizeSummaryDescription(item.desc, item.title),
        publishedAtMs: clampedMs,
      });
    }

    // Strict newest-first chronological sort
    merged.sort((a, b) => b.publishedAtMs - a.publishedAtMs);

    return merged.slice(0, MAX_SLIDING_WINDOW_ARTICLES).map((art, idx) => ({
      ...art,
      isHero: idx === 0,
    }));
  }

  // Primary high-speed feeds fetched immediately for sub-1.5s initial response
  const PRIMARY_FAST_FEEDS = [
    ...FREE_TECH_RSS_FEEDS,
    CHINA_LEAK_RSS_FEEDS[0], // IT Home China
    CHINA_LEAK_RSS_FEEDS[1], // Gizmochina
    CHINA_LEAK_RSS_FEEDS[5], // China Tipster & TENAA Leak Wire
    ADDITIONAL_TECH_RSS_FEEDS[0], // Gadgets 360
    ADDITIONAL_TECH_RSS_FEEDS[5], // 9to5Mac
    ADDITIONAL_TECH_RSS_FEEDS[17], // Global Semiconductor & AI Wire
    YOUTUBE_TECH_RSS_FEEDS[0], // CLASSIFY TECH Official
    YOUTUBE_TECH_RSS_FEEDS[1], // MKBHD
  ].filter(Boolean);

  /**
   * Background Rotating Feed Worker: continuously rotates through the 42-feed Global, China & YouTube
   * syndication matrix every 2.5 minutes without blocking user requests.
   */
  async function rotateRemainingFeedsInBackground() {
    if (isBackgroundRotationRunning) return;
    isBackgroundRotationRunning = true;
    try {
      const batchSize = 10;
      const batch: { name: string; rssUrl: string }[] = [];
      for (let i = 0; i < batchSize; i++) {
        const feed = ALL_SYNDICATION_FEEDS[(rotationCursor + i) % ALL_SYNDICATION_FEEDS.length];
        if (feed) batch.push(feed);
      }
      rotationCursor = (rotationCursor + batchSize) % ALL_SYNDICATION_FEEDS.length;

      const settled = await Promise.allSettled(
        batch.map((feed) => fetchSingleFeedArticles(feed, 4500, 5))
      );

      const discovered: TechArticle[] = [];
      for (const r of settled) {
        if (r.status === 'fulfilled' && Array.isArray(r.value) && r.value.length > 0) {
          discovered.push(...r.value);
        }
      }

      if (discovered.length > 0) {
        const updated = mergeAndSortLiveArticles(
          discovered,
          newsCache ? newsCache.articles : []
        );
        newsCache = {
          timestamp: Date.now(),
          articles: updated,
        };
      }
    } catch {
      // Silent background worker
    } finally {
      isBackgroundRotationRunning = false;
    }
  }

  // Kick off background feed rotation every 2.5 minutes
  setInterval(() => {
    void rotateRemainingFeedsInBackground();
  }, 150 * 1000);

  app.get('/api/news/rss', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const clientIp = getClientIp(req);

      if (forceRefresh && isRateLimited(`rss_refresh_${clientIp}`, 5, 3 * 60 * 1000)) {
        if (newsCache && newsCache.articles.length > 0) {
          return res.json({
            success: true,
            fromCache: true,
            rateLimited: true,
            count: newsCache.articles.length,
            articles: newsCache.articles,
          });
        }
      }

      if (!forceRefresh && newsCache && Date.now() - newsCache.timestamp < NEWS_CACHE_TTL_MS) {
        return res.json({
          success: true,
          fromCache: true,
          count: newsCache.articles.length,
          articles: newsCache.articles,
        });
      }

      const settled = await Promise.allSettled(
        PRIMARY_FAST_FEEDS.map((feed) => fetchSingleFeedArticles(feed, 3600, 5))
      );

      const aggregated: TechArticle[] = [];
      for (const result of settled) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          aggregated.push(...result.value);
        }
      }

      if (aggregated.length > 0) {
        const merged = mergeAndSortLiveArticles(
          aggregated,
          newsCache ? newsCache.articles : []
        );

        newsCache = {
          timestamp: Date.now(),
          articles: merged,
        };

        // Trigger asynchronous background rotation for remaining global/China feeds
        void rotateRemainingFeedsInBackground();

        return res.json({
          success: true,
          fromCache: false,
          count: merged.length,
          articles: merged,
        });
      }

      if (newsCache && newsCache.articles.length > 0) {
        return res.json({
          success: true,
          fromCache: true,
          count: newsCache.articles.length,
          articles: newsCache.articles,
        });
      }

      return res.json({
        success: true,
        fromCache: true,
        count: defaultTechArticles.length,
        articles: defaultTechArticles,
      });
    } catch (err) {
      console.error('Error in /api/news/rss:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to syndicate RSS news.',
        articles: newsCache ? newsCache.articles : [],
      });
    }
  });

  // In-memory cache & in-flight promise map for detailed article synthesis (2 hours TTL)
  const serverArticleSynthesisCache = new Map<string, { timestamp: number; data: any }>();
  const inFlightArticleRequests = new Map<string, Promise<any>>();
  const ARTICLE_SYNTHESIS_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

  // Dedicated endpoint to fetch untruncated full article content on-demand with AI synthesis
  app.get('/api/news/article', async (req: Request, res: Response) => {
    try {
      const targetUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      const rawTitle = typeof req.query.title === 'string' ? req.query.title.trim() : 'Tech Hardware Announcement';
      const sourceName = typeof req.query.source === 'string' ? req.query.source.trim() : 'Technical Release';

      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({ success: false, error: 'Valid URL parameter required' });
      }

      try {
        const parsed = new URL(targetUrl);
        if (isPrivateOrProhibitedHost(parsed.hostname)) {
          return res.status(403).json({ success: false, error: 'Access to internal or prohibited host is denied.' });
        }
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Invalid URL format.' });
      }

      const cacheKey = `${rawTitle}_${targetUrl}`.toLowerCase().trim();
      const cached = serverArticleSynthesisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ARTICLE_SYNTHESIS_CACHE_TTL_MS) {
        return res.json({
          success: true,
          fromCache: true,
          ...cached.data,
        });
      }

      let synthesisPromise = inFlightArticleRequests.get(cacheKey);
      if (!synthesisPromise) {
        synthesisPromise = (async () => {
          const extracted = await extractFullArticleFromWeb(targetUrl);
          const sourceText = extracted && extracted.paragraphs.length > 0
            ? extracted.paragraphs.join('\n\n')
            : rawTitle;

          const synthesized = await generateSynthesizedArticleServer(
            rawTitle,
            sourceText,
            sourceName,
            targetUrl
          );

          const payload = {
            headline: synthesized.headline,
            lead: synthesized.leadSummary,
            paragraphs: synthesized.paragraphs,
            bullets: synthesized.bullets,
            sourceAttribution: synthesized.sourceAttribution,
            count: synthesized.paragraphs.length,
            isAiGenerated: synthesized.isAiGenerated,
          };

          serverArticleSynthesisCache.set(cacheKey, {
            timestamp: Date.now(),
            data: payload,
          });

          return payload;
        })().finally(() => {
          inFlightArticleRequests.delete(cacheKey);
        });

        inFlightArticleRequests.set(cacheKey, synthesisPromise);
      }

      const payload = await synthesisPromise;
      return res.json({
        success: true,
        ...payload,
      });
    } catch (err) {
      console.error('Error in /api/news/article:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch article' });
    }
  });

  // -------------------------------------------------------------
  // ZERO-TOKEN SMARTPHONE SPECS COMPARATOR (/api/compare/specs)
  // Resolves from built-in DB or deterministic hardware spec engine
  // with strict 2-requests-per-hour rate limiting and 0 API token usage.
  // -------------------------------------------------------------
  interface CachedCompareEntry {
    timestamp: number;
    specs: Record<string, unknown>;
  }
  const compareSpecsCache = new Map<string, CachedCompareEntry>();
  const COMPARE_CACHE_TTL_MS = 60 * 60 * 1000;

  app.post('/api/compare/specs', async (req: Request, res: Response) => {
    const rawName = typeof req.body?.deviceName === 'string' ? req.body.deviceName.trim() : '';
    if (!isValidPhoneQuery(rawName)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid smartphone model name.',
      });
    }

    const cacheKey = rawName.toLowerCase();
    const cached = compareSpecsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < COMPARE_CACHE_TTL_MS) {
      return res.json({ success: true, specs: cached.specs, cached: true });
    }

    const builtIn = findBuiltInPhoneSpecs(rawName);
    if (builtIn) {
      const payload = {
        Name: builtIn.name,
        Price: builtIn.price,
        Processor: builtIn.cpu,
        Fab: builtIn.nm,
        AnTuTu: builtIn.antutu,
        Geekbench: builtIn.geek,
        Display: builtIn.display,
        Protection: builtIn.build,
        RAM: builtIn.ram,
        RearCam: builtIn.cam_rear,
        FrontCam: builtIn.cam_front,
        Gaming: builtIn.gaming,
        FiveG: builtIn.bands5g,
        Connectivity: builtIn.wifi,
        Audio: builtIn.audio,
        Battery: builtIn.battery,
        OS: builtIn.os,
        Verdict: builtIn.verdict,
      };
      compareSpecsCache.set(cacheKey, { timestamp: Date.now(), specs: payload });
      return res.json({ success: true, specs: payload, cached: true });
    }

    const clientIp = getClientIp(req);
    if (isRateLimited(`compare_autoadd_${clientIp}`, 2, 60 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        error: 'Auto-Add limit reached (max 2 custom phones per hour). Please select from the built-in device list or try again later.',
      });
    }

    const generated = generateDeterministicPhoneSpecs(rawName);
    const payload = {
      Name: generated.name,
      Price: generated.price,
      Processor: generated.cpu,
      Fab: generated.nm,
      AnTuTu: generated.antutu,
      Geekbench: generated.geek,
      Display: generated.display,
      Protection: generated.build,
      RAM: generated.ram,
      RearCam: generated.cam_rear,
      FrontCam: generated.cam_front,
      Gaming: generated.gaming,
      FiveG: generated.bands5g,
      Connectivity: generated.wifi,
      Audio: generated.audio,
      Battery: generated.battery,
      OS: generated.os,
      Verdict: generated.verdict,
    };

    compareSpecsCache.set(cacheKey, { timestamp: Date.now(), specs: payload });
    return res.json({ success: true, specs: payload, cached: false });
  });

  // -------------------------------------------------------------
  // ZERO-TOKEN SOCIAL TECH RADAR (/api/social/radar)
  // -------------------------------------------------------------
  const CURATED_SOCIAL_RADAR_ITEMS = [
    {
      id: 'radar-1',
      platform: 'X (Twitter)',
      topic: '3nm Silicon Telemetry',
      headline: 'Snapdragon 8 Elite vs Dimensity 9400 Sustained 120FPS Benchmarks',
      summary: 'Independent hardware testers report 38% lower GPU power draw on second-generation 3nm TSMC N3E flagship chipsets.',
      hashtags: ['#Snapdragon8Elite', '#Dimensity9400', '#CLASSIFYTECH'],
      heatLabel: 'Trending Now',
    },
    {
      id: 'radar-2',
      platform: 'X / Weibo',
      topic: 'Battery Chemistry',
      headline: '7,500mAh Silicon-Carbon Batteries Enter Sub-8.1mm Flagship Production',
      summary: 'Supply-chain leaks confirm high-density Si/C anode batteries with 100W PPS fast charging across upcoming flagships.',
      hashtags: ['#ChinaFlagships', '#BatteryTech', '#CLASSIFYTECH'],
      heatLabel: 'Hot Scoop',
    },
  ];

  const handleSocialRadar = async (_req: Request, res: Response) => {
    const updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return res.json({
      success: true,
      items: CURATED_SOCIAL_RADAR_ITEMS,
      updatedAt,
      cached: true,
    });
  };

  app.get('/api/social/radar', handleSocialRadar);
  app.post('/api/social/radar', handleSocialRadar);

  // -------------------------------------------------------------
  // GLOBAL YOUTUBE RSS PROXY (/api/youtube/global)
  // -------------------------------------------------------------
  const GLOBAL_YOUTUBE_CHANNELS = [
    { id: 'UCBJycsmduvYEL83R_U4JriQ', name: 'Marques Brownlee' },
    { id: 'UCMiJRAwDNSNzuYeN2uWa0pA', name: 'Mrwhosetheboss' },
    { id: 'UCXUJJNoP1QupwsYIWFXmsZg', name: 'Tech Burner' },
    { id: 'UCEPL07qzVsOcHd3sMUws65g', name: 'Trakin Tech' },
    { id: 'UCVYamHliCI9rw1tHR1xbkfw', name: 'Dave2D' },
    { id: 'UCp0jHiCTqxDYZ0Bi0sKUmbw', name: 'CLASSIFY TECH' },
  ];

  let youtubeGlobalCache: { timestamp: number; videos: any[] } | null = null;
  const YT_CACHE_TTL_MS = 20 * 60 * 1000;

  app.get('/api/youtube/global', async (req: Request, res: Response) => {
    const force = req.query.refresh === 'true';
    if (!force && youtubeGlobalCache && Date.now() - youtubeGlobalCache.timestamp < YT_CACHE_TTL_MS) {
      return res.json({ success: true, videos: youtubeGlobalCache.videos, cached: true });
    }

    try {
      const results = await Promise.allSettled(
        GLOBAL_YOUTUBE_CHANNELS.map(async (channel) => {
          const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
          const xmlRes = await fetch(feedUrl, {
            headers: { 'User-Agent': 'CLASSIFY-TECH-RSS/1.0' },
            signal: AbortSignal.timeout(7000),
          });
          if (!xmlRes.ok) return [];
          const xmlText = await xmlRes.text();
          const entries = Array.from(xmlText.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)).slice(0, 3);
          return entries
            .map((match) => {
              const block = match[1];
              const videoId = (block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1] || '').trim();
              const title = cleanHtmlText(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
              const link = block.match(/<link[^>]+href="([^"]+)"/i)?.[1] || `https://www.youtube.com/watch?v=${videoId}`;
              const publishedAt = (block.match(/<published>([^<]+)<\/published>/i)?.[1] || '').trim();
              const description = cleanHtmlText(block.match(/<media:description>([\s\S]*?)<\/media:description>/i)?.[1] || '');
              if (!videoId || !title) return null;
              return {
                id: videoId,
                channelId: channel.id,
                title,
                description:
                  description.slice(0, 180) ||
                  `Watch the latest tech coverage from ${channel.name} on YouTube.`,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                channelTitle: channel.name,
                publishedAt,
                formattedDate: publishedAt
                  ? new Date(publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Latest Upload',
                videoUrl: link,
                category: 'GLOBAL',
              };
            })
            .filter(Boolean);
        })
      );

      const collected: any[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          collected.push(...r.value);
        }
      }

      collected.sort(
        (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
      );

      const deduped = Array.from(new Map(collected.map((v) => [v.id, v])).values()).slice(0, 12);
      if (deduped.length > 0) {
        youtubeGlobalCache = { timestamp: Date.now(), videos: deduped };
        return res.json({ success: true, videos: deduped });
      }

      return res.json({
        success: true,
        videos: DEFAULT_YOUTUBE_TECH_VIDEOS,
        fallback: true,
      });
    } catch (err) {
      return res.json({
        success: true,
        videos: DEFAULT_YOUTUBE_TECH_VIDEOS,
        fallback: true,
      });
    }
  });

  // -------------------------------------------------------------
  // CLASSIFY TECH Smart Affiliate Shortener & Hidden Post Redirects
  // -------------------------------------------------------------

  // 1. API: Shorten product link & 4-step Ghost Post KV sync with Cloudflare Worker
  app.post('/api/shorten', async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    if (isRateLimited(`shorten_${clientIp}`, 30, 60 * 1000)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait a minute before creating more short links.',
      });
    }

    try {
      const { url, code: clientCode, customCode: clientCustomCode, postId: clientPostId } = req.body || {};
      if (!url || typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ success: false, error: 'Please enter a valid Amazon, Flipkart, or Myntra link.' });
      }

      const trimmedUrl = url.trim();
      const customCode = (clientCustomCode || clientCode || '').replace(/^post-/, '').trim();
      const validation = isSupportedRetailerUrl(trimmedUrl);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error || 'Only Amazon, Flipkart, and Myntra product links are supported.',
        });
      }

      // Step 1: Send raw `{ url }` via POST to Cloudflare Worker to obtain untouched affiliateUrl
      let workerData: any = null;
      for (const domain of WORKER_URLS) {
        try {
          const cfRes = await fetch(domain, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: trimmedUrl }),
            signal: AbortSignal.timeout(9000),
          });
          if (cfRes.ok) {
            const json = await cfRes.json();
            if (json && json.success && json.affiliateUrl) {
              workerData = json;
              break;
            }
          }
        } catch {
          // try next worker URL
        }
      }

      if (!workerData || !workerData.affiliateUrl) {
        return res.status(502).json({
          success: false,
          error: 'Cloudflare Worker synchronization failed. Please try again.',
        });
      }

      const exactAffiliateUrl = workerData.affiliateUrl;
      const resolvedUrl = workerData.resolvedUrl || trimmedUrl;
      const resolvedStore = workerData.store || validation.store || 'amazon';

      // Step 2: Generate website shortCode
      const shortCode = customCode || generateShortCode(6);

      // Step 3: Build website short link dynamically
      const reqProtocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const reqHost = req.get('host') || 'localhost:3000';
      const reqOrigin = `${reqProtocol}://${reqHost}`;
      const brandedShortUrl = buildBrandedShortUrl(shortCode, reqOrigin);

      // Step 4: Send `{ shortCode, affiliateUrl, resolvedUrl, store }` via POST to Worker to persist in KV
      for (const domain of WORKER_URLS) {
        try {
          const saveRes = await fetch(domain, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shortCode,
              affiliateUrl: exactAffiliateUrl,
              resolvedUrl,
              store: resolvedStore,
            }),
            signal: AbortSignal.timeout(7000),
          });
          if (saveRes.ok) break;
        } catch {
          // try next
        }
      }

      return res.json({
        success: true,
        resolvedUrl,
        affiliateUrl: exactAffiliateUrl,
        store: resolvedStore,
        storeName: getStoreDisplayName(resolvedStore),
        shortCode,
        code: shortCode,
        postId: clientPostId || `post-${shortCode}`,
        shortUrl: brandedShortUrl,
        error: null,
      });
    } catch (err: any) {
      console.error('Error in /api/shorten proxy:', err);
      return res.status(500).json({
        success: false,
        error: err.name === 'AbortError' ? 'Cloudflare Worker request timed out. Please try again.' : 'Failed to process affiliate link.',
      });
    }
  });

  // Server-side KV sync relay for Step 4
  app.post('/api/shorten/kv-sync', async (req: Request, res: Response) => {
    const { shortCode, affiliateUrl, resolvedUrl, store } = req.body || {};
    if (!shortCode || !affiliateUrl) {
      return res.status(400).json({ success: false, error: 'shortCode and affiliateUrl are required.' });
    }
    for (const domain of WORKER_URLS) {
      try {
        const cfRes = await fetch(domain, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shortCode, affiliateUrl, resolvedUrl, store }),
          signal: AbortSignal.timeout(7000),
        });
        if (cfRes.ok) {
          const data = await cfRes.json();
          return res.json(data);
        }
      } catch {
        // try next
      }
    }
    return res.status(502).json({ success: false, error: 'KV sync failed.' });
  });

  // 2. API: Resolve short link from Cloudflare Worker KV
  app.get('/api/resolve/:code', async (req: Request, res: Response) => {
    const rawCode = req.params.code;
    const cleanCode = (rawCode || '').replace(/^post-/, '').trim();
    if (!cleanCode || !/^[a-zA-Z0-9_-]{4,24}$/.test(cleanCode)) {
      return res.status(400).json({ success: false, error: 'Invalid short code format.' });
    }

    try {
      let destination: string | null = null;
      let storeKey: string | undefined;

      for (const domain of WORKER_URLS) {
        // Primary: Worker JSON endpoint `/?code=<shortCode>`
        try {
          const kvRes = await fetch(`${domain}/?code=${encodeURIComponent(cleanCode)}`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(6000),
          });
          if (kvRes.ok) {
            const kvJson = await kvRes.json();
            const candidate = kvJson.affiliateUrl || kvJson.url || kvJson.target;
            if (candidate && typeof candidate === 'string' && candidate.startsWith('http')) {
              destination = candidate.trim();
              if (kvJson.store) storeKey = kvJson.store;
              break;
            }
          }
        } catch {
          // try direct path fallback
        }

        // Secondary: Direct shortcode path (`/:code`)
        try {
          const directUrl = `${domain}/${encodeURIComponent(cleanCode)}`;
          const directRes = await fetch(directUrl, {
            headers: {
              Accept: 'text/html,application/json,*/*',
              'User-Agent': 'Mozilla/5.0 (CLASSIFY-TECH-Proxy/1.0)',
            },
            redirect: 'manual',
            signal: AbortSignal.timeout(6000),
          });

          const loc = directRes.headers.get('location');
          if (loc && typeof loc === 'string' && loc.startsWith('http')) {
            destination = loc.trim();
            break;
          }

          if (directRes.ok) {
            const bodyText = await directRes.text();
            const extracted = extractDestinationFromWorkerResponse(bodyText, directRes.headers);
            if (extracted) {
              destination = extracted;
              break;
            }
          }
        } catch {
          // try next domain
        }
      }

      if (destination) {
        const storeValidation = isSupportedRetailerUrl(destination);
        const resolvedStore = storeKey || storeValidation.store || 'amazon';
        const resolvedStoreName = getStoreDisplayName(resolvedStore);

        return res.json({
          success: true,
          code: cleanCode,
          postId: `post-${cleanCode}`,
          affiliateUrl: destination,
          store: resolvedStore,
          storeName: resolvedStoreName,
        });
      }

      return res.status(404).json({
        success: false,
        code: cleanCode,
        error: 'Short link not found in Cloudflare KV or has expired.',
      });
    } catch (err: any) {
      console.error(`Error resolving shortcode ${cleanCode}:`, err);
      return res.status(500).json({ success: false, error: 'Network error resolving short link.' });
    }
  });

  // 3. Ghost Post SPA route handler for /s/:code and /post/:id
  app.get(['/s/:code', '/post/:id'], (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html')) {
      const rawCode = req.params.code || (req.params.id ? req.params.id.replace(/^post-/, '') : '');
      const queryStr = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return res.redirect(307, `/api/resolve/${encodeURIComponent(rawCode)}${queryStr}`);
    }

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const distPath = path.resolve(__dirname, 'dist');
      return res.sendFile(path.resolve(distPath, 'index.html'));
    }
    return next();
  });

  // Google Search Console HTML file verification route
  app.get('/google239ae2d0e50d07f1.html', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send('google-site-verification: google239ae2d0e50d07f1.html');
  });

  // Ensure standalone Blogger theme XML exists cleanly without affecting Vite index.html
  const rootBloggerXmlPath = path.resolve(__dirname, 'blogger-theme.xml');
  const publicBloggerXmlPath = path.resolve(__dirname, 'public/blogger-theme.xml');
  const needsBloggerXmlBuild =
    !fs.existsSync(rootBloggerXmlPath) ||
    !fs.existsSync(publicBloggerXmlPath) ||
    fs.statSync(rootBloggerXmlPath).size < 10000;
  if (needsBloggerXmlBuild) {
    try {
      const { execFileSync } = await import('node:child_process');
      execFileSync(process.execPath, [path.resolve(__dirname, 'scripts/build-blogger-theme.mjs')], {
        cwd: __dirname,
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'inherit',
      });
    } catch (buildErr) {
      console.error('Failed to auto-build blogger-theme.xml on startup:', buildErr);
    }
  }

  // Direct XML route for standalone Blogger theme (no UI buttons added)
  app.get('/blogger-theme.xml', (req: Request, res: Response) => {
    const xmlFile = fs.existsSync(publicBloggerXmlPath) ? publicBloggerXmlPath : rootBloggerXmlPath;
    if (req.query.download === '1' || req.query.download === 'true') {
      res.setHeader('Content-Disposition', 'attachment; filename="blogger-theme.xml"');
    }
    res.type('application/xml; charset=utf-8').sendFile(xmlFile);
  });

  // Mount Vite in dev (AI Studio preview) or static dist/ in production (GitHub/Node deployment)
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CLASSIFY TECH server running on http://0.0.0.0:${PORT}`);
  });
}

const isMainModule = () => {
  if (!process.argv[1]) return false;
  if (process.argv.some((arg) => arg.includes('--test') || arg.includes('test.ts'))) {
    return false;
  }
  const resolvedArg = path.resolve(process.argv[1]);
  const currentFile = fileURLToPath(import.meta.url);
  return (
    resolvedArg === currentFile ||
    process.argv[1].endsWith('server.ts') ||
    process.argv[1].endsWith('server.js')
  );
};

if (isMainModule()) {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}
