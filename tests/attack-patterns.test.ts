import { describe, it, expect, beforeAll } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');

describe('Attack patterns', () => {
  let db: Database;

  beforeAll(() => {
    db = new Database(DB_PATH, { readonly: true });
  });

  it('has at least 80 attack patterns', () => {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM attack_patterns").get() as { cnt: number };
    expect(count.cnt).toBeGreaterThanOrEqual(80);
  });

  it('covers at least 5 target components', () => {
    const components = db.prepare(
      "SELECT DISTINCT target_component FROM attack_patterns"
    ).all() as Array<{ target_component: string }>;
    expect(components.length).toBeGreaterThanOrEqual(5);
  });

  it('FTS search finds attack patterns', () => {
    const results = db.prepare(
      "SELECT * FROM attack_patterns_fts WHERE attack_patterns_fts MATCH 'replay attack' LIMIT 5"
    ).all();
    expect(results.length).toBeGreaterThan(0);
  });

  it('feasibility fields are valid JSON', () => {
    const patterns = db.prepare("SELECT id, feasibility FROM attack_patterns").all() as Array<{ id: string; feasibility: string }>;
    for (const p of patterns) {
      const parsed = JSON.parse(p.feasibility);
      expect(parsed).toHaveProperty('elapsed_time');
      expect(parsed).toHaveProperty('expertise');
    }
  });

  it('has STRIDE categories', () => {
    const categories = db.prepare(
      "SELECT DISTINCT stride_category FROM attack_patterns"
    ).all() as Array<{ stride_category: string }>;
    expect(categories.length).toBeGreaterThanOrEqual(4);
  });
});
