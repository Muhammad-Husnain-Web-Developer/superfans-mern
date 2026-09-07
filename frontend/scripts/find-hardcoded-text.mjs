/**
 * Finds text a reader can see that never passes through t(), so it stays in one language
 * whatever the viewer picks.
 *
 *   node scripts/find-hardcoded-text.mjs            list what is left, grouped by file
 *   node scripts/find-hardcoded-text.mjs --check    exit 1 if anything is not in the baseline
 *   node scripts/find-hardcoded-text.mjs --save     write the current findings as the baseline
 *
 * The baseline (scripts/hardcoded-baseline.json) is what is known and still to do. --check
 * passes while the list only shrinks, so a new hardcoded string cannot be merged unnoticed,
 * and nobody has to fix all of them before the guard is useful.
 *
 * Super Ads Center and the admin panel are reported separately: the Laravel original leaves
 * those in English too (2 of 7 ads blades and 1 of 18 admin blades call __()), so English
 * there is faithful rather than a regression.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const BASELINE = path.join(HERE, 'hardcoded-baseline.json');

const CODEY = new Set([
  'px', 'em', 'rem', 'vh', 'vw', 'auto', 'none', 'flex', 'block', 'inline', 'inline-block',
  'absolute', 'relative', 'fixed', 'sticky', 'center', 'left', 'right', 'bold', 'normal',
  'hidden', 'visible', 'pointer', 'solid', 'dashed', 'contain', 'cover', 'column', 'row',
  'wrap', 'nowrap', 'button', 'submit', 'reset', 'text', 'password', 'email', 'file',
  'checkbox', 'radio', 'number', 'range', 'image', 'video', 'audio', 'div', 'span', 'true',
  'false', 'null', 'undefined', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'application/json',
  'multipart/form-data', 'utf-8', 'nearest', 'smooth', 'start', 'end', 'both', 'all', 'ease',
  'linear', 'infinite', 'forwards', 'borderBox', 'anonymous', 'lazy', 'eager', 'async',
  'sync', 'polite', 'assertive', 'dialog', 'presentation', 'en-US',
]);

/**
 * Names that stay as they are in every language: the product's own, and the faces it
 * asks for by name. Translating a brand is a bug, not a fix.
 */
const KEEP_AS_IS = [
  /^Super\s?(fans|world|Ads)/i,
  /^SUPERFANSS?\.APP$/i,
  /^Superfans( World| Logo)?$/i,
  /^Superworld( Logo)?$/i,
  /^(Roboto|Consolas|Arial|Helvetica|Georgia|Verdana|Tahoma|Menlo|Monaco|Courier)\b/,
];

function isProse(raw) {
  const t = raw.trim().replace(/[,;]+$/, '');
  if (KEEP_AS_IS.some((re) => re.test(t))) return false;
  if (t.length < 2 || t.length > 300) return false;
  if (CODEY.has(t)) return false;
  if (!/[A-Za-zÀ-ÿ]{2}/.test(t)) return false;
  if (/^https?:\/\//.test(t)) return false;
  if (/^[./#@$]/.test(t)) return false;
  if (/^[a-z0-9_-]+\.(png|jpg|jpeg|svg|webp|mp4|webm|css|json|ts|tsx)$/i.test(t)) return false;
  if (/^\d+(\.\d+)?(px|%|em|rem|s|ms|fr|vh|vw)?$/.test(t)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false;
  if (/^[A-Z][A-Z0-9_]+$/.test(t) && !/\s/.test(t)) return false;
  if (/^[a-z0-9-]+(\s+[a-z0-9-]+)*$/.test(t) && !/[.!?¿¡…]/.test(t)) return false;
  if (/^(rgba?|hsla?|var|calc|url|translate|scale|rotate|linear-gradient)\(/.test(t)) return false;
  /* css shorthand and colours: '4px solid rgba(...)', '1px solid #eee', '0 0 20px ...' */
  if (/^-?[\d.]+(px|em|rem|%|vh|vw|s|ms)?(\s|$)/.test(t)) return false;
  if (/rgba?\(|hsla?\(|#[0-9a-f]{3,8}/i.test(t)) return false;
  if (/(solid|dashed|dotted|inset|ellipsis|uppercase|lowercase|capitalize)/.test(t)) return false;
  /* font stacks and family names */
  if (/(sans-serif|serif|monospace|cursive|fantasy|system-ui)\s*$/.test(t)) return false;
  if (/^(Roboto|Consolas|Arial|Helvetica|Georgia|Verdana|Tahoma|Menlo|Monaco|Courier)/.test(t)) return false;
  /* fragments of code caught by a loose quote match */
  if (/[=><]{1,2}>|\.\w+\(|\)\s*[;,]|\[\w|\]\)|\$\{/.test(t)) return false;
  return /\s/.test(t) || /[.!?¿¡…:]/.test(t) || /^[A-ZÀ-Ý]/.test(t) || /[\u{1F300}-\u{1FAFF}]/u.test(t);
}

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'i18n') walk(p, out); }
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
};

const findings = [];
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let block = false;
  let importing = false;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (block) { if (trimmed.includes('*/')) block = false; return; }
    if (/^import\b/.test(trimmed)) { importing = !/;\s*$/.test(trimmed); return; }
    if (importing) { if (/;\s*$/.test(trimmed)) importing = false; return; }
    if (trimmed.startsWith('/*') || trimmed.startsWith('{/*')) { if (!trimmed.includes('*/')) block = true; return; }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    const push = (s, kind) => {
      if (!isProse(s)) return;
      const at = line.indexOf(s);
      /* only the fallback for a translation that already happens */
      if (at > 0 && /defaultValue\s*:/.test(line.slice(0, at))) return;
      /* the line already translates this very string */
      const before = line.slice(0, at);
      if (at > 0 && /\bt[A-Za-z0-9_]*\(\s*['"][^'"]+['"]/.test(before)) return;
      /* the text IS a key name — it sits inside t('...') / tUi('...') / i18n.t('...') */
      if (at > 0 && /\b(?:i18n\.)?t[A-Za-z0-9_]*\(\s*['"]$/.test(before)) return;
      const text = s.trim();
      if (findings.some((f) => f.file === rel && f.line === idx + 1 && f.text === text)) return;
      findings.push({ file: rel, line: idx + 1, text, kind });
    };

    for (const m of line.matchAll(/>([^<>{}\n]{2,300})</g)) push(m[1], 'text');
    if (!/[<>{}=;]/.test(trimmed) && /^[A-ZÀ-Ý¿¡]/.test(trimmed) && trimmed.length >= 2) push(trimmed, 'text');
    for (const m of line.matchAll(/\b(placeholder|title|alt|aria-label|label|confirmText|cancelText|tooltip)\s*=\s*["']([^"']{2,300})["']/g)) push(m[2], m[1]);
    for (const m of line.matchAll(/\b(placeholder|title|alt|label|text|message|heading|subtitle)\s*:\s*["']([^"']{2,300})["']/g)) push(m[2], m[1]);
    for (const m of line.matchAll(/\b(?:window\.)?(?:alert|confirm)\(\s*["']([^"']{3,300})["']/g)) push(m[1], 'dialog');
    for (const m of line.matchAll(/`([^`$]{4,300})`/g)) push(m[1], 'template');
    /* a literal inside a JSX expression: {cond ? 'Login' : 'Regístrate'} */
    if (/^\{/.test(trimmed) || /=\{/.test(line))
      for (const m of line.matchAll(/(?<![\w.])'([^']{2,200})'/g)) push(m[1], 'expression');
  });
}

const area = (f) => (/^pages\/ads\//.test(f) ? 'ads' : /^pages\/admin\//.test(f) ? 'admin' : 'user');
const user = findings.filter((f) => area(f.file) === 'user');
/* a finding is identified by file + text, not by line, so moving code does not trip the guard */
const id = (f) => `${f.file}|${f.text}`;

const mode = process.argv[2];

if (mode === '--save') {
  fs.writeFileSync(BASELINE, JSON.stringify({ note: 'user-visible strings still to translate; this list may only shrink', ids: user.map(id).sort() }, null, 2) + '\n');
  console.log(`baseline saved — ${user.length} user-visible strings still to do`);
  process.exit(0);
}

if (mode === '--check') {
  if (!fs.existsSync(BASELINE)) { console.error('no baseline; run with --save first'); process.exit(1); }
  const known = new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).ids);
  const added = user.filter((f) => !known.has(id(f)));
  if (added.length) {
    console.error(`\nhardcoded text check FAILED — ${added.length} new string(s) that no language can translate:\n`);
    for (const f of added) console.error(`  ${f.file}:${f.line}  [${f.kind}]  ${f.text}`);
    console.error('\nGive each one a key in src/i18n/locales/*/ui.json, or run --save if it is genuinely not user-facing.');
    process.exit(1);
  }
  const fixed = [...known].filter((k) => !user.some((f) => id(f) === k)).length;
  console.log(`hardcoded text check passed — ${user.length} left to translate, ${fixed} fewer than the baseline.`);
  process.exit(0);
}

const byFile = new Map();
for (const f of user) { if (!byFile.has(f.file)) byFile.set(f.file, []); byFile.get(f.file).push(f); }
console.log(`user-visible strings that never reach t(): ${user.length} in ${byFile.size} files\n`);
for (const [file, items] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${file}  (${items.length})`);
  for (const it of items.sort((a, b) => a.line - b.line))
    console.log(`  ${String(it.line).padStart(5)}  ${('[' + it.kind + ']').padEnd(13)} ${it.text}`);
  console.log('');
}
console.log(`for reference — Super Ads Center: ${findings.filter((f) => area(f.file) === 'ads').length}, admin panel: ${findings.filter((f) => area(f.file) === 'admin').length}`);
