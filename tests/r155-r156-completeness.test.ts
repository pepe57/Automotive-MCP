import { describe, it, expect, beforeAll } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');

describe('R155/R156 Content Completeness - EU MCP Integration', () => {
  let db: Database;

  beforeAll(() => {
    db = new Database(DB_PATH, { readonly: true });
  });

  describe('UNECE R155 Complete Content', () => {
    it('should have at least 17 R155 items (12 articles + 5 annexes + paragraphs)', () => {
      const result = db.prepare(
        'SELECT COUNT(*) as count FROM regulation_content WHERE regulation = ?'
      ).get('r155') as { count: number };

      // Original 17 article/annex entries plus paragraph-level breakdowns
      expect(result.count).toBeGreaterThanOrEqual(80);
    });

    it('should have all 12 main articles (1-12)', () => {
      const articles = db.prepare(`
        SELECT reference FROM regulation_content
        WHERE regulation = 'r155' AND content_type = 'article'
        ORDER BY CAST(reference AS INTEGER)
      `).all() as { reference: string }[];

      const expectedArticles = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      const actualArticles = articles.map(a => a.reference);

      expect(actualArticles).toEqual(expectedArticles);
    });

    it('should have all 5 original annexes plus Annex 5 sub-entries', () => {
      // Check original annexes are still present
      const originalAnnexes = db.prepare(`
        SELECT reference FROM regulation_content
        WHERE regulation = 'r155' AND content_type = 'annex' AND reference LIKE 'Annex%'
        ORDER BY CAST(REPLACE(reference, 'Annex ', '') AS INTEGER)
      `).all() as { reference: string }[];

      const expectedAnnexes = ['Annex 1', 'Annex 2', 'Annex 3', 'Annex 4', 'Annex 5'];
      const actualAnnexes = originalAnnexes.map(a => a.reference);
      expect(actualAnnexes).toEqual(expectedAnnexes);

      // Annex 5 also has paragraph-level threat/mitigation sub-entries
      const annexSubItems = db.prepare(`
        SELECT COUNT(*) as count FROM regulation_content
        WHERE regulation = 'r155' AND content_type = 'annex' AND reference LIKE 'A5.%'
      `).get() as { count: number };
      expect(annexSubItems.count).toBeGreaterThanOrEqual(50);
    });

    it('Article 7 should contain comprehensive CSMS requirements', () => {
      const article7 = db.prepare(`
        SELECT text FROM regulation_content
        WHERE regulation = 'r155' AND reference = '7'
      `).get() as { text: string };

      expect(article7.text).toBeTruthy();
      expect(article7.text.length).toBeGreaterThan(20000); // ~22KB

      // Verify it contains key subsections
      expect(article7.text).toContain('7.2.2.2');
      expect(article7.text).toContain('Cybersecurity Management System');
    });

    it('Annex 5 should contain extensive threat catalog', () => {
      const annex5 = db.prepare(`
        SELECT text FROM regulation_content
        WHERE regulation = 'r155' AND reference = 'Annex 5'
      `).get() as { text: string };

      expect(annex5.text).toBeTruthy();
      expect(annex5.text.length).toBeGreaterThan(140000); // ~148KB
      expect(annex5.text).toContain('threats');
      expect(annex5.text).toContain('mitigations');
    });

    it('should have correct article titles', () => {
      const titles = db.prepare(`
        SELECT reference, title FROM regulation_content
        WHERE regulation = 'r155' AND content_type = 'article'
        ORDER BY CAST(reference AS INTEGER)
      `).all() as { reference: string; title: string }[];

      const titleMap = Object.fromEntries(titles.map(t => [t.reference, t.title]));

      expect(titleMap['1']).toBe('Scope');
      expect(titleMap['2']).toBe('Definitions');
      expect(titleMap['7']).toBe('Specifications');
      expect(titleMap['9']).toBe('Conformity of production');
    });
  });

  describe('UNECE R156 Complete Content', () => {
    it('should have at least 16 R156 items (12 articles + 4 annexes + paragraphs)', () => {
      const result = db.prepare(
        'SELECT COUNT(*) as count FROM regulation_content WHERE regulation = ?'
      ).get('r156') as { count: number };

      // Original 16 article/annex entries plus paragraph-level breakdowns
      expect(result.count).toBeGreaterThanOrEqual(80);
    });

    it('should have all 12 main articles (1-12)', () => {
      const articles = db.prepare(`
        SELECT reference FROM regulation_content
        WHERE regulation = 'r156' AND content_type = 'article'
        ORDER BY CAST(reference AS INTEGER)
      `).all() as { reference: string }[];

      const expectedArticles = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      const actualArticles = articles.map(a => a.reference);

      expect(actualArticles).toEqual(expectedArticles);
    });

    it('should have all 4 annexes', () => {
      const annexes = db.prepare(`
        SELECT reference FROM regulation_content
        WHERE regulation = 'r156' AND content_type = 'annex'
        ORDER BY CAST(REPLACE(reference, 'Annex ', '') AS INTEGER)
      `).all() as { reference: string }[];

      const expectedAnnexes = ['Annex 1', 'Annex 2', 'Annex 3', 'Annex 4'];
      const actualAnnexes = annexes.map(a => a.reference);

      expect(actualAnnexes).toEqual(expectedAnnexes);
    });

    it('Article 7 should contain SUMS requirements', () => {
      const article7 = db.prepare(`
        SELECT text FROM regulation_content
        WHERE regulation = 'r156' AND reference = '7'
      `).get() as { text: string };

      expect(article7.text).toBeTruthy();
      expect(article7.text.length).toBeGreaterThan(5000);
      expect(article7.text).toContain('Software');
    });
  });

  describe('Full-Text Search Capabilities', () => {
    it('should find content via FTS search', () => {
      const results = db.prepare(`
        SELECT regulation, reference, title
        FROM regulation_content_fts
        WHERE regulation_content_fts MATCH 'cybersecurity management'
        LIMIT 10
      `).all() as { regulation: string; reference: string; title: string }[];

      expect(results.length).toBeGreaterThan(0);
    });

    it('should search across both R155 and R156', () => {
      const results = db.prepare(`
        SELECT DISTINCT regulation
        FROM regulation_content_fts
        WHERE regulation_content_fts MATCH 'vehicle'
      `).all() as { regulation: string }[];

      const regulations = results.map(r => r.regulation);
      expect(regulations).toContain('r155');
      expect(regulations).toContain('r156');
    });

    it('should find specific subsection references in text', () => {
      const results = db.prepare(`
        SELECT regulation, reference
        FROM regulation_content_fts
        WHERE regulation_content_fts MATCH '"7.2.2.2"'
      `).all() as { regulation: string; reference: string }[];

      expect(results.length).toBeGreaterThan(0);
      // Should find in Article 7
      const article7Matches = results.filter(r => r.reference === '7');
      expect(article7Matches.length).toBeGreaterThan(0);
    });
  });

  describe('Data Quality', () => {
    it('all content items should have non-empty text', () => {
      const emptyContent = db.prepare(`
        SELECT COUNT(*) as count
        FROM regulation_content
        WHERE regulation IN ('r155', 'r156') AND (text IS NULL OR text = '')
      `).get() as { count: number };

      expect(emptyContent.count).toBe(0);
    });

    it('all article-level and annex-level content should have titles', () => {
      const noTitle = db.prepare(`
        SELECT COUNT(*) as count
        FROM regulation_content
        WHERE regulation IN ('r155', 'r156')
          AND content_type IN ('article', 'annex')
          AND reference NOT LIKE 'A5.%'
          AND (title IS NULL OR title = '')
      `).get() as { count: number };

      expect(noTitle.count).toBe(0);
    });

    it('should have substantial content (>250KB total text)', () => {
      const totalSize = db.prepare(`
        SELECT SUM(LENGTH(text)) as total
        FROM regulation_content
        WHERE regulation IN ('r155', 'r156')
      `).get() as { total: number };

      expect(totalSize.total).toBeGreaterThan(250000); // ~293K chars
    });
  });
});
