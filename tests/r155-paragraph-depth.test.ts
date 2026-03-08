import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');

describe('R155 paragraph-level depth', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(DB_PATH, { readonly: true });
  });

  it('has at least 80 R155 content items (was 17)', () => {
    const count = db.prepare(
      "SELECT COUNT(*) as cnt FROM regulation_content WHERE regulation = 'r155'"
    ).get() as { cnt: number };
    expect(count.cnt).toBeGreaterThanOrEqual(80);
  });

  it('has paragraph-level items for Article 7', () => {
    const items = db.prepare(
      "SELECT reference FROM regulation_content WHERE regulation = 'r155' AND reference LIKE '7.%'"
    ).all();
    expect(items.length).toBeGreaterThanOrEqual(20);
  });

  it('has Annex 5 Part A individual threat entries', () => {
    const items = db.prepare(
      "SELECT reference FROM regulation_content WHERE regulation = 'r155' AND content_type = 'annex' AND reference LIKE 'A5.A.%'"
    ).all();
    expect(items.length).toBeGreaterThanOrEqual(20);
  });

  it('has Annex 5 Part B individual mitigation entries', () => {
    const items = db.prepare(
      "SELECT reference FROM regulation_content WHERE regulation = 'r155' AND content_type = 'annex' AND reference LIKE 'A5.B.%'"
    ).all();
    // R155 Annex 5 Part B contains 19 unique mitigations (M3, M6-M16, M18-M24; M17 absent from source)
    expect(items.length).toBeGreaterThanOrEqual(19);
  });

  it('can FTS search for specific paragraph content', () => {
    const results = db.prepare(
      "SELECT * FROM regulation_content_fts WHERE regulation_content_fts MATCH 'unauthorized access' LIMIT 5"
    ).all();
    expect(results.length).toBeGreaterThan(0);
  });
});
