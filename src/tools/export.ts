import type Database from '@ansvar/mcp-sqlite';
import type { ExportComplianceMatrixInput, ExportComplianceMatrixOutput } from '../types/index.js';

/**
 * Generate a compliance matrix showing requirements with their ISO 21434 mappings.
 *
 * Useful for:
 * - Type approval documentation
 * - Gap analysis
 * - Audit preparation
 * - Compliance tracking spreadsheets
 *
 * @param db - SQLite database connection
 * @param input - Export configuration
 * @returns Compliance matrix in requested format
 */
export function exportComplianceMatrix(
  db: InstanceType<typeof Database>,
  input: ExportComplianceMatrixInput
): ExportComplianceMatrixOutput {
  const { regulation = 'r155', format = 'markdown', include_guidance = false } = input;

  const validFormats = ['markdown', 'csv'];
  if (format && !validFormats.includes(format)) {
    throw new Error(`Invalid format: ${format}. Valid formats: ${validFormats.join(', ')}`);
  }
  const validRegulations = ['r155', 'r156', 'gbt_40857', 'gbt_40856', 'kmvss_18_3', 'ais_189', 'mlit_guidelines'];
  if (regulation && !validRegulations.includes(regulation)) {
    throw new Error(`Invalid regulation: ${regulation}. Valid regulations: ${validRegulations.join(', ')}`);
  }

  // Get all regulation articles
  const articles = db.prepare(`
    SELECT
      reference,
      title,
      text
    FROM regulation_content
    WHERE regulation = ?
      AND content_type = 'article'
    ORDER BY
      CAST(reference AS INTEGER),
      reference
  `).all(regulation) as Array<{
    reference: string;
    title: string | null;
    text: string;
  }>;

  // Build matrix rows
  const rows: Array<{
    requirement_ref: string;
    requirement_title: string;
    iso_clauses: string[];
    work_products: string[];
    guidance_summary: string;
  }> = [];

  for (const article of articles) {
    // Find ISO 21434 clauses that satisfy this requirement
    // Match exact ref OR refs that start with "article." (e.g., "7" matches "7.2.2.2(a)")
    const mappings = db.prepare(`
      SELECT DISTINCT
        fm.source_ref as clause_id,
        sc.title as clause_title,
        sc.guidance,
        sc.work_products
      FROM framework_mappings fm
      JOIN standard_clauses sc
        ON sc.standard = fm.source_id
        AND sc.clause_id = fm.source_ref
      WHERE fm.target_type = 'regulation'
        AND fm.source_type = 'standard'
        AND fm.source_id = 'iso_21434'
        AND fm.target_id = ?
        AND (fm.target_ref = ? OR fm.target_ref LIKE ? || '.%' OR fm.target_ref LIKE ? || '(%')
    `).all(regulation, article.reference, article.reference, article.reference) as Array<{
      clause_id: string;
      clause_title: string;
      guidance: string;
      work_products: string | null;
    }>;

    // Collect unique ISO clauses and work products
    const isoClauses: string[] = [];
    const workProducts: Set<string> = new Set();
    let guidanceSummary = '';

    for (const mapping of mappings) {
      isoClauses.push(`${mapping.clause_id}: ${mapping.clause_title}`);

      if (mapping.work_products) {
        try {
          const wps = JSON.parse(mapping.work_products) as string[];
          wps.forEach(wp => workProducts.add(wp));
        } catch { /* ignore */ }
      }

      if (include_guidance && mapping.guidance) {
        // Take first sentence as summary
        const firstSentence = mapping.guidance.split('.')[0];
        if (firstSentence && !guidanceSummary) {
          guidanceSummary = firstSentence + '.';
        }
      }
    }

    rows.push({
      requirement_ref: `${regulation.toUpperCase()} ${article.reference}`,
      requirement_title: article.title || '',
      iso_clauses: isoClauses,
      work_products: [...workProducts],
      guidance_summary: guidanceSummary
    });
  }

  // Generate output in requested format
  let content: string;

  if (format === 'csv') {
    content = generateCSV(rows, include_guidance);
  } else {
    content = generateMarkdown(rows, regulation, include_guidance);
  }

  // Calculate coverage stats
  const totalRequirements = rows.length;
  const mappedRequirements = rows.filter(r => r.iso_clauses.length > 0).length;
  const coveragePercent = totalRequirements > 0
    ? Math.round((mappedRequirements / totalRequirements) * 100)
    : 0;

  return {
    format,
    content,
    statistics: {
      total_requirements: totalRequirements,
      mapped_requirements: mappedRequirements,
      coverage_percent: coveragePercent,
      unique_work_products: new Set(rows.flatMap(r => r.work_products)).size
    }
  };
}

function generateCSV(
  rows: Array<{
    requirement_ref: string;
    requirement_title: string;
    iso_clauses: string[];
    work_products: string[];
    guidance_summary: string;
  }>,
  includeGuidance: boolean
): string {
  const headers = [
    'Requirement',
    'Title',
    'ISO 21434 Clauses',
    'Work Products',
    'Status'
  ];

  if (includeGuidance) {
    headers.push('Guidance Summary');
  }

  const lines: string[] = [headers.join(',')];

  for (const row of rows) {
    const cells = [
      `"${row.requirement_ref}"`,
      `"${row.requirement_title.replace(/"/g, '""')}"`,
      `"${row.iso_clauses.join('; ')}"`,
      `"${row.work_products.join('; ')}"`,
      row.iso_clauses.length > 0 ? 'Mapped' : 'Not Mapped'
    ];

    if (includeGuidance) {
      cells.push(`"${row.guidance_summary.replace(/"/g, '""')}"`);
    }

    lines.push(cells.join(','));
  }

  return lines.join('\n');
}

function generateMarkdown(
  rows: Array<{
    requirement_ref: string;
    requirement_title: string;
    iso_clauses: string[];
    work_products: string[];
    guidance_summary: string;
  }>,
  regulation: string,
  includeGuidance: boolean
): string {
  const lines: string[] = [
    `# ${regulation.toUpperCase()} Compliance Matrix`,
    '',
    `Generated: ${new Date().toISOString().split('T')[0]}`,
    '',
    '## Requirements Traceability',
    ''
  ];

  // Table header
  if (includeGuidance) {
    lines.push('| Requirement | Title | ISO 21434 Clauses | Work Products | Guidance |');
    lines.push('|-------------|-------|-------------------|---------------|----------|');
  } else {
    lines.push('| Requirement | Title | ISO 21434 Clauses | Work Products |');
    lines.push('|-------------|-------|-------------------|---------------|');
  }

  for (const row of rows) {
    const isoCell = row.iso_clauses.length > 0
      ? row.iso_clauses.map(c => c.split(':')[0]).join(', ')
      : '—';
    const wpCell = row.work_products.length > 0
      ? row.work_products.slice(0, 3).map(wp => {
          const match = wp.match(/^\[([^\]]+)\]/);
          return match ? match[1] : wp;
        }).join(', ') + (row.work_products.length > 3 ? '...' : '')
      : '—';

    if (includeGuidance) {
      const guidanceCell = row.guidance_summary
        ? row.guidance_summary.substring(0, 50) + (row.guidance_summary.length > 50 ? '...' : '')
        : '—';
      lines.push(`| ${row.requirement_ref} | ${row.requirement_title} | ${isoCell} | ${wpCell} | ${guidanceCell} |`);
    } else {
      lines.push(`| ${row.requirement_ref} | ${row.requirement_title} | ${isoCell} | ${wpCell} |`);
    }
  }

  // Summary section
  const mapped = rows.filter(r => r.iso_clauses.length > 0).length;
  const total = rows.length;

  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Requirements:** ${total}`);
  lines.push(`- **Mapped to ISO 21434:** ${mapped} (${total > 0 ? Math.round(mapped/total*100) : 0}%)`);
  lines.push(`- **Unmapped:** ${total - mapped}`);

  return lines.join('\n');
}
