/**
 * Tests for database population from seed files
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');
const STANDARDS_SEED_PATH = join(__dirname, '..', 'data', 'seed', 'standards.json');
const CROSS_MAPPINGS_SEED_PATH = join(__dirname, '..', 'data', 'seed', 'cross-mappings.json');
const standardsSeed = JSON.parse(readFileSync(STANDARDS_SEED_PATH, 'utf-8')) as {
  standards: unknown[];
  clauses: Array<{
    standard?: string;
    clause_id?: string;
    r155_mapping?: string[];
    mappings?: Array<{
      target_type?: string;
      target_id?: string;
      target_ref?: string;
      relationship?: string;
    }>;
  }>;
};
const crossMappingsSeed = existsSync(CROSS_MAPPINGS_SEED_PATH)
  ? JSON.parse(readFileSync(CROSS_MAPPINGS_SEED_PATH, 'utf-8')) as {
      mappings: Array<{
        source_type: string;
        source_id: string;
        source_ref: string;
        target_type: string;
        target_id: string;
        target_ref: string;
        relationship: string;
      }>;
    }
  : { mappings: [] };
const expectedStandardCount = standardsSeed.standards.length;
const expectedClauseCount = standardsSeed.clauses.length;
const expectedMappingCount = (() => {
  const keys = new Set<string>();

  for (const clause of standardsSeed.clauses) {
    const sourceId = clause.standard;
    const sourceRef = clause.clause_id;
    if (!sourceId || !sourceRef) continue;

    // Key matches DB UNIQUE constraint: (source_type, source_id, source_ref, target_type, target_id, target_ref)
    if (Array.isArray(clause.r155_mapping)) {
      for (const targetRef of clause.r155_mapping) {
        keys.add(`standard|${sourceId}|${sourceRef}|regulation|r155|${targetRef}`);
      }
    }

    if (Array.isArray(clause.mappings)) {
      for (const mapping of clause.mappings) {
        if (!mapping?.target_type || !mapping?.target_id || !mapping?.target_ref) continue;
        keys.add(
          `standard|${sourceId}|${sourceRef}|${mapping.target_type}|${mapping.target_id}|${mapping.target_ref}`
        );
      }
    }
  }

  // Include cross-mappings (deduplicated by same unique key as DB)
  for (const m of crossMappingsSeed.mappings) {
    keys.add(
      `${m.source_type}|${m.source_id}|${m.source_ref}|${m.target_type}|${m.target_id}|${m.target_ref}`
    );
  }

  return keys.size;
})();

describe('Database Population', () => {
  let db: Database;

  beforeAll(() => {
    // Ensure database exists
    if (!existsSync(DB_PATH)) {
      throw new Error(`Database not found at ${DB_PATH}. Run: npm run build:db`);
    }
    db = new Database(DB_PATH, { readonly: true });
  });

  describe('Regulations', () => {
    it('should load at least 2 regulations', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM regulations').get() as { count: number };
      expect(count.count).toBeGreaterThanOrEqual(2);
    });

    it('should have R155 with correct metadata', () => {
      const reg = db.prepare('SELECT * FROM regulations WHERE id = ?').get('r155') as any;
      expect(reg).toBeDefined();
      expect(reg.full_name).toBe('UN Regulation No. 155');
      expect(reg.title).toBe('Cyber Security and Cyber Security Management System');
      expect(reg.regulation_type).toBe('unece');
    });

    it('should store applies_to as JSON string', () => {
      const reg = db.prepare('SELECT applies_to FROM regulations WHERE id = ?').get('r155') as any;
      expect(reg.applies_to).toBeDefined();
      const parsed = JSON.parse(reg.applies_to);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toContain('M1');
      expect(parsed).toContain('N1');
    });

    it('should have R156 with correct metadata', () => {
      const reg = db.prepare('SELECT * FROM regulations WHERE id = ?').get('r156') as any;
      expect(reg).toBeDefined();
      expect(reg.full_name).toBe('UN Regulation No. 156');
      expect(reg.title).toBe('Software Update and Software Updates Management System');
    });
  });

  describe('Regulation Content', () => {
    it('should load content items including article-level and paragraph-level entries', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM regulation_content').get() as { count: number };
      // Original 33 article/annex entries + paragraph-level breakdowns
      expect(count.count).toBeGreaterThanOrEqual(33);
    });

    it('should have correct content for R155 Article 7 with CSMS requirements', () => {
      const content = db.prepare(
        'SELECT * FROM regulation_content WHERE regulation = ? AND reference = ?'
      ).get('r155', '7') as any;

      expect(content).toBeDefined();
      expect(content.content_type).toBe('article');
      expect(content.title).toBe('Specifications');
      expect(content.text).toContain('Cybersecurity Management System');
      expect(content.text).toContain('7.2.2.2'); // Contains subsection references
      expect(content.parent_reference).toBeNull();
    });
  });

  describe('Standards', () => {
    it('should load standards from seed file', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM standards').get() as { count: number };
      expect(count.count).toBe(expectedStandardCount);
    });

    it('should have ISO 21434 with correct metadata', () => {
      const std = db.prepare('SELECT * FROM standards WHERE id = ?').get('iso_21434') as any;
      expect(std).toBeDefined();
      expect(std.full_name).toBe('ISO/SAE 21434:2021');
      expect(std.title).toBe('Road vehicles — Cybersecurity engineering');
      expect(std.note).toContain('Standard text requires paid license');
    });
  });

  describe('Standard Clauses', () => {
    it('should load standard clauses from seed file', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM standard_clauses').get() as { count: number };
      expect(count.count).toBe(expectedClauseCount);
    });

    it('should have clause 9.3 with correct data', () => {
      const clause = db.prepare(
        'SELECT * FROM standard_clauses WHERE standard = ? AND clause_id = ?'
      ).get('iso_21434', '9.3') as any;

      expect(clause).toBeDefined();
      expect(clause.title).toBe('Vulnerability analysis');
      expect(clause.guidance).toContain('vulnerability analysis');
      expect(clause.cal_relevant).toBe(1);
    });

    it('should store work_products as JSON string', () => {
      const clause = db.prepare(
        'SELECT work_products FROM standard_clauses WHERE standard = ? AND clause_id = ?'
      ).get('iso_21434', '9.3') as any;

      expect(clause.work_products).toBeDefined();
      const parsed = JSON.parse(clause.work_products);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toContain('[WP-09-03]');
    });
  });

  describe('FTS5 Search', () => {
    it('should automatically populate regulation_content_fts', () => {
      const count = db.prepare(
        'SELECT COUNT(*) as count FROM regulation_content_fts'
      ).get() as { count: number };
      // Matches regulation_content count (articles + paragraphs + annexes)
      expect(count.count).toBeGreaterThanOrEqual(33);
    });

    it('should search regulation content by keyword', () => {
      const results = db.prepare(
        'SELECT reference FROM regulation_content_fts WHERE regulation_content_fts MATCH ?'
      ).all('vulnerability') as any[];

      // Vulnerability should be found in multiple articles
      expect(results.length).toBeGreaterThan(0);

      // Search for CSMS which should be in Article 7
      const csmsResults = db.prepare(
        'SELECT reference FROM regulation_content_fts WHERE regulation_content_fts MATCH ?'
      ).all('Cybersecurity Management System') as any[];

      expect(csmsResults.length).toBeGreaterThan(0);
      // Article 7 contains CSMS specifications
      expect(csmsResults.some((r: any) => r.reference === '7')).toBe(true);
    });

    it('should automatically populate standard_clauses_fts', () => {
      const count = db.prepare(
        'SELECT COUNT(*) as count FROM standard_clauses_fts'
      ).get() as { count: number };
      expect(count.count).toBe(expectedClauseCount);
    });

    it('should search standard clauses by keyword', () => {
      const results = db.prepare(
        'SELECT clause_id FROM standard_clauses_fts WHERE standard_clauses_fts MATCH ?'
      ).all('vulnerability') as any[];

      expect(results.length).toBeGreaterThan(0);
      // Vulnerability appears in multiple clauses (8, 9.3, 15, etc.)
      const clauseIds = results.map((r: any) => r.clause_id);
      expect(clauseIds).toContain('9.3');
    });
  });

  describe('Foreign Key Enforcement', () => {
    it('should have foreign keys enabled', () => {
      const result = db.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);
    });
  });

  describe('Framework Mappings', () => {
    it('should load framework mappings from seed file', () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM framework_mappings').get() as { count: number };
      expect(count.count).toBe(expectedMappingCount);
    });
  });
});
