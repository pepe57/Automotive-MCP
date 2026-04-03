import type Database from '@ansvar/mcp-sqlite';
import type { GetRequirementInput, GetRequirementOutput, MappingReference } from '../types/index.js';

/**
 * Retrieve a specific regulation article or standard clause with full details.
 *
 * For regulations: Returns full text, title, and reference
 * For standards: Returns guidance only (full text requires paid license)
 *
 * Optionally includes cross-framework mappings to related requirements.
 *
 * @param db - SQLite database connection
 * @param input - Source ID and reference to retrieve
 * @returns Requirement details with text/guidance and optional mappings
 * @throws Error if source or reference is not found
 */
export function getRequirement(db: InstanceType<typeof Database>, input: GetRequirementInput): GetRequirementOutput {
  const { source: rawSource, reference, include_mappings = false } = input;

  // Guard against missing required parameters to prevent TypeError on .toLowerCase()
  if (!rawSource) {
    throw new Error('Missing required parameter: source. Use list_sources to see available source IDs.');
  }
  if (!reference) {
    throw new Error('Missing required parameter: reference. Use list_sources or search_requirements to find valid references.');
  }

  const source = rawSource.toLowerCase();

  try {
    // First, determine if source is a regulation or standard
    const isRegulation = db.prepare('SELECT 1 FROM regulations WHERE id = ?').get(source);
    const isStandard = db.prepare('SELECT 1 FROM standards WHERE id = ?').get(source);

    if (!isRegulation && !isStandard) {
      throw new Error(`Source not found: ${source}`);
    }

    let result: GetRequirementOutput;

    if (isRegulation) {
      // Query regulation_content table
      const row = db.prepare(`
        SELECT
          regulation,
          reference,
          title,
          text
        FROM regulation_content
        WHERE regulation = ? AND reference = ?
      `).get(source, reference) as {
        regulation: string;
        reference: string;
        title: string | null;
        text: string;
      } | undefined;

      if (!row) {
        throw new Error(`Reference not found: ${reference} in source ${source}`);
      }

      result = {
        source: row.regulation,
        reference: row.reference,
        title: row.title,
        text: row.text,
        guidance: ''
      };
    } else {
      // Query standard_clauses table
      const row = db.prepare(`
        SELECT
          standard,
          clause_id,
          title,
          guidance,
          normative_text,
          reference_tables,
          work_products
        FROM standard_clauses
        WHERE standard = ? AND clause_id = ?
      `).get(source, reference) as {
        standard: string;
        clause_id: string;
        title: string;
        guidance: string;
        normative_text: string | null;
        reference_tables: string | null;
        work_products: string | null;
      } | undefined;

      if (!row) {
        throw new Error(`Reference not found: ${reference} in source ${source}`);
      }

      // Parse work_products JSON if present
      let workProducts: string[] | undefined = undefined;
      if (row.work_products) {
        try {
          const parsed = JSON.parse(row.work_products);
          if (Array.isArray(parsed) && parsed.length > 0) {
            workProducts = parsed;
          }
        } catch (e) {
          // Invalid JSON, leave undefined
        }
      }

      // Parse reference_tables JSON if present
      let referenceTables: Record<string, unknown>[] | undefined = undefined;
      if (row.reference_tables) {
        try {
          const parsed = JSON.parse(row.reference_tables);
          if (Array.isArray(parsed)) referenceTables = parsed;
        } catch { /* Invalid JSON, leave undefined */ }
      }

      result = {
        source: row.standard,
        reference: row.clause_id,
        title: row.title,
        text: row.normative_text ?? null,
        guidance: row.guidance,
        ...(workProducts && { work_products: workProducts }),
        ...(referenceTables && { reference_tables: referenceTables }),
      };
    }

    // Include mappings if requested
    if (include_mappings) {
      const sourceType = isRegulation ? 'regulation' : 'standard';

      // Forward mappings (this source → other targets)
      const forwardMappings = db.prepare(`
        SELECT
          target_type,
          target_id,
          target_ref,
          relationship
        FROM framework_mappings
        WHERE source_type = ? AND source_id = ? AND source_ref = ?
      `).all(sourceType, source, reference) as Array<{
        target_type: string;
        target_id: string;
        target_ref: string;
        relationship: string;
      }>;

      if (forwardMappings.length > 0) {
        result.maps_to = forwardMappings.map((m): MappingReference => ({
          target_type: m.target_type,
          target_id: m.target_id,
          target_ref: m.target_ref,
          relationship: m.relationship
        }));
      }

      // Reverse mappings (other sources → this target)
      // This shows which standards/clauses satisfy this regulation requirement
      const reverseMappings = db.prepare(`
        SELECT
          source_type,
          source_id,
          source_ref,
          relationship
        FROM framework_mappings
        WHERE target_type = ? AND target_id = ? AND target_ref = ?
      `).all(sourceType, source, reference) as Array<{
        source_type: string;
        source_id: string;
        source_ref: string;
        relationship: string;
      }>;

      if (reverseMappings.length > 0) {
        result.satisfied_by = reverseMappings.map((m): MappingReference => ({
          target_type: m.source_type,
          target_id: m.source_id,
          target_ref: m.source_ref,
          relationship: m.relationship
        }));
      }
    }

    return result;
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof Error) {
      throw error;
    }
    // Wrap unexpected errors
    throw new Error(`Failed to retrieve requirement: ${String(error)}`);
  }
}
