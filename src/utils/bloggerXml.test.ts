import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HOURLY_SYNC_INTERVAL_MS } from './rssParser.ts';

const BLOGGER_XML_PATH = path.resolve(process.cwd(), 'blogger-theme.xml');
const PUBLIC_XML_PATH = path.resolve(process.cwd(), 'public/blogger-theme.xml');
const DIST_XML_PATH = path.resolve(process.cwd(), 'dist/blogger-theme.xml');
const SERVER_TS_PATH = path.resolve(process.cwd(), 'server.ts');
const INDEX_HTML_PATH = path.resolve(process.cwd(), 'index.html');

test('Theme XML files are deleted and /blogger-theme.xml route is removed from server.ts', () => {
  assert.equal(fs.existsSync(BLOGGER_XML_PATH), false, 'blogger-theme.xml must not exist');
  assert.equal(fs.existsSync(PUBLIC_XML_PATH), false, 'public/blogger-theme.xml must not exist');
  assert.equal(fs.existsSync(DIST_XML_PATH), false, 'dist/blogger-theme.xml must not exist');

  const serverCode = fs.readFileSync(SERVER_TS_PATH, 'utf-8');
  assert.equal(
    serverCode.includes('/blogger-theme.xml'),
    false,
    'server.ts must not expose /blogger-theme.xml route'
  );
});

test('index.html remains intact for Vite/AI Studio/GitHub and hourly sync interval is 60 minutes', () => {
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
