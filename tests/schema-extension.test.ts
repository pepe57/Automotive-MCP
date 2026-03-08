// tests/schema-extension.test.ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(__dirname, '..', 'data', 'automotive.db');

describe('Schema extension', () => {
  it('has architecture_patterns table', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='architecture_patterns'"
    ).all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it('has attack_patterns table', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='attack_patterns'"
    ).all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it('has tara_examples table', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tara_examples'"
    ).all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it('has csms_obligations table', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='csms_obligations'"
    ).all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it('has FTS5 index on architecture_patterns', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='architecture_patterns_fts'"
    ).all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it('has FTS5 index on attack_patterns', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='attack_patterns_fts'"
    ).all();
    expect(tables).toHaveLength(1);
    db.close();
  });
});
