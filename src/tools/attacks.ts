import type Database from '@ansvar/mcp-sqlite';
import type { SearchAttackPatternsInput } from '../types/index.js';
import { sanitizeQuery } from './search.js';

/**
 * Database row shape for attack_patterns table.
 */
interface AttackPatternRow {
  id: string;
  name: string;
  target_component: string;
  attack_vector: string;
  stride_category: string;
  feasibility: string;       // JSON object
  impact: string;
  known_mitigations: string; // JSON array
  r155_annex5_refs: string | null; // JSON array
  description: string;
  prerequisites: string | null;    // JSON array
  detection_methods: string | null; // JSON array
}

interface AttackPatternResult {
  id: string;
  name: string;
  target_component: string;
  attack_vector: string;
  stride_category: string;
  impact: string;
  feasibility: Record<string, string>;
  known_mitigations: string[];
  r155_annex5_refs: string[];
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toResult(row: AttackPatternRow): AttackPatternResult {
  return {
    id: row.id,
    name: row.name,
    target_component: row.target_component,
    attack_vector: row.attack_vector,
    stride_category: row.stride_category,
    impact: row.impact,
    feasibility: parseJson<Record<string, string>>(row.feasibility, {}),
    known_mitigations: parseJson<string[]>(row.known_mitigations, []),
    r155_annex5_refs: parseJson<string[]>(row.r155_annex5_refs, []),
  };
}

/**
 * Search automotive-specific attack patterns by keyword, target component,
 * or STRIDE category.
 *
 * - When `query` is provided, performs FTS5 search (optionally filtered by
 *   target_component and/or stride_category).
 * - When only `target_component` or `stride_category` is provided, returns
 *   all matching rows without FTS ranking.
 * - When no parameters are provided, returns an error.
 *
 * @param db - SQLite database connection
 * @param input - Search filters and limit
 * @returns Array of attack pattern results
 */
export function searchAttackPatterns(
  db: InstanceType<typeof Database>,
  input: SearchAttackPatternsInput,
): AttackPatternResult[] {
  const { query, target_component, stride_category, limit: rawLimit = 10 } = input;
  const limit = Math.max(1, Math.min(rawLimit, 50));

  // If no filters at all, throw an error
  if (!query && !target_component && !stride_category) {
    throw new Error(
      'At least one filter required: query, target_component, or stride_category.',
    );
  }

  if (query && query.trim() !== '') {
    // FTS5 search path
    const sanitized = sanitizeQuery(query);

    const conditions: string[] = [];
    const params: (string | number)[] = [sanitized];

    if (target_component) {
      conditions.push('ap.target_component = ?');
      params.push(target_component);
    }
    if (stride_category) {
      conditions.push('ap.stride_category = ?');
      params.push(stride_category);
    }

    const whereExtra = conditions.length > 0
      ? 'AND ' + conditions.join(' AND ')
      : '';

    params.push(limit);

    const sql = `
      SELECT ap.*
      FROM attack_patterns_fts
      JOIN attack_patterns ap ON ap.rowid = attack_patterns_fts.rowid
      WHERE attack_patterns_fts MATCH ?
      ${whereExtra}
      ORDER BY bm25(attack_patterns_fts)
      LIMIT ?
    `;

    try {
      const rows = db.prepare(sql).all(...params) as AttackPatternRow[];
      return rows.map(toResult);
    } catch (error) {
      if (error instanceof Error && error.message.includes('fts5')) {
        return [];
      }
      throw new Error(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Non-FTS path: filter by component and/or stride only
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (target_component) {
    conditions.push('target_component = ?');
    params.push(target_component);
  }
  if (stride_category) {
    conditions.push('stride_category = ?');
    params.push(stride_category);
  }

  params.push(limit);

  const sql = `
    SELECT * FROM attack_patterns
    WHERE ${conditions.join(' AND ')}
    ORDER BY name
    LIMIT ?
  `;

  const rows = db.prepare(sql).all(...params) as AttackPatternRow[];
  return rows.map(toResult);
}
