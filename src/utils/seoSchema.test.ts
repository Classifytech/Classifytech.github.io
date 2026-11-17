import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductComparisonSchema,
  buildNewsArticleSchemaNodes,
  parseOfferPriceAndCurrency,
} from './seoSchema.ts';
import { defaultTechArticles } from '../data/newsData.ts';

test('parseOfferPriceAndCurrency extracts INR and USD numeric values cleanly', () => {
  assert.deepEqual(parseOfferPriceAndCurrency('₹1,29,999 / $1,299'), {
    price: '129999',
    priceCurrency: 'INR',
  });
  assert.deepEqual(parseOfferPriceAndCurrency('$999 (Global)'), {
    price: '999',
    priceCurrency: 'USD',
  });
  assert.deepEqual(parseOfferPriceAndCurrency('N/A'), {
    price: '999.00',
    priceCurrency: 'USD',
  });
});

test('buildProductComparisonSchema produces Google-valid Product snippet with offers, review, and aggregateRating', () => {
  const schema = buildProductComparisonSchema({
    origin: 'https://classifytech.com',
    item1Name: 'Samsung Galaxy S25 Ultra',
    item2Name: 'Xiaomi 15 Pro',
    priceString: '₹1,29,999',
  }) as Record<string, any>;

  assert.equal(schema['@type'], 'Product');
  assert.equal(schema.name, 'Samsung Galaxy S25 Ultra vs Xiaomi 15 Pro Comparison');
  assert.ok(Array.isArray(schema.image) && schema.image[0].startsWith('https://'));
  assert.equal(schema.brand['@type'], 'Brand');
  assert.equal(schema.brand.name, 'Samsung & Xiaomi');
  assert.ok(schema.description.length > 20);
  assert.ok(schema.sku.startsWith('CT-COMP-'));

  // Mandatory valid offers fields for Google Product Snippets
  assert.equal(schema.offers['@type'], 'Offer');
  assert.equal(schema.offers.priceCurrency, 'INR');
  assert.equal(schema.offers.price, '129999');
  assert.equal(schema.offers.availability, 'https://schema.org/InStock');
  assert.equal(schema.offers.priceValidUntil, '2027-12-31');

  // Valid editorial review and aggregateRating
  assert.equal(schema.review['@type'], 'Review');
  assert.equal(schema.review.reviewRating.ratingValue, '4.8');
  assert.equal(schema.review.author.name, 'CLASSIFY TECH');
  assert.equal(schema.aggregateRating['@type'], 'AggregateRating');
  assert.equal(schema.aggregateRating.ratingValue, '4.8');
  assert.equal(schema.aggregateRating.reviewCount, '142');
});

test('buildNewsArticleSchemaNodes builds ISO 8601 dated NewsArticle nodes for top 10 articles', () => {
  const nodes = buildNewsArticleSchemaNodes(defaultTechArticles, 'https://classifytech.com', 10) as Record<string, any>[];
  assert.equal(nodes.length, 10);
  assert.equal(nodes[0]['@type'], 'NewsArticle');
  assert.ok(nodes[0].datePublished.endsWith('Z'));
  assert.ok(nodes[0].dateModified.endsWith('Z'));
  assert.ok(Array.isArray(nodes[0].image) && nodes[0].image[0].startsWith('https://'));
});
