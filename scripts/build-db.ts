#!/usr/bin/env tsx

/**
 * Build the automotive.db SQLite database from seed JSON files.
 * Run with: npm run build:db
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const SEED_DIR = join(DATA_DIR, 'seed');
const DB_PATH = join(DATA_DIR, 'automotive.db');

const SCHEMA = `
-- ============================================================================
-- Core Regulations
-- ============================================================================

CREATE TABLE IF NOT EXISTS regulations (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL,
  version TEXT,
  effective_date TEXT,
  source_url TEXT,
  applies_to TEXT,
  regulation_type TEXT
);

CREATE TABLE IF NOT EXISTS regulation_content (
  rowid INTEGER PRIMARY KEY,
  regulation TEXT NOT NULL REFERENCES regulations(id),
  content_type TEXT NOT NULL CHECK(content_type IN ('article', 'annex', 'paragraph')),
  reference TEXT NOT NULL,
  title TEXT,
  text TEXT NOT NULL,
  parent_reference TEXT,
  UNIQUE(regulation, content_type, reference)
);

-- FTS5 for regulation content search
CREATE VIRTUAL TABLE IF NOT EXISTS regulation_content_fts USING fts5(
  regulation,
  reference,
  title,
  text,
  content='regulation_content',
  content_rowid='rowid'
);

-- FTS5 triggers for regulation_content
CREATE TRIGGER IF NOT EXISTS regulation_content_ai AFTER INSERT ON regulation_content BEGIN
  INSERT INTO regulation_content_fts(rowid, regulation, reference, title, text)
  VALUES (new.rowid, new.regulation, new.reference, new.title, new.text);
END;

CREATE TRIGGER IF NOT EXISTS regulation_content_ad AFTER DELETE ON regulation_content BEGIN
  INSERT INTO regulation_content_fts(regulation_content_fts, rowid, regulation, reference, title, text)
  VALUES('delete', old.rowid, old.regulation, old.reference, old.title, old.text);
END;

CREATE TRIGGER IF NOT EXISTS regulation_content_au AFTER UPDATE ON regulation_content BEGIN
  INSERT INTO regulation_content_fts(regulation_content_fts, rowid, regulation, reference, title, text)
  VALUES('delete', old.rowid, old.regulation, old.reference, old.title, old.text);
  INSERT INTO regulation_content_fts(rowid, regulation, reference, title, text)
  VALUES (new.rowid, new.regulation, new.reference, new.title, new.text);
END;

-- ============================================================================
-- Standards (Reference Only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS standards (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL,
  version TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS standard_clauses (
  id INTEGER PRIMARY KEY,
  standard TEXT NOT NULL REFERENCES standards(id),
  clause_id TEXT NOT NULL,
  title TEXT NOT NULL,
  guidance TEXT NOT NULL,
  work_products TEXT,
  cal_relevant INTEGER DEFAULT 0,
  UNIQUE(standard, clause_id)
);

-- FTS5 for standard guidance search
CREATE VIRTUAL TABLE IF NOT EXISTS standard_clauses_fts USING fts5(
  standard,
  clause_id,
  title,
  guidance,
  content='standard_clauses',
  content_rowid='id'
);

-- FTS5 triggers for standard_clauses
CREATE TRIGGER IF NOT EXISTS standard_clauses_ai AFTER INSERT ON standard_clauses BEGIN
  INSERT INTO standard_clauses_fts(rowid, standard, clause_id, title, guidance)
  VALUES (new.id, new.standard, new.clause_id, new.title, new.guidance);
END;

CREATE TRIGGER IF NOT EXISTS standard_clauses_ad AFTER DELETE ON standard_clauses BEGIN
  INSERT INTO standard_clauses_fts(standard_clauses_fts, rowid, standard, clause_id, title, guidance)
  VALUES('delete', old.id, old.standard, old.clause_id, old.title, old.guidance);
END;

CREATE TRIGGER IF NOT EXISTS standard_clauses_au AFTER UPDATE ON standard_clauses BEGIN
  INSERT INTO standard_clauses_fts(standard_clauses_fts, rowid, standard, clause_id, title, guidance)
  VALUES('delete', old.id, old.standard, old.clause_id, old.title, old.guidance);
  INSERT INTO standard_clauses_fts(rowid, standard, clause_id, title, guidance)
  VALUES (new.id, new.standard, new.clause_id, new.title, new.guidance);
END;

CREATE TABLE IF NOT EXISTS work_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phase TEXT NOT NULL,
  iso_clause TEXT NOT NULL,
  description TEXT NOT NULL,
  contents TEXT NOT NULL,
  template_available INTEGER DEFAULT 0
);

-- ============================================================================
-- TARA Methodology
-- ============================================================================

CREATE TABLE IF NOT EXISTS threat_scenarios (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  threat TEXT NOT NULL,
  attack_path TEXT,
  stride TEXT,
  attack_feasibility TEXT NOT NULL,
  risk_rating TEXT NOT NULL,
  treatment TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS damage_scenarios (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  impact_category TEXT NOT NULL,
  severity TEXT NOT NULL,
  impact_rating TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cybersecurity_goals (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  property TEXT NOT NULL,
  cal TEXT NOT NULL,
  controls TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threat_damage_links (
  threat_id TEXT REFERENCES threat_scenarios(id),
  damage_id TEXT REFERENCES damage_scenarios(id),
  PRIMARY KEY (threat_id, damage_id)
);

CREATE TABLE IF NOT EXISTS threat_goal_links (
  threat_id TEXT REFERENCES threat_scenarios(id),
  goal_id TEXT REFERENCES cybersecurity_goals(id),
  PRIMARY KEY (threat_id, goal_id)
);

-- Add indexes for bidirectional lookups
CREATE INDEX IF NOT EXISTS idx_damage_threat ON threat_damage_links(damage_id, threat_id);
CREATE INDEX IF NOT EXISTS idx_goal_threat ON threat_goal_links(goal_id, threat_id);

-- ============================================================================
-- Cross-Framework Mappings
-- ============================================================================

CREATE TABLE IF NOT EXISTS framework_mappings (
  id INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK(relationship IN ('satisfies', 'partial', 'related')),
  notes TEXT,
  UNIQUE(source_type, source_id, source_ref, target_type, target_id, target_ref)
);

CREATE INDEX IF NOT EXISTS idx_mappings_source ON framework_mappings(source_type, source_id, source_ref);
CREATE INDEX IF NOT EXISTS idx_mappings_target ON framework_mappings(target_type, target_id, target_ref);

-- ============================================================================
-- Database Metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================================
-- Architecture Reference Patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS architecture_patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT NOT NULL,
  components TEXT NOT NULL,          -- JSON array of component names
  trust_boundaries TEXT NOT NULL,    -- JSON array of trust boundary descriptions
  applicable_standards TEXT NOT NULL, -- JSON array of standard IDs
  threat_mitigations TEXT NOT NULL,  -- JSON array of {threat, mitigation} objects
  guidance TEXT NOT NULL,
  diagram_ascii TEXT                 -- Optional ASCII diagram
);

CREATE VIRTUAL TABLE IF NOT EXISTS architecture_patterns_fts USING fts5(
  id, name, domain, description, components, guidance,
  content='architecture_patterns',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS architecture_patterns_ai AFTER INSERT ON architecture_patterns BEGIN
  INSERT INTO architecture_patterns_fts(rowid, id, name, domain, description, components, guidance)
  VALUES (new.rowid, new.id, new.name, new.domain, new.description, new.components, new.guidance);
END;

CREATE TRIGGER IF NOT EXISTS architecture_patterns_ad AFTER DELETE ON architecture_patterns BEGIN
  INSERT INTO architecture_patterns_fts(architecture_patterns_fts, rowid, id, name, domain, description, components, guidance)
  VALUES('delete', old.rowid, old.id, old.name, old.domain, old.description, old.components, old.guidance);
END;

CREATE TRIGGER IF NOT EXISTS architecture_patterns_au AFTER UPDATE ON architecture_patterns BEGIN
  INSERT INTO architecture_patterns_fts(architecture_patterns_fts, rowid, id, name, domain, description, components, guidance)
  VALUES('delete', old.rowid, old.id, old.name, old.domain, old.description, old.components, old.guidance);
  INSERT INTO architecture_patterns_fts(rowid, id, name, domain, description, components, guidance)
  VALUES (new.rowid, new.id, new.name, new.domain, new.description, new.components, new.guidance);
END;

-- ============================================================================
-- Attack Pattern Library
-- ============================================================================

CREATE TABLE IF NOT EXISTS attack_patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_component TEXT NOT NULL,
  attack_vector TEXT NOT NULL,
  stride_category TEXT NOT NULL,     -- S, T, R, I, D, E or combinations
  feasibility TEXT NOT NULL,         -- JSON per ISO 21434 Annex G
  impact TEXT NOT NULL,
  known_mitigations TEXT NOT NULL,   -- JSON array
  r155_annex5_refs TEXT,             -- JSON array of Annex 5 threat IDs
  description TEXT NOT NULL,
  prerequisites TEXT,                -- JSON array of required conditions
  detection_methods TEXT             -- JSON array
);

CREATE VIRTUAL TABLE IF NOT EXISTS attack_patterns_fts USING fts5(
  id, name, target_component, attack_vector, description,
  content='attack_patterns',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS attack_patterns_ai AFTER INSERT ON attack_patterns BEGIN
  INSERT INTO attack_patterns_fts(rowid, id, name, target_component, attack_vector, description)
  VALUES (new.rowid, new.id, new.name, new.target_component, new.attack_vector, new.description);
END;

CREATE TRIGGER IF NOT EXISTS attack_patterns_ad AFTER DELETE ON attack_patterns BEGIN
  INSERT INTO attack_patterns_fts(attack_patterns_fts, rowid, id, name, target_component, attack_vector, description)
  VALUES('delete', old.rowid, old.id, old.name, old.target_component, old.attack_vector, old.description);
END;

CREATE TRIGGER IF NOT EXISTS attack_patterns_au AFTER UPDATE ON attack_patterns BEGIN
  INSERT INTO attack_patterns_fts(attack_patterns_fts, rowid, id, name, target_component, attack_vector, description)
  VALUES('delete', old.rowid, old.id, old.name, old.target_component, old.attack_vector, old.description);
  INSERT INTO attack_patterns_fts(rowid, id, name, target_component, attack_vector, description)
  VALUES (new.rowid, new.id, new.name, new.target_component, new.attack_vector, new.description);
END;

-- ============================================================================
-- TARA Worked Examples
-- ============================================================================

CREATE TABLE IF NOT EXISTS tara_examples (
  id TEXT PRIMARY KEY,
  system_name TEXT NOT NULL,
  item_definition TEXT NOT NULL,
  assets TEXT NOT NULL,              -- JSON array
  threat_scenarios TEXT NOT NULL,    -- JSON array
  damage_scenarios TEXT NOT NULL,    -- JSON array
  risk_determinations TEXT NOT NULL, -- JSON array
  cybersecurity_goals TEXT NOT NULL, -- JSON array
  applicable_standards TEXT NOT NULL -- JSON array of standard IDs
);

-- ============================================================================
-- CSMS Operational Obligations
-- ============================================================================

CREATE TABLE IF NOT EXISTS csms_obligations (
  id TEXT PRIMARY KEY,
  lifecycle_phase TEXT NOT NULL,
  obligation TEXT NOT NULL,
  source_regulation TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  reporting_timeline TEXT,
  evidence_required TEXT NOT NULL,   -- JSON array
  guidance TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS csms_obligations_fts USING fts5(
  id, lifecycle_phase, obligation, guidance,
  content='csms_obligations',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS csms_obligations_ai AFTER INSERT ON csms_obligations BEGIN
  INSERT INTO csms_obligations_fts(rowid, id, lifecycle_phase, obligation, guidance)
  VALUES (new.rowid, new.id, new.lifecycle_phase, new.obligation, new.guidance);
END;

CREATE TRIGGER IF NOT EXISTS csms_obligations_ad AFTER DELETE ON csms_obligations BEGIN
  INSERT INTO csms_obligations_fts(csms_obligations_fts, rowid, id, lifecycle_phase, obligation, guidance)
  VALUES('delete', old.rowid, old.id, old.lifecycle_phase, old.obligation, old.guidance);
END;

CREATE TRIGGER IF NOT EXISTS csms_obligations_au AFTER UPDATE ON csms_obligations BEGIN
  INSERT INTO csms_obligations_fts(csms_obligations_fts, rowid, id, lifecycle_phase, obligation, guidance)
  VALUES('delete', old.rowid, old.id, old.lifecycle_phase, old.obligation, old.guidance);
  INSERT INTO csms_obligations_fts(rowid, id, lifecycle_phase, obligation, guidance)
  VALUES (new.rowid, new.id, new.lifecycle_phase, new.obligation, new.guidance);
END;
`;

/**
 * Load regulations and regulation content from seed JSON file
 */
function loadRegulations(db: Database.Database): void {
  const seedPath = join(SEED_DIR, 'regulations.json');

  if (!existsSync(seedPath)) {
    console.log('⚠ No regulations.json found, skipping...');
    return;
  }

  const data = JSON.parse(readFileSync(seedPath, 'utf-8'));

  // Prepare statements
  const insertReg = db.prepare(`
    INSERT INTO regulations (id, full_name, title, version, effective_date, source_url, applies_to, regulation_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertContent = db.prepare(`
    INSERT INTO regulation_content (regulation, content_type, reference, title, text, parent_reference)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Load in transaction
  const loadAll = db.transaction(() => {
    let regCount = 0;
    let contentCount = 0;

    // Insert regulations
    if (data.regulations) {
      for (const reg of data.regulations) {
        insertReg.run(
          reg.id,
          reg.full_name,
          reg.title,
          reg.version || null,
          reg.effective_date || null,
          reg.source_url || null,
          reg.applies_to ? JSON.stringify(reg.applies_to) : null,
          reg.regulation_type
        );
        regCount++;
      }
    }

    // Insert content
    if (data.content) {
      for (const item of data.content) {
        insertContent.run(
          item.regulation,
          item.content_type,
          item.reference,
          item.title || null,
          item.text,
          item.parent_reference || null
        );
        contentCount++;
      }
    }

    return { regCount, contentCount };
  });

  const result = loadAll();
  console.log(`✓ Loaded ${result.regCount} regulations`);
  console.log(`✓ Loaded ${result.contentCount} content items`);
}

/**
 * Load standards and clauses from seed JSON file
 */
function loadStandards(db: Database.Database): void {
  const seedPath = join(SEED_DIR, 'standards.json');

  if (!existsSync(seedPath)) {
    console.log('⚠ No standards.json found, skipping...');
    return;
  }

  const data = JSON.parse(readFileSync(seedPath, 'utf-8'));

  // Prepare statements
  const insertStd = db.prepare(`
    INSERT INTO standards (id, full_name, title, version, note)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertClause = db.prepare(`
    INSERT INTO standard_clauses (standard, clause_id, title, guidance, work_products, cal_relevant)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMapping = db.prepare(`
    INSERT OR IGNORE INTO framework_mappings (source_type, source_id, source_ref, target_type, target_id, target_ref, relationship, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Load in transaction
  const loadAll = db.transaction(() => {
    let stdCount = 0;
    let clauseCount = 0;
    let mappingCount = 0;

    // Insert standards
    if (data.standards) {
      for (const std of data.standards) {
        insertStd.run(
          std.id,
          std.full_name,
          std.title,
          std.version || null,
          std.note || null
        );
        stdCount++;
      }
    }

    // Insert clauses and their R155 mappings
    if (data.clauses) {
      for (const clause of data.clauses) {
        insertClause.run(
          clause.standard,
          clause.clause_id,
          clause.title,
          clause.guidance,
          clause.work_products ? JSON.stringify(clause.work_products) : null,
          clause.cal_relevant || 0
        );
        clauseCount++;

        // Insert R155 mappings if present
        if (clause.r155_mapping && Array.isArray(clause.r155_mapping)) {
          for (const r155Ref of clause.r155_mapping) {
            const info = insertMapping.run(
              'standard',           // source_type
              clause.standard,      // source_id (e.g., 'iso_21434')
              clause.clause_id,     // source_ref (e.g., '15')
              'regulation',         // target_type
              'r155',               // target_id
              r155Ref,              // target_ref (e.g., '7.2.2.2(a)')
              'satisfies',          // relationship
              null                  // notes
            );
            mappingCount += Number(info.changes || 0);
          }
        }

        // Insert generalized mappings for any target framework (regulations or standards)
        if (clause.mappings && Array.isArray(clause.mappings)) {
          for (const mapping of clause.mappings) {
            if (!mapping || typeof mapping !== 'object') {
              continue;
            }

            const targetType = mapping.target_type;
            const targetId = mapping.target_id;
            const targetRef = mapping.target_ref;
            const relationship = mapping.relationship || 'related';

            if (!targetType || !targetId || !targetRef) {
              continue;
            }

            if (!['regulation', 'standard'].includes(targetType)) {
              continue;
            }

            if (!['satisfies', 'partial', 'related'].includes(relationship)) {
              continue;
            }

            const info = insertMapping.run(
              'standard',
              clause.standard,
              clause.clause_id,
              targetType,
              targetId,
              targetRef,
              relationship,
              mapping.notes || null
            );
            mappingCount += Number(info.changes || 0);
          }
        }
      }
    }

    return { stdCount, clauseCount, mappingCount };
  });

  const result = loadAll();
  console.log(`✓ Loaded ${result.stdCount} standards`);
  console.log(`✓ Loaded ${result.clauseCount} clauses`);
  console.log(`✓ Loaded ${result.mappingCount} cross-framework mappings`);
}

/**
 * Load architecture reference patterns from seed JSON file
 */
function loadArchitecturePatterns(db: Database.Database): void {
  const seedPath = join(SEED_DIR, 'architecture-patterns.json');

  if (!existsSync(seedPath)) {
    console.log('⚠ No architecture-patterns.json found, skipping...');
    return;
  }

  const data = JSON.parse(readFileSync(seedPath, 'utf-8'));

  const insertPattern = db.prepare(`
    INSERT INTO architecture_patterns (id, name, domain, description, components, trust_boundaries, applicable_standards, threat_mitigations, guidance, diagram_ascii)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const loadAll = db.transaction(() => {
    let count = 0;

    if (data.patterns) {
      for (const p of data.patterns) {
        insertPattern.run(
          p.id,
          p.name,
          p.domain,
          p.description,
          JSON.stringify(p.components),
          JSON.stringify(p.trust_boundaries),
          JSON.stringify(p.applicable_standards),
          JSON.stringify(p.threat_mitigations),
          p.guidance,
          p.diagram_ascii || null
        );
        count++;
      }
    }

    return { count };
  });

  const result = loadAll();
  console.log(`✓ Loaded ${result.count} architecture patterns`);
}

function buildDatabase() {
  console.log('Building automotive cybersecurity database...');

  let db: Database.Database | null = null;

  try {
    // Ensure directories exist
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!existsSync(SEED_DIR)) {
      mkdirSync(SEED_DIR, { recursive: true });
      console.log(`Created ${SEED_DIR} - add seed JSON files here`);
    }

    // Remove existing database for clean rebuild
    if (existsSync(DB_PATH)) {
      console.log('Removing existing database for clean rebuild...');
      unlinkSync(DB_PATH);
    }

    // Create/open database
    db = new Database(DB_PATH);

    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');

    // Create schema
    console.log('Creating schema...');
    db.exec(SCHEMA);
    console.log('✓ Schema created');

    // Load seed data
    console.log('\nLoading seed data...');
    loadRegulations(db);
    loadStandards(db);
    loadArchitecturePatterns(db);

    // Insert db_metadata
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkgVersion: string = JSON.parse(readFileSync(pkgPath, 'utf-8')).version;
    const insertMeta = db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?)');
    insertMeta.run('schema_version', '1.0.0');
    insertMeta.run('built_at', new Date().toISOString());
    insertMeta.run('built_by', `build-db.ts v${pkgVersion}`);
    insertMeta.run('server_version', pkgVersion);
    console.log('✓ Metadata written');

    console.log('\n✓ Database populated successfully');
    console.log(`Database ready at: ${DB_PATH}`);
  } catch (error) {
    console.error('Failed to build database:', error);

    // Clean up partial database
    if (existsSync(DB_PATH)) {
      console.log('Cleaning up partial database...');
      try {
        unlinkSync(DB_PATH);
      } catch (cleanupError) {
        console.error('Could not remove partial database:', cleanupError);
      }
    }
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

buildDatabase();
