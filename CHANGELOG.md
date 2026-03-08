# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-03-08

### Added
- 5 new market regulations: GB/T 40857, GB/T 40856, KMVSS 18-3, AIS-189, MLIT Guidelines
- R155/R156 paragraph-level breakdown (342 content items, up from 33)
- 20 architecture reference patterns with FTS5 search
- 90 automotive attack patterns across 9 target components
- 12 complete TARA worked examples
- 47 CSMS operational obligations across 5 lifecycle phases
- 2,000+ cross-framework mappings (up from 483)
- 6 new tools: get_architecture_pattern, search_attack_patterns, generate_tara, map_compliance_path, get_csms_obligations, compare_markets
- Full integration test suite

### Changed
- All standard guidance rewritten to 300-800 words (was 50-100 words)
- export_compliance_matrix now supports all 7 regulations
- search_requirements now searches architecture patterns, attack patterns, and CSMS obligations
- ISO 21434, ISO 14229, AUTOSAR, TISAX, ISO 26262, ISO 24089, GB/T 40857 guidance expanded to implementation depth

## [1.0.2] - 2026-02-17

### Added
- `sources.yml` data provenance documentation for all data sources
- Golden contract tests (`fixtures/golden-tests.json`) with 15 data accuracy tests
- Drift detection hashes (`fixtures/golden-hashes.json`) for seed data integrity
- `db_metadata` table in SQLite schema (schema_version, built_at, server_version)
- `about` tool listed in `server.json` and `manifest.json` (was implemented but undocumented)
- Security scanning: Semgrep SAST, Trivy vulnerability scan, Socket supply chain, OSSF Scorecard
- Database connectivity check in health endpoints (returns 503 when DB unavailable)
- Version field in Vercel health endpoint response

### Fixed
- Hardcoded version strings in `api/mcp.ts` now read dynamically from `package.json`
- Division by zero in `export_compliance_matrix` markdown generator when total requirements is 0
- `__dirname` undefined in `tests/r155-r156-completeness.test.ts` (ESM without `fileURLToPath`)
- `better-sqlite3` now explicitly declared in `devDependencies` for build script and tests
- Dockerfile removed stale `npm rebuild better-sqlite3` (runtime uses `@ansvar/mcp-sqlite` WASM)
- `vercel.json` `includeFiles` glob now matches both npm and pnpm `node_modules` layouts

### Changed
- Health endpoints return structured `{status, server, version, database}` response
- CI security audit job now fails on high/critical vulnerabilities (removed `continue-on-error`)

## [1.0.1] - 2026-02-01

### Added
- `list_work_products` tool for ISO 21434 work products by clause or lifecycle phase
- `export_compliance_matrix` tool for R155/R156-to-ISO-21434 traceability (Markdown + CSV)
- `about` tool for server metadata, dataset statistics, fingerprint, and provenance
- Work products table with 40+ ISO 21434 deliverables
- Cross-framework mapping table (R155 to ISO 21434)
- Streamable HTTP transport for Docker deployment
- Vercel serverless deployment support
- Docker support with health check
- npm provenance publishing
- Dependabot configuration

### Changed
- Migrated SQLite runtime from `better-sqlite3` to `@ansvar/mcp-sqlite` (WASM, Vercel-compatible)

## [0.1.0] - 2026-01-29

### Added
- Complete UNECE R155 regulation content (12 articles + 5 annexes)
  - Article 7: Full 22KB CSMS specifications
  - Annex 5: Comprehensive 148KB threat catalog
  - All official annexes (communication forms, approval marks, certificates)
- Complete UNECE R156 regulation content (12 articles + 4 annexes)
  - Article 7: SUMS requirements
  - All official annexes
- SQLite database with FTS5 full-text search (620KB)
- Three MCP tools: `list_sources`, `get_requirement`, `search_requirements`
- Comprehensive test suite (91 tests, 100% pass rate)
- TypeScript with strict type checking
- Complete documentation:
  - README.md with quick start
  - QUICK_START.md for 5-minute setup
  - docs/USAGE_GUIDE.md with role-specific scenarios
  - R155_R156_INTEGRATION_SUMMARY.md with technical details
- CI/CD pipeline with:
  - Multi-platform testing (Ubuntu, macOS, Windows)
  - Multi-version Node.js support (18, 20, 22)
  - Gitleaks secret scanning
  - CodeQL security analysis
  - Automated npm publishing

### Changed
- Database structure: Hierarchical (43 items) → Flat (33 items) with complete text
- Content source: Manual summaries → Official UNECE text via EU Compliance MCP
- Database size: 152KB → 620KB (4x increase)
- Content size: ~50KB → 294KB (6x increase)

### Attribution
- R155/R156 content sourced from [EU Compliance MCP](https://github.com/Ansvar-Systems/EU_compliance_MCP)
- License: Apache 2.0 (compatible)
- Data: Official UNECE regulations from EUR-Lex

### Technical
- Node.js: 18+ required
- Database: SQLite 3 with FTS5
- Query performance: <1ms average
- Package size: ~650KB (includes 620KB database)

## [0.0.1] - 2026-01-28 (Initial Development)

### Added
- Initial MCP server structure
- Sample R155 content (hierarchical structure)
- ISO 21434 Clause 9.3 guidance
- Basic testing framework

[Unreleased]: https://github.com/Ansvar-Systems/Automotive-MCP/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Ansvar-Systems/Automotive-MCP/compare/v1.0.2...v2.0.0
[1.0.2]: https://github.com/Ansvar-Systems/Automotive-MCP/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Ansvar-Systems/Automotive-MCP/compare/v0.1.0...v1.0.1
[0.1.0]: https://github.com/Ansvar-Systems/Automotive-MCP/releases/tag/v0.1.0
[0.0.1]: https://github.com/Ansvar-Systems/Automotive-MCP/releases/tag/v0.0.1
