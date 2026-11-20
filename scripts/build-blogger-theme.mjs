import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TMP_DIR = path.resolve(ROOT_DIR, '.blogger-build-tmp');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

const ROOT_XML_PATH = path.resolve(ROOT_DIR, 'blogger-theme.xml');
const PUBLIC_XML_PATH = path.resolve(PUBLIC_DIR, 'blogger-theme.xml');
const DIST_XML_PATH = path.resolve(DIST_DIR, 'blogger-theme.xml');

const BLOGGER_ORIGIN = 'https://classifytechz.blogspot.com';
const ADSENSE_PUB_ID = 'ca-pub-5358435749702036';
const GSC_VERIFICATION = 'pdbaM3tYJn6ymz-3vbCAgoOEq5jAMaW31lJmst2nTno';

/**
 * Safely escapes any `]]>` or `</script` sequence inside minified JS
 * so it can live inside an XML CDATA block without breaking Blogger's XML parser
 * or altering string literal contents.
 */
function sanitizeJsForXmlCdata(js) {
  let out = '';
  let state = 'code'; // 'code' | 'single' | 'double' | 'template'
  let escaped = false;

  for (let i = 0; i < js.length; i++) {
    const ch = js[i];

    // Prevent closing </script> tags inside inline script content
    if (ch === '<' && js.slice(i, i + 8).toLowerCase() === '</script') {
      out += '<\\/script';
      i += 7;
      escaped = false;
      continue;
    }

    // Prevent premature XML CDATA termination `]]>`
    if (ch === ']' && js[i + 1] === ']' && js[i + 2] === '>') {
      if (state === 'single' || state === 'double' || state === 'template') {
        out += ']\\x5d>';
      } else {
        out += '] ]>';
      }
      i += 2;
      escaped = false;
      continue;
    }

    out += ch;

    if (state === 'code') {
      if (ch === "'") {
        state = 'single';
      } else if (ch === '"') {
        state = 'double';
      } else if (ch === '`') {
        state = 'template';
      }
    } else {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (
        (state === 'single' && ch === "'") ||
        (state === 'double' && ch === '"') ||
        (state === 'template' && ch === '`')
      ) {
        state = 'code';
      }
    }
  }

  if (out.includes(']]>')) {
    throw new Error('Sanitized JS still contains literal ]]> sequence.');
  }
  if (/<\/script/i.test(out)) {
    throw new Error('Sanitized JS still contains literal </script sequence.');
  }
  return out;
}

/**
 * Safely sanitizes compiled CSS for XML CDATA embedding.
 */
function sanitizeCssForXmlCdata(css) {
  const safe = css.replace(/\]\]>/g, '] ]>').replace(/<\/style/gi, '<\\/style');
  if (safe.includes(']]>')) {
    throw new Error('Sanitized CSS still contains literal ]]> sequence.');
  }
  return safe;
}

/**
 * Validates Blogger XML constraints strictly.
 */
export function validateBloggerXml(html) {
  const errors = [];

  if (!html || Buffer.byteLength(html, 'utf-8') < 10000) {
    errors.push('Output Blogger XML is empty or unexpectedly small.');
  }
  if (!html.startsWith('<?xml version="1.0" encoding="UTF-8" ?>\n<!DOCTYPE html>')) {
    errors.push('Must start with <?xml version="1.0" encoding="UTF-8" ?> and <!DOCTYPE html>.');
  }
  if (!html.includes("xmlns='http://www.w3.org/1999/xhtml'")) {
    errors.push('Missing XHTML namespace on <html>.');
  }
  if (!html.includes("xmlns:b='http://www.google.com/2005/gml/b'")) {
    errors.push('Missing Blogger xmlns:b namespace on <html>.');
  }
  if (!html.includes("xmlns:data='http://www.google.com/2005/gml/data'")) {
    errors.push('Missing Blogger xmlns:data namespace on <html>.');
  }
  if (!html.includes("xmlns:expr='http://www.google.com/2005/gml/expr'")) {
    errors.push('Missing Blogger xmlns:expr namespace on <html>.');
  }

  const skinMatches = html.match(/<b:skin\b[\s\S]*?<\/b:skin>/g) || [];
  if (skinMatches.length !== 1) {
    errors.push(`Expected exactly 1 <b:skin> tag, found ${skinMatches.length}.`);
  }

  if (!/<b:section\b[^>]*id=['"]main-section['"][^>]*><\/b:section>/.test(html)) {
    errors.push('Missing required <b:section id="main-section"> inside <body>.');
  }

  if (!html.includes(`<meta name="google-adsense-account" content="${ADSENSE_PUB_ID}" />`)) {
    errors.push('Missing Google AdSense verification meta tag.');
  }
  if (
    !html.includes(
      `<script async="async" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}" crossorigin="anonymous"></script>`
    )
  ) {
    errors.push('Missing XML-safe Google AdSense script tag with async="async".');
  }

  if (/netlify/i.test(html)) {
    errors.push('Detected leftover Netlify reference in output.');
  }
  if (/\bjsxDEV\b/.test(html)) {
    errors.push('Detected development-only jsxDEV runtime call in production bundle.');
  }
  if (/src=["'](?:\/src\/|\.\/|\/scripts\/|\/assets\/)/i.test(html)) {
    errors.push('Detected local module/script import in standalone output.');
  }

  // Strip CDATA sections before checking XML markup outside CDATA
  const withoutCdata = html.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

  // Check for bare boolean attributes like `async ` or `crossorigin ` without `=`
  if (/<(?:script|link|meta)\b[^>]*\s(?:async|defer|crossorigin)(?=[\s/>])/i.test(withoutCdata)) {
    errors.push('Found bare boolean XML attribute (must be name="value").');
  }

  // Check for unescaped ampersands outside CDATA
  const unescapedAmp = withoutCdata.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g);
  if (unescapedAmp && unescapedAmp.length > 0) {
    errors.push(`Found ${unescapedAmp.length} unescaped '&' characters outside CDATA.`);
  }

  // Check void tags are self-closed
  const unclosedVoid = withoutCdata.match(/<(?:meta|link|br|hr|img|input)\b(?![^>]*\/>)[^>]*>/gi);
  if (unclosedVoid && unclosedVoid.length > 0) {
    errors.push(`Found unclosed void tag(s): ${unclosedVoid.slice(0, 3).join(', ')}`);
  }

  // Verify JSON-LD block parses as valid JSON and has no raw XML special chars
  const ldJsonMatch = html.match(
    /<script id="classifyTechDynamicSchema" type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  if (!ldJsonMatch) {
    errors.push('Missing JSON-LD script block.');
  } else {
    const ldRaw = ldJsonMatch[1];
    if (/[<>&]/.test(ldRaw)) {
      errors.push('JSON-LD contains raw <, >, or & characters which break XML parsing.');
    }
    try {
      JSON.parse(ldRaw);
    } catch (e) {
      errors.push(`Invalid JSON-LD: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Blogger XML validation failed:\n- ${errors.join('\n- ')}`);
  }
}

export async function buildBloggerTheme() {
  console.log('[Blogger Build] Compiling CLASSIFY TECH React + Tailwind v4 into standalone blogger-theme.xml...');

  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  fs.rmSync(TMP_DIR, { recursive: true, force: true });

  try {
    await build({
      root: ROOT_DIR,
      mode: 'production',
      configFile: false,
      logLevel: 'warn',
      plugins: [react({ jsxRuntime: 'automatic' }), tailwindcss()],
      resolve: {
        alias: {
          '@': ROOT_DIR,
        },
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      build: {
        outDir: TMP_DIR,
        emptyOutDir: true,
        cssCodeSplit: false,
        sourcemap: false,
        minify: 'esbuild',
        assetsInlineLimit: 100000000,
        lib: {
          entry: path.resolve(ROOT_DIR, 'src/main.tsx'),
          name: 'ClassifyTechApp',
          formats: ['iife'],
          fileName: () => 'app.iife.js',
        },
      },
    });
  } finally {
    if (prevNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = prevNodeEnv;
    }
  }

  const tmpFiles = fs.readdirSync(TMP_DIR);
  const jsFile = tmpFiles.find((f) => f.endsWith('.js'));
  const cssFile = tmpFiles.find((f) => f.endsWith('.css'));

  if (!jsFile) {
    throw new Error('Vite single-file build did not produce a JS bundle.');
  }
  if (!cssFile) {
    throw new Error('Vite single-file build did not produce a CSS stylesheet.');
  }

  const rawJs = fs.readFileSync(path.join(TMP_DIR, jsFile), 'utf-8');
  const rawCss = fs.readFileSync(path.join(TMP_DIR, cssFile), 'utf-8');

  const safeJs = sanitizeJsForXmlCdata(rawJs);
  const safeCss = sanitizeCssForXmlCdata(
    `${rawCss}\n#main-section { display: none !important; }`
  );

  const schemaObject = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Organization', 'NewsMediaOrganization'],
        '@id': `${BLOGGER_ORIGIN}/#organization`,
        name: 'CLASSIFY TECH',
        alternateName: 'CLASSIFY TECH Official',
        description:
          'Independent tech news aggregator and hardware analysis hub curating trending tech news, tipster leaks, YouTube review summaries, and 50+ point multi-category comparisons.',
        sameAs: [
          'https://www.youtube.com/channel/UCp0jHiCTqxDYZ0Bi0sKUmbw',
          'https://youtube.com/@classifytech',
          'https://x.com/classifytechz',
          'https://www.instagram.com/classifytechz/',
          'https://t.me/ClassifytechGroup',
          'https://www.threads.net/@classifytechz',
          'https://www.facebook.com/classifytechz',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${BLOGGER_ORIGIN}/#website`,
        name: 'CLASSIFY TECH',
        url: BLOGGER_ORIGIN,
        description:
          "CLASSIFY TECH — World's Top Trending Tech News, Tech Leaks, YouTube Review Summaries, and Comparison Hub.",
        inLanguage: 'en',
        publisher: {
          '@id': `${BLOGGER_ORIGIN}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${BLOGGER_ORIGIN}/?compare={search_term_string}#/comparison`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'ItemList',
        name: 'CLASSIFY TECH Top Trending Tech News',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Snapdragon 8 Elite & Dimensity 9400 Shatter 3nm Efficiency Benchmarks in Sustained 120FPS Workloads',
            url: `${BLOGGER_ORIGIN}/?story=tsmc-3nm-n3e-snapdragon-dimensity-breakout`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Marques Brownlee (MKBHD) Reveals Samsung Galaxy S25 Ultra Key Highlights & Hidden Features',
            url: `${BLOGGER_ORIGIN}/?story=mkbhd-reviews-galaxy-s25-ultra-editorial`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Ice Universe & Digital Chat Station Reveal 200MP Periscope & 7,500mAh Si/C Flagship Key Highlights & Hidden Features',
            url: `${BLOGGER_ORIGIN}/?story=ice-universe-dcs-periscope-battery-leak`,
          },
        ],
      },
      {
        '@type': 'NewsArticle',
        headline:
          'Snapdragon 8 Elite & Dimensity 9400 Shatter 3nm Efficiency Benchmarks in Sustained 120FPS Workloads',
        image: [
          'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=1200&q=80',
        ],
        datePublished: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        author: {
          '@type': 'Organization',
          name: 'CLASSIFY TECH',
        },
        publisher: {
          '@id': `${BLOGGER_ORIGIN}/#organization`,
        },
        mainEntityOfPage: `${BLOGGER_ORIGIN}/?story=tsmc-3nm-n3e-snapdragon-dimensity-breakout`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does the CLASSIFY TECH Comparison hub work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The CLASSIFY TECH Comparison hub compares Smartphones, Laptops, Tablets, Smartwatches, Earbuds, Smart TVs, and Chipsets side-by-side across 50+ deep technical parameters.',
            },
          },
        ],
      },
      {
        '@type': 'Product',
        name: 'Samsung Galaxy S25 Ultra vs Xiaomi 15 Pro Comparison',
        image: [
          'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=1200&q=80',
        ],
        description:
          'Side-by-side 50+ point hardware specification comparison between Samsung Galaxy S25 Ultra and Xiaomi 15 Pro across fabrication node, 0-100% charging time, benchmarks, and camera sensors.',
        sku: 'CT-COMP-SAMSUNG-GALAXY-S25-ULTRA-XIAOMI-15',
        brand: {
          '@type': 'Brand',
          name: 'Samsung & Xiaomi',
        },
        offers: {
          '@type': 'Offer',
          url: `${BLOGGER_ORIGIN}/#/comparison`,
          priceCurrency: 'INR',
          price: '129999',
          priceValidUntil: '2027-12-31',
          itemCondition: 'https://schema.org/NewCondition',
          availability: 'https://schema.org/InStock',
        },
        review: {
          '@type': 'Review',
          reviewRating: {
            '@type': 'Rating',
            ratingValue: '4.8',
            bestRating: '5',
            worstRating: '1',
          },
          author: {
            '@type': 'Organization',
            name: 'CLASSIFY TECH',
          },
          reviewBody:
            'Verified 62-parameter technical comparison between Samsung Galaxy S25 Ultra and Xiaomi 15 Pro on CLASSIFY TECH.',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          reviewCount: '142',
          bestRating: '5',
          worstRating: '1',
        },
      },
    ],
  };

  // Escape &, <, > inside JSON-LD so it is simultaneously valid JSON and valid XML without CDATA comments
  const safeJsonLd = JSON.stringify(schemaObject, null, 2)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  const bloggerThemeXml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html b:css='false' b:defaultwidgetversion='2' b:layoutsVersion='3' lang='en' class='dark scroll-smooth' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
    <meta name="referrer" content="no-referrer-when-downgrade" />
    <title>CLASSIFY TECH — Trending Tech News, Leaks &amp; Comparison</title>
    <meta name="google-site-verification" content="${GSC_VERIFICATION}" />
    <meta name="google-adsense-account" content="${ADSENSE_PUB_ID}" />
    <script async="async" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUB_ID}" crossorigin="anonymous"></script>
    <link rel="canonical" href="${BLOGGER_ORIGIN}/" />
    <meta name="description" content="CLASSIFY TECH is your ultra-fast hub for trending tech news, tipster leaks, curated YouTube review summaries, and 50+ point Multi-Category Comparison." />
    <meta name="keywords" content="CLASSIFY TECH, Classify Tech tech news, Trending Tech News, Tech Leaks, Comparison, Gadget Comparison, YouTube Tech Summaries, Global Tech News, China Flagships" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

    <!-- OpenGraph &amp; Twitter Cards (Google Discover Ready) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="CLASSIFY TECH" />
    <meta property="og:url" content="${BLOGGER_ORIGIN}/" />
    <meta property="og:title" content="CLASSIFY TECH — Trending Tech News, Leaks &amp; Comparison" />
    <meta property="og:description" content="CLASSIFY TECH is your ultra-fast hub for trending tech news, tipster leaks, curated YouTube review summaries, and 50+ point Multi-Category Comparison." />
    <meta property="og:image" content="https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&amp;fit=crop&amp;w=1200&amp;q=80" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="675" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@classifytechz" />
    <meta name="twitter:title" content="CLASSIFY TECH — Trending Tech News, Leaks &amp; Comparison" />
    <meta name="twitter:description" content="CLASSIFY TECH is your ultra-fast hub for trending tech news, tipster leaks, curated YouTube review summaries, and 50+ point Multi-Category Comparison." />
    <meta name="twitter:image" content="https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&amp;fit=crop&amp;w=1200&amp;q=80" />

    <!-- Schema.org Structured Data -->
    <script id="classifyTechDynamicSchema" type="application/ld+json">
${safeJsonLd}
    </script>

    <!-- Fast Preconnect Hints, Google Fonts &amp; FontAwesome -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="preconnect" href="https://images.unsplash.com" />
    <link rel="preconnect" href="https://pagead2.googlesyndication.com" />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&amp;family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&amp;family=JetBrains+Mono:wght@400;600;700&amp;display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" />

    <!-- Required Single Blogger Theme Skin -->
    <b:skin><![CDATA[ ]]></b:skin>

    <!-- Compiled CLASSIFY TECH Stylesheet (Tailwind CSS v4 + Custom Theme) -->
    <style type="text/css">
/* <![CDATA[ */
${safeCss}
/* ]]> */
    </style>

    <!-- Instant Theme Initialization -->
    <script type="text/javascript">
// <![CDATA[
(function () {
  try {
    var saved = localStorage.getItem('classify_theme');
    var theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
// ]]>
    </script>
  </head>
  <body class="bg-[#f8fafc] dark:bg-[#06080f] text-slate-900 dark:text-slate-100 antialiased selection:bg-[#00f2fe] selection:text-black">
    <div id="root"></div>
    <b:section id='main-section' class='main' showaddelement='yes'></b:section>
    <script type="text/javascript">
// <![CDATA[
${safeJs}
// ]]>
    </script>
  </body>
</html>
`;

  validateBloggerXml(bloggerThemeXml);

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  fs.writeFileSync(ROOT_XML_PATH, bloggerThemeXml, 'utf-8');
  fs.writeFileSync(PUBLIC_XML_PATH, bloggerThemeXml, 'utf-8');
  fs.writeFileSync(DIST_XML_PATH, bloggerThemeXml, 'utf-8');

  fs.rmSync(TMP_DIR, { recursive: true, force: true });

  const sizeBytes = Buffer.byteLength(bloggerThemeXml, 'utf-8');
  const sizeKb = (sizeBytes / 1024).toFixed(1);
  console.log(
    `[Blogger Build] Generated strictly XML-compliant single-file theme (${sizeKb} KB / ${sizeBytes} bytes) -> blogger-theme.xml, public/blogger-theme.xml & dist/blogger-theme.xml`
  );
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  buildBloggerTheme().catch((err) => {
    console.error('[Blogger Build] Fatal error:', err);
    process.exit(1);
  });
}
