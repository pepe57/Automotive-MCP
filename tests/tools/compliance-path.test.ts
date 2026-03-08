import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { join } from 'path';
import { mapCompliancePath } from '../../src/tools/compliance-path.js';
import type { MapCompliancePathInput } from '../../src/types/index.js';

describe('map_compliance_path tool', () => {
  let db: Database;

  beforeAll(() => {
    const dbPath = join(process.cwd(), 'data', 'automotive.db');
    db = new Database(dbPath, { readonly: true });
  });

  afterAll(() => {
    db.close();
  });

  it('should return paths for a known R155 requirement', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r155',
      requirement_ref: '7.2.2.2(g)',
    };
    const result = mapCompliancePath(db, input);

    expect(result).toBeDefined();
    expect('requirement' in result).toBe(true);
    if ('requirement' in result) {
      const req = result.requirement;
      expect(req.regulation).toBe('r155');
      expect(req.reference).toBe('7.2.2.2(g)');
      expect(req.paths.length).toBeGreaterThan(0);

      // Should contain ISO 21434 clause 8 among the paths
      const hasIso21434Clause8 = req.paths.some(
        (p) => p.id === 'iso_21434' && p.ref === '8',
      );
      expect(hasIso21434Clause8).toBe(true);

      // Should contain AUTOSAR IdsM
      const hasAutosar = req.paths.some(
        (p) => p.id === 'autosar' && p.ref === 'IdsM',
      );
      expect(hasAutosar).toBe(true);

      // Each path node has required fields
      for (const path of req.paths) {
        expect(path.type).toBe('standard');
        expect(path.id).toBeTruthy();
        expect(path.ref).toBeTruthy();
        expect(path.title).toBeTruthy();
        expect(path.relationship).toBeTruthy();
      }
    }
  });

  it('should return paths grouped by article when no requirement_ref', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r155',
    };
    const result = mapCompliancePath(db, input);

    expect(result).toBeDefined();
    expect('articles' in result).toBe(true);
    if ('articles' in result) {
      expect(result.articles.length).toBeGreaterThan(0);
      expect(result.total_requirements).toBeGreaterThan(0);

      // Each article group has the expected shape
      for (const article of result.articles) {
        expect(article.article).toBeTruthy();
        expect(Array.isArray(article.requirements)).toBe(true);
        expect(article.requirements.length).toBeGreaterThan(0);

        for (const req of article.requirements) {
          expect(req.regulation).toBe('r155');
          expect(req.reference).toBeTruthy();
          expect(Array.isArray(req.paths)).toBe(true);
        }
      }
    }
  });

  it('should include guidance text when depth is full', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r155',
      requirement_ref: '7.2.2.2(g)',
      depth: 'full',
    };
    const result = mapCompliancePath(db, input);

    expect(result).toBeDefined();
    expect(result.depth).toBe('full');
    expect('requirement' in result).toBe(true);
    if ('requirement' in result) {
      const req = result.requirement;

      // Full text snippet should be longer than summary
      expect(req.text_snippet).toBeTruthy();

      // At least one path node should have guidance
      const hasGuidance = req.paths.some((p) => p.guidance && p.guidance.length > 0);
      expect(hasGuidance).toBe(true);
    }
  });

  it('should return summary depth by default', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r155',
      requirement_ref: '7.2.2.2(g)',
    };
    const result = mapCompliancePath(db, input);

    expect(result.depth).toBe('summary');
    if ('requirement' in result) {
      // In summary mode, guidance should be undefined on nodes
      for (const path of result.requirement.paths) {
        expect(path.guidance).toBeUndefined();
      }
    }
  });

  it('should throw error for invalid regulation', () => {
    const input: MapCompliancePathInput = {
      regulation: 'nonexistent',
    };
    expect(() => mapCompliancePath(db, input)).toThrow('Regulation not found: nonexistent');
  });

  it('should throw error for invalid requirement_ref', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r155',
      requirement_ref: 'nonexistent.ref',
    };
    expect(() => mapCompliancePath(db, input)).toThrow('Requirement not found: nonexistent.ref');
  });

  it('should return chains with at least 2 hops for some requirements', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r155',
      requirement_ref: '7.2.2.2(g)',
      depth: 'full',
    };
    const result = mapCompliancePath(db, input);

    expect('requirement' in result).toBe(true);
    if ('requirement' in result) {
      // Find at least one path that has children (hop 2+)
      const hasDeepChain = result.requirement.paths.some(
        (p) => p.children && p.children.length > 0,
      );
      expect(hasDeepChain).toBe(true);

      // Specifically, ISO 21434 clause 8 should have children
      // (work products and/or further standard mappings)
      const clause8 = result.requirement.paths.find(
        (p) => p.id === 'iso_21434' && p.ref === '8',
      );
      expect(clause8).toBeDefined();
      if (clause8) {
        expect(clause8.children.length).toBeGreaterThan(0);

        // Should have work product children
        const wpChildren = clause8.children.filter((c) => c.type === 'work_product');
        expect(wpChildren.length).toBeGreaterThan(0);

        // Should have standard children (further mappings)
        const standardChildren = clause8.children.filter((c) => c.type === 'standard');
        expect(standardChildren.length).toBeGreaterThan(0);
      }
    }
  });

  it('should include architecture patterns in the chain', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r155',
      requirement_ref: '7.2.2.2(g)',
    };
    const result = mapCompliancePath(db, input);

    expect('requirement' in result).toBe(true);
    if ('requirement' in result) {
      // Recursively check for architecture pattern nodes
      function findPatterns(nodes: Array<{ type: string; children: unknown[] }>): boolean {
        for (const node of nodes) {
          if (node.type === 'architecture_pattern') return true;
          if (Array.isArray(node.children) && findPatterns(node.children as typeof nodes)) return true;
        }
        return false;
      }

      const hasPatterns = findPatterns(result.requirement.paths);
      expect(hasPatterns).toBe(true);
    }
  });

  it('should work with other regulations like r156', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r156',
    };
    const result = mapCompliancePath(db, input);

    expect(result).toBeDefined();
    expect(result.regulation).toBe('r156');
  });

  it('should handle case-insensitive regulation IDs', () => {
    const input: MapCompliancePathInput = {
      regulation: 'R155',
      requirement_ref: '7.2.2.2(g)',
    };
    const result = mapCompliancePath(db, input);

    expect(result).toBeDefined();
    expect('requirement' in result).toBe(true);
  });

  it('should include work_products array on standard nodes that have them', () => {
    const input: MapCompliancePathInput = {
      regulation: 'r155',
      requirement_ref: '7.2.2.2(g)',
    };
    const result = mapCompliancePath(db, input);

    expect('requirement' in result).toBe(true);
    if ('requirement' in result) {
      // ISO 21434 clause 8 has work products in its standard_clauses entry
      const clause8 = result.requirement.paths.find(
        (p) => p.id === 'iso_21434' && p.ref === '8',
      );
      expect(clause8).toBeDefined();
      if (clause8) {
        expect(clause8.work_products).toBeDefined();
        expect(clause8.work_products!.length).toBeGreaterThan(0);
      }
    }
  });
});
