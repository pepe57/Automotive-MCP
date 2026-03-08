import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');

describe('CSMS obligations', () => {
  let db: Database.Database;
  beforeAll(() => { db = new Database(DB_PATH, { readonly: true }); });

  it('has at least 40 obligations', () => {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM csms_obligations").get() as { cnt: number };
    expect(count.cnt).toBeGreaterThanOrEqual(40);
  });

  it('covers all 5 lifecycle phases', () => {
    const phases = db.prepare("SELECT DISTINCT lifecycle_phase FROM csms_obligations").all() as Array<{ lifecycle_phase: string }>;
    const phaseNames = phases.map(p => p.lifecycle_phase);
    expect(phaseNames).toContain('development');
    expect(phaseNames).toContain('production');
    expect(phaseNames).toContain('operations');
    expect(phaseNames).toContain('decommissioning');
    expect(phaseNames).toContain('supplier_management');
  });

  it('FTS search finds incident reporting', () => {
    const results = db.prepare(
      "SELECT * FROM csms_obligations_fts WHERE csms_obligations_fts MATCH 'incident reporting' LIMIT 5"
    ).all();
    expect(results.length).toBeGreaterThan(0);
  });

  it('evidence_required fields are valid JSON arrays', () => {
    const obligations = db.prepare("SELECT id, evidence_required FROM csms_obligations").all() as Array<{ id: string; evidence_required: string }>;
    for (const o of obligations) {
      const parsed = JSON.parse(o.evidence_required);
      expect(Array.isArray(parsed), `${o.id} evidence_required is not an array`).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    }
  });
});
