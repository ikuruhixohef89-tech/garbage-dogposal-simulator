// Dev-only: stages scenes with the real game modules and saves the site images (1280x720, JPEG 0.85, no UI).
// Open http://localhost:8080/garbage-dogposal-simulator/tools/capture.html with `npm run serve` running.

import { computeLayout } from '../src/core/layout.js';
import { createKitchenBackground } from '../src/render/kitchen.js';
import { createFx } from '../src/render/fx.js';
import { createDogActor } from '../src/dog/states.js';
import { createSession } from '../src/game/session.js';

const W = 1280;
const H = 720;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
const logEl = document.getElementById('log');
const SAVE = new URLSearchParams(location.search).get('save') !== '0';
const log = s => {
  logEl.textContent += s + '\n';
};

// Camera: the normal layout, or a zoomed/shifted one (used to put the dog on the right for the poster).
function makeVp(cam) {
  const L = computeLayout(W, H);
  if (cam) {
    L.s = cam.s;
    L.ox = cam.ox;
    L.oy = cam.oy;
    L.view = { x0: -L.ox / L.s, y0: -L.oy / L.s, x1: (W - L.ox) / L.s, y1: (H - L.oy) / L.s };
  }
  return {
    layout: L,
    bw: W,
    bh: H,
    kx: 1,
    ky: 1,
    dpr: 1,
    worldTransform(c) {
      c.setTransform(L.s, 0, 0, L.s, L.ox, L.oy);
    },
  };
}

function stage(cam, shiftIndex = 0, gameMode = 'rush') {
  const vp = makeVp(cam);
  const kitchen = createKitchenBackground();
  const fx = createFx();
  const dog = createDogActor(7);
  dog.placeFor(vp.layout);
  const ui = {
    hud() {},
    shiftCard(info, done) {
      done();
    },
    skipCard() {},
    shiftEnd() {},
    hideShiftEnd() {},
    cards(list, pick) {
      pick(list[0].id);
    },
    report() {},
    aiLine() {},
  };
  const storage = { get: () => ({ tutorialDone: 1, hints: 0 }), save() {} };
  const session = createSession({ vp, dog, fx, ui, storage, kitchen });
  const step = sec => {
    const n = Math.round(sec * 60);
    for (let i = 0; i < n; i++) session.update(1 / 60);
  };
  session.start(gameMode); // most presets stage Slice Rush scenes; cover and still-2 show Sort & Feed
  step(0.3);
  // Jump to a later shift (its card closes at once in this stub; upgrade cards are auto-picked).
  for (let i = 0; i < shiftIndex; i++) {
    session.dev.setTimer(0);
    step(4);
    step(2.5);
    step(0.3);
  }
  session.dev.clearPlan();
  session.dev.clearAir();
  session.dev.setTimer(40);
  return { vp, session, dog, fx, step, dev: session.dev };
}

function draw(s) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  s.dev.hideMarkers();
  s.session.render(ctx, 1e9);
}

async function save(name) {
  if (!SAVE) {
    log(`${name}: preview only`);
    return;
  }
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
  const res = await fetch(`/__save?dir=site&name=${name}`, { method: 'POST', body: blob });
  log(`${name}: ${res.status} ${await res.text()}`);
}

const PRESETS = {
  // Sort & Feed: pieces on the tray, the spare apple bit on its way to Crumb, produce in the air.
  async cover() {
    const s = stage(null, 0, 'sort');
    s.session.setUiHidden(true);
    s.dev.fillBowl(['cucumber', 'carrot', 'strawberry', 'pepper']);
    s.dev.slice(s.dev.place('apple', 1000, 420, 0.3), 0.4);
    s.dev.slice(s.dev.place('cucumber', 1200, 380, -0.3), -0.3);
    s.dev.endStroke();
    s.step(0.8);
    s.dev.clearAir();
    s.dev.send(s.dev.state().tray.findIndex(p => p && p.startsWith('spare:apple')), 'dog');
    s.step(0.22);
    s.dev.place('pepper', 1080, 210, 0.4);
    s.dev.place('strawberry', 1330, 300, -0.6);
    s.dev.place('banana', 860, 300, 0.7);
    s.step(0.02);
    s.dev.freeze();
    draw(s);
  },  // Poster under the site's Play button (left-center): Crumb on the right third, a treat flying in.
  async poster() {
    const sc = 1.2;
    const s = stage({ s: sc, ox: W * 0.7 - 295 * sc, oy: H * 0.05 - 180 * sc });
    s.session.setUiHidden(true); // no bubble or texts: the site puts its Play button over this frame
    s.dev.request('strawberry');
    s.dev.slice(s.dev.place('strawberry', 500, 330, 0.4), 0.3);
    s.dev.endStroke();
    s.step(0.2);
    s.dev.freeze();
    draw(s);
  },
  // One swipe through three: halves, juice and a multi-slice.
  async 'still-1'() {
    const s = stage(null, 1);
    s.dev.fillBowl(['tomato', 'pear', 'apple', 'zucchini']);
    for (const [id, x, y, r] of [['tomato', 760, 330, 0.3], ['pear', 990, 280, -0.5], ['peach', 1230, 330, 0.2]]) {
      s.dev.slice(s.dev.place(id, x, y, r), 0.12);
    }
    s.dev.endStroke();
    s.dev.place('watermelon', 1400, 520, 0.2);
    s.step(0.16);
    s.dev.freeze();
    draw(s);
  },
  // Sort & Feed: an apple core thrown at the dog; the SOUS-AI mitt grabs it mid-air.
  async 'still-2'() {
    const s = stage(null, 1, 'sort');
    s.dev.slice(s.dev.place('apple', 1000, 420, 0.3), 0.2);
    s.dev.slice(s.dev.place('tomato', 1200, 400, 0), -0.5);
    s.dev.endStroke();
    s.step(0.8);
    s.dev.clearAir();
    s.dev.send(s.dev.state().tray.findIndex(p => p && p.startsWith('scrap:apple')), 'dog');
    s.step(0.36);
    s.dev.place('cucumber', 1150, 250, 0.6);
    s.dev.place('chocolate', 1380, 360, -0.3);
    s.step(0.02);
    s.dev.freeze();
    draw(s);
  },  // Food coma: the treat bounces, the bowl is full, produce keeps coming.
  async 'still-3'() {
    const s = stage();
    s.dev.fillBowl(['cucumber', 'carrot', 'cucumber', 'pepper', 'banana', 'apple', 'blueberries', 'strawberry']);
    s.dev.setTummy(100);
    s.step(1.6);
    s.dev.place('blueberries', 900, 280, 0);
    s.dev.place('apple', 1150, 380, 0.5);
    s.dev.place('carrot', 1360, 250, -0.8);
    s.step(0.02);
    s.dev.freeze();
    draw(s);
  },
  // Stage images: one per shift.
  async 'stage-1'() {
    const s = stage();
    s.dev.fillBowl(['cucumber', 'carrot']);
    s.dev.place('cucumber', 820, 260, -0.3);
    s.dev.place('apple', 1080, 380, 0.4);
    s.dev.place('banana', 1340, 230, 0.8);
    s.dev.place('onion', 1220, 520, 0.1);
    s.step(0.02);
    s.dev.freeze();
    draw(s);
  },
  async 'stage-2'() {
    const s = stage(null, 1);
    s.dev.fillBowl(['tomato', 'pear', 'zucchini']);
    const w = s.dev.place('watermelon', 900, 330, 0.3);
    s.dev.slice(w, 0.5);
    s.dev.place('tomato', 1150, 220, 0);
    s.dev.place('chocolate', 1360, 400, -0.3);
    s.dev.place('zucchini', 1240, 560, 0.5);
    s.step(0.02);
    s.dev.freeze();
    draw(s);
  },
  async 'stage-3'() {
    const s = stage(null, 2);
    s.dev.fillBowl(['mango', 'pineapple', 'peach', 'banana']);
    s.dev.place('pineapple', 830, 330, -0.5);
    s.dev.place('peach', 1060, 220, 0, 'golden');
    s.dev.place('garlic', 1290, 330, 0.6);
    s.dev.place('banana', 1430, 520, 0.4, 'frozen');
    s.dev.place('mango', 1080, 520, 0.9);
    s.step(0.02);
    s.dev.freeze();
    draw(s);
  },
};

const only = new URLSearchParams(location.search).get('only');
for (const [name, fn] of Object.entries(PRESETS)) {
  if (only && only !== name) continue;
  await fn();
  await save(`${name}.jpg`);
  await new Promise(r => setTimeout(r, 50));
}
log('done');
window.__captureDone = true;
