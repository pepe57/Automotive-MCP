import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');

describe('Cross-framework mappings', () => {
  let db: Database.Database;
  beforeAll(() => { db = new Database(DB_PATH, { readonly: true }); });

  it('has at least 2000 framework mappings', () => {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM framework_mappings").get() as { cnt: number };
    expect(count.cnt).toBeGreaterThanOrEqual(2000);
  });

  it('has mappings between ISO 21434 and AUTOSAR', () => {
    const count = db.prepare(
      "SELECT COUNT(*) as cnt FROM framework_mappings WHERE source_id = 'iso_21434' AND target_id = 'autosar'"
    ).get() as { cnt: number };
    expect(count.cnt).toBeGreaterThan(0);
  });

  it('has mappings between R155 and new market regulations', () => {
    const count = db.prepare(
      "SELECT COUNT(*) as cnt FROM framework_mappings WHERE (source_id = 'r155' OR target_id = 'r155') AND (source_id IN ('gbt_40857','kmvss_18_3','ais_189') OR target_id IN ('gbt_40857','kmvss_18_3','ais_189'))"
    ).get() as { cnt: number };
    expect(count.cnt).toBeGreaterThan(0);
  });

  it('has safety-security interface mappings (ISO 21434 <-> ISO 26262)', () => {
    const count = db.prepare(
      "SELECT COUNT(*) as cnt FROM framework_mappings WHERE (source_id = 'iso_21434' AND target_id = 'iso_26262') OR (source_id = 'iso_26262' AND target_id = 'iso_21434')"
    ).get() as { cnt: number };
    expect(count.cnt).toBeGreaterThan(0);
  });
});
