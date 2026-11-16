import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPARISON_CATEGORIES,
  DEEP_SPEC_GROUPS,
  TOTAL_DEEP_SPEC_ROWS_COUNT,
  BUILT_IN_MULTI_CATEGORY_CATALOG,
  TRENDING_MULTI_CATEGORY_COMPARISONS,
  findBuiltInDeepItem,
  fetchMultiSourceGadgetSpecs,
} from './multiCategoryComparison.ts';

test('COMPARISON_CATEGORIES includes all 7 required Smartprix-style gadget categories', () => {
  assert.equal(COMPARISON_CATEGORIES.length, 7);
  const ids = COMPARISON_CATEGORIES.map((c) => c.id);
  assert.deepEqual(ids, [
    'smartphones',
    'laptops',
    'tablets',
    'smartwatches',
    'earbuds',
    'tvs',
    'chipsets',
  ]);
  const shortLabels = COMPARISON_CATEGORIES.map((c) => c.shortPillLabel);
  assert.deepEqual(shortLabels, [
    'Mobiles',
    'Laptops',
    'Tablets',
    'Smartwatches',
    'Earbuds',
    'TVs',
    'Chipsets',
  ]);
});

test('DEEP_SPEC_GROUPS contains 8 collapsible sub-headers and at least 50 deep technical rows (62 rows)', () => {
  assert.equal(DEEP_SPEC_GROUPS.length, 8);
  assert.ok(
    TOTAL_DEEP_SPEC_ROWS_COUNT >= 50,
    `Expected at least 50 spec rows, got ${TOTAL_DEEP_SPEC_ROWS_COUNT}`
  );
  assert.equal(TOTAL_DEEP_SPEC_ROWS_COUNT, 62);

  const expectedTitles = [
    '1. Overview & Pricing',
    '2. Processor & Silicon',
    '3. Benchmarks & Gaming',
    '4. Memory & Storage',
    '5. Display & Eye Protection',
    '6. Rear & Front Cameras',
    '7. Battery & Exact Charging Speed',
    '8. Build, Network & Extras',
  ];
  assert.deepEqual(
    DEEP_SPEC_GROUPS.map((g) => g.title),
    expectedTitles
  );
});

test('Every category has built-in catalog items with all 62 deep spec rows populated and trending pairs', () => {
  for (const cat of COMPARISON_CATEGORIES) {
    const catalog = BUILT_IN_MULTI_CATEGORY_CATALOG[cat.id];
    assert.ok(catalog.length >= 2, `Category ${cat.id} should have at least 2 built-in items`);

    const trending = TRENDING_MULTI_CATEGORY_COMPARISONS.filter((t) => t.category === cat.id);
    assert.ok(trending.length >= 1, `Category ${cat.id} should have trending comparisons`);

    for (const item of catalog.slice(0, 2)) {
      for (const group of DEEP_SPEC_GROUPS) {
        for (const row of group.rows) {
          assert.ok(
            typeof item.specs[row.key] === 'string' && item.specs[row.key].length > 0,
            `Item ${item.name} (${cat.id}) missing spec key ${row.key}`
          );
        }
      }
    }
  }

  const foundS25 = findBuiltInDeepItem('Galaxy S25 Ultra', 'smartphones');
  assert.ok(foundS25);
  assert.equal(foundS25.name, 'Samsung Galaxy S25 Ultra');
});

test('fetchMultiSourceGadgetSpecs resolves unlisted gadgets across categories with 0 AI credits', async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({}), { status: 200 });

  const phone = await fetchMultiSourceGadgetSpecs(
    'Xiaomi 15S Ultra Custom Edition',
    'smartphones',
    mockFetch
  );
  assert.equal(phone.category, 'smartphones');
  assert.ok(phone.name.includes('Xiaomi'));
  assert.ok(phone.specs.charge_0_to_100.length > 0);
  assert.ok(phone.specs.fab_node.includes('nm'));

  const laptop = await fetchMultiSourceGadgetSpecs(
    'Lenovo Legion Pro 9i Gen 10',
    'laptops',
    mockFetch
  );
  assert.equal(laptop.category, 'laptops');
  assert.ok(laptop.specs.chipset_name.length > 0);
  assert.ok(laptop.specs.final_verdict.length > 0);
});
