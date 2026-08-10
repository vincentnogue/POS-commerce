#!/usr/bin/env node
// Checks translation key parity between src/lib/locales/fr.ts and en.ts.
// Exits non-zero if the two dictionaries have mismatched keys (missing or
// extra). Run with: npm run i18n:check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const KEY_RE = /^\s*"([a-zA-Z0-9_.]+)"\s*:/gm;

function extractKeys(file) {
  const src = readFileSync(join(root, file), 'utf8');
  const keys = new Set();
  let m;
  while ((m = KEY_RE.exec(src)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

const fr = extractKeys('src/lib/locales/fr.ts');
const en = extractKeys('src/lib/locales/en.ts');

const missingInEn = [...fr].filter((k) => !en.has(k)).sort();
const missingInFr = [...en].filter((k) => !fr.has(k)).sort();

if (missingInEn.length === 0 && missingInFr.length === 0) {
  console.log(`i18n parity OK — ${fr.size} keys in fr.ts and en.ts`);
  process.exit(0);
}

if (missingInEn.length > 0) {
  console.error(`Missing in en.ts (${missingInEn.length}):`);
  missingInEn.forEach((k) => console.error(`  - ${k}`));
}
if (missingInFr.length > 0) {
  console.error(`Missing in fr.ts (${missingInFr.length}):`);
  missingInFr.forEach((k) => console.error(`  - ${k}`));
}
process.exit(1);
