// Dev-only sandbox for Crumb: three angles, silhouette and size tests, expression sheet.
// Open http://localhost:8080/garbage-dogposal-simulator/tools/dog-sandbox.html (npm run serve).
// ?view=sheet|one  ?alive=0  ?save=1 (renders at 1:1 and writes PNGs to tools/out/ via the dev server)

import { drawDog } from '../src/dog/draw.js';
import { createDogBrain } from '../src/dog/brain.js';
import { EXPRESSIONS } from '../src/dog/rig.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const info = document.getElementById('info');
const params = new URLSearchParams(location.search);
let view = params.get('view') || 'sheet';
let alive = params.get('alive') !== '0';

const SHEET = { w: 1600, h: 1100 };
const ONE = { w: 900, h: 900 };

function makeCell(expr, seed, extra) {
  const b = createDogBrain(seed);
  b.setExpression(expr, true);
  return { brain: b, extra };
}

// Sheet layout in sheet pixels: [x, pawsY, pxPerU].
const cells = [
  makeCell('neutral', 11, { label: 'turn -0.6', turn: -0.6, at: [190, 390, 2.5] }),
  makeCell('neutral', 12, { label: 'front', turn: 0, at: [490, 390, 2.5] }),
  makeCell('neutral', 13, { label: 'turn +0.6', turn: 0.6, at: [790, 390, 2.5] }),
  makeCell('neutral', 21, { label: 'silhouette', silhouette: true, at: [1100, 390, 2.5] }),
  makeCell('neutral', 31, { label: 'head 64 px', at: [1350, 390, 64 / 48] }),
  makeCell('neutral', 32, { label: 'head 32 px', at: [1510, 390, 32 / 48] }),
];
Object.keys(EXPRESSIONS).forEach((name, i) => {
  const col = i % 7;
  const row = Math.floor(i / 7);
  cells.push(makeCell(name, 41 + i, { label: name, at: [118 + col * 228, 735 + row * 330, 1.95] }));
});
const big = makeCell('neutral', 99, { label: '', at: [ONE.w / 2, ONE.h * 0.86, ONE.h / 145] });

let mouse = null;
let dpr = 1;
let W = 0;
let H = 0;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('pointermove', e => {
  mouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => {
  mouse = null;
});
document.getElementById('v-sheet').addEventListener('click', () => setView('sheet'));
document.getElementById('v-one').addEventListener('click', () => setView('one'));
document.getElementById('t-alive').addEventListener('click', () => {
  alive = !alive;
  document.getElementById('t-alive').classList.toggle('on', alive);
});
function setView(v) {
  view = v;
  document.getElementById('v-sheet').classList.toggle('on', v === 'sheet');
  document.getElementById('v-one').classList.toggle('on', v === 'one');
}
setView(view);
document.getElementById('t-alive').classList.toggle('on', alive);

let drawMs = 0;
let drawCount = 0;
let avgMs = 0;
let lastInfo = 0;

// g: target context; k: sheet px -> device px; ox/oy: sheet origin in device px.
function drawCell(g, cell, k, ox, oy, dt, mouseSheet) {
  const [x, y, pxPerU] = cell.extra.at;
  const b = cell.brain;
  b.overlays = alive;
  b.look = mouseSheet ? { x: (mouseSheet.x - x) / pxPerU, y: (mouseSheet.y - y) / pxPerU } : null;
  const pose = b.update(dt);
  if (cell.extra.turn !== undefined) pose.turn = cell.extra.turn + (alive ? pose.turn * 0.3 : 0);
  g.setTransform(k * pxPerU, 0, 0, k * pxPerU, ox + k * x, oy + k * y);
  const t0 = performance.now();
  drawDog(g, pose, { pxPerU: pxPerU * (k / dpr), silhouette: !!cell.extra.silhouette });
  drawMs += performance.now() - t0;
  drawCount++;
  if (cell.extra.label) {
    g.setTransform(k, 0, 0, k, ox, oy);
    g.fillStyle = '#7A6250';
    g.font = '600 18px system-ui, "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.fillText(cell.extra.label, x, y + 30);
  }
}

function renderView(g, gw, gh, dt, mouseCss) {
  const size = view === 'one' ? ONE : SHEET;
  const k = Math.min(gw / size.w, gh / size.h);
  const ox = (gw - size.w * k) / 2;
  const oy = (gh - size.h * k) / 2;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#F4EFE6';
  g.fillRect(0, 0, gw, gh);
  const m = mouseCss ? { x: (mouseCss.x * dpr - ox) / k, y: (mouseCss.y * dpr - oy) / k } : null;
  if (view === 'one') drawCell(g, big, k, ox, oy, dt, m);
  else for (const c of cells) drawCell(g, c, k, ox, oy, dt, m);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  renderView(ctx, canvas.width, canvas.height, dt, mouse);
  if (now - lastInfo > 500) {
    avgMs = drawCount ? drawMs / drawCount : 0;
    info.textContent = `dog draw avg ${avgMs.toFixed(3)} ms per dog (${drawCount} draws / 0.5 s)\nview ${view}  alive ${alive}  dpr ${dpr}`;
    drawMs = 0;
    drawCount = 0;
    lastInfo = now;
  }
}
requestAnimationFrame(frame);

// 1:1 export through the dev server (tools/serve.mjs writes to tools/out/).
async function savePng(name, v) {
  const prevView = view;
  const prevDpr = dpr;
  view = v;
  dpr = 1;
  const size = v === 'one' ? ONE : SHEET;
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderView(off.getContext('2d'), size.w, size.h, 0, null);
  view = prevView;
  dpr = prevDpr;
  const blob = await new Promise(r => off.toBlob(r, 'image/png'));
  const res = await fetch(`/__save?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
  return `${name}: ${res.status} ${await res.text()}`;
}

window.__sandbox = { avgMs: () => avgMs, savePng };
if (params.get('save') === '1') {
  Promise.all([savePng('crumb-sheet.png', 'sheet'), savePng('crumb-big.png', 'one')]).then(r => {
    info.textContent = r.join('\n');
  });
}
