import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { join } from 'path';
import { compareMarkets } from '../../src/tools/markets.js';
import type { CompareMarketsInput } from '../../src/types/index.js';

describe('compare_markets tool', () => {
  let db: Database;

  beforeAll(() => {
    const dbPath = join(process.cwd(), 'data', 'automotive.db');
    db = new Database(dbPath, { readonly: true });
  });

  afterAll(() => {
    db.close();
  });

  it('should compare R155 with GB/T 40857', () => {
    const input: CompareMarketsInput = { markets: ['r155', 'gbt_40857'] };
    const result = compareMarkets(db, input);

    expect(result).toBeDefined();
    expect(result.markets_compared).toEqual(['r155', 'gbt_40857']);

    // Should have equivalences from framework_mappings
    expect(result.equivalences.length).toBeGreaterThan(0);
    for (const eq of result.equivalences) {
      expect(['r155', 'gbt_40857']).toContain(eq.source_regulation);
      expect(['r155', 'gbt_40857']).toContain(eq.target_regulation);
      expect(eq.source_ref).toBeTruthy();
      expect(eq.target_ref).toBeTruthy();
      expect(eq.relationship).toBeTruthy();
    }

    // Should have common_requirements (satisfies/partial equivalences)
    expect(result.common_requirements.length).toBeGreaterThan(0);
    for (const cr of result.common_requirements) {
      expect(['satisfies', 'partial']).toContain(cr.relationship);
    }

    // Should have market_specific entries for both markets
    expect(result.market_specific).toHaveProperty('r155');
    expect(result.market_specific).toHaveProperty('gbt_40857');

    // Summary should have correct structure
    expect(result.summary.total_requirements_per_market['r155']).toBeGreaterThan(0);
    expect(result.summary.total_requirements_per_market['gbt_40857']).toBeGreaterThan(0);
    expect(result.summary.cross_market_mappings).toBeGreaterThan(0);
    expect(result.summary.common_topic_count).toBeGreaterThan(0);
  });

  it('should filter by topic', () => {
    const input: CompareMarketsInput = {
      markets: ['r155', 'gbt_40857'],
      topic: 'software update',
    };
    const result = compareMarkets(db, input);

    expect(result).toBeDefined();
    expect(result.topic).toBe('software update');

    // With topic filter, should have fewer total requirements than unfiltered
    const unfilteredResult = compareMarkets(db, { markets: ['r155', 'gbt_40857'] });
    const topicTotal = result.summary.total_requirements_per_market['r155'] +
      result.summary.total_requirements_per_market['gbt_40857'];
    const unfilteredTotal = unfilteredResult.summary.total_requirements_per_market['r155'] +
      unfilteredResult.summary.total_requirements_per_market['gbt_40857'];
    expect(topicTotal).toBeLessThan(unfilteredTotal);
  });

  it('should throw error when fewer than 2 markets provided', () => {
    expect(() => compareMarkets(db, { markets: ['r155'] })).toThrow(
      'At least 2 markets required',
    );
  });

  it('should throw error for empty markets array', () => {
    expect(() => compareMarkets(db, { markets: [] })).toThrow(
      'At least 2 markets required',
    );
  });

  it('should throw error for invalid market', () => {
    expect(() => compareMarkets(db, { markets: ['r155', 'nonexistent'] })).toThrow(
      'Regulation not found: nonexistent',
    );
  });

  it('should return common_requirements and market_specific', () => {
    const input: CompareMarketsInput = { markets: ['r155', 'kmvss_18_3'] };
    const result = compareMarkets(db, input);

    // Must have the expected output structure
    expect(result).toHaveProperty('common_requirements');
    expect(result).toHaveProperty('market_specific');
    expect(result).toHaveProperty('equivalences');
    expect(result).toHaveProperty('summary');

    expect(Array.isArray(result.common_requirements)).toBe(true);
    expect(typeof result.market_specific).toBe('object');
    expect(result.market_specific).toHaveProperty('r155');
    expect(result.market_specific).toHaveProperty('kmvss_18_3');
  });

  it('should compare 3 markets', () => {
    const input: CompareMarketsInput = {
      markets: ['r155', 'gbt_40857', 'kmvss_18_3'],
    };
    const result = compareMarkets(db, input);

    expect(result.markets_compared).toEqual(['r155', 'gbt_40857', 'kmvss_18_3']);
    expect(result.market_specific).toHaveProperty('r155');
    expect(result.market_specific).toHaveProperty('gbt_40857');
    expect(result.market_specific).toHaveProperty('kmvss_18_3');
    expect(result.equivalences.length).toBeGreaterThan(0);
  });

  it('should handle special characters in topic query', () => {
    const input: CompareMarketsInput = {
      markets: ['r155', 'gbt_40857'],
      topic: 'CAN-bus',
    };
    expect(() => compareMarkets(db, input)).not.toThrow();
  });

  it('should return empty topic results for non-matching topic', () => {
    const input: CompareMarketsInput = {
      markets: ['r155', 'gbt_40857'],
      topic: 'xyznonexistentqueryabc',
    };
    const result = compareMarkets(db, input);

    expect(result.summary.total_requirements_per_market['r155']).toBe(0);
    expect(result.summary.total_requirements_per_market['gbt_40857']).toBe(0);
  });

  it('should normalize market IDs to lowercase', () => {
    const input: CompareMarketsInput = { markets: ['R155', 'GBT_40857'] };
    const result = compareMarkets(db, input);

    expect(result.markets_compared).toEqual(['r155', 'gbt_40857']);
    expect(result.summary.total_requirements_per_market['r155']).toBeGreaterThan(0);
  });
});
