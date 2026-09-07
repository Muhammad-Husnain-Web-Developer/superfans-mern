/**
 * Guards the translations. Run it before every deploy: `node scripts/check-i18n.mjs`
 *
 * Three things go wrong with i18n and none of them show up in a type check:
 *
 *   1. a key is called in the code but missing from a locale file — the raw key name is
 *      printed on screen for anyone reading in that language,
 *   2. a locale file drifts from English and quietly loses a key, so that language falls
 *      back to English on a line nobody thought to look at,
 *   3. a placeholder (:attribute, {{count}}) is dropped in one translation, so the message
 *      renders with a hole in it.
 *
 * Exits non-zero on any of them, with the file and key named.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const LOCALES = path.join(SRC, 'i18n', 'locales');

const flat = (o, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (Array.isArray(v)) v.forEach((s, i) => { if (typeof s === 'string') out[`${key}[${i}]`] = s; });
    else if (v && typeof v === 'object') flat(v, key, out);
  }
  return out;
};

const localeNames = fs.readdirSync(LOCALES).filter((d) => fs.statSync(path.join(LOCALES, d)).isDirectory());
const bundles = {};
for (const l of localeNames) {
  bundles[l] = {};
  for (const f of fs.readdirSync(path.join(LOCALES, l))) {
    bundles[l][f.replace('.json', '')] = flat(JSON.parse(fs.readFileSync(path.join(LOCALES, l, f), 'utf8')));
  }
}

const problems = [];

/* ---- 1. every key the code calls exists in every language --------------------- */
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'i18n') walk(p); }
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(SRC);

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  /* which namespace each translate function was bound to in this file.
     A bare object would answer for toLocaleString and friends off Object.prototype, and
     every toLocaleString('en-US') in the app would read as a translation call. */
  const ns = Object.create(null);
  for (const m of src.matchAll(/const\s*\{\s*t(?:\s*:\s*(\w+))?\s*\}\s*=\s*useTranslation\(\s*'([^']+)'/g))
    ns[m[1] || 't'] = m[2];

  for (const m of src.matchAll(/\b(t[A-Za-z0-9_]*)\(\s*'([^']+)'/g)) {
    const [, fn, key] = m;
    const namespace = ns[fn];
    if (!namespace) continue;                       // not a translate call we can place
    if (/\{\{|\$\{/.test(key)) continue;            // built at runtime
    const line = src.slice(0, m.index).split('\n').length;
    for (const l of localeNames) {
      if (bundles[l][namespace]?.[key] === undefined) {
        problems.push(`missing key   ${l}/${namespace}.json  "${key}"   used at ${path.relative(SRC, file).replace(/\\/g, '/')}:${line}`);
      }
    }
  }
}

/* ---- 2. every language carries every English key ----------------------------- */
for (const nsName of Object.keys(bundles.en)) {
  for (const key of Object.keys(bundles.en[nsName])) {
    for (const l of localeNames) {
      if (l === 'en') continue;
      if (bundles[l][nsName] === undefined) { problems.push(`missing file  ${l}/${nsName}.json`); break; }
      if (bundles[l][nsName][key] === undefined) problems.push(`missing key   ${l}/${nsName}.json  "${key}"`);
    }
  }
}

/* ---- 3. placeholders survive translation ------------------------------------- */
const tokens = (s) => [...new Set([...s.matchAll(/:[a-z_]+|\{\{\s*[\w]+\s*\}\}/gi)].map((m) => m[0]))].sort().join(',');
for (const nsName of Object.keys(bundles.en)) {
  for (const [key, value] of Object.entries(bundles.en[nsName])) {
    const want = tokens(value);
    for (const l of localeNames) {
      const got = bundles[l][nsName]?.[key];
      if (got === undefined) continue;
      if (tokens(got) !== want) {
        problems.push(`placeholder   ${l}/${nsName}.json  "${key}"   en[${want || '-'}] vs ${l}[${tokens(got) || '-'}]`);
      }
    }
  }
}

const unique = [...new Set(problems)];
if (unique.length) {
  console.error(`\ni18n check FAILED — ${unique.length} problem(s):\n`);
  for (const p of unique.slice(0, 60)) console.error('  ' + p);
  if (unique.length > 60) console.error(`  … and ${unique.length - 60} more`);
  process.exit(1);
}
const keyCount = Object.values(bundles.en).reduce((a, b) => a + Object.keys(b).length, 0);
console.log(`i18n check passed — ${keyCount} keys x ${localeNames.length} languages, every key present, every placeholder intact.`);
