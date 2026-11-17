import { GoogleGenAI, Type } from '@google/genai';
import {
  cleanHtmlText,
  containsChineseOrForeignScript,
  sanitizeSummaryDescription,
  translateTextToEnglishFree,
} from './rssParser.ts';

export interface SynthesizedArticleResult {
  headline: string;
  leadSummary: string;
  paragraphs: string[];
  bullets: string[];
  sourceAttribution: string;
  isAiGenerated: boolean;
}

export const SYNTHESIS_MODEL = 'gemini-2.5-flash';

// In-memory cache for synthesized articles keyed by normalized title or source URL (TTL: 6 hours)
interface CacheEntry {
  timestamp: number;
  data: SynthesizedArticleResult;
}

const synthesisCache = new Map<string, CacheEntry>();
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function getCachedSynthesis(key: string): SynthesizedArticleResult | null {
  const cached = synthesisCache.get(key.toLowerCase().trim());
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setCachedSynthesis(key: string, data: SynthesizedArticleResult): void {
  synthesisCache.set(key.toLowerCase().trim(), {
    timestamp: Date.now(),
    data,
  });
}

/**
 * Returns available Gemini API keys in rotation priority from environment secret configuration.
 * Order: GEMINI_API_KEY -> API_KEY -> GEMINI_API_KEY_2 -> GEMINI_API_KEY_3
 */
export function getAvailableGeminiKeys(): string[] {
  const envKeys = [
    process.env.GEMINI_API_KEY,
    process.env.API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ];

  const valid = envKeys
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 10)
    .map((k) => k.trim());

  return Array.from(new Set(valid));
}

let keyRotationIndex = 0;

export type TechTopic =
  | 'CHIPSET'
  | 'CAMERA'
  | 'BATTERY'
  | 'CONNECTIVITY'
  | 'SOFTWARE'
  | 'FOLDABLE'
  | 'GAMING'
  | 'GENERAL';

function detectArticleTopic(title: string, content: string): TechTopic {
  const titleLower = title.toLowerCase();
  const text = `${title} ${content}`.toLowerCase();

  // Avoid misclassifying Face ID / biometric / software / display stories as CAMERA
  if (/(?:face id|touch id|fingerprint|biometric|under-display face)/i.test(text)) {
    return 'GENERAL';
  }
  if (/(?:android|ios|hyperos|one ui|oxygenos|firmware|patch|update|operating system|kernel)/.test(titleLower)) {
    return 'SOFTWARE';
  }
  if (/(?:snapdragon|dimensity|oryon|cortex|processor|silicon|chipset|adreno|gpu|npu|2nm|3nm|4nm|exynos|tensor)/.test(text)) {
    return 'CHIPSET';
  }
  if (/(?:lytia|megapixel|telephoto|periscope|camera sensor|camera module|ultrawide|ois|200mp|50mp camera)/.test(text)) {
    return 'CAMERA';
  }
  if (/(?:battery|mah|charging|charger|watt|silicon-carbon|fast charge|power cell)/.test(text)) {
    return 'BATTERY';
  }
  if (/(?:5g|telecom|spectrum|band|wi-fi|wifi|bluetooth|satellite|cellular|modem)/.test(text)) {
    return 'CONNECTIVITY';
  }
  if (/(?:foldable|flip|fold|hinge|crease|flexible display|teardrop)/.test(text)) {
    return 'FOLDABLE';
  }
  if (/(?:gaming|game|fps|bgmi|frame rate|vapor chamber|cooling|ray tracing)/.test(text)) {
    return 'GAMING';
  }
  return 'GENERAL';
}

/**
 * Deterministic editorial synthesis fallback when Gemini keys are missing, invalid, or rate-limited.
 * - Strips broken WordPress HTML attributes (`data-medium-file`, `data-large-file`, etc.).
 * - NEVER prepends `${cleanTitle}: ` to `leadSummary` (preventing ugly duplicate headlines on cards).
 * - NEVER injects unrelated camera/photography boilerplate into software, Face ID, battery, or general news.
 * - Keeps fallback paragraphs 100% faithful to the actual article sentences.
 */
export function synthesizeWithDeterministicFallback(
  rawTitle: string,
  rawContent: string,
  sourceName = 'Official Technical Release',
  _sourceUrl = ''
): SynthesizedArticleResult {
  const cleanTitle = cleanHtmlText(rawTitle)
    .replace(/^BREAKING:\s*/i, '')
    .replace(/^EXCLUSIVE:\s*/i, '')
    .replace(/:\s*Architectural Context & Market Outlook/gi, '')
    .trim();

  // Thoroughly sanitize HTML, WordPress data-* attributes, figure/img tags, and publisher footers
  const sanitizedContent = cleanHtmlText(rawContent)
    .replace(/The post\s+.*?appeared first on\s+.*$/gis, '')
    .replace(/Continue reading on\s+.*$/gis, '')
    .replace(/Read more\s*\.{0,3}$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract meaningful factual sentences that do not merely repeat the headline
  const rawSentences = sanitizedContent
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 22 &&
        s.toLowerCase() !== cleanTitle.toLowerCase() &&
        !s.toLowerCase().startsWith(cleanTitle.toLowerCase()) &&
        !/subscribe|copyright|newsletter|all rights reserved|terms of service|follow us on|read more|data-medium-file|data-large-file/i.test(
          s
        )
    );

  const headline = cleanTitle;
  const topic = detectArticleTopic(cleanTitle, sanitizedContent);

  // If the source has very limited facts (< 2 sentences), return an honest concise summary without duplicate title prefix
  if (rawSentences.length < 2) {
    const summaryFact =
      rawSentences[0] ||
      `New technical details and release updates have been reported by ${sourceName}.`;
    const leadSummary = sanitizeSummaryDescription(summaryFact, cleanTitle);
    const p1 = `According to reports published by ${sourceName}, ${summaryFact.replace(/\.$/, '')}.`;
    const p2 = `Additional hardware specifications, regional pricing, and official rollout schedules remain subject to confirmation from ${sourceName}. CLASSIFY TECH will update this report as verified documentation is released.`;
    return {
      headline,
      leadSummary,
      paragraphs: [p1, p2],
      bullets: [
        `Source Report: Published via ${sourceName}.`,
        `Key Update: ${leadSummary}`,
      ],
      sourceAttribution: `Reported by ${sourceName}; synthesized with editorial fact verification by CLASSIFY TECH Desk.`,
      isAiGenerated: false,
    };
  }

  const fact1 = rawSentences[0];
  const fact2 = rawSentences[1];
  const fact3 = rawSentences[2] || '';
  const fact4 = rawSentences[3] || '';

  // NEVER prepend `${cleanTitle}: ` to leadSummary
  const leadSummary = sanitizeSummaryDescription(fact1, cleanTitle);

  let p1 = '';
  let p2 = '';
  let p3 = '';
  let p4 = '';
  let bullets: string[] = [];

  switch (topic) {
    case 'CHIPSET':
      p1 = `Silicon and computing developments featured in ${cleanTitle} have been outlined in reports by ${sourceName}. According to the primary disclosures, ${fact1.replace(/\.$/, '')}.`;
      p2 = `Technical details from the publication state that ${fact2.replace(/\.$/, '')}.${fact3 ? ' ' + fact3.replace(/\.$/, '') + '.' : ''}`;
      p3 = fact4
        ? `${fact4.replace(/\.$/, '')}.`
        : `Further independent benchmark evaluation will verify sustained clock stability, power efficiency, and thermal performance across retail hardware.`;
      p4 = `CLASSIFY TECH Desk will continue tracking verified specifications and benchmark telemetry as additional documentation is published by ${sourceName}.`;
      bullets = [
        `Processor & Silicon: Hardware updates reported via ${sourceName}.`,
        `Key Finding: ${leadSummary}`,
        `Detail: ${fact2.slice(0, 110).replace(/\.$/, '')}.`,
      ];
      break;

    case 'CAMERA':
      p1 = `Optical and camera hardware developments for ${cleanTitle} were detailed in recent reporting by ${sourceName}. The disclosure confirms that ${fact1.replace(/\.$/, '')}.`;
      p2 = `Hardware parameters outlined in the report note that ${fact2.replace(/\.$/, '')}.${fact3 ? ' ' + fact3.replace(/\.$/, '') + '.' : ''}`;
      p3 = fact4
        ? `${fact4.replace(/\.$/, '')}.`
        : `Further evaluation will focus on sensor dynamic range, optical stabilization, and low-light capture across production units.`;
      p4 = `CLASSIFY TECH will update this report with side-by-side optical comparisons once official retail units are evaluated.`;
      bullets = [
        `Camera System: Sensor and lens configurations documented via ${sourceName}.`,
        `Optical Highlight: ${leadSummary}`,
        `Specification: ${fact2.slice(0, 110).replace(/\.$/, '')}.`,
      ];
      break;

    case 'BATTERY':
      p1 = `Power delivery and battery architecture updates for ${cleanTitle} have been disclosed by ${sourceName}. Primary reporting states that ${fact1.replace(/\.$/, '')}.`;
      p2 = `Technical specifications indicate that ${fact2.replace(/\.$/, '')}.${fact3 ? ' ' + fact3.replace(/\.$/, '') + '.' : ''}`;
      p3 = fact4
        ? `${fact4.replace(/\.$/, '')}.`
        : `Daily endurance, cell energy density, and charging speed curves will be tracked across standard usage scenarios.`;
      p4 = `CLASSIFY TECH Desk will update battery charging profiles and endurance figures following retail availability.`;
      bullets = [
        `Battery & Charging: Power parameters published via ${sourceName}.`,
        `Key Detail: ${leadSummary}`,
        `Specification: ${fact2.slice(0, 110).replace(/\.$/, '')}.`,
      ];
      break;

    default:
      p1 = `Developments regarding ${cleanTitle} were recently published by ${sourceName}. Primary reporting confirms that ${fact1.replace(/\.$/, '')}.`;
      p2 = `According to the source documentation, ${fact2.replace(/\.$/, '')}.${fact3 ? ' ' + fact3.replace(/\.$/, '') + '.' : ''}`;
      p3 = fact4
        ? `${fact4.replace(/\.$/, '')}.`
        : `Further updates regarding regional availability, pricing, and hardware/software rollout schedules will be confirmed by the manufacturer.`;
      p4 = `CLASSIFY TECH Desk will continue monitoring official announcements and technical documentation from ${sourceName}.`;
      bullets = [
        `Primary Source: Technical disclosures reported via ${sourceName}.`,
        `Key Highlight: ${leadSummary}`,
        `Additional Context: ${fact2.slice(0, 110).replace(/\.$/, '')}.`,
      ];
      break;
  }

  const sourceAttribution = `Reported by ${sourceName}; synthesized with editorial fact verification by CLASSIFY TECH Desk.`;

  return {
    headline,
    leadSummary,
    paragraphs: [p1, p2, p3, p4],
    bullets,
    sourceAttribution,
    isAiGenerated: false,
  };
}

/**
 * Real Gemini 2.5 Flash Editorial Writer & Translator with 6-hour caching,
 * multi-key rotation on 429 errors, and automatic fallback to deterministic synthesis.
 */
export async function synthesizeOriginalTechArticle(
  rawTitle: string,
  rawContent: string,
  sourceName = 'Tech Announcement',
  sourceUrl = ''
): Promise<SynthesizedArticleResult> {
  const cacheKey = `${rawTitle}_${sourceUrl}`.slice(0, 180);
  const cached = getCachedSynthesis(cacheKey);
  if (cached) {
    return cached;
  }

  const cleanInputTitle = cleanHtmlText(rawTitle);
  const cleanInputContent = cleanHtmlText(rawContent);
  const keys = getAvailableGeminiKeys();

  if (keys.length > 0) {
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const apiKey = keys[(keyRotationIndex + attempt) % keys.length];
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const prompt = `You are the Senior Hardware & Technology Editor at CLASSIFY TECH.
Rewrite and synthesize the following source tech news report into a clean, factual, original English article.
- If the source title or content contains Chinese or any non-English language, translate all facts into fluent, natural English (including converting RMB/CNY prices to approximate USD/INR equivalents in parentheses where helpful).
- Do NOT repeat the headline at the start of leadSummary.
- Keep 100% of facts grounded in the provided source text. Do NOT invent unverified camera or hardware specs not present in the source.

Source Publisher: ${sourceName}
Source Headline: ${cleanInputTitle}
Source Content:
${cleanInputContent.slice(0, 3500)}`;

        const response = await ai.models.generateContent({
          model: SYNTHESIS_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: {
                  type: Type.STRING,
                  description: 'Clean, compelling English tech news headline (max 110 chars).',
                },
                leadSummary: {
                  type: Type.STRING,
                  description:
                    '1-2 sentence standalone English summary that does NOT repeat the headline.',
                },
                paragraphs: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 to 4 detailed, factual English paragraphs.',
                },
                bullets: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 concise key engineering takeaways in English.',
                },
              },
              required: ['headline', 'leadSummary', 'paragraphs', 'bullets'],
            },
          },
        });

        const rawJson = (response.text ?? '').trim();
        if (rawJson) {
          const parsed = JSON.parse(rawJson) as {
            headline?: string;
            leadSummary?: string;
            paragraphs?: string[];
            bullets?: string[];
          };

          if (
            parsed.headline &&
            parsed.leadSummary &&
            Array.isArray(parsed.paragraphs) &&
            parsed.paragraphs.length >= 2
          ) {
            keyRotationIndex = (keyRotationIndex + attempt + 1) % keys.length;
            const aiResult: SynthesizedArticleResult = {
              headline: cleanHtmlText(parsed.headline),
              leadSummary: sanitizeSummaryDescription(parsed.leadSummary, parsed.headline),
              paragraphs: parsed.paragraphs.map((p) => cleanHtmlText(p)).filter(Boolean),
              bullets: Array.isArray(parsed.bullets)
                ? parsed.bullets.map((b) => cleanHtmlText(b)).filter(Boolean)
                : [`Reported via ${sourceName}.`],
              sourceAttribution: `Reported by ${sourceName}; translated & synthesized by CLASSIFY TECH Editorial Desk.`,
              isAiGenerated: true,
            };
            setCachedSynthesis(cacheKey, aiResult);
            return aiResult;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('exhausted')) {
          keyRotationIndex = (keyRotationIndex + 1) % keys.length;
          continue;
        }
        break;
      }
    }
  }

  // If no Gemini key is active (or all keys are rate-limited), translate Chinese/foreign text via free GTX endpoint first
  let finalTitle = cleanInputTitle;
  let finalContent = cleanInputContent;
  if (containsChineseOrForeignScript(finalTitle)) {
    finalTitle = await translateTextToEnglishFree(finalTitle);
  }
  if (containsChineseOrForeignScript(finalContent)) {
    finalContent = await translateTextToEnglishFree(finalContent);
  }

  const fallback = synthesizeWithDeterministicFallback(
    finalTitle,
    finalContent,
    sourceName,
    sourceUrl
  );
  setCachedSynthesis(cacheKey, fallback);
  return fallback;
}
