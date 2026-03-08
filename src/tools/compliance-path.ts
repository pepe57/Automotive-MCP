import type Database from '@ansvar/mcp-sqlite';
import type { MapCompliancePathInput } from '../types/index.js';

/**
 * A single node in a compliance path chain.
 */
interface PathNode {
  type: 'regulation' | 'standard' | 'work_product' | 'architecture_pattern';
  id: string;
  ref: string;
  title: string;
  relationship?: string;
  guidance?: string;
  work_products?: string[];
  children: PathNode[];
}

/**
 * One requirement's full compliance path.
 */
interface RequirementPath {
  regulation: string;
  reference: string;
  title: string | null;
  text_snippet: string | null;
  paths: PathNode[];
}

/**
 * Output grouped by article when no requirement_ref is given.
 */
interface ArticleGroup {
  article: string;
  article_title: string | null;
  requirements: RequirementPath[];
}

type MapCompliancePathOutput =
  | { regulation: string; requirement: RequirementPath; depth: string }
  | { regulation: string; articles: ArticleGroup[]; total_requirements: number; depth: string };

/**
 * Trace a regulation requirement through to implementation.
 *
 * Walks the framework_mappings table in both directions, following chains
 * up to 3 hops deep:
 *   regulation requirement -> ISO/standard clause -> implementation standard/work products -> architecture patterns
 *
 * @param db - SQLite database connection
 * @param input - Regulation, optional requirement_ref, optional depth
 * @returns Full compliance path(s)
 */
export function mapCompliancePath(
  db: InstanceType<typeof Database>,
  input: MapCompliancePathInput,
): MapCompliancePathOutput {
  const { regulation: rawRegulation, requirement_ref, depth = 'summary' } = input;

  if (!rawRegulation) {
    throw new Error('Missing required parameter: regulation. Use list_sources to see available regulation IDs.');
  }

  const regulation = rawRegulation.toLowerCase();

  // Verify regulation exists
  const regRow = db.prepare('SELECT id, full_name FROM regulations WHERE id = ?').get(regulation) as
    | { id: string; full_name: string }
    | undefined;

  if (!regRow) {
    const available = db.prepare('SELECT id FROM regulations').all() as Array<{ id: string }>;
    throw new Error(
      `Regulation not found: ${regulation}. Available regulations: ${available.map((r) => r.id).join(', ')}`,
    );
  }

  const includeFull = depth === 'full';

  if (requirement_ref) {
    // Single requirement mode
    const reqPath = buildRequirementPath(db, regulation, requirement_ref, includeFull);
    if (!reqPath) {
      throw new Error(
        `Requirement not found: ${requirement_ref} in ${regulation}. Use search_requirements to find valid references.`,
      );
    }
    return { regulation, requirement: reqPath, depth };
  }

  // Full regulation mode: collect all distinct target_refs from framework_mappings
  // for this regulation, then build paths for each one grouped by article.
  const mappedRefs = db
    .prepare(
      `SELECT DISTINCT target_ref
       FROM framework_mappings
       WHERE target_type = 'regulation' AND target_id = ?
       ORDER BY target_ref`,
    )
    .all(regulation) as Array<{ target_ref: string }>;

  // Group references by article
  const articleMap = new Map<string, { title: string | null; refs: string[] }>();

  for (const { target_ref } of mappedRefs) {
    const articleRef = extractArticleRef(target_ref);
    if (!articleMap.has(articleRef)) {
      const article = db
        .prepare(
          `SELECT title FROM regulation_content
           WHERE regulation = ? AND reference = ? AND content_type = 'article'`,
        )
        .get(regulation, articleRef) as { title: string | null } | undefined;
      articleMap.set(articleRef, { title: article?.title || null, refs: [] });
    }
    articleMap.get(articleRef)!.refs.push(target_ref);
  }

  const articles: ArticleGroup[] = [];

  for (const [articleRef, group] of articleMap) {
    const requirements: RequirementPath[] = [];

    for (const ref of group.refs) {
      const path = buildRequirementPath(db, regulation, ref, includeFull);
      if (path && path.paths.length > 0) {
        requirements.push(path);
      }
    }

    if (requirements.length > 0) {
      articles.push({
        article: articleRef,
        article_title: group.title,
        requirements,
      });
    }
  }

  return {
    regulation,
    articles,
    total_requirements: articles.reduce((sum, a) => sum + a.requirements.length, 0),
    depth,
  };
}

/**
 * Extract the top-level article reference from a paragraph reference.
 * "7.2.2.2(g)" -> "7", "5.3.1" -> "5"
 */
function extractArticleRef(ref: string): string {
  const dotIndex = ref.indexOf('.');
  if (dotIndex === -1) {
    // Could be "7" or "7(a)" -- strip parenthetical
    const parenIndex = ref.indexOf('(');
    return parenIndex === -1 ? ref : ref.substring(0, parenIndex);
  }
  return ref.substring(0, dotIndex);
}

/**
 * Build the full compliance path for a single requirement.
 *
 * Framework mappings may reference sub-paragraph items like "7.2.2.2(g)" that
 * don't have their own row in regulation_content (the text lives in the parent
 * paragraph "7.2.2.2"). This function handles both cases: exact match and
 * parent-paragraph fallback.
 */
function buildRequirementPath(
  db: InstanceType<typeof Database>,
  regulation: string,
  reference: string,
  includeFull: boolean,
): RequirementPath | null {
  // Get requirement text -- try exact match first
  let req = db
    .prepare(
      `SELECT reference, title, text
       FROM regulation_content
       WHERE regulation = ? AND reference = ?`,
    )
    .get(regulation, reference) as { reference: string; title: string | null; text: string } | undefined;

  // If not found, try stripping parenthetical sub-item (e.g., "7.2.2.2(g)" -> "7.2.2.2")
  const parentRef = reference.replace(/\([^)]+\)$/, '');
  if (!req && parentRef !== reference) {
    req = db
      .prepare(
        `SELECT reference, title, text
         FROM regulation_content
         WHERE regulation = ? AND reference = ?`,
      )
      .get(regulation, parentRef) as { reference: string; title: string | null; text: string } | undefined;
  }

  // Also check if this ref exists in framework_mappings even without regulation_content
  const hasMappings = db
    .prepare(
      `SELECT 1 FROM framework_mappings
       WHERE target_type = 'regulation' AND target_id = ? AND target_ref = ?
       LIMIT 1`,
    )
    .get(regulation, reference);

  if (!req && !hasMappings) {
    return null;
  }

  // Find standards that satisfy this requirement (hop 1: regulation <- standard)
  const hop1Mappings = db
    .prepare(
      `SELECT source_type, source_id, source_ref, relationship, notes
       FROM framework_mappings
       WHERE target_type = 'regulation'
         AND target_id = ?
         AND target_ref = ?`,
    )
    .all(regulation, reference) as Array<{
    source_type: string;
    source_id: string;
    source_ref: string;
    relationship: string;
    notes: string | null;
  }>;

  const paths: PathNode[] = [];

  for (const mapping of hop1Mappings) {
    const node = buildStandardNode(db, mapping, includeFull, 1);
    if (node) {
      paths.push(node);
    }
  }

  return {
    regulation,
    reference,
    title: req?.title || null,
    text_snippet: req ? (includeFull ? req.text : truncate(req.text, 120)) : null,
    paths,
  };
}

/**
 * Build a PathNode for a standard clause, including child hops.
 */
function buildStandardNode(
  db: InstanceType<typeof Database>,
  mapping: {
    source_type: string;
    source_id: string;
    source_ref: string;
    relationship: string;
    notes: string | null;
  },
  includeFull: boolean,
  currentHop: number,
): PathNode | null {
  // Look up the standard clause details
  const clause = db
    .prepare(
      `SELECT clause_id, title, guidance, work_products
       FROM standard_clauses
       WHERE standard = ? AND clause_id = ?`,
    )
    .get(mapping.source_id, mapping.source_ref) as
    | { clause_id: string; title: string; guidance: string; work_products: string | null }
    | undefined;

  const title = clause?.title || mapping.notes || `${mapping.source_id} ${mapping.source_ref}`;

  // Parse work products from standard clause
  let workProducts: string[] | undefined;
  if (clause?.work_products) {
    try {
      const parsed = JSON.parse(clause.work_products) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        workProducts = parsed;
      }
    } catch {
      // Skip malformed JSON
    }
  }

  const children: PathNode[] = [];

  // Add work product child nodes
  if (workProducts) {
    for (const wp of workProducts) {
      children.push({
        type: 'work_product',
        id: extractWorkProductId(wp),
        ref: extractWorkProductId(wp),
        title: wp,
        children: [],
      });
    }
  }

  // Hop 2+: find further mappings from this standard clause to other standards
  if (currentHop < 3) {
    const hop2Mappings = db
      .prepare(
        `SELECT target_type, target_id, target_ref, relationship, notes
         FROM framework_mappings
         WHERE source_type = 'standard'
           AND source_id = ?
           AND source_ref = ?
           AND target_type = 'standard'`,
      )
      .all(mapping.source_id, mapping.source_ref) as Array<{
      target_type: string;
      target_id: string;
      target_ref: string;
      relationship: string;
      notes: string | null;
    }>;

    for (const hop2 of hop2Mappings) {
      const childNode = buildStandardNode(
        db,
        {
          source_type: hop2.target_type,
          source_id: hop2.target_id,
          source_ref: hop2.target_ref,
          relationship: hop2.relationship,
          notes: hop2.notes,
        },
        includeFull,
        currentHop + 1,
      );
      if (childNode) {
        children.push(childNode);
      }
    }

    // Find architecture patterns that reference this standard
    const patterns = findArchitecturePatterns(db, mapping.source_id);
    for (const pattern of patterns) {
      children.push({
        type: 'architecture_pattern',
        id: pattern.id,
        ref: pattern.id,
        title: pattern.name,
        guidance: includeFull ? pattern.description : undefined,
        children: [],
      });
    }
  }

  return {
    type: 'standard',
    id: mapping.source_id,
    ref: mapping.source_ref,
    title,
    relationship: mapping.relationship,
    guidance: includeFull && clause?.guidance ? clause.guidance : undefined,
    work_products: workProducts,
    children,
  };
}

/**
 * Find architecture patterns whose applicable_standards include the given standard ID.
 */
function findArchitecturePatterns(
  db: InstanceType<typeof Database>,
  standardId: string,
): Array<{ id: string; name: string; description: string }> {
  // applicable_standards is a JSON array stored as text
  return db
    .prepare(
      `SELECT id, name, description
       FROM architecture_patterns
       WHERE applicable_standards LIKE ?`,
    )
    .all(`%${standardId}%`) as Array<{ id: string; name: string; description: string }>;
}

/**
 * Extract work product ID from a formatted string like "[WP-08-01] Cybersecurity monitoring report".
 */
function extractWorkProductId(wp: string): string {
  const match = wp.match(/^\[([^\]]+)\]/);
  return match ? match[1] : wp;
}

/**
 * Truncate text to a maximum length, appending "..." if truncated.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}
