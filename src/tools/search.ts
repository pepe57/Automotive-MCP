import type Database from '@ansvar/mcp-sqlite';
import type { SearchRequirementsInput, SearchResult } from '../types/index.js';

/**
 * Full-text search across regulations and standards using FTS5 with BM25 ranking.
 *
 * Searches both regulation_content_fts and standard_clauses_fts tables.
 * Returns results sorted by relevance with highlighted snippets.
 *
 * @param db - SQLite database connection
 * @param input - Search query, optional source filter, and result limit
 * @returns Array of search results with snippets and relevance scores
 */
/**
 * Sanitize FTS5 query to handle special characters and prevent syntax errors.
 * FTS5 uses special operators like AND, OR, NOT, NEAR, -, ", etc.
 * For simple text searches, we quote the query to treat it as a phrase.
 *
 * @param query - Raw search query
 * @returns Sanitized query safe for FTS5 MATCH
 */
export function sanitizeQuery(query: string): string {
  // Remove leading/trailing whitespace
  const trimmed = query.trim();

  // If query already has quotes, use as-is
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }

  // Check if query contains FTS5 operators or special chars that could cause issues
  const hasSpecialChars = /[-+(){}[\]"*:^]/.test(trimmed);

  if (hasSpecialChars) {
    // Escape double quotes inside the query and wrap in quotes for phrase search
    return `"${trimmed.replace(/"/g, '""')}"`;
  }

  // For simple queries, return as-is (FTS5 will tokenize properly)
  return trimmed;
}

export function searchRequirements(db: InstanceType<typeof Database>, input: SearchRequirementsInput): SearchResult[] {
  const { query, sources: rawSources, limit: rawLimit = 10 } = input;
  const sources = rawSources?.map(s => s.toLowerCase());
  const limit = Math.max(0, Math.min(rawLimit, 100));

  // Return empty array for empty queries
  if (!query || query.trim() === '') {
    return [];
  }

  // Sanitize query for FTS5
  const sanitizedQuery = sanitizeQuery(query);

  try {
    const results: SearchResult[] = [];

    // Build WHERE clause for source filtering
    const buildSourceFilter = (sourceColumn: string, sources?: string[]): string => {
      if (!sources || sources.length === 0) {
        return '';
      }
      const placeholders = sources.map(() => '?').join(', ');
      return `AND ${sourceColumn} IN (${placeholders})`;
    };

    // Search regulations using FTS5
    const regulationSourceFilter = buildSourceFilter('regulation', sources);
    const regulationQuery = `
      SELECT
        regulation as source,
        reference,
        title,
        snippet(regulation_content_fts, -1, '**', '**', '...', 32) as snippet,
        bm25(regulation_content_fts) as rank
      FROM regulation_content_fts
      WHERE regulation_content_fts MATCH ?
      ${regulationSourceFilter}
      ORDER BY rank
      LIMIT ?
    `;

    const regulationStmt = db.prepare(regulationQuery);
    const regulationParams = sources && sources.length > 0
      ? [sanitizedQuery, ...sources, limit]
      : [sanitizedQuery, limit];

    const regulationResults = regulationStmt.all(...regulationParams) as Array<{
      source: string;
      reference: string;
      title: string | null;
      snippet: string;
      rank: number;
    }>;

    for (const row of regulationResults) {
      results.push({
        source: row.source,
        reference: row.reference,
        title: row.title,
        snippet: row.snippet,
        relevance: row.rank,
        content_type: 'regulation'
      });
    }

    // Search standards using FTS5
    const standardSourceFilter = buildSourceFilter('standard', sources);
    const standardQuery = `
      SELECT
        standard as source,
        clause_id as reference,
        title,
        snippet(standard_clauses_fts, -1, '**', '**', '...', 32) as snippet,
        bm25(standard_clauses_fts) as rank
      FROM standard_clauses_fts
      WHERE standard_clauses_fts MATCH ?
      ${standardSourceFilter}
      ORDER BY rank
      LIMIT ?
    `;

    const standardStmt = db.prepare(standardQuery);
    const standardParams = sources && sources.length > 0
      ? [sanitizedQuery, ...sources, limit]
      : [sanitizedQuery, limit];

    const standardResults = standardStmt.all(...standardParams) as Array<{
      source: string;
      reference: string;
      title: string | null;
      snippet: string;
      rank: number;
    }>;

    for (const row of standardResults) {
      results.push({
        source: row.source,
        reference: row.reference,
        title: row.title,
        snippet: row.snippet,
        relevance: row.rank,
        content_type: 'standard'
      });
    }

    // Search architecture patterns using FTS5
    try {
      const archQuery = `
        SELECT
          'architecture_patterns' as source,
          id as reference,
          name as title,
          snippet(architecture_patterns_fts, -1, '**', '**', '...', 32) as snippet,
          bm25(architecture_patterns_fts) as rank
        FROM architecture_patterns_fts
        WHERE architecture_patterns_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;

      const archResults = db.prepare(archQuery).all(sanitizedQuery, limit) as Array<{
        source: string;
        reference: string;
        title: string | null;
        snippet: string;
        rank: number;
      }>;

      for (const row of archResults) {
        results.push({
          source: row.source,
          reference: row.reference,
          title: row.title,
          snippet: row.snippet,
          relevance: row.rank,
          content_type: 'architecture_pattern'
        });
      }
    } catch {
      // architecture_patterns_fts table may not exist in test databases
    }

    // Search attack patterns using FTS5
    try {
      const attackQuery = `
        SELECT
          'attack_patterns' as source,
          id as reference,
          name as title,
          snippet(attack_patterns_fts, -1, '**', '**', '...', 32) as snippet,
          bm25(attack_patterns_fts) as rank
        FROM attack_patterns_fts
        WHERE attack_patterns_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;

      const attackResults = db.prepare(attackQuery).all(sanitizedQuery, limit) as Array<{
        source: string;
        reference: string;
        title: string | null;
        snippet: string;
        rank: number;
      }>;

      for (const row of attackResults) {
        results.push({
          source: row.source,
          reference: row.reference,
          title: row.title,
          snippet: row.snippet,
          relevance: row.rank,
          content_type: 'attack_pattern'
        });
      }
    } catch {
      // attack_patterns_fts table may not exist in test databases
    }

    // Search CSMS obligations using FTS5
    try {
      const csmsQuery = `
        SELECT
          'csms_obligations' as source,
          id as reference,
          obligation as title,
          snippet(csms_obligations_fts, -1, '**', '**', '...', 32) as snippet,
          bm25(csms_obligations_fts) as rank
        FROM csms_obligations_fts
        WHERE csms_obligations_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;

      const csmsResults = db.prepare(csmsQuery).all(sanitizedQuery, limit) as Array<{
        source: string;
        reference: string;
        title: string | null;
        snippet: string;
        rank: number;
      }>;

      for (const row of csmsResults) {
        results.push({
          source: row.source,
          reference: row.reference,
          title: row.title,
          snippet: row.snippet,
          relevance: row.rank,
          content_type: 'csms_obligation'
        });
      }
    } catch {
      // csms_obligations_fts table may not exist in test databases
    }

    // Sort all results by relevance (BM25 rank - lower is better)
    results.sort((a, b) => a.relevance - b.relevance);

    // Apply overall limit
    return results.slice(0, limit);

  } catch (error) {
    // Handle FTS5 query syntax errors gracefully
    if (error instanceof Error && error.message.includes('fts5')) {
      // Return empty results for invalid FTS5 queries
      return [];
    }
    // Re-throw other errors
    throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
