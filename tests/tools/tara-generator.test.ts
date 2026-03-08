import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { join } from 'path';
import { generateTara } from '../../src/tools/tara-generator.js';
import type { GenerateTaraInput } from '../../src/types/index.js';

describe('generate_tara tool', () => {
  let db: Database;

  beforeAll(() => {
    const dbPath = join(process.cwd(), 'data', 'automotive.db');
    db = new Database(dbPath, { readonly: true });
  });

  afterAll(() => {
    db.close();
  });

  it('should return TARA template with threat scenarios from attack patterns', () => {
    const input: GenerateTaraInput = {
      system_description: 'firmware extraction',
    };
    const result = generateTara(db, input);

    expect(result).toHaveProperty('item_definition');
    expect(result).toHaveProperty('assets');
    expect(result).toHaveProperty('threat_scenarios');
    expect(result).toHaveProperty('damage_scenarios');
    expect(result).toHaveProperty('risk_determinations');
    expect(result).toHaveProperty('cybersecurity_goals');
    expect(result).toHaveProperty('disclaimer');

    expect(result.item_definition).toBe('firmware extraction');
    expect(Array.isArray(result.assets)).toBe(true);
    expect(result.assets.length).toBeGreaterThan(0);

    expect(Array.isArray(result.threat_scenarios)).toBe(true);
    expect(result.threat_scenarios.length).toBeGreaterThan(0);

    const ts = result.threat_scenarios[0];
    expect(ts).toHaveProperty('id');
    expect(ts).toHaveProperty('threat');
    expect(ts).toHaveProperty('stride');
    expect(ts).toHaveProperty('attack_vector');
    expect(ts).toHaveProperty('feasibility');
    expect(ts).toHaveProperty('impact');
    expect(ts).toHaveProperty('mitigations');
    expect(ts).toHaveProperty('r155_refs');
    expect(ts.id).toMatch(/^TS-GEN-\d{2}$/);
    expect(typeof ts.feasibility).toBe('object');
    expect(Array.isArray(ts.mitigations)).toBe(true);
  });

  it('should return tara-tcu example when system_type is "tcu"', () => {
    const input: GenerateTaraInput = {
      system_description: 'telematics unit with cellular connectivity',
      system_type: 'tcu',
    };
    const result = generateTara(db, input);

    // Should use the tara-tcu example as base, so item_definition comes from the DB
    expect(result.item_definition).toContain('Telematics Control Unit');

    // Should include the worked example
    expect(result.worked_examples).toBeDefined();
    expect(result.worked_examples!.length).toBeGreaterThan(0);
    expect(result.worked_examples![0].id).toBe('tara-tcu');
  });

  it('should return cybersecurity goals derived from STRIDE categories', () => {
    const input: GenerateTaraInput = {
      system_description: 'ECU firmware update mechanism',
    };
    const result = generateTara(db, input);

    expect(result.cybersecurity_goals.length).toBeGreaterThan(0);

    for (const goal of result.cybersecurity_goals) {
      expect(goal).toHaveProperty('property');
      expect(goal).toHaveProperty('description');
      expect(goal).toHaveProperty('derived_from');
      expect(
        ['Authenticity', 'Integrity', 'Non-repudiation', 'Confidentiality', 'Availability'].includes(
          goal.property,
        ),
      ).toBe(true);
      expect(Array.isArray(goal.derived_from)).toBe(true);
      expect(goal.derived_from.length).toBeGreaterThan(0);
    }
  });

  it('should include disclaimer', () => {
    const input: GenerateTaraInput = {
      system_description: 'gateway ECU',
    };
    const result = generateTara(db, input);

    expect(result.disclaimer).toContain('ISO 21434 clause 15');
    expect(result.disclaimer).toContain('pattern matching');
  });

  it('should suppress examples when include_examples is false', () => {
    const input: GenerateTaraInput = {
      system_description: 'telematics unit with cellular connectivity',
      system_type: 'tcu',
      include_examples: false,
    };
    const result = generateTara(db, input);

    expect(result.worked_examples).toBeUndefined();
  });

  it('should not crash with invalid system_type and fall back to search', () => {
    const input: GenerateTaraInput = {
      system_description: 'CAN bus network gateway',
      system_type: 'nonexistent_system_xyz',
    };

    expect(() => generateTara(db, input)).not.toThrow();

    const result = generateTara(db, input);
    // Should still return a valid template, just without a base example
    expect(result).toHaveProperty('item_definition');
    expect(result.item_definition).toBe('CAN bus network gateway');
    expect(result).toHaveProperty('threat_scenarios');
    expect(result).toHaveProperty('disclaimer');
  });

  it('should throw error for empty system_description', () => {
    const input: GenerateTaraInput = {
      system_description: '',
    };
    expect(() => generateTara(db, input)).toThrow('system_description is required');
  });

  it('should throw error for whitespace-only system_description', () => {
    const input: GenerateTaraInput = {
      system_description: '   ',
    };
    expect(() => generateTara(db, input)).toThrow('system_description is required');
  });

  it('should have matching damage_scenarios and risk_determinations for each threat', () => {
    const input: GenerateTaraInput = {
      system_description: 'OTA software update system',
    };
    const result = generateTara(db, input);

    // Every threat_scenario should have a corresponding damage and risk entry
    expect(result.damage_scenarios.length).toBe(result.threat_scenarios.length);
    expect(result.risk_determinations.length).toBe(result.threat_scenarios.length);

    for (const ts of result.threat_scenarios) {
      expect(result.damage_scenarios.some((d) => d.threat_id === ts.id)).toBe(true);
      expect(result.risk_determinations.some((r) => r.threat_id === ts.id)).toBe(true);
    }

    // Risk determinations should have valid fields
    for (const rd of result.risk_determinations) {
      expect(['Very Low', 'Low', 'Medium', 'High', 'Very High']).toContain(rd.feasibility);
      expect(['negligible', 'minor', 'moderate', 'major', 'critical']).toContain(rd.impact);
      expect(['Low', 'Medium', 'High', 'Very High']).toContain(rd.risk_level);
    }
  });

  it('should handle system_type matching case-insensitively', () => {
    const input: GenerateTaraInput = {
      system_description: 'telematics unit',
      system_type: 'TCU',
    };
    const result = generateTara(db, input);

    expect(result.item_definition).toContain('Telematics Control Unit');
  });
});
