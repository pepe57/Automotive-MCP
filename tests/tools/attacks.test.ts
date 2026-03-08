import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { join } from 'path';
import { searchAttackPatterns } from '../../src/tools/attacks.js';
import type { SearchAttackPatternsInput } from '../../src/types/index.js';

describe('search_attack_patterns tool', () => {
  let db: Database;

  beforeAll(() => {
    const dbPath = join(process.cwd(), 'data', 'automotive.db');
    db = new Database(dbPath, { readonly: true });
  });

  afterAll(() => {
    db.close();
  });

  it('should return results for FTS query', () => {
    const input: SearchAttackPatternsInput = { query: 'firmware' };
    const result = searchAttackPatterns(db, input);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    const first = result[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('target_component');
    expect(first).toHaveProperty('attack_vector');
    expect(first).toHaveProperty('stride_category');
    expect(first).toHaveProperty('impact');
    expect(first).toHaveProperty('feasibility');
    expect(first).toHaveProperty('known_mitigations');
    expect(first).toHaveProperty('r155_annex5_refs');

    // Feasibility should be parsed JSON object
    expect(typeof first.feasibility).toBe('object');
    expect(first.feasibility).not.toBeNull();

    // Mitigations should be parsed JSON array
    expect(Array.isArray(first.known_mitigations)).toBe(true);
    expect(first.known_mitigations.length).toBeGreaterThan(0);

    // Annex 5 refs should be parsed JSON array
    expect(Array.isArray(first.r155_annex5_refs)).toBe(true);
  });

  it('should filter by target_component', () => {
    const input: SearchAttackPatternsInput = { target_component: 'ECU' };
    const result = searchAttackPatterns(db, input);

    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.target_component).toBe('ECU');
    }
  });

  it('should filter by stride_category', () => {
    const input: SearchAttackPatternsInput = { stride_category: 'T' };
    const result = searchAttackPatterns(db, input);

    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.stride_category).toBe('T');
    }
  });

  it('should combine FTS query with target_component filter', () => {
    const input: SearchAttackPatternsInput = {
      query: 'firmware',
      target_component: 'ECU',
    };
    const result = searchAttackPatterns(db, input);

    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.target_component).toBe('ECU');
    }
  });

  it('should combine FTS query with stride_category filter', () => {
    const input: SearchAttackPatternsInput = {
      query: 'injection',
      stride_category: 'T',
    };
    const result = searchAttackPatterns(db, input);

    // May or may not have results depending on data, but should not error
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(r.stride_category).toBe('T');
    }
  });

  it('should combine target_component and stride_category without query', () => {
    const input: SearchAttackPatternsInput = {
      target_component: 'ECU',
      stride_category: 'I',
    };
    const result = searchAttackPatterns(db, input);

    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.target_component).toBe('ECU');
      expect(r.stride_category).toBe('I');
    }
  });

  it('should throw error when no filters provided', () => {
    const input: SearchAttackPatternsInput = {};
    expect(() => searchAttackPatterns(db, input)).toThrow(
      'At least one filter required',
    );
  });

  it('should respect limit parameter', () => {
    const input: SearchAttackPatternsInput = {
      target_component: 'ECU',
      limit: 3,
    };
    const result = searchAttackPatterns(db, input);

    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should cap limit at 50', () => {
    const input: SearchAttackPatternsInput = {
      target_component: 'ECU',
      limit: 200,
    };
    const result = searchAttackPatterns(db, input);

    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('should return empty array for FTS query with no matches', () => {
    const input: SearchAttackPatternsInput = {
      query: 'xyznonexistentqueryabc',
    };
    const result = searchAttackPatterns(db, input);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('should handle special characters in query', () => {
    const input: SearchAttackPatternsInput = { query: 'CAN-bus' };
    expect(() => searchAttackPatterns(db, input)).not.toThrow();
  });

  it('should return results sorted by name when using non-FTS path', () => {
    const input: SearchAttackPatternsInput = { target_component: 'ECU' };
    const result = searchAttackPatterns(db, input);

    expect(result.length).toBeGreaterThan(1);
    // SQLite ORDER BY uses binary collation (byte-level comparison)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].name <= result[i + 1].name).toBe(true);
    }
  });
});
