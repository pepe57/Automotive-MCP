/**
 * Type definitions for Automotive Cybersecurity MCP
 */

// ============================================================================
// Type Aliases for Known Values
// ============================================================================

export type RegulationType = 'unece' | 'eu_implementing' | 'national';
export type ContentType = 'article' | 'annex' | 'paragraph';
export type LifecyclePhase = 'concept' | 'development' | 'production' | 'operations' | 'decommissioning';
export type RiskRating = 'Low' | 'Medium' | 'High' | 'Very High';
export type RiskTreatment = 'Avoid' | 'Reduce' | 'Share' | 'Retain';
export type SecurityProperty = 'Confidentiality' | 'Integrity' | 'Availability' | 'Authenticity';
export type CALLevel = 'CAL-1' | 'CAL-2' | 'CAL-3' | 'CAL-4';
export type MappingRelationship = 'satisfies' | 'partial' | 'related';

// ============================================================================
// Parsed JSON Structure Types
// ============================================================================

/** Attack feasibility rating per ISO 21434 Table 10 */
export interface AttackFeasibility {
  elapsed_time: string;
  expertise: string;
  knowledge: string;
  equipment: string;
  access: string;
}

// ============================================================================
// Database Record Types
// ============================================================================

export interface Regulation {
  id: string;
  full_name: string;
  title: string;
  version: string | null;
  effective_date: string | null;
  source_url: string | null;
  applies_to: string[];  // Changed from string (parsed JSON array)
  regulation_type: RegulationType;  // Changed from string
}

export interface RegulationContent {
  rowid: number;
  regulation: string;
  content_type: ContentType;  // Use the alias
  reference: string;
  title: string | null;
  text: string;
  parent_reference: string | null;
}

export interface Standard {
  id: string;
  full_name: string;
  title: string;
  version: string | null;
  note: string | null;
}

export interface StandardClause {
  id: number;
  standard: string;
  clause_id: string;
  title: string;
  guidance: string;
  work_products: string[] | null;  // Changed from string (parsed JSON array)
  cal_relevant: boolean;  // Changed from number
}

export interface WorkProduct {
  id: string;
  name: string;
  phase: LifecyclePhase;  // Changed from string
  iso_clause: string;
  description: string;
  contents: string[];  // Changed from string (parsed JSON array)
  template_available: boolean;  // Changed from number
}

// ============================================================================
// TARA Types (Planned — DB tables exist but are not yet populated or exposed)
// ============================================================================

export interface ThreatScenario {
  id: string;
  category: string;
  asset_type: string;
  threat: string;
  attack_path: string | null;
  stride: string;
  attack_feasibility: AttackFeasibility;  // Changed from string (parsed JSON object)
  risk_rating: RiskRating;  // Changed from string
  treatment: RiskTreatment;  // Changed from string
}

export interface DamageScenario {
  id: string;
  description: string;
  impact_category: string;
  severity: string;
  impact_rating: string;
}

export interface CybersecurityGoal {
  id: string;
  description: string;
  property: SecurityProperty;  // Changed from string
  cal: CALLevel;  // Changed from string
  controls: string[];  // Changed from string (parsed JSON array)
}

export interface FrameworkMapping {
  id: number;
  source_type: string;
  source_id: string;
  source_ref: string;
  target_type: string;
  target_id: string;
  target_ref: string;
  relationship: MappingRelationship;  // Use the alias
  notes: string | null;
}

// ============================================================================
// Tool Input Types
// ============================================================================

export interface GetRequirementInput {
  source: string;
  reference: string;
  include_mappings?: boolean;
}

export interface SearchRequirementsInput {
  query: string;
  sources?: string[];
  limit?: number;
}

export interface ListSourcesInput {
  source_type?: 'regulation' | 'standard' | 'all';
}

export interface GetArchitecturePatternInput {
  pattern_id?: string;
  domain?: string;
}

/** @planned TARA guidance input — not yet implemented */
export interface GetTaraGuidanceInput {
  asset_type?: string;
  threat_category?: string;
  phase?: string;
}

/** @planned Standards mapping input — not yet implemented */
export interface MapStandardsInput {
  source: string;
  source_reference?: string;
  target: string;
}

export interface GetWorkProductsInput {
  phase?: string;
  iso_clause?: string;
}

export interface ListWorkProductsInput {
  clause_id?: string;
  phase?: string;
}

export interface WorkProductItem {
  id: string | null;
  name: string;
  clause_id: string;
  clause_title: string;
  cal_relevant: boolean;
  r155_refs: string[];
}

export interface ListWorkProductsOutput {
  work_products: WorkProductItem[];
  summary: {
    total_work_products: number;
    clauses_covered: number;
    cal_relevant_count: number;
  };
  phases: string[];
}

export interface ExportComplianceMatrixInput {
  regulation?: string;
  format?: 'markdown' | 'csv';
  include_guidance?: boolean;
}

export interface ExportComplianceMatrixOutput {
  format: string;
  content: string;
  statistics: {
    total_requirements: number;
    mapped_requirements: number;
    coverage_percent: number;
    unique_work_products: number;
  };
}

export interface SearchAttackPatternsInput {
  query?: string;
  target_component?: string;
  stride_category?: string;
  limit?: number;
}

export interface GenerateTaraInput {
  system_description: string;
  system_type?: string;
  include_examples?: boolean;
}

export interface GetTypeApprovalChecklistInput {
  regulation: string;
  vehicle_category?: string;
}

export interface MapCompliancePathInput {
  regulation: string;
  requirement_ref?: string;
  depth?: 'summary' | 'full';
}

export interface GetCsmsObligationsInput {
  lifecycle_phase?: string;
  regulation?: string;
  query?: string;
}

export interface CompareMarketsInput {
  markets: string[];
  topic?: string;
}

// ============================================================================
// Tool Output Types
// ============================================================================

export interface GetRequirementOutput {
  source: string;
  reference: string;
  title: string | null;
  text: string | null; // null for paid standards
  guidance: string;
  maps_to?: MappingReference[];        // Forward: this requirement → other frameworks
  satisfied_by?: MappingReference[];   // Reverse: other frameworks → this requirement
  work_products?: string[];
}

export interface MappingReference {
  target_type: string;
  target_id: string;
  target_ref: string;
  relationship: string;
}

export interface SearchResult {
  source: string;
  reference: string;
  title: string | null;
  snippet: string;
  relevance: number;
  content_type?: string;  // "regulation", "standard", "architecture_pattern", "attack_pattern", "csms_obligation"
}

export interface SourceInfo {
  id: string;
  name: string;
  version: string | null;
  type: string;
  description: string;
  item_count: number;
  full_text_available: boolean;
}

export interface TaraGuidanceOutput {
  asset_type?: string;
  phase?: string;
  threat_scenarios: ThreatScenario[];
  damage_scenarios: DamageScenario[];
  cybersecurity_goals: CybersecurityGoal[];
  attack_feasibility_method: string;
}

export interface MappingOutput {
  source: string;
  target: string;
  mappings: {
    source_ref: string;
    source_title: string;
    target_refs: string[];
    relationship: string;
    notes?: string;
  }[];
}

export interface WorkProductOutput {
  phase?: string;
  work_products: WorkProduct[];
}

export interface ChecklistItem {
  reference: string;
  requirement: string;
  evidence_needed: string[];
  common_gaps: string[];
  guidance: string;
}

export interface TypeApprovalChecklistOutput {
  regulation: string;
  vehicle_category?: string;
  requirements: ChecklistItem[];
  documentation_needed: string[];
  audit_expectations: string[];
}
