import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HOURLY_SYNC_INTERVAL_MS } from './rssParser.ts';

const BLOGGER_XML_PATH = path.resolve(process.cwd(), 'blogger-theme.xml');
const PUBLIC_XML_PATH = path.resolve(process.cwd(), 'public/blogger-theme.xml');
const INDEX_HTML_PATH = path.resolve(process.cwd(), 'index.html');

test('Standalone blogger-theme.xml is strictly valid Blogger XML with zero Netlify code and zero jsxDEV', () => {
  assert.equal(fs.existsSync(BLOGGER_XML_PATH), true, 'blogger-theme.xml must exist');
  const xml = fs.readFileSync(BLOGGER_XML_PATH, 'utf-8');
  assert.ok(Buffer.byteLength(xml, 'utf-8') > 100000, 'blogger-theme.xml must not be empty');

  // 1. XML declaration, doctype & Blogger namespaces
  assert.ok(
    xml.startsWith('<?xml version="1.0" encoding="UTF-8" ?>\n<!DOCTYPE html>'),
    'Must start with XML declaration and DOCTYPE'
  );
  assert.match(xml, /xmlns=['"]http:\/\/www\.w3\.org\/1999\/xhtml['"]/);
  assert.match(xml, /xmlns:b=['"]http:\/\/www\.google\.com\/2005\/gml\/b['"]/);
  assert.match(xml, /xmlns:data=['"]http:\/\/www\.google\.com\/2005\/gml\/data['"]/);
  assert.match(xml, /xmlns:expr=['"]http:\/\/www\.google\.com\/2005\/gml\/expr['"]/);
  assert.match(xml, /b:layoutsVersion=['"]3['"]/);

  // 2. Exactly one <b:skin> tag
  const skinMatches = xml.match(/<b:skin\b[\s\S]*?<\/b:skin>/g) || [];
  assert.equal(skinMatches.length, 1, 'Must contain exactly ONE <b:skin> tag');

  // 3. Required hidden <b:section> inside <body>
  assert.match(xml, /<b:section\b[^>]*id=['"]main-section['"][^>]*><\/b:section>/);
  assert.ok(xml.includes('#main-section { display: none !important; }'));

  // 4. Google AdSense, Search Console & Discover SEO tags
  assert.ok(
    xml.includes('<meta name="google-adsense-account" content="ca-pub-5358435749702036" />'),
    'Must include self-closed Google AdSense meta tag'
  );
  assert.ok(
    xml.includes(
      '<script async="async" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5358435749702036" crossorigin="anonymous"></script>'
    ),
    'Must include XML-compliant Google AdSense script with async="async"'
  );
  assert.ok(
    xml.includes('max-image-preview:large, max-snippet:-1, max-video-preview:-1'),
    'Must include Google Discover robots directives'
  );
  assert.ok(
    xml.includes('<link rel="canonical" href="https://classifytechz.blogspot.com/" />'),
    'Must include Blogger canonical link'
  );

  // 5. Zero Netlify references, zero dev-only jsxDEV calls & zero local module/script imports
  assert.equal(/netlify/i.test(xml), false, 'Must contain zero Netlify references');
  assert.equal(/\bjsxDEV\b/.test(xml), false, 'Must contain zero dev-only jsxDEV calls');
  assert.equal(
    /src=["'](?:\/src\/|\.\/|\/scripts\/|\/assets\/)/i.test(xml),
    false,
    'Must contain zero local module or script imports'
  );

  // 6. Strict XML checks outside CDATA
  const withoutCdata = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const unescapedAmps = withoutCdata.match(
    /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g
  );
  assert.equal(unescapedAmps, null, 'Must have zero unescaped & characters outside CDATA');

  const bareBoolAttrs = withoutCdata.match(
    /<(?:script|link|meta)\b[^>]*\s(?:async|defer|crossorigin)(?=[\s/>])/gi
  );
  assert.equal(bareBoolAttrs, null, 'Must have zero bare boolean attributes');

  const unclosedVoidTags = withoutCdata.match(
    /<(?:meta|link|br|hr|img|input)\b(?![^>]*\/>)[^>]*>/gi
  );
  assert.equal(unclosedVoidTags, null, 'All void tags must be self-closed');

  // 7. JSON-LD must be valid JSON and XML-safe
  const ldMatch = xml.match(
    /<script id="classifyTechDynamicSchema" type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  assert.ok(ldMatch && ldMatch[1], 'Must include JSON-LD script block');
  assert.equal(/[<>&]/.test(ldMatch[1]), false, 'JSON-LD must not contain raw <, >, or &');
  const parsedLd = JSON.parse(ldMatch[1]);
  assert.equal(parsedLd['@context'], 'https://schema.org');

  // 8. Inline styles and inline bundled app script must be wrapped in CDATA
  assert.match(xml, /<style type="text\/css">\s*\/\* <!\[CDATA\[ \*\//);
  assert.match(xml, /<script type="text\/javascript">\s*\/\/ <!\[CDATA\[/);
});

test('public/blogger-theme.xml matches root blogger-theme.xml and index.html remains intact for Vite/AI Studio/GitHub', () => {
  assert.equal(fs.existsSync(PUBLIC_XML_PATH), true, 'public/blogger-theme.xml must exist');
  const rootXml = fs.readFileSync(BLOGGER_XML_PATH, 'utf-8');
  const publicXml = fs.readFileSync(PUBLIC_XML_PATH, 'utf-8');
  assert.equal(publicXml, rootXml, 'public/blogger-theme.xml must match blogger-theme.xml');

  assert.equal(fs.existsSync(INDEX_HTML_PATH), true, 'index.html must exist for Vite');
  const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  assert.ok(
    indexHtml.includes('<script type="module" src="/src/main.tsx"></script>'),
    'index.html must mount /src/main.tsx for AI Studio & GitHub Vite builds'
  );
  assert.equal(HOURLY_SYNC_INTERVAL_MS, 60 * 60 * 1000, 'Hourly sync interval must be exactly 60 minutes');
});

test('Workspace has no leftover Netlify config files or _redirects', () => {
  assert.equal(fs.existsSync(path.resolve(process.cwd(), 'netlify.toml')), false);
  assert.equal(fs.existsSync(path.resolve(process.cwd(), 'netlify')), false);
  assert.equal(fs.existsSync(path.resolve(process.cwd(), 'public/_redirects')), false);
});
