// Session regression tests in Node: a stub dog and UI, the real rules, shifts, flights and timers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../../src/core/layout.js';
import { createFx } from '../../src/render/fx.js';
import { createSession } from '../../src/game/session.js';
import { INGREDIENTS } from '../../src/food/ingredients.js';

function setup({ tutorialDone = 3, autoPick = true } = {}) {
  const L = computeLayout(1280, 720);
  const vp = { layout: L, worldTransform() {} };
  const eaten = [];
  const dog = {
    base: 'title',
    busy: false,
    setBase(b) {
      this.base = b;
    },
    play() {},
    eat(bites) {
      eaten.push(bites);
    },
    look() {},
    anchor() {
      return { x: 295, y: 576 };
    },
    hitHead(x, y) {
      return Math.hypot(x - 295, y - 520) < 80;
    },
    update() {},
    placeFor() {},
  };
  let cardDone = null;
  let saved = { tutorialDone, hints: 0 };
  const ui = {
    hud() {},
    shiftCard(info, done) {
      cardDone = done;
      return 0.2;
    },
    skipCard() {
      const f = cardDone;
      cardDone = null;
      if (f) f();
    },
    shiftEnd() {},
    hideShiftEnd() {},
    cards(list, pick) {
      ui.offered.push(list.map(c => c.id));
      if (autoPick) pick(list[0].id);
    },
    report(d) {
      ui.reported = d;
    },
    aiLine() {},
    offered: [],
    reported: null,
  };
  const storage = { get: () => saved, save: o => (saved = { ...saved, ...o }) };
  const session = createSession({ vp, dog, fx: createFx(), ui, storage, kitchen: {} });
  const step = sec => {
    for (let i = 0; i < Math.round(sec * 60); i++) session.update(1 / 60);
  };
  const css = (x, y) => ({ cx: L.ox + x * L.s, cy: L.oy + y * L.s });
  return { session, step, ui, L, css, dev: session.dev, eaten, storage: () => saved };
}

// Plays like a careful player: slices everything that is food once it is on screen, never touches bombs or junk.
function playCarefully(t, maxSteps = 20000) {
  for (let guard = 0; guard < maxSteps && !t.ui.reported; guard++) {
    const st = t.dev.state();
    if (st.phase === 'play') {
      for (const b of st.bodies) {
        if ((b.type === 'produce' || b.type === 'toy') && b.y < 760) t.dev.slice(b.uid);
      }
      t.dev.endStroke();
    }
    t.step(1 / 60);
  }
}

test('a careful run (slice all food, leave every bomb) reaches the report with 3 stars per shift', () => {
  const t = setup();
  t.session.start('rush');
  playCarefully(t);
  assert.ok(t.ui.reported, 'report shown');
  assert.deepEqual(t.dev.state().stars, [3, 3, 3]);
  assert.equal(t.ui.offered.length, 2, 'upgrade cards after MON and WED');
  assert.ok(t.ui.reported.slices > 60, `slices ${t.ui.reported.slices}`);
  assert.ok(t.ui.reported.leftAlone > 0, 'some bombs were left alone');
});

test('slicing a bomb is a strike and never feeds the dog; three strikes end the shift', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  const before = t.eaten.length;
  for (let k = 0; k < 3; k++) {
    const id = t.dev.place('onion', 1000, 400);
    t.dev.slice(id);
    t.step(0.6);
  }
  const st = t.dev.state();
  assert.equal(st.strikes, 3);
  assert.equal(t.eaten.length, before, 'no eat() for a bomb');
  assert.ok(!st.flights.includes('treat'));
  t.step(2.5);
  assert.notEqual(t.dev.state().phase, 'play', 'the shift ended');
});

test('a free block (Second Mitt) catches one bomb without a strike', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.boost('shield');
  t.dev.slice(t.dev.place('grapes', 1000, 400));
  t.step(0.6);
  assert.equal(t.dev.state().strikes, 0);
  assert.equal(t.dev.state().shields, 0);
  t.dev.slice(t.dev.place('grapes', 1000, 400));
  t.step(0.6);
  assert.equal(t.dev.state().strikes, 1);
});

test('only produce spare bits fly to the dog, and every eat() comes from one', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  for (const id of Object.keys(INGREDIENTS)) {
    const it = INGREDIENTS[id];
    if (it.type === 'toy') continue;
    const u = t.dev.place(id, 1000, 400);
    t.dev.slice(u);
    if (it.hits > 1) t.dev.slice(u);
    t.dev.endStroke();
    t.step(1);
  }
  assert.ok(t.eaten.length > 0, 'the dog ate something');
  assert.ok(t.eaten.length <= t.dev.state().treats + 1);
});

test('a big watermelon needs two hits', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  const u = t.dev.place('watermelon', 1000, 400);
  t.dev.slice(u);
  assert.equal(t.dev.state().bodies.length, 1, 'cracked, still whole');
  t.dev.slice(u);
  assert.equal(t.dev.state().bodies.length, 0);
  assert.equal(t.dev.state().sliced, 1);
});

test('a real swipe across a flying item slices it; a slow drag does not', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  const u = t.dev.place('apple', 1000, 400);
  const p = (x, y, ms) => ({ x, y, ...t.css(x, y), t: ms, type: 'mouse' });
  // Slow: 400 lu in 2 s.
  t.session.pointer('down', p(800, 400, 1000));
  for (let i = 1; i <= 20; i++) t.session.pointer('move', p(800 + i * 20, 400, 1000 + i * 100));
  t.session.pointer('up', p(1200, 400, 3000));
  assert.equal(t.dev.state().sliced, 0, 'slow drag');
  // Fast: 400 lu in 40 ms.
  t.session.pointer('down', p(800, 400, 4000));
  for (let i = 1; i <= 4; i++) t.session.pointer('move', p(800 + i * 100, 400, 4000 + i * 10));
  t.session.pointer('up', p(1200, 400, 4050));
  assert.equal(t.dev.state().sliced, 1);
  assert.ok(!t.dev.state().bodies.some(b => b.uid === u));
});

test('one swipe through three items is a multi-slice bonus', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.place('apple', 800, 400);
  t.dev.place('pear', 1000, 400);
  t.dev.place('peach', 1200, 400);
  const p = (x, ms) => ({ x, y: 400, ...t.css(x, 400), t: ms, type: 'mouse' });
  const before = t.dev.state().score;
  t.session.pointer('down', p(650, 5000));
  for (let i = 1; i <= 8; i++) t.session.pointer('move', p(650 + i * 90, 5000 + i * 8));
  t.session.pointer('up', p(1370, 5070));
  const st = t.dev.state();
  assert.equal(st.sliced, 3);
  assert.ok(st.score - before >= 30 + 30, `score +${st.score - before}`);
});

test('a missed produce breaks the streak but costs no strike; a bomb left alone scores', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.slice(t.dev.place('apple', 1000, 400));
  assert.equal(t.dev.state().streak, 1);
  t.dev.toss('carrot');
  t.dev.toss('onion');
  t.step(4);
  const st = t.dev.state();
  assert.equal(st.streak, 0);
  assert.equal(st.misses, 1);
  assert.equal(st.strikes, 0);
});

test('rotating the phone clears items in the air without counting misses', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.toss('apple');
  t.dev.toss('onion');
  t.step(0.5);
  t.session.onLayout(t.L, true);
  t.step(0.1);
  const st = t.dev.state();
  assert.equal(st.bodies.length, 0);
  assert.equal(st.misses, 0);
});

test('UNIT JAMMED: treats bounce, three pets clear it', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.event('jammed');
  assert.equal(t.dev.state().event, 'jammed');
  const head = { x: 295, y: 520 };
  for (let i = 0; i < 3; i++) {
    const p = { ...head, ...t.css(head.x, head.y), t: 9000 + i * 400, type: 'touch' };
    t.session.pointer('down', p);
    t.session.pointer('up', { ...p, t: p.t + 80 });
    t.step(0.1);
  }
  assert.equal(t.dev.state().event, null);
});

test('a 1x1 frame (iframe still laying out) never produces NaN positions', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  const tiny = computeLayout(1, 1);
  Object.assign(t.L, tiny);
  t.dev.toss('apple');
  t.dev.toss('onion');
  t.step(0.5);
  for (const b of t.dev.state().bodies) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `${b.id} at ${b.x},${b.y}`);
  }
});

test('first run: the tutorial cucumber, then the chocolate, then the timer starts', () => {
  const t = setup({ tutorialDone: 0 });
  t.session.start('rush');
  t.dev.skipCard();
  t.step(0.5);
  let st = t.dev.state();
  assert.equal(st.tutorial, 0);
  assert.equal(st.timerOn, false);
  t.step(1.5);
  const cuc = t.dev.state().bodies.find(b => b.id === 'cucumber');
  assert.ok(cuc, 'a slow cucumber');
  t.dev.slice(cuc.uid);
  t.step(1.5);
  st = t.dev.state();
  assert.equal(st.tutorial, 1);
  t.step(12);
  st = t.dev.state();
  assert.equal(st.tutorial, null, 'the chocolate fell, the tutorial is over');
  assert.equal(st.timerOn, true);
  assert.equal(st.strikes, 0);
  assert.equal(t.storage().tutorialDone & 2, 2, 'the Slice Rush tutorial is marked done');
});

// ---------- Sort & Feed (main mode) ----------

const CORRECT = { dish: 'bowl', spare: 'dog' };
function sortCarefully(t, maxSteps = 30000) {
  for (let guard = 0; guard < maxSteps && !t.ui.reported; guard++) {
    const st = t.dev.state();
    if (st.phase === 'play') {
      for (const b of st.bodies) if ((b.type === 'produce' || b.type === 'toy') && b.y < 760) t.dev.slice(b.uid);
      t.dev.endStroke();
      st.tray.forEach((p, i) => {
        if (!p) return;
        const [kind, , cat] = p.split(':');
        const target = kind === 'spare' && cat === 'ok' ? 'dog' : CORRECT[kind] || 'bin';
        t.dev.send(i, target);
      });
    }
    t.step(1 / 60);
  }
}

test('Sort & Feed: a careful run (slice, then send every piece where it belongs) reaches the report with stars', () => {
  const t = setup();
  t.session.start('sort');
  sortCarefully(t);
  assert.ok(t.ui.reported, 'report shown');
  const st = t.dev.state();
  assert.ok(st.stars.every(s => s >= 2), `stars ${st.stars}`);
  assert.equal(t.ui.reported.mode, 'sort');
  assert.ok(t.ui.reported.treats > 0, 'Crumb got his spare bits');
});

test('Sort & Feed: slicing puts the pieces on the tray instead of sending them anywhere', () => {
  const t = setup();
  t.session.start('sort');
  t.step(0.3);
  t.dev.clearPlan();
  const before = t.eaten.length;
  t.dev.slice(t.dev.place('apple', 1000, 400));
  t.step(0.6);
  const st = t.dev.state();
  assert.deepEqual(st.tray.filter(Boolean).sort(), ['dish:apple:ok', 'scrap:apple-core:toxic', 'spare:apple:ok']);
  assert.equal(t.eaten.length, before, 'nothing flew to the dog by itself');
  assert.ok(!st.flights.includes('treat'));
});

test('Sort & Feed: the spare bit feeds Crumb, the pile goes to the bowl, the core to the bin', () => {
  const t = setup();
  t.session.start('sort');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.slice(t.dev.place('apple', 1000, 400));
  t.step(0.6);
  const slot = k => t.dev.state().tray.findIndex(p => p && p.startsWith(k));
  t.dev.send(slot('spare'), 'dog');
  t.step(0.7);
  t.dev.send(slot('dish'), 'bowl');
  t.step(0.7);
  t.dev.send(slot('scrap'), 'bin');
  t.step(0.7);
  const st = t.dev.state();
  assert.equal(st.treats, 1);
  assert.equal(st.portions, 1);
  assert.equal(st.errors, 0);
  assert.equal(st.strikes, 0);
  assert.equal(st.pieces, 0);
});

test('Sort & Feed: an apple core thrown at the dog is caught by the mitt: strike, never eaten', () => {
  const t = setup();
  t.session.start('sort');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.slice(t.dev.place('apple', 1000, 400));
  t.step(0.6);
  const before = t.eaten.length;
  const i = t.dev.state().tray.findIndex(p => p && p.startsWith('scrap'));
  t.dev.send(i, 'dog');
  t.step(1.2);
  const st = t.dev.state();
  assert.equal(st.strikes, 1);
  assert.equal(st.errors, 1);
  assert.equal(t.eaten.length, before);
  assert.equal(st.tray.filter(Boolean).length, 2, 'the core is gone (binned by the mitt)');
});

test('Sort & Feed: a full tray drops new pieces (portion lost)', () => {
  const t = setup();
  t.session.start('sort');
  t.step(0.3);
  t.dev.clearPlan();
  for (const id of ['apple', 'pear', 'carrot']) {
    t.dev.slice(t.dev.place(id, 1000, 400));
    t.step(0.5);
  }
  const st = t.dev.state();
  assert.equal(st.tray.filter(Boolean).length, t.L.zones.tray.slots);
  assert.ok(st.lost >= 1);
});

test('Sort & Feed: a real grab and flick from the tray towards the bin', () => {
  const t = setup();
  t.session.start('sort');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.slice(t.dev.place('cucumber', 1000, 400));
  t.step(0.6);
  const i = t.dev.state().tray.findIndex(p => p && p.startsWith('scrap'));
  const z = t.L.zones.tray;
  const sx = z.x + (z.w / z.slots) * (i + 0.5);
  const sy = z.y + z.h / 2;
  const bin = t.L.zones.bin;
  const bx = bin.x + bin.w / 2;
  const by = bin.y + bin.h / 2;
  const p = (x, y, ms) => ({ x, y, ...t.css(x, y), t: ms, type: 'mouse' });
  t.session.pointer('down', p(sx, sy, 1000));
  t.session.pointer('move', p(sx + (bx - sx) * 0.3, sy + (by - sy) * 0.3, 1020));
  t.session.pointer('move', p(sx + (bx - sx) * 0.6, sy + (by - sy) * 0.6, 1040));
  t.session.pointer('up', p(sx + (bx - sx) * 0.6, sy + (by - sy) * 0.6, 1045));
  t.step(0.8);
  const st = t.dev.state();
  assert.equal(st.tray.filter(Boolean).length, 2, `the ends left the tray: ${st.tray}`);
  assert.equal(st.errors, 0);
  assert.ok(st.score > 0);
});
// ---------- Cuts anywhere ----------

test('a swipe near the top of an item cuts there, not through the middle', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.place('apple', 1000, 400);
  const p = (x, y, ms) => ({ x, y, ...t.css(x, y), t: ms, type: 'mouse' });
  // A horizontal swipe 30 lu above the center.
  t.session.pointer('down', p(800, 370, 6000));
  for (let i = 1; i <= 4; i++) t.session.pointer('move', p(800 + i * 100, 370, 6000 + i * 10));
  t.session.pointer('up', p(1200, 370, 6050));
  const st = t.dev.state();
  assert.equal(st.halves, 2);
  for (const planes of st.cuts) assert.ok(Math.abs(Math.abs(planes[0]) - 30) <= 2, `cut offset ${planes[0]}`);
});

test('a falling half can be cut again into two smaller pieces', () => {
  const t = setup();
  t.session.start('rush');
  t.step(0.3);
  t.dev.clearPlan();
  t.dev.slice(t.dev.place('apple', 1000, 400), 0);
  t.step(0.2);
  const before = t.dev.state();
  assert.equal(before.halves, 2);
  // A vertical swipe through the whole area where the halves are.
  const p = (x, y, ms) => ({ x, y, ...t.css(x, y), t: ms, type: 'mouse' });
  t.session.pointer('down', p(1000, 150, 7000));
  for (let i = 1; i <= 6; i++) t.session.pointer('move', p(1000, 150 + i * 100, 7000 + i * 10));
  t.session.pointer('up', p(1000, 750, 7070));
  const st = t.dev.state();
  assert.ok(st.halves >= 3, `pieces ${st.halves}`);
  assert.ok(st.cuts.some(planes => planes.length === 2), 'a piece with two cuts');
  assert.ok(st.score > before.score);
});