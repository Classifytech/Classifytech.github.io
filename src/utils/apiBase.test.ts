import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { API_BASE, CLOUD_RUN_API_ORIGIN, resolveApiBase } from './apiBase.ts';

test('resolveApiBase returns Cloud Run origin for blogspot.com hostnames and empty string otherwise', () => {
  assert.equal(CLOUD_RUN_API_ORIGIN, 'https://classifytech.ai.studio');
  assert.equal(resolveApiBase('classifytechz.blogspot.com'), 'https://classifytech.ai.studio');
  assert.equal(resolveApiBase('CLASSIFYTECHZ.BLOGSPOT.COM'), 'https://classifytech.ai.studio');
  assert.equal(resolveApiBase('blogspot.com'), 'https://classifytech.ai.studio');

  // Non-Blogger origins keep relative /api/* paths
  assert.equal(resolveApiBase('classifytech.ai.studio'), '');
  assert.equal(resolveApiBase('localhost'), '');
  assert.equal(resolveApiBase('127.0.0.1'), '');
  assert.equal(resolveApiBase('evilblogspot.com'), '');
  assert.equal(resolveApiBase(''), '');
  assert.equal(API_BASE, '');
});

test('server.ts configures Blogger CORS middleware and Cross-Origin-Resource-Policy for assets', () => {
  const serverCode = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');
  assert.ok(serverCode.includes('https://classifytechz.blogspot.com'), 'CORS must allow Blogger origin');
  assert.ok(serverCode.includes('http://localhost:3000'), 'CORS must allow localhost:3000');
  assert.ok(serverCode.includes('Access-Control-Allow-Origin'));
  assert.ok(serverCode.includes('Access-Control-Allow-Methods'));
  assert.ok(serverCode.includes('Access-Control-Allow-Headers'));
  assert.ok(serverCode.includes('Cross-Origin-Resource-Policy'));
  assert.ok(serverCode.includes('cross-origin'));
});

test('vite.config.ts outputs stable single-file classifytech.js and classifytech.css without manualChunks', () => {
  const viteConfig = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf-8');
  assert.ok(viteConfig.includes("entryFileNames: 'assets/classifytech.js'"));
  assert.ok(viteConfig.includes("'assets/classifytech.css'"));
  assert.ok(viteConfig.includes('inlineDynamicImports: true'));
  assert.equal(viteConfig.includes('manualChunks'), false);
});
