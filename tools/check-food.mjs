// Dog-safety check: no 'toxic' or 'nope' part can ever reach the dog, and every category matches site/sources.md.
// Node built-ins only. Exit code 1 on any problem.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allPieceTypes, FACTS, INGREDIENTS } from '../src/food/ingredients.js';
import { resolveSlice, resolveTreat, resolveDrop, canFeed } from '../src/game/rules.js';
import { mulberry32 } from '../src/core/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

// Expected categories, copied from the table in site/sources.md.
const EXPECTED = {
  'dish:cucumber': 'ok', 'spare:cucumber': 'ok', 'scrap:cucumber-ends': 'nope',
  'dish:pepper': 'ok', 'spare:pepper': 'ok', 'scrap:pepper-cap': 'nope',
  'dish:carrot': 'ok', 'spare:carrot': 'ok', 'scrap:carrot-ends': 'nope',
  'dish:tomato': 'ok', 'spare:tomato': 'ok', 'scrap:tomato-top': 'toxic',
  'dish:apple': 'ok', 'spare:apple': 'ok', 'scrap:apple-core': 'toxic',
  'dish:strawberry': 'ok', 'spare:strawberry': 'ok', 'scrap:strawberry-hulls': 'nope',
  'dish:banana': 'ok', 'spare:banana': 'ok', 'scrap:banana-peel': 'nope',
  'dish:blueberries': 'ok', 'spare:blueberries': 'ok',
  'dish:watermelon': 'ok', 'spare:watermelon': 'ok', 'scrap:watermelon-rind': 'nope',
  'dish:pear': 'ok', 'spare:pear': 'ok', 'scrap:pear-core': 'toxic',
  'dish:zucchini': 'ok', 'spare:zucchini': 'ok',
  'dish:peach': 'ok', 'spare:peach': 'ok', 'scrap:peach-pit': 'toxic',
  'dish:mango': 'ok', 'spare:mango': 'ok', 'scrap:mango-pit': 'toxic',
  'dish:pineapple': 'ok', 'spare:pineapple': 'ok', 'scrap:pineapple-skin': 'nope',
  'intruder:onion': 'toxic', 'intruder:grapes': 'toxic', 'intruder:chocolate': 'toxic',
  'intruder:garlic': 'toxic', 'intruder:gum': 'toxic',
  'intruder:sponge': 'nope', 'intruder:spoon': 'nope',
};

const types = allPieceTypes();
for (const t of types) {
  const key = `${t.kind}:${t.itemId}`;
  if (!(key in EXPECTED)) problems.push(`${key}: no verified category in the expected table`);
  else if (EXPECTED[key] !== t.cat) problems.push(`${key}: category ${t.cat}, verified ${EXPECTED[key]}`);
  const junk = INGREDIENTS[t.ingredient] && INGREDIENTS[t.ingredient].type === 'junk';
  if (!junk && !FACTS[t.itemId]) problems.push(`${key}: missing fact line`);
}
for (const key of Object.keys(EXPECTED)) {
  if (!types.some(t => `${t.kind}:${t.itemId}` === key)) problems.push(`${key}: expected but not produced by the game`);
}

// Item types are consistent with their parts.
for (const [id, it] of Object.entries(INGREDIENTS)) {
  if (it.type === 'bomb' && it.cat !== 'toxic') problems.push(`${id}: a bomb must be toxic`);
  if (it.type === 'junk' && it.cat !== 'nope') problems.push(`${id}: junk must be nope`);
  if (it.type === 'produce' && (it.flesh !== 'ok' || it.spare !== 'ok')) problems.push(`${id}: produce flesh and spare must be ok`);
}

// Fact lines must not exaggerate, and the game must not name the genre reference.
for (const [id, line] of Object.entries(FACTS)) {
  if (/poison|deadly|lethal|fatal/i.test(line)) problems.push(`fact ${id}: uses a word the sources do not support`);
  if (line.length > 110) problems.push(`fact ${id}: longer than 110 characters`);
}
const strings = fs.readFileSync(path.join(ROOT, 'src', 'strings.js'), 'utf8');
if (/ninja/i.test(strings)) problems.push('strings.js: names a brand');

// 10 000 random slices and treats: nothing toxic or nope is ever fed; a bomb always strikes unless shielded.
const rnd = mulberry32(2026);
let bombSlices = 0;
let bombStrikes = 0;
let feeds = 0;
for (let i = 0; i < 10000; i++) {
  const t = types[Math.floor(rnd() * types.length)];
  const dog = { coma: rnd() < 0.2, jammed: rnd() < 0.2, request: rnd() < 0.5 ? t.ingredient : null };
  const r = resolveTreat(t, dog);
  if (r.eaten) {
    feeds++;
    if (t.cat !== 'ok' || t.kind !== 'spare') problems.push(`treat ${t.kind}:${t.itemId} (${t.cat}) was eaten`);
  }
  if (canFeed(t, dog) && t.cat !== 'ok') problems.push(`canFeed allowed ${t.kind}:${t.itemId}`);
  if (t.kind === 'intruder' && INGREDIENTS[t.ingredient].type === 'bomb') {
    const shield = rnd() < 0.3;
    const s = resolveSlice(t.ingredient, { shield });
    bombSlices++;
    if (!shield && s.strike) bombStrikes++;
    if (shield && s.strike) problems.push(`shielded bomb ${t.ingredient} still struck`);
    if (!shield && !s.strike) problems.push(`bomb ${t.ingredient} sliced without a strike`);
  }
}

// Sort & Feed: 10 000 random throws of tray pieces at the dog. Unsafe pieces are never eaten; toxic always strikes.
let drops = 0;
for (let i = 0; i < 10000; i++) {
  const t = types[Math.floor(rnd() * types.length)];
  if (t.kind === 'intruder') continue;
  const r = resolveDrop(t, 'dog', { coma: rnd() < 0.2, jammed: rnd() < 0.2, request: rnd() < 0.5 ? t.ingredient : null });
  drops++;
  if (t.cat !== 'ok' && r.eaten) problems.push(`drop ${t.kind}:${t.itemId} (${t.cat}) was eaten`);
  if (t.cat === 'toxic' && !(r.strike && r.mitt === 'red')) problems.push(`drop ${t.kind}:${t.itemId} toxic without a red mitt and strike`);
  if (t.cat === 'nope' && !(r.mitt === 'yellow' && !r.strike)) problems.push(`drop ${t.kind}:${t.itemId} nope without a yellow mitt`);
}
console.log(`Sort & Feed throws at the dog: ${drops}`);

// sources.md exists, links the main sources, and every in-game fact line matches its wording.
const sources = fs.readFileSync(path.join(ROOT, 'site', 'sources.md'), 'utf8');
if (!/aspca\.org/.test(sources) || !/akc\.org/.test(sources)) problems.push('site/sources.md: ASPCA and AKC links missing');
const norm = s => s.replace(/[‘’]/g, "'");
const srcNorm = norm(sources);
for (const [id, line] of Object.entries(FACTS)) {
  if (!srcNorm.includes(norm(line))) problems.push(`fact ${id}: wording differs from site/sources.md`);
}

console.log(`Part types: ${types.length}`);
console.log(`Random checks: 10000 (treats eaten ${feeds}, all ok spare bits; bomb slices ${bombSlices})`);
if (problems.length) {
  console.log(`\nFAIL: ${problems.length} problem(s)`);
  for (const p of problems) console.log('  - ' + p);
  process.exitCode = 1;
} else {
  console.log('\nOK: categories match the table, nothing unsafe is ever fed, fact lines are clean.');
}
