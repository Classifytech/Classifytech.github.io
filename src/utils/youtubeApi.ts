/**
 * CLASSIFY TECH Global YouTube RSS Feed Integration
 * Aggregates latest tech coverage from CLASSIFY TECH and major global tech creators
 * using api.rss2json.com with server-side XML RSS proxy (/api/youtube/global) fallback
 * and deterministic featured cards when offline or throttled.
 */

export const YOUTUBE_CHANNEL_ID = 'UCp0jHiCTqxDYZ0Bi0sKUmbw';
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/channel/UCp0jHiCTqxDYZ0Bi0sKUmbw';

export const techChannels: string[] = [
  'UCBJycsmduvYEL83R_U4JriQ', // Marques Brownlee (MKBHD)
  'UCMiJRAwDNSNzuYeN2uWa0pA', // Mrwhosetheboss
  'UCXUJJNoP1QupwsYIWFXmsZg', // Tech Burner
  'UCEPL07qzVsOcHd3sMUws65g', // Trakin Tech
  'UCVYamHliCI9rw1tHR1xbkfw', // Dave2D
  'UCO2WJZKQoDW4Te6NHx4KfTg', // Geekyranjit
  'UC9d89_bf0p2fb89242kG8IQ', // Gyan Therapy
  'UCWFKCr40YwOZQx8FHU_ZqqQ', // JerryRigEverything
  'UCp0jHiCTqxDYZ0Bi0sKUmbw', // CLASSIFY TECH (blended naturally at end)
];

export const TECH_CHANNEL_META: Record<string, { name: string; handle: string }> = {
  UCBJycsmduvYEL83R_U4JriQ: { name: 'Marques Brownlee', handle: '@mkbhd' },
  UCMiJRAwDNSNzuYeN2uWa0pA: { name: 'Mrwhosetheboss', handle: '@mrwhosetheboss' },
  UCXUJJNoP1QupwsYIWFXmsZg: { name: 'Tech Burner', handle: '@TechBurner' },
  UCEPL07qzVsOcHd3sMUws65g: { name: 'Trakin Tech', handle: '@TrakinTech' },
  UCVYamHliCI9rw1tHR1xbkfw: { name: 'Dave2D', handle: '@Dave2D' },
  UCO2WJZKQoDW4Te6NHx4KfTg: { name: 'Geekyranjit', handle: '@Geekyranjit' },
  UC9d89_bf0p2fb89242kG8IQ: { name: 'Gyan Therapy', handle: '@GyanTherapy' },
  UCWFKCr40YwOZQx8FHU_ZqqQ: { name: 'JerryRigEverything', handle: '@JerryRigEverything' },
  UCp0jHiCTqxDYZ0Bi0sKUmbw: { name: 'CLASSIFY TECH', handle: '@classifytech' },
};

export interface YouTubeVideoItem {
  id: string;
  channelId?: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  formattedDate: string;
  videoUrl: string;
  durationLabel?: string;
  category?: string;
}

export interface Rss2JsonYouTubeItem {
  title?: string;
  pubDate?: string;
  link?: string;
  guid?: string;
  author?: string;
  thumbnail?: string;
  description?: string;
  enclosure?: {
    link?: string;
  };
}

export interface Rss2JsonYouTubeResponse {
  status?: string;
  feed?: {
    title?: string;
  };
  items?: Rss2JsonYouTubeItem[];
}

export interface YouTubeNewsArticleCard {
  id: string;
  channelTitle: string;
  headline: string;
  topic: string;
  specialFeature: string;
  editorialSummary: string;
  thumbnail: string;
  formattedDate: string;
  durationLabel?: string;
  category?: string;
  videoUrl: string;
  ctaLabel: string;
}

/**
 * Transformative Fair-Use YouTube News Article Summary Generator.
 * Converts raw YouTube RSS metadata into an original editorial news summary card
 * with direct traffic redirection back to the creator's official YouTube URL.
 */
export function renderYouTubeNewsCard(videoData: YouTubeVideoItem): YouTubeNewsArticleCard {
  const channelName = (videoData.channelTitle || 'Tech Creator').trim();
  const rawTitle = (videoData.title || 'Next-Gen Flagship Hardware').trim();

  const topicSegment = rawTitle
    .split(/[:|—–]/)[0]
    .replace(/\b(review|unboxing|hands-on|first look|explained|test|shootout)\b/gi, '')
    .replace(/[!?⚡🔥]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+&\s*$/, '')
    .trim();
  const topic = (topicSegment.length >= 4 ? topicSegment : rawTitle).replace(/[.!?]+$/, '').trim();

  const rawDesc = (videoData.description || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Split sentences without breaking decimal numbers like 8.2mm or 9.5mm
  const firstClause = rawDesc
    .split(/(?<!\d)\.(?!\d)|[!?]/)[0]
    .replace(/^(comparing|evaluating|testing|measuring|real-world|watch the|full|how)\s+/i, '')
    .trim();

  const hasPromoNoise = /subscribe|download our|sponsor|merch|follow me|business inquiries|patreon|discord|instagram|▶/i.test(
    firstClause
  );

  let specialFeature = '';
  if (!hasPromoNoise && firstClause.length >= 18 && firstClause.length <= 150) {
    specialFeature = firstClause.charAt(0).toLowerCase() + firstClause.slice(1);
  } else {
    const lowerTitle = rawTitle.toLowerCase();
    if (lowerTitle.includes('camera') || lowerTitle.includes('pro') || lowerTitle.includes('ultra')) {
      specialFeature = 'custom flagship silicon, high-brightness LTPO display panels, and pro-grade camera optics';
    } else if (lowerTitle.includes('battery') || lowerTitle.includes('mah')) {
      specialFeature = 'high-density Silicon-Carbon battery chemistry, rapid charging curves, and thermal efficiency';
    } else if (lowerTitle.includes('os') || lowerTitle.includes('software') || lowerTitle.includes('ui')) {
      specialFeature = 'redesigned system animations, kernel-level scheduling optimizations, and on-device AI tools';
    } else {
      specialFeature = 'next-generation hardware engineering, real-world benchmark validation, and thermal performance analysis';
    }
  }

  const editorialSummary = `${channelName} just reviewed ${topic}. The standout feature is ${specialFeature}. Is it worth it?`;

  return {
    id: videoData.id,
    channelTitle: channelName,
    headline: rawTitle,
    topic,
    specialFeature,
    editorialSummary,
    thumbnail: videoData.thumbnail,
    formattedDate: videoData.formattedDate || 'Latest Dispatch',
    durationLabel: videoData.durationLabel,
    category: videoData.category || 'TECH REVIEW',
    videoUrl: videoData.videoUrl || YOUTUBE_CHANNEL_URL,
    ctaLabel: '📺 Watch Original Video',
  };
}

export const DEFAULT_YOUTUBE_TECH_VIDEOS: YouTubeVideoItem[] = [
  {
    id: 'yt-global-creator-mkbhd-flagship',
    channelId: 'UCBJycsmduvYEL83R_U4JriQ',
    title: 'Smartphone Camera Shootout & Blind Test Insights: Computational Optics',
    description:
      'Evaluating 1-inch Type flagship sensors, low-light HDR tone mapping, and natural portrait bokeh performance across global mobile cameras.',
    thumbnail:
      'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80',
    channelTitle: 'Marques Brownlee',
    publishedAt: '2026-11-12T15:00:00Z',
    formattedDate: 'Nov 12, 2026',
    videoUrl: 'https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ',
    durationLabel: '18:12',
    category: 'CAMERA',
  },
  {
    id: 'yt-global-creator-mrwhosetheboss-foldables',
    channelId: 'UCMiJRAwDNSNzuYeN2uWa0pA',
    title: 'Ultra-Thin Foldables & Next-Gen Titanium Chassis Engineering Breakdown',
    description:
      'How hinge geometry, carbon-fiber backplates, and dual-cell Si-C batteries pushed foldable smartphones below 9.5mm folded thickness.',
    thumbnail:
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1200&q=80',
    channelTitle: 'Mrwhosetheboss',
    publishedAt: '2026-11-11T11:30:00Z',
    formattedDate: 'Nov 11, 2026',
    videoUrl: 'https://www.youtube.com/channel/UCMiJRAwDNSNzuYeN2uWa0pA',
    durationLabel: '16:05',
    category: 'HARDWARE',
  },
  {
    id: 'yt-global-creator-dave2d-silicon',
    channelId: 'UCVYamHliCI9rw1tHR1xbkfw',
    title: '3nm Mobile Silicon Efficiency: Why Sustained Wattage Beats Peak Benchmarks',
    description:
      'Measuring performance-per-watt curves, battery temperatures, and acoustic fan/vapor chamber design inside slim mobile hardware.',
    thumbnail:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    channelTitle: 'Dave2D',
    publishedAt: '2026-11-10T16:45:00Z',
    formattedDate: 'Nov 10, 2026',
    videoUrl: 'https://www.youtube.com/channel/UCVYamHliCI9rw1tHR1xbkfw',
    durationLabel: '11:19',
    category: 'CHIPSET',
  },
  {
    id: 'yt-sd8-elite-dimensity-9400',
    channelId: 'UCXUJJNoP1QupwsYIWFXmsZg',
    title: 'Snapdragon 8 Elite vs Dimensity 9400: 120FPS Gaming & Thermal Stress Test',
    description:
      'Real-world 60-minute sustained AnTuTu v10 loop, 120FPS frame-time analysis, and vapor chamber thermal measurements on flagship 3nm silicon.',
    thumbnail:
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
    channelTitle: 'Tech Burner',
    publishedAt: '2026-11-09T10:00:00Z',
    formattedDate: 'Nov 9, 2026',
    videoUrl: 'https://www.youtube.com/channel/UCXUJJNoP1QupwsYIWFXmsZg',
    durationLabel: '14:28',
    category: 'CHIPSET',
  },
  {
    id: 'yt-xiaomi-15-pro-vivo-x200-pro',
    channelId: 'UCEPL07qzVsOcHd3sMUws65g',
    title: 'Xiaomi 15 Pro vs Vivo X200 Pro Mini: Compact Flagship Camera & Battery Test',
    description:
      'Comparing 6100mAh vs 5700mAh Silicon-Carbon endurance, Leica Summilux vs Zeiss T* periscope optics, and HyperOS 2.0 vs OriginOS 5 fluidity.',
    thumbnail:
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
    channelTitle: 'Trakin Tech',
    publishedAt: '2026-11-08T12:30:00Z',
    formattedDate: 'Nov 8, 2026',
    videoUrl: 'https://www.youtube.com/channel/UCEPL07qzVsOcHd3sMUws65g',
    durationLabel: '12:40',
    category: 'CAMERA',
  },
  {
    id: 'yt-silicon-carbon-battery-2026',
    channelId: 'UCVYamHliCI9rw1tHR1xbkfw',
    title: '6500mAh Silicon-Carbon Battery Explained: Real Drain Test & Charging Curves',
    description:
      'Testing 100W fast charging curves, 1600-cycle longevity ratings, and full-day 5G screen-on time on slim sub-8.2mm performance phones.',
    thumbnail:
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
    channelTitle: 'Dave2D',
    publishedAt: '2026-11-07T09:15:00Z',
    formattedDate: 'Nov 7, 2026',
    videoUrl: 'https://www.youtube.com/channel/UCVYamHliCI9rw1tHR1xbkfw',
    durationLabel: '09:44',
    category: 'BATTERY',
  },
];

export function formatYouTubePublishedDate(isoDate?: string): string {
  if (!isoDate) return 'Latest Upload';
  const normalized =
    isoDate.includes(' ') && !isoDate.includes('T') ? isoDate.replace(' ', 'T') + 'Z' : isoDate;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return 'Latest Upload';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildYouTubeRssXmlUrl(channelId: string = YOUTUBE_CHANNEL_ID): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId.trim()}`;
}

export function buildYouTubeRss2JsonUrl(channelId: string = YOUTUBE_CHANNEL_ID): string {
  const rssUrl = buildYouTubeRssXmlUrl(channelId);
  return `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
}

export function extractYouTubeVideoId(linkOrGuid: string = ''): string | null {
  const match = linkOrGuid.match(
    /(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|yt:video:)([a-zA-Z0-9_-]{11})/i
  );
  return match && match[1] ? match[1] : null;
}

export function mapRss2JsonItemsToVideos(
  items: Rss2JsonYouTubeItem[],
  fallbackChannelTitle: string = 'CLASSIFY TECH',
  channelId?: string
): YouTubeVideoItem[] {
  if (!Array.isArray(items)) return [];

  const mapped: YouTubeVideoItem[] = [];
  for (const item of items) {
    const title = item?.title?.trim();
    if (!title) continue;

    const videoId =
      extractYouTubeVideoId(item.guid || '') || extractYouTubeVideoId(item.link || '');
    const safeId = videoId || item.guid || item.link;
    if (!safeId) continue;

    const thumb =
      item.thumbnail?.trim() ||
      item.enclosure?.link?.trim() ||
      (videoId
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80');

    const cleanDesc = (item.description || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    mapped.push({
      id: safeId,
      channelId,
      title,
      description:
        cleanDesc ||
        'Watch the latest hardware review, unboxing, and benchmark coverage on YouTube.',
      thumbnail: thumb,
      channelTitle: item.author?.trim() || fallbackChannelTitle,
      publishedAt: item.pubDate || '',
      formattedDate: formatYouTubePublishedDate(item.pubDate),
      videoUrl:
        item.link?.trim() ||
        (videoId
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
          : YOUTUBE_CHANNEL_URL),
      category: channelId === YOUTUBE_CHANNEL_ID ? 'CLASSIFY TECH' : 'GLOBAL',
    });
  }
  return mapped;
}

export interface FetchYouTubeVideosResult {
  videos: YouTubeVideoItem[];
  source: 'youtube-rss' | 'server-rss' | 'fallback';
  error?: string;
}

function parseSortTimestamp(publishedAt?: string): number {
  if (!publishedAt) return 0;
  const normalized =
    publishedAt.includes(' ') && !publishedAt.includes('T')
      ? publishedAt.replace(' ', 'T') + 'Z'
      : publishedAt;
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Fetches latest channel videos from a single YouTube RSS feed via rss2json.com.
 */
export async function fetchLatestYouTubeTechNews(options?: {
  channelId?: string;
  maxResults?: number;
  fetchFn?: typeof fetch;
}): Promise<FetchYouTubeVideosResult> {
  const channelId = (options?.channelId ?? YOUTUBE_CHANNEL_ID).trim();
  const maxResults = Math.min(Math.max(1, options?.maxResults ?? 6), 15);
  const fetchImpl = options?.fetchFn ?? fetch;

  if (!channelId || channelId === 'YOUR_CHANNEL_ID') {
    return {
      videos: DEFAULT_YOUTUBE_TECH_VIDEOS,
      source: 'fallback',
    };
  }

  try {
    const endpoint = buildYouTubeRss2JsonUrl(channelId);
    const response = await fetchImpl(endpoint, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        videos: DEFAULT_YOUTUBE_TECH_VIDEOS,
        source: 'fallback',
        error: `YouTube RSS proxy returned status ${response.status}`,
      };
    }

    const data = (await response.json()) as Rss2JsonYouTubeResponse;
    if (data?.status && data.status !== 'ok') {
      return {
        videos: DEFAULT_YOUTUBE_TECH_VIDEOS,
        source: 'fallback',
        error: 'YouTube RSS feed unavailable',
      };
    }

    const fallbackName = TECH_CHANNEL_META[channelId]?.name || data?.feed?.title || 'CLASSIFY TECH';
    const videos = mapRss2JsonItemsToVideos(data?.items || [], fallbackName, channelId).slice(
      0,
      maxResults
    );

    if (videos.length === 0) {
      return {
        videos: DEFAULT_YOUTUBE_TECH_VIDEOS,
        source: 'fallback',
      };
    }

    return {
      videos,
      source: 'youtube-rss',
    };
  } catch (err: any) {
    return {
      videos: DEFAULT_YOUTUBE_TECH_VIDEOS,
      source: 'fallback',
      error: err?.message || 'Unable to reach YouTube RSS feed',
    };
  }
}

/**
 * Loops through techChannels via api.rss2json.com, mixes and sorts newest uploads
 * into a unified Global Tech Videos feed, falling back cleanly to /api/youtube/global
 * and curated cards if rss2json is throttled or offline.
 */
export async function fetchGlobalTechYouTubeVideos(options?: {
  channels?: string[];
  perChannelLimit?: number;
  maxTotal?: number;
  fetchFn?: typeof fetch;
}): Promise<FetchYouTubeVideosResult> {
  const channels = (options?.channels ?? techChannels).filter(Boolean);
  const perChannelLimit = Math.min(Math.max(1, options?.perChannelLimit ?? 2), 6);
  const maxTotal = Math.min(Math.max(3, options?.maxTotal ?? 12), 24);
  const fetchImpl = options?.fetchFn ?? fetch;

  // 1. Try CORS-free server-side YouTube XML aggregator (/api/youtube/global) first when available
  try {
    const serverRes = await fetchImpl('/api/youtube/global', {
      headers: { Accept: 'application/json' },
    });
    if (serverRes.ok) {
      const json = (await serverRes.json()) as { success?: boolean; videos?: YouTubeVideoItem[] };
      if (json.success && Array.isArray(json.videos) && json.videos.length > 0) {
        return {
          videos: json.videos.slice(0, maxTotal),
          source: 'server-rss',
        };
      }
    }
  } catch {
    // Static deploy or unit mock — proceed to multi-channel rss2json loop
  }

  // 2. Query each channel in techChannels via rss2json.com (works cleanly on static hosting)
  const channelResults = await Promise.allSettled(
    channels.map(async (channelId) => {
      const endpoint = buildYouTubeRss2JsonUrl(channelId);
      const res = await fetchImpl(endpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [] as YouTubeVideoItem[];
      const data = (await res.json()) as Rss2JsonYouTubeResponse;
      if (data?.status && data.status !== 'ok') return [] as YouTubeVideoItem[];
      const channelName = TECH_CHANNEL_META[channelId]?.name || data?.feed?.title || 'Global Tech';
      return mapRss2JsonItemsToVideos(data?.items || [], channelName, channelId).slice(
        0,
        perChannelLimit
      );
    })
  );

  const collected: YouTubeVideoItem[] = [];
  for (const res of channelResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      collected.push(...res.value);
    }
  }

  if (collected.length > 0) {
    const deduped = Array.from(new Map(collected.map((v) => [v.id, v])).values());
    deduped.sort((a, b) => parseSortTimestamp(b.publishedAt) - parseSortTimestamp(a.publishedAt));

    return {
      videos: deduped.slice(0, maxTotal),
      source: 'youtube-rss',
    };
  }

  return {
    videos: DEFAULT_YOUTUBE_TECH_VIDEOS.slice(0, maxTotal),
    source: 'fallback',
    error: 'Live YouTube RSS proxy unavailable; displaying curated tech videos.',
  };
}

export interface FetchTrendingTechVideosResult {
  videos: YouTubeVideoItem[];
  cards: YouTubeNewsArticleCard[];
  source: 'youtube-rss' | 'server-rss' | 'fallback';
  error?: string;
}

/**
 * Phase 3 Automation Hook: Fetches from top global tech YouTube channels
 * and transforms each video into a Fair-Use "News Summary Card" with direct creator links.
 */
export async function fetchTrendingTechVideos(options?: {
  channels?: string[];
  perChannelLimit?: number;
  maxTotal?: number;
  fetchFn?: typeof fetch;
}): Promise<FetchTrendingTechVideosResult> {
  const result = await fetchGlobalTechYouTubeVideos(options);
  const cards = result.videos.map((video) => renderYouTubeNewsCard(video));
  return {
    videos: result.videos,
    cards,
    source: result.source,
    error: result.error,
  };
}

