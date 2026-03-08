import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');

describe('Guidance depth - AUTOSAR', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(DB_PATH, { readonly: true });
  });

  it('AUTOSAR clauses have guidance >= 300 words each', () => {
    const clauses = db.prepare(
      "SELECT clause_id, guidance FROM standard_clauses WHERE standard = 'autosar'"
    ).all() as Array<{ clause_id: string; guidance: string }>;

    for (const clause of clauses) {
      const wordCount = clause.guidance.split(/\s+/).length;
      expect(wordCount, `Clause ${clause.clause_id} has ${wordCount} words, need >= 300`).toBeGreaterThanOrEqual(300);
    }
  });

  it('SecOC clause mentions freshness values and MAC', () => {
    const clause = db.prepare(
      "SELECT guidance FROM standard_clauses WHERE standard = 'autosar' AND clause_id = 'SecOC'"
    ).get() as { guidance: string };
    expect(clause.guidance.toLowerCase()).toContain('freshness');
    expect(clause.guidance.toLowerCase()).toContain('mac');
  });

  it('KeyM clause mentions certificate chain and HSM', () => {
    const clause = db.prepare(
      "SELECT guidance FROM standard_clauses WHERE standard = 'autosar' AND clause_id = 'KeyM'"
    ).get() as { guidance: string };
    expect(clause.guidance.toLowerCase()).toContain('certificate');
    expect(clause.guidance.toLowerCase()).toContain('hsm');
  });

  it('IdsM clause mentions CAN anomaly detection', () => {
    const clause = db.prepare(
      "SELECT guidance FROM standard_clauses WHERE standard = 'autosar' AND clause_id = 'IdsM'"
    ).get() as { guidance: string };
    expect(clause.guidance.toLowerCase()).toContain('anomaly');
    expect(clause.guidance.toLowerCase()).toContain('can');
  });
});
