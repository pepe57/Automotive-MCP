import type Database from '@ansvar/mcp-sqlite';
import type { GenerateTaraInput } from '../types/index.js';
import { sanitizeQuery } from './search.js';

/**
 * STRIDE category to security property mapping per ISO 21434.
 */
const STRIDE_TO_PROPERTY: Record<string, string> = {
  S: 'Authenticity',
  T: 'Integrity',
  R: 'Non-repudiation',
  I: 'Confidentiality',
  D: 'Availability',
  E: 'Integrity',
};

/**
 * Database row shape for attack_patterns table.
 */
interface AttackPatternRow {
  id: string;
  name: string;
  target_component: string;
  attack_vector: string;
  stride_category: string;
  feasibility: string;
  impact: string;
  known_mitigations: string;
  r155_annex5_refs: string | null;
  description: string;
  prerequisites: string | null;
  detection_methods: string | null;
}

/**
 * Database row shape for tara_examples table.
 */
interface TaraExampleRow {
  id: string;
  system_name: string;
  item_definition: string;
  assets: string;
  threat_scenarios: string;
  damage_scenarios: string;
  risk_determinations: string;
  cybersecurity_goals: string;
  applicable_standards: string;
}

interface ThreatScenarioOutput {
  id: string;
  threat: string;
  stride: string;
  attack_vector: string;
  feasibility: Record<string, string>;
  impact: string;
  mitigations: string[];
  r155_refs: string[];
}

interface CybersecurityGoalOutput {
  property: string;
  description: string;
  derived_from: string[];
}

interface TaraTemplateOutput {
  item_definition: string;
  assets: string[];
  threat_scenarios: ThreatScenarioOutput[];
  damage_scenarios: Array<{
    threat_id: string;
    impact: string;
  }>;
  risk_determinations: Array<{
    threat_id: string;
    feasibility: string;
    impact: string;
    risk_level: string;
  }>;
  cybersecurity_goals: CybersecurityGoalOutput[];
  worked_examples?: TaraExampleParsed[];
  disclaimer: string;
}

interface TaraExampleParsed {
  id: string;
  system_name: string;
  item_definition: string;
  assets: unknown[];
  threat_scenarios: unknown[];
  damage_scenarios: unknown[];
  risk_determinations: unknown[];
  cybersecurity_goals: unknown[];
  applicable_standards: string[];
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Derive a simple feasibility label from the ISO 21434 Annex G factors.
 */
function deriveFeasibilityLabel(feasibility: Record<string, string>): string {
  const timeRank: Record<string, number> = {
    hours: 4,
    days: 3,
    weeks: 2,
    months: 1,
  };
  const expertiseRank: Record<string, number> = {
    layman: 4,
    proficient: 3,
    expert: 2,
    multiple_experts: 1,
  };
  const equipmentRank: Record<string, number> = {
    standard: 4,
    specialized: 3,
    bespoke_equipment: 2,
    multiple_bespoke: 1,
  };

  const t = timeRank[feasibility.elapsed_time] ?? 2;
  const e = expertiseRank[feasibility.expertise] ?? 2;
  const eq = equipmentRank[feasibility.equipment] ?? 2;
  const avg = (t + e + eq) / 3;

  if (avg >= 3.5) return 'High';
  if (avg >= 2.5) return 'Medium';
  if (avg >= 1.5) return 'Low';
  return 'Very Low';
}

/**
 * Derive a risk level from feasibility and impact strings.
 */
function deriveRiskLevel(feasibility: string, impact: string): string {
  const fRank: Record<string, number> = {
    High: 3,
    Medium: 2,
    Low: 1,
    'Very Low': 0,
  };
  const iRank: Record<string, number> = {
    critical: 4,
    major: 3,
    moderate: 2,
    minor: 1,
    negligible: 0,
  };

  const f = fRank[feasibility] ?? 2;
  const i = iRank[impact.toLowerCase()] ?? 2;
  const score = f + i;

  if (score >= 6) return 'Very High';
  if (score >= 4) return 'High';
  if (score >= 2) return 'Medium';
  return 'Low';
}

/**
 * Categorize impact severity from a free-text impact string.
 */
function categorizeImpact(impact: string): string {
  const lower = impact.toLowerCase();
  if (
    lower.includes('safety') ||
    lower.includes('life') ||
    lower.includes('crash') ||
    lower.includes('injur')
  ) {
    return 'critical';
  }
  if (
    lower.includes('control') ||
    lower.includes('compromise') ||
    lower.includes('full access') ||
    lower.includes('fleet')
  ) {
    return 'major';
  }
  if (
    lower.includes('data') ||
    lower.includes('privacy') ||
    lower.includes('track')
  ) {
    return 'moderate';
  }
  return 'moderate';
}

/**
 * Parse a tara_examples row into the output format.
 */
function parseExample(row: TaraExampleRow): TaraExampleParsed {
  return {
    id: row.id,
    system_name: row.system_name,
    item_definition: row.item_definition,
    assets: parseJson<unknown[]>(row.assets, []),
    threat_scenarios: parseJson<unknown[]>(row.threat_scenarios, []),
    damage_scenarios: parseJson<unknown[]>(row.damage_scenarios, []),
    risk_determinations: parseJson<unknown[]>(row.risk_determinations, []),
    cybersecurity_goals: parseJson<unknown[]>(row.cybersecurity_goals, []),
    applicable_standards: parseJson<string[]>(row.applicable_standards, []),
  };
}

const DISCLAIMER =
  'This is a generated template based on pattern matching against the attack pattern library. ' +
  'A complete TARA per ISO 21434 clause 15 requires expert analysis of your specific system architecture, ' +
  'asset identification, and organizational risk acceptance criteria.';

/**
 * Generate a structured TARA template for a vehicle system.
 *
 * Steps:
 * 1. If system_type matches a tara_examples.id suffix, use that as the base template
 * 2. FTS5 search attack_patterns using tokenized terms from system_description
 * 3. For each matching attack pattern, pull its mitigations
 * 4. Derive cybersecurity goals from STRIDE categories
 * 5. Return structured output
 *
 * @param db - SQLite database connection
 * @param input - System description, optional type hint, examples flag
 * @returns Structured TARA template
 */
export function generateTara(
  db: InstanceType<typeof Database>,
  input: GenerateTaraInput,
): TaraTemplateOutput {
  const { system_description, system_type, include_examples = true } = input;

  if (!system_description || system_description.trim() === '') {
    throw new Error('system_description is required and must not be empty.');
  }

  // Step 1: Check if system_type matches a tara_examples ID suffix
  let baseExample: TaraExampleRow | undefined;
  if (system_type && system_type.trim() !== '') {
    const candidateId = `tara-${system_type.trim().toLowerCase()}`;
    const row = db
      .prepare('SELECT * FROM tara_examples WHERE id = ?')
      .get(candidateId) as TaraExampleRow | undefined;
    if (row) {
      baseExample = row;
    }
  }

  // Step 2: FTS5 search attack_patterns using system_description
  const sanitized = sanitizeQuery(system_description);
  let attackRows: AttackPatternRow[] = [];

  try {
    const sql = `
      SELECT ap.*
      FROM attack_patterns_fts
      JOIN attack_patterns ap ON ap.rowid = attack_patterns_fts.rowid
      WHERE attack_patterns_fts MATCH ?
      ORDER BY bm25(attack_patterns_fts)
      LIMIT 20
    `;
    attackRows = db.prepare(sql).all(sanitized) as AttackPatternRow[];
  } catch (error) {
    // FTS5 query syntax errors: fall back to empty results
    if (!(error instanceof Error && error.message.includes('fts5'))) {
      throw new Error(
        `Attack pattern search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Step 3: Build threat scenarios from matched attack patterns
  const threatScenarios: ThreatScenarioOutput[] = attackRows.map(
    (row, idx) => {
      const feasibility = parseJson<Record<string, string>>(
        row.feasibility,
        {},
      );
      const mitigations = parseJson<string[]>(row.known_mitigations, []);
      const r155Refs = parseJson<string[]>(row.r155_annex5_refs, []);

      return {
        id: `TS-GEN-${String(idx + 1).padStart(2, '0')}`,
        threat: row.name,
        stride: row.stride_category,
        attack_vector: row.attack_vector,
        feasibility,
        impact: row.impact,
        mitigations,
        r155_refs: r155Refs,
      };
    },
  );

  // Step 4: Derive damage scenarios and risk determinations
  const damageScenarios = threatScenarios.map((ts) => ({
    threat_id: ts.id,
    impact: ts.impact,
  }));

  const riskDeterminations = threatScenarios.map((ts) => {
    const feasLabel = deriveFeasibilityLabel(ts.feasibility);
    const impactLabel = categorizeImpact(ts.impact);
    return {
      threat_id: ts.id,
      feasibility: feasLabel,
      impact: impactLabel,
      risk_level: deriveRiskLevel(feasLabel, impactLabel),
    };
  });

  // Step 5: Derive cybersecurity goals from STRIDE categories
  const goalMap = new Map<string, Set<string>>();
  for (const ts of threatScenarios) {
    const categories = ts.stride.split(/[,/]/);
    for (const cat of categories) {
      const trimmed = cat.trim();
      const property = STRIDE_TO_PROPERTY[trimmed];
      if (property) {
        if (!goalMap.has(property)) {
          goalMap.set(property, new Set());
        }
        goalMap.get(property)!.add(ts.id);
      }
    }
  }

  const cybersecurityGoals: CybersecurityGoalOutput[] = [];
  for (const [property, threatIds] of goalMap) {
    cybersecurityGoals.push({
      property,
      description: `Ensure ${property.toLowerCase()} of the system against identified threats`,
      derived_from: Array.from(threatIds),
    });
  }

  // Build item_definition from base example or system_description
  const itemDefinition = baseExample
    ? baseExample.item_definition
    : system_description;

  // Build assets from base example or derive from attack target components
  let assets: string[];
  if (baseExample) {
    assets = parseJson<string[]>(baseExample.assets, []);
  } else {
    const uniqueComponents = new Set(attackRows.map((r) => r.target_component));
    assets = Array.from(uniqueComponents).map(
      (c) => `${c} and associated interfaces`,
    );
    if (assets.length === 0) {
      assets = ['System components (requires identification)'];
    }
  }

  // Step 6: Optionally include worked examples
  let workedExamples: TaraExampleParsed[] | undefined;
  if (include_examples) {
    const examples: TaraExampleRow[] = [];

    // Include the base example if found
    if (baseExample) {
      examples.push(baseExample);
    }

    // Also search for related examples based on system_description
    try {
      const exampleSql = `
        SELECT te.*
        FROM tara_examples te
        WHERE te.system_name LIKE ?
        OR te.item_definition LIKE ?
        LIMIT 3
      `;
      const searchTerm = `%${system_description.split(/\s+/).slice(0, 3).join('%')}%`;
      const found = db
        .prepare(exampleSql)
        .all(searchTerm, searchTerm) as TaraExampleRow[];
      for (const f of found) {
        if (!examples.some((e) => e.id === f.id)) {
          examples.push(f);
        }
      }
    } catch {
      // Non-critical: if LIKE search fails, we still have the base example
    }

    if (examples.length > 0) {
      workedExamples = examples.map(parseExample);
    }
  }

  const result: TaraTemplateOutput = {
    item_definition: itemDefinition,
    assets,
    threat_scenarios: threatScenarios,
    damage_scenarios: damageScenarios,
    risk_determinations: riskDeterminations,
    cybersecurity_goals: cybersecurityGoals,
    disclaimer: DISCLAIMER,
  };

  if (workedExamples && workedExamples.length > 0) {
    result.worked_examples = workedExamples;
  }

  return result;
}
