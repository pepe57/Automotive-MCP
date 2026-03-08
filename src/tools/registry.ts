/**
 * Shared tool registry for the Automotive MCP server.
 * Single source of truth for tool definitions and handlers.
 *
 * Pattern: Based on EU Compliance MCP architecture
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type Database from '@ansvar/mcp-sqlite';
import {
  CallToolRequest,
  CallToolResult,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { listSources } from './list.js';
import { getRequirement } from './get.js';
import { searchRequirements } from './search.js';
import { listWorkProducts } from './workproducts.js';
import { exportComplianceMatrix } from './export.js';
import { getArchitecturePattern } from './architecture.js';
import { searchAttackPatterns } from './attacks.js';
import { generateTara } from './tara-generator.js';
import { mapCompliancePath } from './compliance-path.js';
import { getCsmsObligations } from './csms.js';
import { compareMarkets } from './markets.js';
import { getAbout, type AboutContext } from './about.js';
import type { ListSourcesInput, GetRequirementInput, SearchRequirementsInput, ListWorkProductsInput, ExportComplianceMatrixInput, GetArchitecturePatternInput, SearchAttackPatternsInput, GenerateTaraInput, MapCompliancePathInput, GetCsmsObligationsInput, CompareMarketsInput } from '../types/index.js';

/**
 * Tool definition with name, description, input schema, and handler function
 */
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations?: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
  };
  handler: (db: InstanceType<typeof Database>, args: unknown) => unknown;
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
} as const;

function toTitle(name: string): string {
  return name
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function annotateTools(tools: ToolDefinition[]): ToolDefinition[] {
  return tools.map((tool) => ({
    ...tool,
    annotations: tool.annotations ?? {
      title: toTitle(tool.name),
      readOnlyHint: READ_ONLY_ANNOTATIONS.readOnlyHint,
      destructiveHint: READ_ONLY_ANNOTATIONS.destructiveHint,
    },
  }));
}

/**
 * Registry of all available tools
 */
const TOOLS: ToolDefinition[] = [
  {
    name: 'list_sources',
    description:
      'List available automotive regulations and standards. Call this first to discover available sources before using other tools. Returns metadata including version, type (regulation/standard), item counts, and whether full text is available. Returns an empty array if no sources match the filter. Do NOT use this to retrieve requirement content — use get_requirement instead.',
    inputSchema: {
      type: 'object',
      properties: {
        source_type: {
          type: 'string',
          enum: ['regulation', 'standard', 'all'],
          default: 'all',
          description:
            'Filter by source type. "regulation" returns UNECE regulations, "standard" returns curated standards metadata and guidance, "all" returns both. Default: "all".',
        },
      },
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as ListSourcesInput;
      return listSources(db, input);
    },
  },
  {
    name: 'get_requirement',
    description:
      'Retrieve a specific regulation article or standard clause. For regulations (UNECE R155/R156), returns full text. For standards, returns curated guidance and work products where available — full text is NOT included (requires licensed copies). Returns an error if the source or reference is not found. Use this for individual lookups; for bulk audit documentation, use export_compliance_matrix instead.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description:
            'Source ID (e.g., "r155", "r156", "iso_21434"). Use list_sources to see available sources.',
        },
        reference: {
          type: 'string',
          description:
            'Reference identifier within the source (e.g., "7.2.2.2" for regulation article, "9.3" for standard clause).',
        },
        include_mappings: {
          type: 'boolean',
          default: false,
          description:
            'Include cross-framework mappings to related requirements in other regulations/standards. Default: false.',
        },
      },
      required: ['source', 'reference'],
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as GetRequirementInput;
      return getRequirement(db, input);
    },
  },
  {
    name: 'search_requirements',
    description:
      'Full-text search across all regulations and standards using FTS5 with BM25 ranking. Search regulations (UNECE R155/R156 full text) and standards guidance metadata. Returns results sorted by relevance with highlighted snippets. Returns an empty array for no matches (not an error). Empty or whitespace-only queries return empty results. Maximum 100 results per query. Use this for keyword/topic discovery; use get_requirement for retrieving a known specific item.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query text. Can be a single word, phrase, or multiple terms. FTS5 will tokenize and rank results by relevance.',
        },
        sources: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'Optional: Filter to specific sources (e.g., ["r155", "iso_21434"]). Omit to search all sources.',
        },
        limit: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 100,
          description:
            'Maximum number of results to return. Default: 10, minimum: 1, maximum: 100. Results are ranked by BM25 relevance score.',
        },
      },
      required: ['query'],
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as SearchRequirementsInput;
      return searchRequirements(db, input);
    },
  },
  {
    name: 'list_work_products',
    description:
      'List ISO 21434 work products (deliverables) required for cybersecurity engineering. Shows which artifacts to produce for each clause, whether CAL-dependent, and which R155 requirements they help satisfy. Returns all work products if no filters are specified. Phase filter maps to ISO 21434 clause groups (e.g., "tara" maps to clause 15). Do NOT use this for regulation text — use get_requirement or search_requirements instead.',
    inputSchema: {
      type: 'object',
      properties: {
        clause_id: {
          type: 'string',
          description:
            'Filter to a specific ISO 21434 clause (e.g., "15" for TARA, "6" for cybersecurity case). Omit for all clauses.',
        },
        phase: {
          type: 'string',
          enum: ['organizational', 'project', 'continual', 'concept', 'development', 'validation', 'production', 'operations', 'decommissioning', 'tara'],
          description:
            'Filter by lifecycle phase. Options: organizational, project, continual, concept, development, validation, production, operations, decommissioning, tara.',
        },
      },
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as ListWorkProductsInput;
      return listWorkProducts(db, input);
    },
  },
  {
    name: 'export_compliance_matrix',
    description:
      'Generate a compliance traceability matrix showing regulation requirements mapped to ISO 21434 clauses and work products. Export as Markdown table or CSV for spreadsheet import. Produces large output — use for audit documentation, gap analysis, and compliance tracking. Do NOT use for individual requirement lookups; use get_requirement for single items instead.',
    inputSchema: {
      type: 'object',
      properties: {
        regulation: {
          type: 'string',
          enum: ['r155', 'r156', 'gbt_40857', 'gbt_40856', 'kmvss_18_3', 'ais_189', 'mlit_guidelines'],
          default: 'r155',
          description:
            'Regulation to generate matrix for. Supports UNECE (r155, r156), China (gbt_40857, gbt_40856), Korea (kmvss_18_3), India (ais_189), and Japan (mlit_guidelines). Default: "r155".',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'csv'],
          default: 'markdown',
          description:
            'Output format. "markdown" for documentation, "csv" for spreadsheet import. Default: "markdown".',
        },
        include_guidance: {
          type: 'boolean',
          default: false,
          description:
            'Include ISO 21434 guidance summaries in output. Default: false.',
        },
      },
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as ExportComplianceMatrixInput;
      return exportComplianceMatrix(db, input);
    },
  },
  {
    name: 'get_architecture_pattern',
    description:
      'Retrieve architecture reference patterns for automotive cybersecurity. Get a specific pattern by ID (e.g., \'split-trust-diagnostic-pki\') for full implementation guidance, or browse by domain (e.g., \'diagnostics\', \'software-update\', \'network-architecture\'). Each pattern includes components, trust boundaries, applicable standards, and threat mitigations.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern_id: {
          type: 'string',
          description:
            'Specific pattern ID to retrieve with full details (e.g., "split-trust-diagnostic-pki", "ota-chain-of-trust"). Omit to browse.',
        },
        domain: {
          type: 'string',
          description:
            'Filter patterns by domain (e.g., "diagnostics", "software-update", "network-architecture", "platform-security"). Omit to list all domains.',
        },
      },
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as GetArchitecturePatternInput;
      return getArchitecturePattern(db, input);
    },
  },
  {
    name: 'search_attack_patterns',
    description:
      'Search automotive-specific attack patterns by keyword, target component, or STRIDE category. Returns attack descriptions, feasibility ratings per ISO 21434 Annex G, known mitigations, and cross-references to R155 Annex 5 threats.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query text for full-text search across attack pattern names, descriptions, and attack vectors. Optional if target_component or stride_category is provided.',
        },
        target_component: {
          type: 'string',
          description:
            'Filter by target component (e.g., "ECU", "Telematics", "Gateway", "OTA", "CAN_Ethernet", "V2X", "Diagnostics", "Sensors", "Access_Control").',
        },
        stride_category: {
          type: 'string',
          description:
            'Filter by STRIDE category (e.g., "S" for Spoofing, "T" for Tampering, "R" for Repudiation, "I" for Information Disclosure, "D" for Denial of Service, "E" for Elevation of Privilege, or combinations like "ST", "IE").',
        },
        limit: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 50,
          description:
            'Maximum number of results to return. Default: 10, maximum: 50.',
        },
      },
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as SearchAttackPatternsInput;
      return searchAttackPatterns(db, input);
    },
  },
  {
    name: 'generate_tara',
    description:
      'Generate a structured TARA (Threat Analysis and Risk Assessment) template for a vehicle system. Provide a system description and optionally a system type hint. Returns assets, threat scenarios (matched from the attack pattern library), damage scenarios, risk ratings, and cybersecurity goals. The output is a starting template — not a finished TARA.',
    inputSchema: {
      type: 'object',
      properties: {
        system_description: {
          type: 'string',
          description:
            'Description of the vehicle system to generate a TARA for. Include key components, interfaces, and connectivity (e.g., "Telematics control unit with 4G modem and CAN bus interface").',
        },
        system_type: {
          type: 'string',
          description:
            'Optional system type hint. If this matches a known TARA example suffix (e.g., "tcu", "gateway", "ota-client"), the worked example is used as a base template.',
        },
        include_examples: {
          type: 'boolean',
          default: true,
          description:
            'Include matching worked examples from the TARA example library. Default: true.',
        },
      },
      required: ['system_description'],
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as GenerateTaraInput;
      return generateTara(db, input);
    },
  },
  {
    name: 'map_compliance_path',
    description:
      'Trace a regulation requirement through to implementation. Given a regulation and optionally a specific paragraph, returns the full compliance path: regulation requirement → ISO 21434 clause → work products → AUTOSAR/UDS implementation → architecture patterns. Use for audit preparation, gap analysis, or understanding what implementing a specific requirement actually involves.',
    inputSchema: {
      type: 'object',
      properties: {
        regulation: {
          type: 'string',
          description:
            'Regulation ID (e.g., "r155", "r156"). Use list_sources to see available regulations.',
        },
        requirement_ref: {
          type: 'string',
          description:
            'Specific requirement reference (e.g., "7.2.2.2(g)"). Omit to return paths for all paragraphs in the regulation, grouped by article.',
        },
        depth: {
          type: 'string',
          enum: ['summary', 'full'],
          default: 'summary',
          description:
            'Level of detail. "summary" returns one line per mapping node. "full" includes guidance text at each node. Default: "summary".',
        },
      },
      required: ['regulation'],
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as MapCompliancePathInput;
      return mapCompliancePath(db, input);
    },
  },
  {
    name: 'get_csms_obligations',
    description:
      'Retrieve CSMS (Cybersecurity Management System) operational obligations by lifecycle phase. Shows what an OEM must do during development, production, operations, decommissioning, and supplier management — with reporting timelines, evidence requirements, and practical guidance.',
    inputSchema: {
      type: 'object',
      properties: {
        lifecycle_phase: {
          type: 'string',
          description:
            'Filter to a specific lifecycle phase (e.g., "development", "production", "operations", "decommissioning", "supplier_management"). Omit to return all phases.',
        },
        regulation: {
          type: 'string',
          description:
            'Filter to obligations from a specific source regulation (e.g., "r155"). Omit to return obligations from all regulations.',
        },
        query: {
          type: 'string',
          description:
            'Full-text search across obligation text and guidance. FTS5 with BM25 ranking.',
        },
      },
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as GetCsmsObligationsInput;
      return getCsmsObligations(db, input);
    },
  },
  {
    name: 'compare_markets',
    description:
      'Compare automotive cybersecurity requirements across markets. Provide 2+ market regulation IDs (e.g., \'r155\', \'gbt_40857\', \'kmvss_18_3\') and optionally filter by topic. Returns common requirements, market-specific obligations, and cross-market equivalences.',
    inputSchema: {
      type: 'object',
      properties: {
        markets: {
          type: 'array',
          items: {
            type: 'string',
          },
          minItems: 2,
          description:
            'Array of market regulation IDs to compare (minimum 2). Use list_sources to see available regulation IDs (e.g., "r155", "gbt_40857", "kmvss_18_3", "ais_189", "mlit_guidelines").',
        },
        topic: {
          type: 'string',
          description:
            'Optional topic filter. Uses FTS5 to find requirements related to the topic across all specified markets (e.g., "software update", "intrusion detection", "risk assessment").',
        },
      },
      required: ['markets'],
    },
    handler: (db: InstanceType<typeof Database>, args: unknown) => {
      const input = args as CompareMarketsInput;
      return compareMarkets(db, input);
    },
  },
];

function createAboutTool(context: AboutContext): ToolDefinition {
  return {
    name: 'about',
    description:
      'Server metadata, dataset statistics, freshness, and provenance. No input parameters needed. ' +
      'Call this to verify data coverage, currency, and content basis before relying on results.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: (db) => {
      return getAbout(db, context);
    },
  };
}

export function buildTools(context: AboutContext): ToolDefinition[] {
  return [...TOOLS, createAboutTool(context)];
}

/**
 * Register all tool handlers with the MCP server.
 *
 * @param server - MCP server instance
 * @param db - SQLite database connection
 * @param context - Optional about context for metadata tool
 */
export function registerTools(server: Server, db: InstanceType<typeof Database>, context?: AboutContext): void {
  const allTools = annotateTools(context ? buildTools(context) : TOOLS);
  // Register ListToolsRequest handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    })),
  }));

  // Register CallToolRequest handler
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    // Find tool by name
    const tool = allTools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    }

    try {
      // Execute tool handler
      const result = tool.handler(db, args ?? {});

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });
}
