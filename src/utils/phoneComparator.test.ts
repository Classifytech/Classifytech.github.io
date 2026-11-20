import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLORIGINS_SPEC_PROXY_URL,
  BUILT_IN_SMARTPHONE_DB,
  isValidPhoneQuery,
  WIKIDATA_SEARCH_API_URL,
  WIKIPEDIA_SUMMARY_API_URL,
} from './phoneComparator.ts';

test('BUILT_IN_SMARTPHONE_DB includes key flagship and midrange smartphone models with strictly unique IDs', () => {
  assert.ok(BUILT_IN_SMARTPHONE_DB.length >= 25);

  const ids = BUILT_IN_SMARTPHONE_DB.map((p) => p.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'All phone IDs in BUILT_IN_SMARTPHONE_DB must be strictly unique');

  const requiredSubstrings = [
    'Poco F1',
    'Redmi Note 14 Pro+',
    'Redmi K80 Pro',
    'iQOO Neo 9 Pro',
    'iQOO Z9s Pro',
    'Vivo X200 Pro',
    'Vivo T3 Ultra',
    'Realme GT 7 Pro',
    'Realme Narzo 70 Turbo',
    'OnePlus Nord 4',
    'OnePlus 13R',
    'Huawei Mate 70 Pro+',
    'Huawei Pura 70 Ultra',
    'Honor Magic 7 Pro',
    'Honor 200 Pro',
  ];

  for (const name of requiredSubstrings) {
    const found = BUILT_IN_SMARTPHONE_DB.some((p) => p.name.toLowerCase().includes(name.toLowerCase()));
    assert.ok(found, `Expected BUILT_IN_SMARTPHONE_DB to include "${name}"`);
  }

  for (const phone of BUILT_IN_SMARTPHONE_DB) {
    assert.ok(phone.id && phone.name && phone.cpu && phone.display && phone.battery && phone.os);
    assert.ok(typeof phone.antutu === 'number' && phone.antutu > 0);
  }
});

test('Public spec lookup endpoint constants remain properly configured', () => {
  assert.ok(ALLORIGINS_SPEC_PROXY_URL.startsWith('https://api.allorigins.win/'));
  assert.ok(WIKIPEDIA_SUMMARY_API_URL.startsWith('https://en.wikipedia.org/'));
  assert.ok(WIKIDATA_SEARCH_API_URL.startsWith('https://www.wikidata.org/'));
});

test('isValidPhoneQuery blocks gibberish and invalid phone names while allowing real smartphone models', () => {
  assert.equal(isValidPhoneQuery(''), false);
  assert.equal(isValidPhoneQuery('a'), false);
  assert.equal(isValidPhoneQuery('123456'), false);
  assert.equal(isValidPhoneQuery('aaaaaaa'), false);
  assert.equal(isValidPhoneQuery('xkcdqwertzxcv'), false);
  assert.equal(isValidPhoneQuery('https://evil.example.com'), false);
  assert.equal(isValidPhoneQuery('<script>alert(1)</script>'), false);

  assert.equal(isValidPhoneQuery('Poco F1'), true);
  assert.equal(isValidPhoneQuery('Redmi Note 14 Pro+ 5G'), true);
  assert.equal(isValidPhoneQuery('iQOO Z9 Turbo'), true);
  assert.equal(isValidPhoneQuery('Huawei Mate 60 RS'), true);
  assert.equal(isValidPhoneQuery('Honor 100 Pro'), true);
});
