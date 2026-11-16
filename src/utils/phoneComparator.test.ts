import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_ADD_RATE_LIMIT_ERROR,
  buildCompareSpecsPrompt,
  buildPublicSpecsApiUrl,
  BUILT_IN_SMARTPHONE_DB,
  checkAutoAddRateLimit,
  COMPARE_SPECS_PROXY_ENDPOINT,
  dataPhones,
  DEVICE_NOT_FOUND_ERROR,
  fetchDeviceSpecsWithCache,
  fetchSpecsFromGemini,
  findBuiltInPhoneSpecs,
  FREE_PUBLIC_SPECS_API_URL,
  getAllAvailablePhones,
  getCachedPhoneSpecs,
  INVALID_PHONE_NAME_ERROR,
  isValidPhoneQuery,
  normalizePhoneSpecsResponse,
  saveCachedPhoneSpecs,
  type StorageLike,
} from './phoneComparator.ts';
import { generateNewsSummary } from './aiSummaryHook.ts';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

test('buildCompareSpecsPrompt requests the exact 16-point Gemini JSON schema keys', () => {
  const prompt = buildCompareSpecsPrompt('Xiaomi 15 Ultra');
  assert.ok(prompt.includes('Xiaomi 15 Ultra'));
  for (const key of [
    'Price',
    'Processor',
    'Fab',
    'AnTuTu',
    'Display',
    'Protection',
    'RAM',
    'RearCam',
    'FrontCam',
    'Gaming',
    '5G',
    'Connectivity',
    'Audio',
    'Battery',
    'OS',
    'Verdict',
  ]) {
    assert.ok(prompt.includes(key), `Prompt should include key ${key}`);
  }
});

test('BUILT_IN_SMARTPHONE_DB (dataPhones) includes Poco F1, Redmi Note/K, iQOO Neo/Z, Vivo X/T, Realme GT/Narzo, OnePlus Nord/R, Huawei Mate/Pura, and Honor Magic/Number series', () => {
  assert.equal(dataPhones, BUILT_IN_SMARTPHONE_DB);
  assert.ok(BUILT_IN_SMARTPHONE_DB.length >= 25);

  const requiredQueries = [
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

  for (const query of requiredQueries) {
    const found = findBuiltInPhoneSpecs(query);
    assert.ok(found, `Expected built-in database to find "${query}" at 0 token cost`);
  }

  // Regression test: if localStorage has a cached entry with id 'poco-f1' and name 'Poco F1',
  // getAllAvailablePhones must deduplicate by ID so React never sees duplicate 'poco-f1' keys.
  const storage = createMemoryStorage();
  saveCachedPhoneSpecs(
    'Poco F1',
    {
      ...BUILT_IN_SMARTPHONE_DB[0],
      id: 'poco-f1',
      name: 'Poco F1',
    },
    'deterministic-local',
    storage
  );
  const allPhones = getAllAvailablePhones(storage);
  const ids = allPhones.map((p) => p.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'All phone IDs in getAllAvailablePhones must be strictly unique');
  assert.equal(ids.filter((id) => id === 'poco-f1').length, 1);
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

test('fetchDeviceSpecsWithCache enforces max 2 Auto-Add requests per hour in localStorage and uses 0 Gemini tokens in production mode', async () => {
  const storage = createMemoryStorage();
  let geminiCalls = 0;

  const mockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === COMPARE_SPECS_PROXY_ENDPOINT) {
      geminiCalls += 1;
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  // Built-in phone lookup consumes 0 rate limit and 0 network calls
  const builtInRes = await fetchDeviceSpecsWithCache('Poco F1', {
    fetchImpl: mockFetch,
    storage,
    now: 1000,
    useBuiltInDb: true,
    useZeroTokenFallback: true,
  });
  assert.equal(builtInRes.source, 'built-in');
  assert.ok(builtInRes.specs.name.includes('Poco F1'));
  assert.equal(geminiCalls, 0);

  // Gibberish phone name is blocked before consuming rate limit or tokens
  await assert.rejects(
    () =>
      fetchDeviceSpecsWithCache('zzzzxxxxqqqq', {
        fetchImpl: mockFetch,
        storage,
        now: 1500,
        useBuiltInDb: true,
        useZeroTokenFallback: true,
      }),
    (err: Error) => err.message === INVALID_PHONE_NAME_ERROR
  );

  // Unlisted phone #1 -> resolved via deterministic-local (0 Gemini tokens)
  const unlisted1 = await fetchDeviceSpecsWithCache('Redmi K60 Ultra', {
    fetchImpl: mockFetch,
    storage,
    now: 2000,
    useBuiltInDb: true,
    useZeroTokenFallback: true,
  });
  assert.equal(unlisted1.source, 'deterministic-local');
  assert.equal(geminiCalls, 0);

  // Unlisted phone #2 -> resolved via deterministic-local (0 Gemini tokens)
  const unlisted2 = await fetchDeviceSpecsWithCache('Vivo X90 Pro+', {
    fetchImpl: mockFetch,
    storage,
    now: 3000,
    useBuiltInDb: true,
    useZeroTokenFallback: true,
  });
  assert.equal(unlisted2.source, 'deterministic-local');
  assert.equal(geminiCalls, 0);

  // Rate limit check after 2 unlisted Auto-Add calls within the same hour
  const rateState = checkAutoAddRateLimit(storage, 4000);
  assert.equal(rateState.allowed, false);
  assert.equal(rateState.remaining, 0);

  // Unlisted phone #3 within the same hour -> blocked by strict 2/hour rate limit!
  await assert.rejects(
    () =>
      fetchDeviceSpecsWithCache('Honor 90 GT', {
        fetchImpl: mockFetch,
        storage,
        now: 4000,
        useBuiltInDb: true,
        useZeroTokenFallback: true,
      }),
    (err: Error) => err.message === AUTO_ADD_RATE_LIMIT_ERROR
  );

  // After 1 hour + 1 second, rate limit resets cleanly
  const afterOneHour = await fetchDeviceSpecsWithCache('Honor 90 GT', {
    fetchImpl: mockFetch,
    storage,
    now: 2000 + 3600 * 1000 + 1000,
    useBuiltInDb: true,
    useZeroTokenFallback: true,
  });
  assert.equal(afterOneHour.source, 'deterministic-local');
  assert.equal(geminiCalls, 0);
});

test('normalizePhoneSpecsResponse maps both Gemini schema keys and legacy aliases', () => {
  const parsed = normalizePhoneSpecsResponse(
    {
      specs: {
        Name: 'Xiaomi 15 Ultra',
        Price: 'CNY 6,499 / ~₹89,999 (16GB/512GB)',
        Processor: 'Qualcomm Snapdragon 8 Elite',
        Fab: '3nm TSMC N3E • Adreno 830',
        AnTuTu: 2890000,
        Geekbench: '3210 Single / 10150 Multi',
        Display: '6.73" 2K LTPO AMOLED • 120Hz • 3200 Nits',
        Protection: 'Dragon Crystal Glass 2.0 • IP68',
        RAM: '16GB LPDDR5X + 512GB UFS 4.1',
        RearCam: '50MP 1-inch LYT-900 OIS + 200MP 4.3x Periscope',
        FrontCam: '32MP 4K 60FPS',
        Gaming: '120FPS Sustained • Dual-Channel Vapor Chamber',
        FiveG: 'Global + China + India n1/n3/n28/n77/n78',
        Connectivity: 'Wi-Fi 7 • Bluetooth 6.0 • NFC • IR Blaster',
        Audio: 'Dual Dolby Atmos Stereo Speakers',
        Battery: '6000mAh Silicon-Carbon • 90W Wired + 80W Wireless',
        OS: 'HyperOS 2.0 (Android 15)',
        Verdict: 'Top-tier mobile photography & battery endurance flagship.',
      },
    },
    'Xiaomi 15 Ultra'
  );

  assert.equal(parsed.name, 'Xiaomi 15 Ultra');
  assert.equal(parsed.antutu, 2890000);
  assert.ok(parsed.battery.includes('6000mAh'));

  const withStringScore = normalizePhoneSpecsResponse(
    { Price: '₹79,999', AnTuTu: '2,890,000+ pts (v10)' },
    'OnePlus 13'
  );
  assert.equal(withStringScore.antutu, 2890000);

  const withMillionScore = normalizePhoneSpecsResponse(
    { Price: '₹84,999', AnTuTu: '2.85M pts (AnTuTu v10)' },
    'Vivo X200 Pro'
  );
  assert.equal(withMillionScore.antutu, 2850000);
});

test('fetchDeviceSpecsWithCache Tier 1 returns localStorage cache with 0 network calls', async () => {
  const storage = createMemoryStorage();
  let networkCalls = 0;

  const mockFetch = (async (input: RequestInfo | URL) => {
    networkCalls += 1;
    const url = String(input);
    if (url.startsWith(FREE_PUBLIC_SPECS_API_URL)) {
      return new Response('', { status: 404 });
    }
    return new Response(
      JSON.stringify({
        success: true,
        specs: {
          Name: 'Xiaomi 15 Ultra',
          Price: '₹89,999',
          Processor: 'Snapdragon 8 Elite',
          Fab: '3nm',
          AnTuTu: 2850000,
          Display: '6.73" 2K AMOLED',
          Protection: 'IP68',
          RAM: '16GB / 512GB',
          RearCam: '200MP Periscope',
          FrontCam: '32MP',
          Gaming: '120FPS',
          '5G': 'Global 5G',
          Connectivity: 'Wi-Fi 7',
          Audio: 'Stereo',
          Battery: '6000mAh',
          OS: 'HyperOS 2.0',
          Verdict: 'Flagship camera champion.',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  // First query: misses cache, tries public API (404), falls back to Gemini (2 calls) & saves to cache
  const first = await fetchDeviceSpecsWithCache('Xiaomi 15 Ultra', {
    fetchImpl: mockFetch,
    storage,
    now: 1000,
  });
  assert.equal(first.source, 'gemini-fallback');
  assert.equal(networkCalls, 2);

  // Second query (even with different casing): hits cache -> 0 additional network calls!
  const second = await fetchDeviceSpecsWithCache('  xiaomi 15 ultra ', {
    fetchImpl: mockFetch,
    storage,
    now: 2000,
  });
  assert.equal(second.source, 'cache');
  assert.equal(second.specs.name, 'Xiaomi 15 Ultra');
  assert.equal(networkCalls, 2); // Unchanged! Zero API cost!
});

test('fetchDeviceSpecsWithCache Tier 2 uses Free Public Specs API before Gemini and caches result', async () => {
  const storage = createMemoryStorage();
  const calledUrls: string[] = [];

  const mockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calledUrls.push(url);
    if (url === buildPublicSpecsApiUrl('OnePlus 13')) {
      return new Response(
        JSON.stringify({
          data: {
            name: 'OnePlus 13',
            price: '₹69,999',
            processor: 'Snapdragon 8 Elite',
            nm: '3nm',
            antutu: 2800000,
            display: '6.82" LTPO AMOLED',
            protection: 'IP68/IP69',
            ram: '16GB + 512GB',
            cam_rear: '50MP LYT-808 Hasselblad Triple',
            cam_front: '32MP',
            gaming: '120FPS',
            bands5g: 'India + Global 5G',
            wifi: 'Wi-Fi 7',
            audio: 'Stereo',
            battery: '6000mAh 100W',
            os: 'OxygenOS 15',
            verdict: 'Balanced battery and performance flagship.',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error('Gemini API should NOT be called when public API succeeds!');
  }) as typeof fetch;

  const result = await fetchDeviceSpecsWithCache('OnePlus 13', {
    fetchImpl: mockFetch,
    storage,
    now: 5000,
  });

  assert.equal(result.source, 'public-api');
  assert.equal(result.specs.name, 'OnePlus 13');
  assert.equal(calledUrls.length, 1);
  assert.ok(calledUrls[0].startsWith(FREE_PUBLIC_SPECS_API_URL));

  // Verify saved into cache
  const cached = getCachedPhoneSpecs('OnePlus 13', storage, 6000);
  assert.ok(cached);
  assert.equal(cached.specs.name, 'OnePlus 13');
});

test('fetchSpecsFromGemini calls POST /api/compare/specs and surfaces errors cleanly', async () => {
  let capturedUrl = '';
  const failingFetch = (async (input: RequestInfo | URL) => {
    capturedUrl = String(input);
    return new Response(
      JSON.stringify({ success: false, error: DEVICE_NOT_FOUND_ERROR }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  await assert.rejects(
    () => fetchSpecsFromGemini('Nothing Phone 99', failingFetch),
    (err: Error) => err.message === DEVICE_NOT_FOUND_ERROR
  );
  assert.equal(capturedUrl, COMPARE_SPECS_PROXY_ENDPOINT);
});

test('generateNewsSummary placeholder handles valid and empty URLs safely', async () => {
  const emptyRes = await generateNewsSummary('');
  assert.equal(emptyRes.success, false);
  assert.equal(emptyRes.isPlaceholder, true);

  const validRes = await generateNewsSummary('https://example.com/xiaomi-15-pro-launch');
  assert.equal(validRes.success, true);
  assert.equal(validRes.isPlaceholder, true);
  assert.ok(validRes.summary.includes('https://example.com/xiaomi-15-pro-launch'));
});

test('TRENDING_SMARTPRIX_COMPARISONS and parseLiveHtmlPhoneSpecs extract 16 hardware specs from live Smartprix/GSMArena HTML with 0 AI credits', async () => {
  const {
    TRENDING_SMARTPRIX_COMPARISONS,
    parseLiveHtmlPhoneSpecs,
    tryLiveSmartprixOrGsmarenaSpecs,
  } = await import('./phoneComparator.ts');

  assert.ok(TRENDING_SMARTPRIX_COMPARISONS.length >= 6);
  for (const pair of TRENDING_SMARTPRIX_COMPARISONS) {
    assert.ok(pair.id && pair.label && pair.p1Name && pair.p2Name && pair.tag);
  }

  const mockSmartprixHtml = `
    <div class="sm-product">
      <h2>Vivo X200 Ultra 5G</h2>
      <span class="price">₹89,990</span>
      <ul class="specs">
        <li>Qualcomm Snapdragon 8 Elite, 3 nm</li>
        <li>16 GB RAM, 512 GB inbuilt</li>
        <li>6.82 inchesLTPO AMOLED, 120 Hz Display</li>
        <li>200 MP + 50 MP + 50 MP Triple Rear Camera</li>
        <li>50 MP Front Camera</li>
        <li>6000 mAh Battery with 100W Fast Charging</li>
        <li>Android v15</li>
      </ul>
    </div>
  `;

  const extracted = parseLiveHtmlPhoneSpecs(mockSmartprixHtml, 'Vivo X200 Ultra 5G');
  assert.ok(extracted);
  assert.equal(extracted.price, '₹89,990');
  assert.ok(extracted.cpu.includes('Snapdragon 8 Elite'));
  assert.ok(extracted.nm.includes('3nm'));
  assert.ok(extracted.ram.includes('16 GB RAM'));
  assert.ok(extracted.cam_rear.includes('200 MP'));
  assert.ok(extracted.cam_front.includes('50 MP Front Camera'));
  assert.ok(extracted.battery.includes('6000 mAh'));
  assert.ok(extracted.os.includes('Android v15'));

  const mockAllOriginsFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('api.allorigins.win')) {
      return new Response(JSON.stringify({ contents: mockSmartprixHtml }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  const liveResult = await tryLiveSmartprixOrGsmarenaSpecs('Vivo X200 Ultra 5G', mockAllOriginsFetch);
  assert.ok(liveResult);
  assert.equal(liveResult.price, '₹89,990');
});

