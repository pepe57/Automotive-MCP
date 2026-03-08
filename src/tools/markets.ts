import type Database from '@ansvar/mcp-sqlite';
import type { CompareMarketsInput } from '../types/index.js';
import { sanitizeQuery } from './search.js';

/**
 * A requirement entry from regulation_content.
 */
interface RequirementRow {
  regulation: string;
  content_type: string;
  reference: string;
  title: string | null;
  text: string;
}

/**
 * A cross-market equivalence from framework_mappings.
 */
interface CrossMarketMapping {
  source_id: string;
  source_ref: string;
  target_id: string;
  target_ref: string;
  relationship: string;
  notes: string | null;
}

/**
 * A single requirement in the comparison output.
 */
interface ComparisonRequirement {
  regulation: string;
  reference: string;
  title: string | null;
  text: string;
}

/**
 * A cross-market equivalence pair shown in the output.
 */
interface Equivalence {
  source_regulation: string;
  source_ref: string;
  target_regulation: string;
  target_ref: string;
  relationship: string;
  notes: string | null;
}

interface CompareMarketsOutput {
  markets_compared: string[];
  topic?: string;
  common_requirements: Equivalence[];
  market_specific: Record<string, ComparisonRequirement[]>;
  equivalences: Equivalence[];
  summary: {
    total_requirements_per_market: Record<string, number>;
    cross_market_mappings: number;
    common_topic_count: number;
  };
}

/**
 * Compare automotive cybersecurity requirements across markets.
 *
 * For each market regulation, queries regulation_content for requirements.
 * Uses framework_mappings to find cross-market equivalences.
 * Optionally filters by topic using FTS5.
 *
 * Requires at least 2 markets in the markets array.
 *
 * @param db - SQLite database connection
 * @param input - Markets to compare and optional topic filter
 * @returns Comparison with common requirements, market-specific items, and equivalences
 */
export function compareMarkets(
  db: InstanceType<typeof Database>,
  input: CompareMarketsInput,
): CompareMarketsOutput {
  const { markets: rawMarkets, topic } = input;

  if (!rawMarkets || rawMarkets.length < 2) {
    throw new Error(
      'At least 2 markets required for comparison. Provide market regulation IDs (e.g., ["r155", "gbt_40857"]).',
    );
  }

  const markets = rawMarkets.map(m => m.toLowerCase());

  // Validate that all markets exist
  for (const market of markets) {
    const exists = db.prepare('SELECT id FROM regulations WHERE id = ?').get(market) as { id: string } | undefined;
    if (!exists) {
      const available = db.prepare('SELECT id FROM regulations').all() as Array<{ id: string }>;
      throw new Error(
        `Regulation not found: ${market}. Available regulations: ${available.map(r => r.id).join(', ')}`,
      );
    }
  }

  // Gather requirements per market
  const requirementsByMarket: Record<string, ComparisonRequirement[]> = {};

  for (const market of markets) {
    if (topic && topic.trim() !== '') {
      // FTS-filtered requirements
      const sanitized = sanitizeQuery(topic);
      try {
        const rows = db.prepare(`
          SELECT rc.regulation, rc.content_type, rc.reference, rc.title, rc.text
          FROM regulation_content_fts fts
          JOIN regulation_content rc ON rc.rowid = fts.rowid
          WHERE regulation_content_fts MATCH ?
          AND rc.regulation = ?
          ORDER BY bm25(regulation_content_fts)
        `).all(sanitized, market) as RequirementRow[];

        requirementsByMarket[market] = rows.map(r => ({
          regulation: r.regulation,
          reference: r.reference,
          title: r.title,
          text: r.text,
        }));
      } catch (error) {
        if (error instanceof Error && error.message.includes('fts5')) {
          requirementsByMarket[market] = [];
        } else {
          throw new Error(
            `Search failed for ${market}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } else {
      // All requirements for this market (articles and paragraphs)
      const rows = db.prepare(`
        SELECT regulation, content_type, reference, title, text
        FROM regulation_content
        WHERE regulation = ?
        ORDER BY reference
      `).all(market) as RequirementRow[];

      requirementsByMarket[market] = rows.map(r => ({
        regulation: r.regulation,
        reference: r.reference,
        title: r.title,
        text: r.text,
      }));
    }
  }

  // Gather cross-market equivalences from framework_mappings
  // We want all pairs where both source and target are in our market list
  const placeholders = markets.map(() => '?').join(', ');
  const equivalenceRows = db.prepare(`
    SELECT source_id, source_ref, target_id, target_ref, relationship, notes
    FROM framework_mappings
    WHERE source_type = 'regulation'
      AND target_type = 'regulation'
      AND source_id IN (${placeholders})
      AND target_id IN (${placeholders})
    ORDER BY source_id, source_ref
  `).all(...markets, ...markets) as CrossMarketMapping[];

  const equivalences: Equivalence[] = equivalenceRows.map(e => ({
    source_regulation: e.source_id,
    source_ref: e.source_ref,
    target_regulation: e.target_id,
    target_ref: e.target_ref,
    relationship: e.relationship,
    notes: e.notes,
  }));

  // Find common requirements: references that appear in equivalence mappings
  // These are the cross-market "aligned" requirements
  const commonRequirements: Equivalence[] = equivalences.filter(
    e => e.relationship === 'satisfies' || e.relationship === 'partial',
  );

  // Determine market-specific items: requirements not referenced in any equivalence
  const referencedRefs = new Map<string, Set<string>>();
  for (const market of markets) {
    referencedRefs.set(market, new Set<string>());
  }

  for (const eq of equivalences) {
    referencedRefs.get(eq.source_regulation)?.add(eq.source_ref);
    referencedRefs.get(eq.target_regulation)?.add(eq.target_ref);
  }

  const marketSpecific: Record<string, ComparisonRequirement[]> = {};
  for (const market of markets) {
    const referenced = referencedRefs.get(market) ?? new Set<string>();
    marketSpecific[market] = (requirementsByMarket[market] ?? []).filter(
      r => !referenced.has(r.reference),
    );
  }

  // Build summary
  const totalRequirementsPerMarket: Record<string, number> = {};
  for (const market of markets) {
    totalRequirementsPerMarket[market] = (requirementsByMarket[market] ?? []).length;
  }

  return {
    markets_compared: markets,
    topic: topic || undefined,
    common_requirements: commonRequirements,
    market_specific: marketSpecific,
    equivalences,
    summary: {
      total_requirements_per_market: totalRequirementsPerMarket,
      cross_market_mappings: equivalences.length,
      common_topic_count: commonRequirements.length,
    },
  };
}
