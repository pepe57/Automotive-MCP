import { describe, it, expect, beforeAll } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');

describe('Architecture patterns', () => {
  let db: Database;

  beforeAll(() => {
    db = new Database(DB_PATH, { readonly: true });
  });

  it('has at least 15 architecture patterns', () => {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM architecture_patterns").get() as { cnt: number };
    expect(count.cnt).toBeGreaterThanOrEqual(15);
  });

  it('has split-trust diagnostic PKI pattern', () => {
    const pattern = db.prepare(
      "SELECT * FROM architecture_patterns WHERE id = 'split-trust-diagnostic-pki'"
    ).get();
    expect(pattern).toBeTruthy();
  });

  it('FTS search finds patterns by keyword', () => {
    const results = db.prepare(
      "SELECT * FROM architecture_patterns_fts WHERE architecture_patterns_fts MATCH 'diagnostic certificate' LIMIT 5"
    ).all();
    expect(results.length).toBeGreaterThan(0);
  });

  it('each pattern has applicable_standards as valid JSON array', () => {
    const patterns = db.prepare("SELECT id, applicable_standards FROM architecture_patterns").all() as Array<{ id: string; applicable_standards: string }>;
    for (const p of patterns) {
      const parsed = JSON.parse(p.applicable_standards);
      expect(Array.isArray(parsed), `Pattern ${p.id} applicable_standards is not an array`).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    }
  });
});
