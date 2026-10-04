// Static checks against GAME_BRIEF.md and spec.md. Node built-ins only. Exit code 1 on any violation.
// Runtime = index.html + src/**. Tools and site/ are not loaded by the game and are not checked for content.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_BYTES = 400 * 1024; // own budget (the brief asks for under 2-3 MB); raised from 300 KB for two game modes
const SKIP_DIRS = new Set(['.git', 'node_modules', 'out']);
const UPPERCASE_OK = new Set(['README.md', 'LICENSE']);
const BINARY_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|mp3|wav|ogg|m4a|flac|mp4|webm|mov|ttf|otf|woff2?|eot)$/i;
const TEXT_EXT = /\.(html|js|mjs|css|json|svg)$/i;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const all = walk(ROOT);
const runtime = all.filter(f => {
  const r = rel(f);
  return r === 'index.html' || r.startsWith('src/');
});

const RULES = [
  { name: 'external URL', re: /https?:\/\/(?!www\.w3\.org\/2000\/svg)/gi },
  { name: 'root-absolute path', re: /(?:src|href)\s*=\s*["']\/(?!\/)|from\s+["']\/|import\(\s*["']\/|url\(\s*["']?\/(?!\/)/g },
  { name: 'network API', re: /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|sendBeacon|EventSource/g },
  { name: 'cookie', re: /document\.cookie/g },
  { name: 'console.log', re: /console\.log\s*\(/g },
  { name: 'vibration', re: /navigator\.vibrate/g },
  { name: 'Cyrillic text', re: /[Ѐ-ӿ]/g },
  { name: 'channel characters', re: /\b(?:Vince|Byte)\b/g },
  { name: 'pointer cursor (pointing finger)', re: /cursor\s*:\s*pointer/g },
];

const problems = [];

for (const f of runtime) {
  const r = rel(f);
  if (BINARY_EXT.test(r)) {
    problems.push(`${r}: binary asset in runtime`);
    continue;
  }
  if (!TEXT_EXT.test(r)) continue;
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const rule of RULES) {
    lines.forEach((line, i) => {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) problems.push(`${r}:${i + 1}: ${rule.name}: ${line.trim().slice(0, 100)}`);
    });
  }
}

// File names: lowercase only (GitHub Pages is case-sensitive).
for (const f of all) {
  const r = rel(f);
  const base = path.basename(r);
  if (UPPERCASE_OK.has(r)) continue;
  if (r !== r.toLowerCase()) problems.push(`${r}: uppercase letters in path`);
  if (/\s/.test(base)) problems.push(`${r}: whitespace in file name`);
}

// Every module the game actually loads (import graph from src/main.js) must be preloaded,
// so Pages does not serve a waterfall of requests. Modules nobody imports yet are listed, not failed.
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const preloaded = new Set([...html.matchAll(/rel="modulepreload"\s+href="\.\/([^"]+)"/g)].map(m => m[1]));
const reachable = new Set();
const stack = ['src/main.js'];
while (stack.length) {
  const r = stack.pop();
  if (reachable.has(r)) continue;
  reachable.add(r);
  const abs = path.join(ROOT, r);
  if (!fs.existsSync(abs)) continue;
  const text = fs.readFileSync(abs, 'utf8');
  for (const m of text.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const spec = m[1] || m[2];
    stack.push(rel(path.resolve(path.dirname(abs), spec)));
  }
}
for (const r of reachable) {
  if (!preloaded.has(r)) problems.push(`${r}: loaded by the game but missing <link rel="modulepreload">`);
}
for (const p of preloaded) {
  if (!fs.existsSync(path.join(ROOT, p))) problems.push(`index.html: modulepreload points to missing file ${p}`);
  else if (!reachable.has(p)) problems.push(`index.html: modulepreload of ${p}, which the game never imports`);
}
const notYetUsed = runtime.filter(f => f.endsWith('.js') && !reachable.has(rel(f))).map(rel);

// Relative imports must point to existing files with the exact case.
for (const f of runtime.filter(x => x.endsWith('.js'))) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(f), m[1]);
    const dir = path.dirname(target);
    const ok = fs.existsSync(dir) && fs.readdirSync(dir).includes(path.basename(target));
    if (!ok) problems.push(`${rel(f)}: import not found or wrong case: ${m[1]}`);
  }
}

// Weight budget.
let total = 0;
const sizes = runtime.map(f => {
  const b = fs.statSync(f).size;
  total += b;
  return [rel(f), b];
});
sizes.sort((a, b) => b[1] - a[1]);
console.log('Runtime files (bytes):');
for (const [r, b] of sizes) console.log(`  ${String(b).padStart(7)}  ${r}`);
console.log(`  ${String(total).padStart(7)}  TOTAL (${(total / 1024).toFixed(1)} KB of ${BUDGET_BYTES / 1024} KB budget)`);
if (notYetUsed.length) console.log(`\nIn src/ but not imported by the game yet: ${notYetUsed.join(', ')}`);
if (total > BUDGET_BYTES) problems.push(`runtime weight ${total} B exceeds ${BUDGET_BYTES} B`);

if (problems.length) {
  console.log(`\nFAIL: ${problems.length} problem(s)`);
  for (const p of problems) console.log('  - ' + p);
  process.exitCode = 1;
} else {
  console.log(`\nOK: ${runtime.length} runtime files, ${RULES.length} content rules, names, preloads, imports, weight.`);
}
