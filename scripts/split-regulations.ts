#!/usr/bin/env tsx

/**
 * Split R155/R156 articles into paragraph-level items.
 * Reads existing regulations.json, extracts sub-paragraphs from article text,
 * and writes back to regulations.json with new paragraph-level entries.
 *
 * Run with: npx tsx scripts/split-regulations.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_PATH = join(__dirname, '..', 'data', 'seed', 'regulations.json');

interface ContentItem {
  regulation: string;
  content_type: 'article' | 'annex' | 'paragraph';
  reference: string;
  title: string;
  text: string;
  parent_reference?: string;
}

interface RegulationData {
  regulations: any[];
  content: ContentItem[];
}

/**
 * Clean text extracted from HTML-parsed content.
 * Normalize whitespace: collapse runs of whitespace to single space.
 */
function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Parse an article's text into sub-paragraphs.
 * Articles use numbering like "5.1.", "5.1.1.", "7.2.2.2." etc.
 */
function splitArticleIntoParagraphs(
  regulation: string,
  articleRef: string,
  articleText: string
): ContentItem[] {
  const paragraphs: ContentItem[] = [];

  // Build regex to find paragraph references within this article
  const escapedRef = articleRef.replace(/\./g, '\\.');
  const paraPattern = new RegExp(
    `(?:^|\\s)(${escapedRef}\\.\\d+(?:\\.\\d+)*)\\.\\s`,
    'g'
  );

  // Find all paragraph references and their positions
  const refs: { ref: string; pos: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = paraPattern.exec(articleText)) !== null) {
    const ref = match[1];
    // Only keep the first occurrence of each ref (text has each ref duplicated)
    if (!refs.some((r) => r.ref === ref)) {
      refs.push({ ref, pos: match.index });
    }
  }

  // Sort by position in text
  refs.sort((a, b) => a.pos - b.pos);

  // Extract text for each paragraph
  for (let i = 0; i < refs.length; i++) {
    const startPos = refs[i].pos;
    const endPos = i + 1 < refs.length ? refs[i + 1].pos : articleText.length;

    let rawText = articleText.substring(startPos, endPos);
    let text = cleanText(rawText);

    // Remove the leading reference number from text
    const refPrefix = refs[i].ref + '.';
    const prefixIdx = text.indexOf(refPrefix);
    if (prefixIdx !== -1) {
      text = text.substring(prefixIdx + refPrefix.length).trim();
    }

    // Deduplicate text
    text = deduplicateText(text, refs[i].ref);

    if (text.length < 5) continue;

    // Determine parent reference
    const refParts = refs[i].ref.split('.');
    let parentRef: string;
    if (refParts.length <= 2) {
      parentRef = articleRef;
    } else {
      parentRef = refParts.slice(0, -1).join('.');
    }

    paragraphs.push({
      regulation,
      content_type: 'paragraph',
      reference: refs[i].ref,
      title: '',
      text,
      parent_reference: parentRef,
    });
  }

  return paragraphs;
}

/**
 * Remove duplicated text blocks that result from HTML parsing.
 */
function deduplicateText(text: string, ref: string): string {
  const refEscaped = ref.replace(/\./g, '\\.');
  text = text.replace(new RegExp(`^${refEscaped}\\.?\\s+`, ''), '');
  text = text.replace(/\(([a-z])\)\s+\(?\1\)?/g, '($1)');
  text = text.replace(/\s{2,}/g, ' ').trim();
  return text;
}

/**
 * Parse Annex 5 into individual threat entries (Part A) and mitigation entries (Part B/C).
 */
function splitAnnex5(annexText: string): ContentItem[] {
  const items: ContentItem[] = [];

  const partAStart = annexText.indexOf('Part A.');
  const partBStart = annexText.indexOf('Part B.');
  const partCStart = annexText.indexOf('Part C.');

  if (partAStart === -1 || partBStart === -1) {
    console.warn('Could not find Part A or Part B markers in Annex 5');
    return items;
  }

  const partAText = annexText.substring(partAStart, partBStart);
  const partBText = annexText.substring(
    partBStart,
    partCStart !== -1 ? partCStart : annexText.length
  );
  const partCText =
    partCStart !== -1 ? annexText.substring(partCStart) : '';

  items.push(...parsePartAThreats(partAText));
  items.push(...parsePartBMitigations(partBText));
  items.push(...parsePartCMitigations(partCText));

  return items;
}

/**
 * Parse Part A threat entries.
 * Threats are numbered 1 through ~29 with sub-items (1.1, 1.2...).
 */
function parsePartAThreats(partAText: string): ContentItem[] {
  const items: ContentItem[] = [];

  const categories: { ref: string; title: string }[] = [
    { ref: '4.3.1', title: 'Threats regarding back-end servers related to vehicles in the field' },
    { ref: '4.3.2', title: 'Threats to vehicles regarding their communication channels' },
    { ref: '4.3.3', title: 'Threats to vehicles regarding their update procedures' },
    { ref: '4.3.4', title: 'Threats to vehicles regarding unintended human actions facilitating a cyber attack' },
    { ref: '4.3.5', title: 'Threats to vehicles regarding their external connectivity and connections' },
    { ref: '4.3.6', title: 'Threats to vehicle data/code' },
    { ref: '4.3.7', title: 'Potential vulnerabilities that could be exploited if not sufficiently hardened or protected' },
  ];

  const categoryRanges = [
    { cat: '4.3.1', min: 1, max: 3 },
    { cat: '4.3.2', min: 4, max: 6 },
    { cat: '4.3.3', min: 7, max: 9 },
    { cat: '4.3.4', min: 10, max: 13 },
    { cat: '4.3.5', min: 14, max: 17 },
    { cat: '4.3.6', min: 18, max: 23 },
    { cat: '4.3.7', min: 24, max: 29 },
  ];

  const threatEntries = extractNumberedEntries(partAText);

  for (const entry of threatEntries) {
    const highLevel = parseInt(entry.id.split('.')[0], 10);
    const cat = categoryRanges.find(
      (c) => highLevel >= c.min && highLevel <= c.max
    );
    const catRef = cat ? cat.cat : '4.3.1';
    const catTitle = categories.find((c) => c.ref === catRef)?.title || '';

    items.push({
      regulation: 'r155',
      content_type: 'annex',
      reference: `A5.A.${entry.id}`,
      title: catTitle,
      text: entry.text,
      parent_reference: 'Annex 5',
    });
  }

  return items;
}

/**
 * Extract numbered entries from table-structured text.
 */
function extractNumberedEntries(
  text: string
): { id: string; text: string }[] {
  const entries: { id: string; text: string }[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const idPattern = /^(\d+(?:\.\d+)?)$/;

  for (let i = 0; i < lines.length; i++) {
    const idMatch = lines[i].match(idPattern);
    if (idMatch) {
      const id = idMatch[1];
      if (id.startsWith('4.')) continue;

      let desc = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine.match(idPattern)) break;
        if (
          nextLine.startsWith('Table') ||
          nextLine.startsWith('4.3.') ||
          nextLine === 'High-level' ||
          nextLine === 'Example of'
        )
          break;
        if (nextLine.length > 10) {
          desc = nextLine;
          break;
        }
      }

      if (desc) {
        const sameId = entries.find((d) => d.id === id);
        if (!sameId) {
          entries.push({ id, text: desc });
        }
      }
    }
  }

  return entries;
}

/**
 * Parse Part B mitigations from Annex 5 text.
 */
function parsePartBMitigations(partBText: string): ContentItem[] {
  const items: ContentItem[] = [];
  const lines = partBText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const mPattern = /^(M\d+)$/;
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const mMatch = lines[i].match(mPattern);
    if (mMatch) {
      const mRef = mMatch[1];
      if (seen.has(mRef)) continue;
      seen.add(mRef);

      let desc = '';
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const nextLine = lines[j];
        // Skip duplicate of current M-ref (HTML duplication)
        if (nextLine === mRef) continue;
        // Stop at a different M-ref
        if (nextLine.match(mPattern)) break;
        if (nextLine.length > 15) {
          desc = nextLine;
          break;
        }
      }

      if (desc) {
        items.push({
          regulation: 'r155',
          content_type: 'annex',
          reference: `A5.B.${mRef}`,
          title: `Mitigation ${mRef}`,
          text: desc,
          parent_reference: 'Annex 5',
        });
      }
    }
  }

  return items;
}

/**
 * Parse Part C mitigations from Annex 5 text.
 */
function parsePartCMitigations(partCText: string): ContentItem[] {
  const items: ContentItem[] = [];
  if (!partCText) return items;

  const lines = partCText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const mPattern = /^(M\d+)$/;
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const mMatch = lines[i].match(mPattern);
    if (mMatch) {
      const mRef = mMatch[1];
      if (seen.has(mRef)) continue;
      seen.add(mRef);

      let desc = '';
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const nextLine = lines[j];
        // Skip duplicate of current M-ref (HTML duplication)
        if (nextLine === mRef) continue;
        // Stop at a different M-ref
        if (nextLine.match(mPattern)) break;
        if (nextLine.length > 15) {
          desc = nextLine;
          break;
        }
      }

      if (desc) {
        items.push({
          regulation: 'r155',
          content_type: 'annex',
          reference: `A5.C.${mRef}`,
          title: `Mitigation ${mRef} (outside vehicles)`,
          text: desc,
          parent_reference: 'Annex 5',
        });
      }
    }
  }

  return items;
}

/**
 * Main: Read regulations.json, split articles, write back.
 */
function main() {
  console.log('Reading regulations.json...');
  const data: RegulationData = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));

  const originalCount = data.content.length;
  console.log(`Original content items: ${originalCount}`);

  const newItems: ContentItem[] = [];

  for (const reg of ['r155', 'r156']) {
    const articles = data.content.filter(
      (c) => c.regulation === reg && c.content_type === 'article'
    );

    let articleParas = 0;
    for (const article of articles) {
      const paragraphs = splitArticleIntoParagraphs(
        reg,
        article.reference,
        article.text
      );
      newItems.push(...paragraphs);
      articleParas += paragraphs.length;
    }
    console.log(
      `${reg}: extracted ${articleParas} paragraphs from ${articles.length} articles`
    );

    if (reg === 'r155') {
      const annex5 = data.content.find(
        (c) => c.regulation === 'r155' && c.reference === 'Annex 5'
      );
      if (annex5) {
        const annexItems = splitAnnex5(annex5.text);
        newItems.push(...annexItems);
        console.log(`${reg}: extracted ${annexItems.length} Annex 5 entries`);
      }
    }
  }

  data.content.push(...newItems);

  console.log(`\nTotal content items: ${data.content.length} (was ${originalCount})`);
  console.log(`New items added: ${newItems.length}`);

  for (const reg of ['r155', 'r156']) {
    const count = data.content.filter((c) => c.regulation === reg).length;
    console.log(`  ${reg}: ${count} items`);
  }

  writeFileSync(SEED_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\nWritten to ${SEED_PATH}`);
}

main();
