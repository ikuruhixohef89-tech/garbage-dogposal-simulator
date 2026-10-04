// The kitchen. SOUS-AI tosses produce, the player slices it mid-air. Two modes:
//   sort (Sort & Feed, the main mode): the pieces land on a tray and the player sends each one: the spare bit
//     to Crumb, the sliced pile to the bowl, peels, pits and anything unsafe to the bin;
//   rush (Slice Rush): halves go to the bowl, scraps to the bin and a spare bit flies to Crumb on its own.
// Bombs (toxic) must be left alone; slicing one, or throwing an unsafe piece at the dog, calls the safety mitt.
// Also: boosters, upgrade cards between shifts, micro-events, requests, the tutorial. Everything is in lu.

import { ARENA, LIMITS, PALETTE } from '../config.js';
import { INGREDIENTS, FACTS, piecesOf } from '../food/ingredients.js';
import { drawWhole, drawWholeFast, drawCutPiece, supportAlong, drawTreat, drawScrap, drawPiece, drawMarker, drawVariantBack, drawVariantFront } from '../food/art.js';
import { createBlade, segmentHitsItem, drawKnife } from '../food/blade.js';
import { resolveSlice, resolveFall, resolveTreat, resolveDrop, canFeed, POINTS, DROP_POINTS, TUMMY, comboMultiplier, multiBonus, shiftStars, sortStars, quotaFor, rankFor } from './rules.js';
import { newlyUnlocked } from './skins.js';
import { SHIFTS, planShift, difficulty, pools } from './shifts.js';
import { EVENTS, planEvents } from './events.js';
import { tuneFor, drawCards, BASE_TUNE } from './upgrades.js';
import { makeRng } from '../core/rng.js';
import { bowlGeometry } from '../render/kitchen.js';
import { hitRectCss } from '../core/layout.js';
import { drawMitt, drawBubble } from '../render/fx.js';
import * as sfx from '../audio/sfx.js';
import { S } from '../strings.js';
import { ease, clamp, roundRectPath } from '../core/math.js';

const TAU = Math.PI * 2;
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, "Segoe UI", Roboto, sans-serif';
const INK = PALETTE.ui.ink;
const TREAT_CHANCE = [0.6, 0.5, 0.42];
const MIN_SPEED_CSS = 0.25; // px per ms: slower finger moves draw a trail but do not slice
const BOOST_SECONDS = { freezer: 4, zoomies: 6, blender: 6 };

export function createSession({ vp, dog, fx, ui, storage, kitchen }) {
  const blade = createBlade();
  let rng = makeRng(1);
  let run = null;
  let time = 0;
  let uid = 0;
  let mode = 'title';
  let pointer = null;
  let uiHidden = false;
  let petTimes = [];
  let stroke = null; // { count, pressAt: {cx, cy}, pressT, onDog, swished }
  let assistAt = -1;
  // Game-time timers: they stop while the game is paused (setTimeout would not).
  const timers = [];
  function later(sec, fn) {
    timers.push({ at: time + sec, fn });
  }
  function runTimers() {
    for (let i = timers.length - 1; i >= 0; i--) {
      if (time >= timers[i].at) {
        const t = timers.splice(i, 1)[0];
        t.fn();
      }
    }
  }

  // ---------- geometry ----------

  const L = () => vp.layout;
  const Z = () => vp.layout.zones;
  const A = () => ARENA[vp.layout.mode];
  const px = () => (vp.kx || 1) * vp.layout.s; // backing pixels per lu (for baked sprites)
  const itemScale = () => (L().compact ? 1.3 : L().mode === 'portrait' ? 1.15 : 1);
  const bottomY = () => Math.max(L().view.y1, L().box.h) + 140;

  function binPoint() {
    const z = Z().bin;
    return { x: z.x + z.w / 2, y: z.y + 6 };
  }
  function bowlPoint() {
    const g = bowlGeometry(Z().bowl);
    return { x: g.cx, y: g.rimY - 10 };
  }
  function stampPoint() {
    const a = A();
    return { x: (a.x0 + a.x1) / 2, y: Math.max(a.stampY, L().view.y0 + 90 / L().s) };
  }

  // ---------- run / shift lifecycle ----------

  // gameMode: 'sort' (Sort & Feed, main) or 'rush' (Slice Rush).
  // opts.training: run the tutorial even if it was done before.
  function start(gameMode = 'sort', opts = {}) {
    timers.length = 0;
    fx.clear();
    cancelPointer();
    const seed = (Math.random() * 4294967296) >>> 0;
    rng = makeRng(seed);
    const saved = storage.get();
    const tutBit = gameMode === 'rush' ? 2 : 1;
    run = {
      mode: gameMode === 'rush' ? 'rush' : 'sort',
      tutBit,
      seed,
      index: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      stars: [],
      slices: 0,
      bestMulti: 0,
      treats: 0,
      leftAlone: 0,
      resisted: 0,
      saves: 0,
      tummy: TUMMY.start,
      coma: 0,
      slowUntil: 0,
      seen: new Map(),
      hints: saved.hints ? 'always' : 'first',
      tutorial: (saved.tutorialDone & tutBit) && !opts.training ? null : { step: 0, body: null, wait: 0, pieces: [] },
      phase: 'card',
      shift: null,
      aiIndex: 0,
      mitts: [],
      napUntil: 0,
      binLid: 0,
      lastWhine: 0,
      picks: [],
      tune: { ...BASE_TUNE },
      boosts: { freezer: 0, zoomies: 0, blender: 0 },
      shields: 0,
      held: null, // a tray piece being dragged: { piece, offsetY, samples, last }
      selected: null, // tap-tap: a tray piece waiting for a target
      goodBoy: 0,
      lastTreatAt: -9,
      recentEats: [],
      jamCount: 0,
      jamCooldownUntil: 0,
      lastMissLineAt: -99,
    };
    mode = 'game';
    dog.setBase('idle');
    beginShift(0);
  }

  function beginShift(i) {
    run.index = i;
    const def = SHIFTS[i];
    // The layout may not exist yet if PLAY is pressed before the first frame.
    const sort = run.mode === 'sort';
    const plan = planShift(rng, i, { compact: !!(vp.layout && vp.layout.compact), goldenK: run.tune.goldenK, sort });
    const timer = sort ? def.timerSort : def.timer;
    run.shift = {
      def,
      index: i,
      plan,
      next: 0,
      tau: 0,
      timer,
      startScore: run.score,
      timerOn: false,
      produce: 0,
      extraProduce: 0,
      sliced: 0,
      misses: 0,
      strikes: 0,
      freeBlocks: run.tune.freeBlocks,
      bodies: [],
      halves: [],
      flights: [], // treats, scraps and the ball
      bowl: [],
      // Sort & Feed: pieces on the tray and in the air between the tray and a target.
      pieces: [],
      tray: Array((vp.layout ? vp.layout.zones : null) && vp.layout.zones.tray ? vp.layout.zones.tray.slots : 5).fill(null),
      portions: 0,
      errors: 0,
      lost: 0,
      request: null,
      nextRequestAt: time + rng.range(def.requestEvery[0], def.requestEvery[1]),
      events: run.tutorial ? [] : planEvents(rng, i, timer, def.events),
      event: null,
      puppy: null,
      prepAt: 10,
      wrapT: 0,
      ended: false,
    };
    run.phase = 'card';
    // The card names the bombs that are new this shift.
    const newNo = [];
    for (const id of pools(i).bombs) if (INGREDIENTS[id].from === i) newNo.push(INGREDIENTS[id].label);
    pushHud();
    const thisShift = run.shift;
    const cardSeconds = ui.shiftCard(
      // The very first run starts with the training: its own card, not the Monday one.
      run.tutorial
        ? { day: def.day, name: S.training, header: S.trainingHeader, joke: run.mode === 'sort' ? S.trainingJokeSort : S.trainingJoke, newNo: [], short: false }
        : { day: def.day, name: def.name, header: S.aiHeader(def.confidence), joke: def.joke, newNo, short: false },
      () => {
        if (!run || run.shift !== thisShift) return;
        run.phase = 'play';
        thisShift.timerOn = !run.tutorial;
        pushHud();
      },
    );
    later(cardSeconds || 2.6, () => {
      if (run && run.shift === thisShift && run.phase === 'card') ui.skipCard();
    });
  }

  function quota(sh) {
    // Sort & Feed: every produce item is one portion for the bowl.
    if (run.mode === 'sort') return sh.plan.produce + sh.extraProduce;
    return quotaFor(sh.plan.produce + sh.extraProduce);
  }

  function endShift(reason) {
    const sh = run.shift;
    if (sh.ended) return;
    sh.ended = true;
    cancelPointer();
    run.phase = 'end';
    if (sh.event) endEvent(true);
    // Pieces still on the tray when the shift ends are lost.
    for (const p of sh.pieces) if (p.kind === 'dish' && p.cat === 'ok') sh.lost++;
    const stars = run.mode === 'sort'
      ? sortStars({ portions: sh.portions, total: Math.max(1, sh.produce), errors: sh.errors, strikes: sh.strikes })
      : shiftStars({ sliced: sh.sliced, produce: Math.max(1, sh.produce), strikes: sh.strikes });
    if (stars === 3) run.score += POINTS.threeStars;
    run.stars.push(stars);
    if (stars > 0) sfx.play('star');
    sh.bodies.length = 0;
    sh.halves.length = 0;
    sh.flights.length = 0;
    sh.pieces.length = 0;
    sh.tray.fill(null);
    run.held = null;
    run.selected = null;
    sh.request = null;
    sh.puppy = null;
    run.mitts.length = 0;
    run.boosts = { freezer: 0, zoomies: 0, blender: 0 };
    fx.clearBubble();
    pushHud();
    const thisRun = run;
    // The shift's own score goes to this level's top list (records on this device only).
    const shiftScore = run.score - sh.startScore;
    const place = storage.addTop ? storage.addTop(run.mode, sh.def.id, shiftScore) : 0;
    ui.shiftEnd({ day: sh.def.day, stars, score: run.score, shiftScore, place, reason });
    later(2.2, () => {
      // A restart may have started a new run meanwhile; this timer belongs to the old one.
      if (!run || run !== thisRun) return;
      ui.hideShiftEnd();
      if (run.index + 1 < SHIFTS.length) showCards(stars === 3);
      else finishRun();
    });
  }

  function showCards(rareSlot) {
    run.phase = 'cards';
    const cards = drawCards(rng, run.picks, rareSlot);
    const thisRun = run;
    const pick = id => {
      if (!run || run !== thisRun || run.phase !== 'cards') return;
      const card = cards.find(c => c.id === id) || cards[0];
      if (card) {
        run.picks.push(card.id);
        run.tune = tuneFor(run.picks);
      }
      beginShift(run.index + 1);
      if (card) ui.aiLine(card.line, 2400, 0);
    };
    if (ui.cards && cards.length) ui.cards(cards, pick);
    else pick(cards[0] && cards[0].id);
  }

  function finishRun() {
    run.phase = 'report';
    const saved = storage.get();
    const totalStars = run.stars.reduce((a, b) => a + b, 0);
    const newBest = run.score > (saved.best || 0);
    const unlocks = newlyUnlocked(saved.best || 0, Math.max(saved.best || 0, run.score)).map(s => s.name);
    storage.save({ best: Math.max(saved.best || 0, run.score), bestStars: Math.max(saved.bestStars || 0, totalStars) });
    const place = storage.addTop ? storage.addTop(run.mode, 'run', run.score) : 0;
    dog.setBase('coma');
    ui.report({
      score: run.score,
      best: Math.max(saved.best || 0, run.score),
      hadBest: (saved.best || 0) > 0,
      newBest,
      stars: totalStars,
      maxStars: SHIFTS.length * 3,
      mode: run.mode,
      place,
      unlocks,
      slices: run.slices,
      bestMulti: run.bestMulti,
      treats: run.treats,
      leftAlone: run.leftAlone,
      resisted: run.resisted,
      saves: run.saves,
      rank: S.ranks[rankFor(totalStars)],
    });
  }

  function toTitle() {
    cancelPointer();
    timers.length = 0;
    run = null;
    mode = 'title';
    fx.clear();
    dog.setBase('title');
    dog.play('sulk', { now: true, clear: true });
  }

  // ---------- tossing ----------

  function seenCount(key) {
    return run.seen.get(key) || 0;
  }
  function seenAdd(key) {
    run.seen.set(key, seenCount(key) + 1);
  }

  // Spawns one whole item below the screen with a velocity that peaks inside the arena.
  // opts: { x0, vx, apex, wait, slow (gravity factor), d }
  function toss(id, variant = null, opts = {}) {
    const sh = run.shift;
    const it = INGREDIENTS[id];
    const a = A();
    const v = L().view;
    const d = opts.d == null ? difficulty(sh.def, sh.tau) : opts.d;
    const f = 1 - 0.12 * d; // later in a shift things fly a bit faster (same height, shorter time)
    let g = (a.g / (f * f)) * (opts.slow || 1);
    if (it.type === 'produce' || it.type === 'toy') g *= run.tune.gravityK;
    const y0 = bottomY() - 40;
    // Peaks stay below the HUD row (about 64 CSS px), so nothing hides under the buttons.
    // A tiny frame (an iframe while it is being laid out) must never push the peak below the launch point.
    const apex = Math.min(
      Math.max(opts.apex == null ? rng.range(a.apex0, a.apex1) : opts.apex, v.y0 + Math.max(70, 64 / L().s + it.size[1] * 0.6)),
      y0 - 300,
    );
    const vy = -Math.sqrt(2 * g * (y0 - apex));
    const T = (2 * -vy) / g;
    const x0 = opts.x0 == null ? rng.range(a.x0, a.x1) : opts.x0;
    let vx = opts.vx;
    if (vx == null) vx = clamp((rng.range(a.x0, a.x1) - x0) / T, -a.maxVx, a.maxVx);
    const k = itemScale();
    const long = it.size[0] > it.size[1] * 1.6;
    const markKey = `mark:${id}`;
    const marker = it.type === 'bomb' || it.type === 'junk' ? run.hints === 'always' || seenCount(markKey) < (id === 'grapes' ? 3 : 2) : false;
    if (it.type === 'bomb' || it.type === 'junk') seenAdd(markKey);
    const body = {
      uid: ++uid,
      id,
      it,
      variant,
      x: x0,
      y: y0,
      vx,
      vy,
      g,
      rot: rng.range(0, TAU),
      vr: (rng.chance(0.5) ? 1 : -1) * rng.range(long ? 1.2 : 2, long ? 1.8 : 3.2),
      size: [it.size[0] * k, it.size[1] * k],
      hits: 0,
      need: it.hits || 1,
      hitAt: -9,
      wait: opts.wait || 0,
      marker,
    };
    sh.bodies.push(body);
    if (it.type === 'produce') sh.produce++;
    if (it.type === 'bomb') onBombTossed(body);
    return body;
  }

  function spawnSalvo(s) {
    const sh = run.shift;
    const a = A();
    const live = sh.bodies.length;
    const cap = L().compact ? 4 : LIMITS.bodies;
    const items = s.items.slice(0, Math.max(1, cap - live));
    // A pending request gets its produce into the next salvo.
    if (sh.request) {
      const i = items.findIndex(x => INGREDIENTS[x.id].type === 'produce' && !x.variant);
      if (i >= 0 && INGREDIENTS[sh.request.ingredient].from <= sh.index && !sh.request.queued) {
        items[i] = { id: sh.request.ingredient, variant: null };
        sh.request.queued = true;
      }
    }
    const fanX = rng.range(a.x0 + 120, a.x1 - 120);
    items.forEach((x, i) => {
      if (s.pattern === 'fan') {
        const spread = L().mode === 'portrait' ? 130 : 220;
        toss(x.id, x.variant, { x0: fanX, vx: (i - (items.length - 1) / 2) * spread, wait: 0 });
      } else {
        toss(x.id, x.variant, { wait: i * 0.14 });
      }
    });
    if (rng.chance(0.4) && !dog.busy) dog.play('alert');
    sfx.play('boof');
  }

  function onBombTossed(body) {
    const sh = run.shift;
    if (sh.index >= 1 && !sh.puppy && !run.tutorial && rng.chance(0.3) && run.coma <= 0 && !sh.event) {
      sh.puppy = { uid: body.uid, t: 0 };
      sfx.play('whine');
    }
  }

  // ---------- slicing ----------

  function boostOn(name) {
    return run.boosts[name] > time;
  }

  function bladePad(body, pointerType) {
    const it = body.it;
    if (it.type === 'bomb') return -body.size[1] * 0.12; // harder to touch by accident
    let k = run.tune.bladeK * (boostOn('blender') ? 1.8 : 1);
    const touch = pointerType === 'touch' ? 8 / L().s : 0;
    return (body.size[1] / 2) * (k - 1) + Math.max(10, 8 / L().s) + touch;
  }

  function bladeSegment(seg, pointerType) {
    const sh = run.shift;
    const minSpeed = MIN_SPEED_CSS * (L().compact ? 0.8 : 1);
    if (seg.speed < minSpeed) return;
    if (!stroke.swished && seg.speed > minSpeed * 2) {
      stroke.swished = true;
      sfx.play('swish', 0.5);
    }
    const angle = Math.atan2(seg.by - seg.ay, seg.bx - seg.ax);
    for (const body of sh.bodies.slice()) {
      if (body.wait > 0 || time - body.hitAt < 0.15) continue;
      const hit = segmentHitsItem(seg.ax, seg.ay, seg.bx, seg.by, body.x, body.y, body.rot, body.size[0], body.size[1], bladePad(body, pointerType));
      if (hit < 0) continue;
      sliceBody(body, angle, false, cutOffset(seg, angle, body.x, body.y, body.rot, body.size));
      if (!blade.active) return; // a hard item stopped the stroke
    }
    // Pieces in the air can be cut again (halves into quarters, quarters into eighths).
    for (const h of sh.halves.slice()) {
      if (h.depth >= 3 || time - h.born < 0.12 || !sh.halves.includes(h)) continue;
      const rot = h.rot + h.spin;
      const s = segmentHitsItem(seg.ax, seg.ay, seg.bx, seg.by, h.x, h.y, rot, h.size[0], h.size[1], 4);
      if (s < 0) continue;
      // The hit point must be on this piece, not on the part that already flew away.
      const hx = seg.ax + (seg.bx - seg.ax) * s - h.x;
      const hy = seg.ay + (seg.by - seg.ay) * s - h.y;
      const qx = hx * Math.cos(-rot) - hy * Math.sin(-rot);
      const qy = hx * Math.sin(-rot) + hy * Math.cos(-rot);
      const inside = h.planes.every(pl => ((-Math.sin(pl.la) * qx + Math.cos(pl.la) * qy) - pl.d) * pl.side >= -6);
      if (!inside) continue;
      dicePiece(h, angle, cutOffset(seg, angle, h.x, h.y, rot, h.size, 0.9));
    }
  }

  // Where the swipe crossed an item: the signed distance of the cut line from the item's center (lu),
  // kept inside the item so both pieces are real.
  function cutOffset(seg, angle, cx, cy, rot, size, keep = 0.7) {
    const d = (seg.ax - cx) * -Math.sin(angle) + (seg.ay - cy) * Math.cos(angle);
    const lim = supportAlong(size, angle - rot) * keep;
    return clamp(d, -lim, lim);
  }

  // A falling piece cut again: two smaller pieces, a little juice, a small bonus.
  function dicePiece(h, angle, d) {
    const sh = run.shift;
    const k = sh.halves.indexOf(h);
    if (k < 0) return;
    sh.halves.splice(k, 1);
    const la = angle - (h.rot + h.spin);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    for (const side of [-1, 1]) {
      if (sh.halves.length >= LIMITS.halves) sh.halves.shift();
      sh.halves.push({
        ...h,
        planes: [...h.planes, { la, d, side }],
        depth: h.depth + 1,
        born: time,
        x: h.x + nx * side * 4,
        y: h.y + ny * side * 4,
        vx: h.vx + nx * side * 120,
        vy: Math.min(h.vy, 0) + ny * side * 120 - 120,
        vr: h.vr + side * rng.range(1, 2.5),
      });
    }
    const it = INGREDIENTS[h.id];
    fx.juice(h.x, h.y, it.juice, 4);
    sfx.play('chop');
    if (it.type === 'produce') {
      addScore(POINTS.dice);
      fx.text(`+${POINTS.dice}`, h.x, h.y - 40, PALETTE.ui.good, 26);
    }
  }

  function removeBody(body) {
    const sh = run.shift;
    const k = sh.bodies.indexOf(body);
    if (k >= 0) sh.bodies.splice(k, 1);
  }

  function multiplier() {
    return comboMultiplier(run.streak);
  }

  // d: where the cut line passes, as a signed distance from the item's center (0 = through the middle).
  function sliceBody(body, angle, auto, d = 0) {
    const sh = run.shift;
    const it = body.it;
    if (it.type === 'toy') {
      batBall(body);
      return;
    }
    // Big items crack first.
    if (it.type === 'produce' && body.hits + 1 < body.need) {
      body.hits++;
      body.hitAt = time;
      body.vy = Math.min(body.vy, -260);
      fx.juice(body.x, body.y, it.juice, 6);
      sfx.play('chop');
      addScore(POINTS.crack);
      fx.text(`+${POINTS.crack}`, body.x, body.y - body.size[1] * 0.6, INK, 30);
      return;
    }
    const shield = it.type === 'bomb' && (sh.freeBlocks > 0 || run.shields > 0);
    const r = resolveSlice(body.id, { shield, tutorial: !!run.tutorial });
    if (r.stopStroke) {
      // A wooden spoon: clank, bounce off, and the stroke ends.
      body.hitAt = time + 0.35;
      body.vx = -body.vx * 0.6 + (rng.chance(0.5) ? 120 : -120);
      body.vy = Math.min(body.vy, -200);
      body.vr *= -2;
      sfx.play('clank');
      fx.sparkle(body.x, body.y);
      junkResult(body, r);
      blade.end();
      return;
    }
    removeBody(body);
    if (it.type === 'produce') {
      produceSliced(body, angle, auto, d);
      return;
    }
    if (it.type === 'bomb') {
      bombSliced(body, angle, r, shield, d);
      return;
    }
    // Junk that splits (a sponge).
    spawnHalves(body, angle, d);
    junkResult(body, r);
  }

  function junkResult(body, r) {
    breakStreak();
    if (r.points) addScore(r.points);
    const sp = stampPoint();
    fx.stamp(S.notFood, PALETTE.ui.warn, sp.x, sp.y);
    sfx.play('stamp', false);
    if (r.points) fx.text(`${r.points}`, body.x, body.y - 60, PALETTE.ui.danger, 34);
    aiLine(S.aiNotFood);
  }

  // Two pieces split along the cut line (wherever the swipe crossed). Each piece keeps the item's center as its
  // origin and a list of cut planes in the item's frame, so it can be cut again later.
  function spawnHalves(body, angle, d = 0) {
    const sh = run.shift;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const la = angle - body.rot;
    for (const side of [-1, 1]) {
      if (sh.halves.length >= LIMITS.halves) sh.halves.shift();
      sh.halves.push({
        id: body.id,
        size: body.size,
        rot: body.rot,
        spin: 0, // pieces turn as a whole: the item and its cut lines rotate together
        planes: [{ la, d, side }],
        depth: 1,
        born: time,
        x: body.x + nx * side * 6,
        y: body.y + ny * side * 6,
        vx: body.vx * 0.5 + nx * side * 150,
        vy: Math.min(body.vy * 0.4, 60) + ny * side * 150 - 80,
        vr: side * rng.range(1.5, 3),
        g: body.g * 1.15,
      });
    }
  }

  function produceSliced(body, angle, auto, d = 0) {
    const sh = run.shift;
    const it = body.it;
    spawnHalves(body, angle, d);
    fx.juice(body.x, body.y, it.juice, 8);
    sfx.play('chop');
    sfx.play(it.sound === 'squish' ? 'squish' : 'crunch');
    sh.sliced++;
    run.slices++;
    const sort = run.mode === 'sort';
    if (!sort && sh.bowl.length < 12) sh.bowl.push(body.id);
    if (stroke && !auto) stroke.count++;
    run.streak++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    const pts = Math.round((sort ? DROP_POINTS.slice : POINTS.slice) * multiplier());
    addScore(pts);
    fx.text(`+${pts}`, body.x, body.y - body.size[1] * 0.6, PALETTE.ui.good, 32);
    if (run.streak > 0 && run.streak % 10 === 0) {
      fx.text(S.combo(run.streak), body.x, body.y - body.size[1] - 40, PALETTE.ui.primaryLip, 42);
      if (!dog.busy) dog.play('happy');
    }
    if (body.variant === 'golden') {
      addScore(POINTS.golden);
      fx.text(S.golden, body.x, body.y - 120, PALETTE.ui.primaryLip, 44);
      fx.sparkle(body.x, body.y);
    } else if (body.variant === 'frozen') {
      fx.sparkle(body.x, body.y);
      activateBoost('freezer');
    }
    if (sort) {
      // Sort & Feed: the pieces drop onto the tray, and the player sends each one.
      const made = piecesOf(body.id).map((spec, k) => spawnPiece(spec, { x: body.x, y: body.y }, k * 0.08)).filter(Boolean);
      if (run.tutorial && run.tutorial.body === body) {
        run.tutorial.body = null;
        run.tutorial.pieces = made;
        run.tutorial.sorting = true;
      }
      return;
    }
    // Scrap to the bin (peels, ends, pits, cores).
    if (it.scrap) {
      sh.flights.push({ kind: 'scrap', id: body.id, itemId: it.scrap.id, from: { x: body.x, y: body.y }, to: binPoint(), t: 0, dur: 0.55, arc: 140, x: body.x, y: body.y, rot: 0 });
    }
    // A spare bit for Crumb, sometimes.
    const requested = sh.request && sh.request.ingredient === body.id;
    const chance = TREAT_CHANCE[sh.index] * run.tune.treatK + (boostOn('zoomies') ? 0.3 : 0);
    if (run.coma <= 0 && time - run.lastTreatAt >= 0.7 && (requested || rng.chance(chance) || (run.tutorial && run.tutorial.step === 0))) {
      run.lastTreatAt = time;
      const to = dog.anchor('mouth');
      const dist = Math.hypot(to.x - body.x, to.y - body.y);
      sh.flights.push({
        kind: 'treat',
        id: body.id,
        part: { kind: 'spare', cat: it.spare, ingredient: body.id },
        from: { x: body.x, y: body.y },
        to,
        t: 0,
        dur: clamp(0.4 + dist / 3000, 0.4, 0.75),
        arc: Math.min(220, dist * 0.3),
        x: body.x,
        y: body.y,
        rot: 0,
        mouth: false,
      });
    }
    if (run.tutorial && run.tutorial.body === body) run.tutorial.done = true;
  }

  function bombSliced(body, angle, r, shield, d = 0) {
    const sh = run.shift;
    const it = body.it;
    breakStreak();
    fx.juice(body.x, body.y, it.juice, 6);
    sfx.play('mitt');
    sfx.play('stamp', true);
    const v = L().view;
    run.mitts.push({ id: body.id, size: body.size, rot: body.rot, cutA: angle, la: angle - body.rot, d, phase: 'in', t: 0, from: { x: v.x0 - 120, y: body.y + 40 }, at: { x: body.x, y: body.y }, x: body.x, y: body.y });
    run.slowUntil = time + 0.25;
    run.saves++;
    const sp = stampPoint();
    if (shield) {
      if (sh.freeBlocks > 0) sh.freeBlocks--;
      else run.shields--;
      fx.stamp(S.freeTrial, PALETTE.ui.good, sp.x, sp.y);
      ui.aiLine(S.boosters.shield.line, 2200, 1);
    } else {
      fx.stamp(S.blocked, PALETTE.ui.danger, sp.x, sp.y);
      if (r.points) {
        addScore(r.points);
        fx.text(`${r.points}`, body.x, body.y - 70, PALETTE.ui.danger, 38);
      }
      // The first block of each item explains why (a vet-sourced fact line); after that, jokes.
      const factKey = `fact:${body.id}`;
      if (!seenCount(factKey) && FACTS[body.id]) {
        seenAdd(factKey);
        ui.aiLine(FACTS[body.id], 3200, 1);
      } else aiLine(S.aiBlocked);
      if (r.strike) addStrike();
    }
    if (sh.puppy && sh.puppy.uid === body.uid) sh.puppy = null;
    dog.play('confused', { now: true, clear: true });
    sayAside(S.question, 0.9);
    if (run.tutorial && run.tutorial.body === body) run.tutorial.done = true;
  }

  function addStrike() {
    const sh = run.shift;
    sh.strikes++;
    pushHud();
    if (sh.strikes >= run.tune.maxStrikes) {
      ui.aiLine(S.strikeOut, 3200, 2);
      run.napUntil = time + 3;
      later(1.6, () => {
        if (run && run.shift === sh && !sh.ended) endShift('strikes');
      });
    }
  }

  function breakStreak() {
    run.streak = 0;
  }

  function batBall(body) {
    const sh = run.shift;
    removeBody(body);
    const to = dog.anchor('mouth');
    const dist = Math.hypot(to.x - body.x, to.y - body.y);
    sh.flights.push({ kind: 'ball', id: 'ball', from: { x: body.x, y: body.y }, to, t: 0, dur: clamp(0.35 + dist / 3200, 0.35, 0.6), arc: Math.min(240, dist * 0.35), x: body.x, y: body.y, rot: body.rot, size: body.size });
    sfx.play('squeak');
  }

  function activateBoost(name) {
    if (name === 'shield') {
      run.shields++;
    } else {
      const base = Math.max(run.boosts[name], time);
      // A repeat extends by half the base time instead of stacking.
      run.boosts[name] = run.boosts[name] > time ? base + BOOST_SECONDS[name] * 0.5 * run.tune.boostK : time + BOOST_SECONDS[name] * run.tune.boostK;
    }
    sfx.play('power');
    const sp = stampPoint();
    fx.text(S.boosters[name].name, sp.x, sp.y + 70, PALETTE.ui.primaryLip, 46);
    ui.aiLine(S.boosters[name].line, 2200, 0);
  }

  function addGoodBoy(n) {
    run.goodBoy += n;
    if (run.goodBoy >= 100) {
      run.goodBoy = 0;
      const h = dog.anchor('heart');
      fx.text(S.goodBoyBonus, h.x + 160, h.y - 60, PALETTE.ui.heart, 40);
      sfx.play('yap');
      activateBoost(rng.chance(0.5) ? 'blender' : 'shield');
    }
  }

  // ---------- flights (treats, scraps, ball) ----------

  function stepFlights(dt) {
    const sh = run.shift;
    for (const f of sh.flights.slice()) {
      f.t += dt / f.dur;
      const t = Math.min(1, f.t);
      f.x = f.from.x + (f.to.x - f.from.x) * t;
      f.y = f.from.y + (f.to.y - f.from.y) * t - 4 * f.arc * t * (1 - t);
      f.rot += dt * 8;
      if (f.kind === 'treat' && !f.mouth && (1 - t) * f.dur <= 0.15 && canFeed(f.part, dogState())) {
        f.mouth = true;
        dog.eat(INGREDIENTS[f.id].bites || 3);
      }
      if (f.t < 1) continue;
      sh.flights.splice(sh.flights.indexOf(f), 1);
      if (f.kind === 'scrap') sfx.play('bin');
      else if (f.kind === 'treat') treatArrived(f);
      else if (f.kind === 'ball') ballArrived(f);
    }
  }

  function dogState() {
    const sh = run.shift;
    return { coma: run.coma > 0, jammed: !!(sh && sh.event && sh.event.id === 'jammed'), request: sh && sh.request ? sh.request.ingredient : null };
  }

  function treatArrived(f) {
    const sh = run.shift;
    const r = resolveTreat(f.part, dogState());
    if (!r.eaten) {
      fx.text(S.boing, f.to.x + 40, f.to.y - 30, INK, 34);
      sfx.play('tap');
      return;
    }
    run.tummy = Math.min(run.tune.comaAt, run.tummy + r.tummy);
    run.treats++;
    let pts = r.points;
    if (r.requestMet) pts = POINTS.treat + Math.round(POINTS.request * run.tune.requestK);
    if (boostOn('zoomies')) pts *= 3;
    addScore(pts);
    fx.crumbs(f.to.x, f.to.y, INGREDIENTS[f.id].juice, 6);
    const h = dog.anchor('heart');
    fx.hearts(h.x, h.y, r.requestMet ? 2 : 1);
    fx.text(`+${pts}`, h.x + 60, h.y - 40, PALETTE.ui.good, 30);
    sfx.play('crunch');
    later(0.22, () => sfx.play('chew'));
    addGoodBoy(r.requestMet ? 25 : 10);
    if (r.requestMet) {
      sh.request = null;
      dog.play('tippy');
      sh.nextRequestAt = time + rng.range(sh.def.requestEvery[0], sh.def.requestEvery[1]);
    }
    // Eating too fast jams the disposal.
    run.recentEats = run.recentEats.filter(t => time - t < 3);
    run.recentEats.push(time);
    if (run.recentEats.length >= 3 && run.tummy >= 40 && run.jamCount < 2 && time >= run.jamCooldownUntil && !sh.event && !run.tutorial && sh.timerOn) {
      startEvent('jammed');
    }
  }

  function ballArrived(f) {
    dog.play('catch', { now: true, clear: true });
    sfx.play('squeak');
    sfx.play('yap');
    later(0.4, () => {
      if (run && run.phase === 'play') dog.play('zoomies');
    });
    const h = dog.anchor('heart');
    fx.hearts(h.x, h.y, 2);
    activateBoost('zoomies');
  }

  // ---------- Sort & Feed: the tray and throws ----------

  function traySlot(i) {
    const z = Z().tray;
    const sw = z.w / z.slots;
    return { x: z.x + sw * (i + 0.5), y: z.y + z.h / 2 };
  }
  function pieceScale() {
    const z = Z().tray;
    return Math.min(0.9, z.w / z.slots / 110) * (L().compact ? 1.2 : 1);
  }
  function targetPoint(target) {
    if (target === 'dog') return dog.anchor('mouth');
    if (target === 'bowl') return bowlPoint();
    return binPoint();
  }
  function zoneHit(name, p) {
    const r = hitRectCss(L(), name);
    return p.cx >= r.x && p.cx <= r.x + r.w && p.cy >= r.y && p.cy <= r.y + r.h;
  }
  function targetAt(p) {
    if (zoneHit('bin', p)) return 'bin';
    if (zoneHit('bowl', p)) return 'bowl';
    if (zoneHit('sink', p)) return 'dog';
    return null;
  }
  // Where a piece should go: the sliced pile to the bowl, the plain spare bit to the dog, the rest to the bin.
  function correctTarget(piece) {
    if (piece.kind === 'dish') return 'bowl';
    if (piece.kind === 'spare' && piece.cat === 'ok') return 'dog';
    return 'bin';
  }

  function spawnPiece(spec, from, delay = 0) {
    const sh = run.shift;
    const i = sh.tray.indexOf(null);
    if (i < 0) {
      // Tray full: the piece falls off the counter.
      if (spec.kind === 'dish') sh.lost++;
      addScore(DROP_POINTS.trayFull);
      if (time - (run.trayFullAt || -9) > 0.6) {
        run.trayFullAt = time;
        fx.text(S.trayFull, from.x, from.y - 70, PALETTE.ui.danger, 36);
        sfx.play('nope');
      }
      return null;
    }
    const markKey = `pmark:${spec.kind}:${spec.itemId}`;
    const piece = {
      id: ++uid,
      kind: spec.kind,
      ingredient: spec.ingredient,
      itemId: spec.itemId,
      cat: spec.cat,
      label: spec.label,
      state: 'hop',
      slot: i,
      x: from.x,
      y: from.y,
      rot: 0,
      anim: { kind: 'hop', from: { ...from }, to: traySlot(i), t: -delay / 0.35, dur: 0.35, arc: 90 },
      marker: spec.cat !== 'ok' && (run.hints === 'always' || seenCount(markKey) < 2),
    };
    seenAdd(markKey);
    sh.tray[i] = piece;
    sh.pieces.push(piece);
    return piece;
  }

  function releaseSlot(piece) {
    const sh = run.shift;
    if (piece.slot >= 0 && sh.tray[piece.slot] === piece) sh.tray[piece.slot] = null;
    piece.slot = -1;
  }
  function removePiece(piece) {
    releaseSlot(piece);
    piece.state = 'done';
    const arr = run.shift.pieces;
    const k = arr.indexOf(piece);
    if (k >= 0) arr.splice(k, 1);
    if (run.selected === piece) run.selected = null;
  }
  // A held piece keeps its slot, so it can always go back.
  function returnHome(piece) {
    const sh = run.shift;
    let i = piece.slot;
    if (i < 0 || sh.tray[i] !== piece) {
      i = sh.tray.indexOf(null);
      if (i < 0) {
        removePiece(piece);
        return;
      }
      sh.tray[i] = piece;
      piece.slot = i;
    }
    piece.state = 'hop';
    piece.anim = { kind: 'hop', from: { x: piece.x, y: piece.y }, to: traySlot(i), t: 0, dur: 0.25, arc: 40 };
  }

  function launch(piece, target) {
    if (!piece || piece.state === 'done') return;
    releaseSlot(piece);
    const from = { x: piece.x, y: piece.y };
    const to = targetPoint(target);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const ds = dogState();
    piece.state = 'fly';
    piece.anim = {
      kind: 'fly',
      from,
      to,
      t: 0,
      dur: clamp(0.35 + dist / 4000, 0.35, 0.5),
      arc: Math.min(180, dist * 0.35),
      target,
      intercept: target === 'dog' && piece.cat !== 'ok' ? 0.6 : null,
      coma: target === 'dog' && (ds.coma || ds.jammed),
      mouth: false,
    };
    if (run.selected === piece) run.selected = null;
    sfx.play('swish', 0.6);
  }

  function stepPieces(dt) {
    const sh = run.shift;
    for (const piece of sh.pieces.slice()) {
      const a = piece.anim;
      if (!a) continue;
      a.t += dt / a.dur;
      if (a.t < 0) continue;
      const t = Math.min(1, a.t);
      const k = a.kind === 'fly' ? t : ease.outQuad(t);
      piece.x = a.from.x + (a.to.x - a.from.x) * k;
      piece.y = a.from.y + (a.to.y - a.from.y) * k - 4 * a.arc * k * (1 - k);
      if (a.kind === 'fly') {
        piece.rot += dt * 9;
        if (a.target === 'dog' && a.intercept === null && !a.coma && !a.mouth && (1 - t) * a.dur <= 0.15) {
          a.mouth = true;
          dog.eat(INGREDIENTS[piece.ingredient].bites || 3);
        }
        if (a.intercept !== null && t >= a.intercept) {
          piece.anim = null;
          startPieceMitt(piece, resolveDrop(piece, 'dog', dogState()));
          continue;
        }
      }
      if (a.t >= 1) {
        piece.anim = null;
        if (a.kind === 'fly') arrive(piece, a);
        else {
          piece.state = 'rest';
          piece.rot = 0;
        }
      }
    }
  }

  // An unsafe piece thrown at the dog: the mitt grabs it mid-air and takes it to the bin.
  function startPieceMitt(piece, result) {
    const sh = run.shift;
    const v = L().view;
    let r = result;
    piece.state = 'mitt';
    run.mitts.push({ piece, phase: 'in', t: 0, from: { x: v.x0 - 120, y: piece.y + 40 }, at: { x: piece.x, y: piece.y }, x: piece.x, y: piece.y });
    run.slowUntil = time + 0.25;
    run.saves++;
    sfx.play('mitt');
    sfx.play('stamp', r.mitt === 'red');
    const sp = stampPoint();
    if (r.strike && (sh.freeBlocks > 0 || run.shields > 0)) {
      if (sh.freeBlocks > 0) sh.freeBlocks--;
      else run.shields--;
      r = { ...r, strike: false, points: 0 };
      fx.stamp(S.freeTrial, PALETTE.ui.good, sp.x, sp.y);
    } else {
      fx.stamp(r.mitt === 'red' ? S.blocked : S.notFood, r.mitt === 'red' ? PALETTE.ui.danger : PALETTE.ui.warn, sp.x, sp.y);
    }
    const factKey = `fact:${piece.itemId}`;
    if (!seenCount(factKey) && FACTS[piece.itemId]) {
      seenAdd(factKey);
      ui.aiLine(FACTS[piece.itemId], 3200, 1);
    } else aiLine(r.mitt === 'red' ? S.aiBlocked : S.aiNotFood);
    dog.play('confused', { now: true, clear: true });
    sayAside(S.question, 0.9);
    applyDrop(r, piece, 'dog');
  }

  function applyDrop(r, piece, target) {
    const sh = run.shift;
    const tut = !!run.tutorial;
    let pts = r.points;
    if (tut && pts < 0) pts = 0;
    if (r.correct) {
      run.streak++;
      run.bestStreak = Math.max(run.bestStreak, run.streak);
      if (pts > 0) pts = Math.round(pts * multiplier());
    }
    if (r.error) {
      breakStreak();
      if (!tut) sh.errors++;
    }
    if (r.strike && !tut) addStrike();
    if (r.portion) {
      sh.portions++;
      if (sh.bowl.length < 12) sh.bowl.push(piece.ingredient);
    }
    if (r.portionLost) sh.lost++;
    if (pts) {
      addScore(pts);
      const p = target === 'dog' ? dog.anchor('heart') : targetPoint(target);
      fx.text(`${pts > 0 ? '+' : ''}${pts}`, p.x + 40, p.y - 40, pts > 0 ? PALETTE.ui.good : PALETTE.ui.danger, 36);
    }
    pushHud();
  }

  function arrive(piece, a) {
    const sh = run.shift;
    const target = a.target;
    const r = resolveDrop(piece, target, dogState());
    if (r.bounce) {
      fx.text(S.boing, a.to.x, a.to.y - 40, INK, 34);
      sfx.play('tap');
      returnHome(piece);
      return;
    }
    removePiece(piece);
    if (target === 'dog') {
      if (r.eaten) {
        if (!a.mouth) dog.eat(INGREDIENTS[piece.ingredient].bites || 3);
        run.tummy = Math.min(run.tune.comaAt, run.tummy + r.tummy);
        run.treats++;
        fx.crumbs(a.to.x, a.to.y, INGREDIENTS[piece.ingredient].juice, 6);
        const h = dog.anchor('heart');
        fx.hearts(h.x, h.y, r.result === 'fed' ? 2 : 1);
        sfx.play('crunch');
        later(0.22, () => sfx.play('chew'));
        if (r.result === 'dishEaten') {
          const b = dog.anchor('bubble');
          fx.text(S.eatenByAppliance, b.x + 120, b.y, PALETTE.ui.danger, 30);
        } else addGoodBoy(r.requestMet ? 25 : 10);
        if (r.requestMet) {
          sh.request = null;
          dog.play('tippy');
          sh.nextRequestAt = time + rng.range(sh.def.requestEvery[0], sh.def.requestEvery[1]);
        }
        run.recentEats = run.recentEats.filter(t => time - t < 3);
        run.recentEats.push(time);
        if (run.recentEats.length >= 3 && run.tummy >= 40 && run.jamCount < 2 && time >= run.jamCooldownUntil && !sh.event && !run.tutorial && sh.timerOn) {
          later(0.5, () => {
            if (run && run.shift === sh && !sh.event && run.phase === 'play') startEvent('jammed');
          });
        }
      }
    } else if (target === 'bowl') {
      sfx.play('plop');
      if (r.result === 'ew') {
        const p = targetPoint('bowl');
        fx.text(S.ew, p.x, p.y - 60, PALETTE.ui.danger, 40);
        sfx.play('nope');
      }
    } else {
      sfx.play('bin');
      if (r.result === 'wasted') {
        dog.play('sulk');
        sayAside(S.dots, 1);
      }
    }
    applyDrop(r, piece, target);
  }

  // Tray pieces are grabbed within a finger-sized radius of their slot.
  function pieceAt(p) {
    const sh = run.shift;
    const r = Math.max(60 * pieceScale(), 26 / L().s);
    let best = null;
    let bd = Infinity;
    for (const piece of sh.pieces) {
      if (piece.state !== 'rest') continue;
      const pos = traySlot(piece.slot);
      const d = Math.hypot(pos.x - p.x, pos.y - p.y);
      if (d < r && d < bd) {
        best = piece;
        bd = d;
      }
    }
    return best;
  }

  function grab(piece, p) {
    piece.state = 'held';
    run.held = { piece, offsetY: p.type === 'touch' ? -28 / L().s : 0, samples: [{ cx: p.cx, cy: p.cy, t: p.t }], last: p, pressAt: { cx: p.cx, cy: p.cy }, pressT: p.t };
    piece.x = p.x;
    piece.y = p.y + run.held.offsetY;
    sfx.play('tap');
  }

  // Aim assist: the target whose direction is within 40 degrees of the throw.
  function aim(piece, vx, vy) {
    let best = null;
    let bestAng = (40 * Math.PI) / 180;
    for (const t of ['dog', 'bowl', 'bin']) {
      // The bin is aimed at its middle (its lid is where things land, but the middle reads better as a direction).
      const tp = t === 'bin' ? { x: Z().bin.x + Z().bin.w / 2, y: Z().bin.y + Z().bin.h / 2 } : targetPoint(t);
      const dx = tp.x - piece.x;
      const dy = tp.y - piece.y;
      const ang = Math.abs(Math.atan2(vx * dy - vy * dx, vx * dx + vy * dy));
      if (ang < bestAng) {
        bestAng = ang;
        best = t;
      }
    }
    return best;
  }

  function releaseHeld(type, p) {
    const h = run.held;
    run.held = null;
    const piece = h.piece;
    if (type === 'cancel') {
      returnHome(piece);
      return;
    }
    const tap = Math.hypot(p.cx - h.pressAt.cx, p.cy - h.pressAt.cy) < 10 && p.t - h.pressT < 250;
    if (tap) {
      // Tap-tap: select now, send with the next tap on a target.
      returnHome(piece);
      run.selected = piece;
      return;
    }
    let target = targetAt(p);
    // A flick counts only if the finger was still moving when it let go (last sample under 70 ms ago).
    const s = h.samples;
    const lastS = s[s.length - 1];
    if (!target && s.length >= 2 && p.t - lastS.t < 70) {
      const a = s[0];
      const dtMs = Math.max(1, lastS.t - a.t);
      const vx = (lastS.cx - a.cx) / dtMs;
      const vy = (lastS.cy - a.cy) / dtMs;
      if (Math.hypot(vx, vy) >= 0.5) target = aim(piece, vx, vy);
    }
    if (target) launch(piece, target);
    else returnHome(piece);
  }

  function restPieces() {
    return run.shift.pieces.filter(p => p.state === 'rest');
  }

  function sendKey(target) {
    const list = restPieces();
    const piece = run.selected && list.includes(run.selected) ? run.selected : list[0];
    if (!piece) return;
    const pos = traySlot(piece.slot);
    piece.x = pos.x;
    piece.y = pos.y;
    launch(piece, target);
  }

  // ---------- micro-events ----------

  function startEvent(id) {
    const sh = run.shift;
    const def = EVENTS[id];
    sh.event = { id, t: 0, dur: def.dur, pets: 0, hicAt: 0.4, sneezed: false, said: false, nextDrop: 0.3 };
    ui.aiLine(def.lines[0], 2600, 1);
    if (id === 'jammed') {
      run.jamCount++;
      sfx.play('mmf');
      dog.play('confused', { now: true });
    } else if (id === 'delivery') {
      sfx.play('doorbell');
      later(0.3, () => {
        sfx.play('yap');
        dog.play('yap');
      });
    }
  }

  function endEvent(silent = false) {
    const sh = run.shift;
    const ev = sh.event;
    if (!ev) return;
    sh.event = null;
    if (ev.id === 'jammed') run.jamCooldownUntil = time + 25;
    if (!silent) ui.aiLine(EVENTS[ev.id].end, 2200, 0);
  }

  function updateEvent(dt) {
    const sh = run.shift;
    // Scheduled events start on shift time, one at a time.
    if (!sh.event && sh.events.length && sh.tau >= sh.events[0].at && run.coma <= 0 && sh.timer > 6) {
      startEvent(sh.events.shift().id);
    }
    const ev = sh.event;
    if (!ev) return;
    ev.t += dt;
    if (ev.id === 'jammed') {
      if (ev.t > 1.6 && !ev.said) {
        ev.said = true;
        ui.aiLine(EVENTS.jammed.lines[1], 2400, 1);
      }
    } else if (ev.id === 'hiccups') {
      if (ev.t >= ev.hicAt) {
        ev.hicAt += 1.25;
        sayAside(S.hic, 0.6);
        sfx.play('hic');
        dog.play('alert', { now: true });
        for (const b of sh.bodies) if (b.wait <= 0) b.vy -= 220;
        for (const h of sh.halves) h.vy -= 160;
      }
    } else if (ev.id === 'sneeze') {
      if (!ev.said) {
        ev.said = true;
        sayAside(S.ah, 1.3);
        dog.play('alert', { now: true });
      }
      if (ev.t >= 1.4 && !ev.sneezed) {
        ev.sneezed = true;
        sayAside(S.choo, 0.8);
        sfx.play('sneeze');
        dog.play('confused', { now: true });
      }
      if (ev.t >= 1.4 && ev.t < 2.1) {
        const k = 1100 * dt;
        for (const b of sh.bodies) {
          if (L().mode === 'portrait') b.vy += k * 0.6;
          else b.vx += k;
        }
      }
    } else if (ev.id === 'delivery') {
      ev.nextDrop -= dt;
      if (ev.nextDrop <= 0 && ev.t < ev.dur - 0.6) {
        ev.nextDrop = 0.45;
        const { produce } = pools(sh.index);
        const n = L().compact ? 1 : rng.int(2, 3);
        for (let i = 0; i < n; i++) {
          toss(rng.pick(produce), null, { wait: i * 0.1 });
          sh.extraProduce++;
        }
      }
    }
    if (ev.t >= ev.dur) endEvent();
  }

  function petDog() {
    const sh = run && run.shift;
    if (sh && sh.event && sh.event.id === 'jammed') {
      sh.event.pets++;
      dog.play('pet', { now: true });
      sfx.play('mmf');
      const h = dog.anchor('heart');
      fx.hearts(h.x, h.y, 1);
      if (sh.event.pets >= 3) {
        addScore(20);
        const sp = stampPoint();
        fx.stamp(S.unitCleared, PALETTE.ui.good, sp.x, sp.y);
        sfx.play('gulp');
        sfx.play('ding');
        fx.hearts(h.x, h.y, 3);
        endEvent();
      }
      return;
    }
    petTimes = petTimes.filter(t => time - t < 3);
    petTimes.push(time);
    if (petTimes.length > 5) {
      sayAside(S.thatsEnough, 1.2);
      dog.play('sulk');
      return;
    }
    dog.play('pet');
    sfx.play('mmf');
    const h = dog.anchor('heart');
    fx.hearts(h.x, h.y, 1);
  }

  // ---------- update ----------

  function stepBodies(dt) {
    const sh = run.shift;
    const k = boostOn('freezer') ? 0.45 : 1;
    const bdt = dt * k;
    const bottom = bottomY();
    for (const b of sh.bodies.slice()) {
      if (b.wait > 0) {
        b.wait -= dt;
        continue;
      }
      b.vy += b.g * bdt;
      b.x += b.vx * bdt;
      b.y += b.vy * bdt;
      b.rot += b.vr * bdt;
      if (b.vy > 0 && b.y > bottom) {
        removeBody(b);
        bodyFell(b);
      }
    }
    for (const h of sh.halves.slice()) {
      h.vy += h.g * bdt;
      h.x += h.vx * bdt;
      h.y += h.vy * bdt;
      h.spin += h.vr * bdt;
      if (h.y > bottom) sh.halves.splice(sh.halves.indexOf(h), 1);
    }
  }

  function bodyFell(b) {
    const sh = run.shift;
    const r = resolveFall(b.id);
    if (run.tutorial && run.tutorial.body === b) {
      run.tutorial.done = b.it.type !== 'produce'; // a missed tutorial cucumber comes back
      run.tutorial.body = null;
      if (b.it.type === 'produce') return;
    }
    if (r.miss) {
      sh.misses++;
      breakStreak();
      if (time - run.lastMissLineAt > 9) {
        run.lastMissLineAt = time;
        aiLine(S.aiMissed);
      }
      if (!dog.busy && rng.chance(0.3)) sfx.play('sigh');
    }
    if (r.result === 'leftIt') {
      run.leftAlone++;
      const puppy = sh.puppy && sh.puppy.uid === b.uid;
      const pts = puppy ? POINTS.resisted : r.points;
      addScore(pts);
      const x = clamp(b.x, A().x0, A().x1);
      const y = Math.min(L().view.y1, L().box.h) - 120;
      fx.text(puppy ? S.resisted : S.leftIt, x, y, PALETTE.ui.good, puppy ? 40 : 30);
      if (puppy) {
        sh.puppy = null;
        run.resisted++;
        addGoodBoy(15);
        dog.play('sulk', { now: true, onDone: () => dog.play('happy') });
      }
    }
  }

  function stepMitts(dt) {
    for (const m of run.mitts.slice()) {
      m.t += dt;
      if (m.phase === 'in') {
        const k = ease.outBack(Math.min(1, m.t / 0.18), 1.3);
        m.mx = m.from.x + (m.at.x - m.from.x) * k;
        m.my = m.from.y + (m.at.y - m.from.y) * k;
        if (m.t >= 0.18) {
          m.phase = 'carry';
          m.t = 0;
          m.cfrom = { x: m.x, y: m.y };
          m.to = binPoint();
        }
      } else {
        const k = ease.inOutSine(Math.min(1, m.t / 0.35));
        m.x = m.cfrom.x + (m.to.x - m.cfrom.x) * k;
        m.y = m.cfrom.y + (m.to.y - m.cfrom.y) * k - 60 * Math.sin(Math.PI * k);
        m.mx = m.x;
        m.my = m.y;
        if (m.piece) {
          m.piece.x = m.x;
          m.piece.y = m.y;
        }
        if (m.t >= 0.35) {
          sfx.play('bin');
          if (m.piece) removePiece(m.piece);
          run.mitts.splice(run.mitts.indexOf(m), 1);
        }
      }
    }
  }

  function updateDogState() {
    const sh = run.shift;
    const jam = sh && sh.event && sh.event.id === 'jammed';
    if (run.coma > 0 || time < run.napUntil) dog.setBase('coma');
    else if (jam) dog.setBase('slow');
    else if (sh && sh.puppy) dog.setBase('puppy');
    else if (run.tummy >= TUMMY.slowAt) dog.setBase('slow');
    else if (sh && (sh.bodies.some(b => b.it.type === 'produce' && b.wait <= 0) || sh.pieces.some(p => p.kind === 'spare' && p.cat === 'ok' && (p.state === 'rest' || p.state === 'held')))) dog.setBase('beg');
    else dog.setBase('idle');
    // Gaze: a treat on its way, the puppy-eyes bomb, a golden item, the nearest produce, the pointer.
    let target = null;
    if (sh) {
      const f = sh.flights.find(x => x.kind !== 'scrap');
      if (f) target = f;
      else if (run.held) target = run.held.piece;
      else if (sh.puppy) target = sh.bodies.find(b => b.uid === sh.puppy.uid) || null;
      if (!target) target = sh.bodies.find(b => b.variant === 'golden' && b.wait <= 0) || null;
      if (!target) {
        const m = dog.anchor('mouth');
        let bd = Infinity;
        for (const b of sh.bodies) {
          if (b.wait > 0 || b.it.type !== 'produce') continue;
          const d = Math.hypot(b.x - m.x, b.y - m.y);
          if (d < bd) {
            bd = d;
            target = b;
          }
        }
      }
    }
    dog.look(target ? { x: target.x, y: target.y } : pointer);
  }

  function updateRequests(dt) {
    const sh = run.shift;
    if (!sh.request && time >= sh.nextRequestAt && run.tummy < TUMMY.slowAt && run.coma <= 0 && !run.tutorial && !sh.event) {
      const { produce } = pools(sh.index);
      sh.request = { ingredient: rng.pick(produce), t: 0, life: run.tune.requestLife, queued: false };
      dog.play('yap');
      sfx.play('yap');
    }
    if (sh.request) {
      sh.request.t += dt;
      if (sh.request.t >= sh.request.life) {
        sh.request = null;
        dog.play('sulk');
        sh.nextRequestAt = time + rng.range(sh.def.requestEvery[0], sh.def.requestEvery[1]);
      }
    }
  }

  function updateTutorial() {
    const tut = run.tutorial;
    const sh = run.shift;
    // Sort & Feed: after the first cut, the tutorial waits until its pieces are sent somewhere.
    if (tut.sorting) {
      if (tut.pieces.every(p => p.state === 'done')) {
        tut.sorting = false;
        tut.pieces = [];
        tut.done = true;
      }
      return;
    }
    if (tut.done) {
      tut.done = false;
      tut.body = null;
      tut.step++;
      tut.wait = 0.8;
      if (tut.step >= 2) {
        run.tutorial = null;
        storage.save({ tutorialDone: (storage.get().tutorialDone || 0) | run.tutBit });
        sh.timerOn = true;
        const sp = stampPoint();
        fx.text(S.go, sp.x, sp.y + 60, PALETTE.ui.good, 64);
        sfx.play('ding');
        pushHud();
      }
      return;
    }
    if (tut.body) return;
    if (tut.wait > 0) return;
    const a = A();
    const mid = (a.x0 + a.x1) / 2;
    if (tut.step === 0) {
      tut.body = toss('cucumber', null, { x0: mid, vx: 0, apex: (a.apex0 + a.apex1) / 2, slow: 0.35, d: 0 });
      sh.extraProduce++;
    } else {
      tut.body = toss('chocolate', null, { x0: mid + 80, vx: -20, apex: (a.apex0 + a.apex1) / 2, slow: 0.35, d: 0 });
      tut.body.marker = true;
      ui.aiLine(S.aiTutorialBomb, 3200, 1);
    }
  }

  function update(dtRaw) {
    time += dtRaw;
    runTimers();
    fx.update(dtRaw);
    blade.update(time);
    if (mode !== 'game' || !run) {
      dog.update(dtRaw);
      if (mode === 'title' && Math.random() < dtRaw * 0.4) {
        const p = dog.anchor('heart');
        fx.zzz(p.x + 30, p.y + 40);
      }
      return;
    }
    const scale = time < run.slowUntil ? 0.5 : 1;
    const dt = dtRaw * scale;
    dog.update(dt);
    const sh = run.shift;
    // No layout yet (no frame drawn: hidden tab, iframe not laid out): nothing in the world can move.
    if (run.phase !== 'play' || !sh || !vp.layout) return;

    stepBodies(dt);
    stepFlights(dt);
    stepPieces(dt);
    stepMitts(dt);
    if (sh.puppy) {
      sh.puppy.t += dt;
      if (!sh.bodies.some(b => b.uid === sh.puppy.uid)) sh.puppy = null;
    }

    // Tummy.
    if (run.coma > 0) {
      run.coma -= dt;
      if (Math.random() < dt * 0.5) {
        const p = dog.anchor('heart');
        fx.zzz(p.x + 40, p.y + 30);
      }
      if (run.coma <= 0) run.tummy = TUMMY.afterComa;
    } else {
      // Check the full tummy before it decays, or a treat that fills it to the top would never count.
      if (run.tummy >= run.tune.comaAt) {
        run.coma = TUMMY.comaSeconds;
        sfx.play('snore');
        if (sh.event && sh.event.id === 'jammed') endEvent(true);
      }
      run.tummy = Math.max(0, run.tummy - TUMMY.decayPerSecond * dt);
      if (run.tummy < TUMMY.hungryBelow && time - run.lastWhine > 5) {
        run.lastWhine = time;
        sfx.play('whine');
      }
    }

    updateDogState();

    if (run.tutorial) {
      if (run.tutorial.wait > 0) run.tutorial.wait -= dt;
      updateTutorial();
      return;
    }
    if (!sh.timerOn) return;

    updateRequests(dt);
    updateEvent(dt);

    // Prep Cook (upgrade): SOUS-AI slices one produce item every 10 s.
    if (run.tune.prepCook && sh.tau >= sh.prepAt) {
      sh.prepAt += 10;
      const b = lowestProduce();
      if (b) {
        const a = rng.range(0, Math.PI);
        sliceBody(b, a, true, rng.range(-0.4, 0.4) * supportAlong(b.size, a - b.rot));
      }
    }

    // Timer and the toss plan.
    if (sh.timer > 0) {
      sh.tau += dt;
      const before = Math.ceil(sh.timer);
      sh.timer = Math.max(0, sh.timer - dt);
      if (Math.ceil(sh.timer) !== before) pushHud();
      while (sh.next < sh.plan.salvos.length && sh.plan.salvos[sh.next].t <= sh.tau) spawnSalvo(sh.plan.salvos[sh.next++]);
      if (sh.timer <= 0) {
        const sp = stampPoint();
        fx.text(S.timeUp, sp.x, sp.y + 60, PALETTE.ui.danger, 64);
      }
      // Sort & Feed: everything tossed and sorted before time runs out ends the shift early, with a time bonus.
      if (run.mode === 'sort' && sh.timer > 0 && sh.next >= sh.plan.salvos.length && !sh.bodies.length && !sh.pieces.length && !sh.flights.length && !run.mitts.length && !sh.event) {
        addScore(Math.round(sh.timer) * 5);
        endShift('done');
        return;
      }
    } else {
      // Time is up: let the air clear (at most 3 s), then close the shift.
      sh.wrapT += dt;
      const busy = sh.bodies.length || sh.flights.length || run.mitts.length || sh.pieces.some(p => p.state === 'fly' || p.state === 'mitt');
      if (!busy || sh.wrapT > 3) endShift('time');
      return;
    }

    // Bin lid.
    const overBin = run.held && run.held.last && targetAt(run.held.last) === 'bin';
    const wantOpen = overBin || sh.flights.some(f => f.kind === 'scrap' && f.t > 0.4) || run.mitts.some(m => m.phase === 'carry') || sh.pieces.some(p => p.anim && p.anim.target === 'bin');
    run.binLid += ((wantOpen ? 1 : 0) - run.binLid) * Math.min(1, dt * 14);
  }

  function lowestProduce() {
    let best = null;
    for (const b of run.shift.bodies) {
      if (b.wait > 0 || b.it.type !== 'produce') continue;
      if (!best || b.y > best.y) best = b;
    }
    return best;
  }

  function addScore(n) {
    run.score = Math.max(0, run.score + n);
    pushHud();
  }

  function pushHud() {
    if (!run || !run.shift) return;
    const sh = run.shift;
    ui.hud({
      day: sh.def.day,
      recipe: run.tutorial ? S.training : sh.def.name,
      portions: run.mode === 'sort' ? sh.portions : sh.sliced,
      total: quota(sh),
      timer: Math.ceil(sh.timer),
      score: run.score,
      strikes: sh.strikes,
    });
  }

  function aiLine(list) {
    const line = Array.isArray(list) ? list[run.aiIndex++ % list.length] : list;
    ui.aiLine(line);
  }

  // Short reactions go on the left of the head, so they never cover a request bubble.
  function sayAside(text, life) {
    const h = dog.anchor('bubble');
    const w = Math.max(84, text.length * 19 + 40);
    fx.say(text, h.x - 60 - w / 2, h.y, life);
  }

  // ---------- input ----------

  function cancelPointer() {
    blade.end();
    stroke = null;
    if (run && run.held) {
      returnHome(run.held.piece);
      run.held = null;
    }
  }

  function endStroke() {
    if (!stroke || !run) return;
    const n = stroke.count;
    if (n >= 3) {
      const bonus = Math.round(multiBonus(n) * run.tune.multiK);
      addScore(bonus);
      run.bestMulti = Math.max(run.bestMulti, n);
      const sp = stampPoint();
      fx.text(`${S.multi(n)} +${bonus}`, sp.x, sp.y + 130, PALETTE.ui.primaryLip, 48);
      sfx.play('star');
      if (n >= 5) dog.play('zoomies');
      else if (!dog.busy) dog.play('happy');
    } else if (n > 0) run.bestMulti = Math.max(run.bestMulti, n);
  }

  function pointerEvent(type, p) {
    pointer = { x: p.x, y: p.y, cx: p.cx, cy: p.cy, type: p.type };
    if (mode !== 'game' || !run) return;
    if (run.phase !== 'play') {
      if (type === 'down' && dog.hitHead(p.x, p.y)) petDog();
      if (type === 'up' || type === 'cancel') cancelPointer();
      return;
    }
    const sort = run.mode === 'sort';
    if (type === 'down') {
      if (sort) {
        if (run.held) cancelPointer(); // a stale grab: never leave a piece in the air
        const piece = pieceAt(p);
        if (piece) {
          grab(piece, p);
          return;
        }
        const t = run.selected && targetAt(p);
        if (t) {
          launch(run.selected, t);
          return;
        }
      }
      blade.begin(p, time);
      stroke = { count: 0, pressAt: { cx: p.cx, cy: p.cy }, pressT: p.t, onDog: dog.hitHead(p.x, p.y), swished: false };
      return;
    }
    if (type === 'move') {
      if (run.held) {
        const h = run.held;
        h.piece.x = p.x;
        h.piece.y = p.y + h.offsetY;
        h.samples.push({ cx: p.cx, cy: p.cy, t: p.t });
        while (h.samples.length > 2 && p.t - h.samples[0].t > 80) h.samples.shift();
        h.last = p;
        return;
      }
      if (!blade.active || !stroke) return;
      const seg = blade.move(p, time);
      if (seg) bladeSegment(seg, p.type);
      return;
    }
    if (type === 'up' || type === 'cancel') {
      if (run.held) {
        releaseHeld(type, p);
        return;
      }
      const st = stroke;
      if (st) {
        const tap = Math.hypot(p.cx - st.pressAt.cx, p.cy - st.pressAt.cy) < 12 && p.t - st.pressT < 300;
        endStroke();
        if (tap && st.onDog && type === 'up') petDog();
        else if (tap && run.selected && !targetAt(p)) run.selected = null;
      }
      blade.end();
      stroke = null;
    }
  }

  function keyEvent(action) {
    if (mode !== 'game' || !run || run.phase !== 'play') return false;
    if (action === 'chop') {
      // Assist slice: the lowest produce in the air, never a bomb. No stroke bonus.
      if (time - assistAt < 0.35) return true;
      const b = lowestProduce();
      if (b) {
        assistAt = time;
        const a = rng.range(-0.6, 0.6) + Math.PI / 2;
        sliceBody(b, a, true, rng.range(-0.4, 0.4) * supportAlong(b.size, a - b.rot));
      }
      return true;
    }
    if (run.mode === 'sort') {
      if (action === 'pick1' || action === 'pick2' || action === 'pick3') {
        sendKey(action === 'pick1' ? 'dog' : action === 'pick2' ? 'bowl' : 'bin');
        return true;
      }
      if (action === 'prev' || action === 'next') {
        const list = restPieces();
        if (!list.length) return true;
        const i = run.selected ? list.indexOf(run.selected) : -1;
        const n = list.length;
        run.selected = list[(i + (action === 'next' ? 1 : -1) + n * 2) % n] || list[0];
        return true;
      }
    }
    return false;
  }

  // ---------- render ----------

  function drawBowlContents(ctx) {
    const sh = run && run.shift;
    if (!sh || !sh.bowl.length) return;
    const g = bowlGeometry(Z().bowl);
    const n = sh.bowl.length;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const x = g.cx + (col - 1.5) * g.rx * 0.38 + (row % 2) * 18;
      const y = g.rimY + 4 - row * 18;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.6, 0.6);
      drawPiece(ctx, { kind: 'dish', ingredient: sh.bowl[i] });
      ctx.restore();
    }
  }

  function drawBin(ctx) {
    const z = Z().bin;
    const lid = run ? run.binLid : 0;
    ctx.save();
    ctx.fillStyle = 'rgba(58,36,24,0.18)';
    ctx.beginPath();
    ctx.ellipse(z.x + z.w / 2 + 6, z.y + z.h + 4, z.w * 0.5, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.scene.cabinetShade;
    ctx.beginPath();
    roundRectPath(ctx, z.x + 6, z.y + 12, z.w - 12, z.h - 12, 14);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = PALETTE.ui.paper;
    ctx.font = `800 ${Math.round(Math.min(22, z.h * 0.28))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(S.binLabel, z.x + z.w / 2, z.y + z.h / 2 + 8);
    ctx.translate(z.x + 2, z.y + 12);
    ctx.rotate(-lid * 0.9);
    ctx.fillStyle = '#6A8270';
    ctx.beginPath();
    roundRectPath(ctx, 0, -12, z.w - 4, 16, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  function drawBodies(ctx) {
    const sh = run.shift;
    for (const b of sh.bodies) {
      if (b.wait > 0) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.variant) drawVariantBack(ctx, b.variant, b.size, time);
      ctx.save();
      ctx.rotate(b.rot);
      drawWholeFast(ctx, b.id, b.size, px());
      if (b.hits > 0) {
        // A crack across a big item that needs another hit.
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-b.size[0] * 0.3, -b.size[1] * 0.4);
        ctx.lineTo(-b.size[0] * 0.05, 0);
        ctx.lineTo(-b.size[0] * 0.15, b.size[1] * 0.1);
        ctx.lineTo(b.size[0] * 0.2, b.size[1] * 0.42);
        ctx.stroke();
      }
      ctx.restore();
      if (b.variant) drawVariantFront(ctx, b.variant, b.size, time);
      ctx.restore();
      const puppy = sh.puppy && sh.puppy.uid === b.uid;
      if (puppy && !uiHidden) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, Math.max(b.size[0], b.size[1]) * 0.6 + 6 * Math.sin(time * 10), 0, TAU);
        ctx.lineWidth = 6;
        ctx.strokeStyle = PALETTE.ui.heart;
        ctx.stroke();
      }
      if (b.marker && !uiHidden) {
        const r = Math.max(18, 9 / L().s);
        drawMarker(ctx, b.it.cat, b.x + b.size[0] * 0.38, b.y - b.size[1] * 0.55, r);
      }
    }
  }

  function drawHalves(ctx) {
    for (const h of run.shift.halves) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot + h.spin);
      drawCutPiece(ctx, h.id, h.size, h.planes, px());
      ctx.restore();
    }
  }

  function drawFlights(ctx) {
    const k = itemScale();
    for (const f of run.shift.flights) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      if (f.kind === 'treat') {
        ctx.scale(k, k);
        drawTreat(ctx, f.id);
      } else if (f.kind === 'scrap') {
        ctx.scale(0.8 * k, 0.8 * k);
        drawScrap(ctx, f.itemId);
      } else {
        drawWhole(ctx, 'ball', f.size);
      }
      ctx.restore();
    }
  }

  function drawMitts(ctx) {
    for (const m of run.mitts) {
      if (m.piece) {
        drawPieceAt(ctx, m.piece, m.x, m.y, pieceScale());
        drawMitt(ctx, (m.mx == null ? m.from.x : m.mx) - 10, (m.my == null ? m.from.y : m.my) + 30, 0.25, 0.9 * itemScale());
        continue;
      }
      const split = m.phase === 'in' ? Math.min(1, m.t / 0.18) * 14 : 14;
      const nx = -Math.sin(m.cutA);
      const ny = Math.cos(m.cutA);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(m.x + nx * side * split, m.y + ny * side * split);
        ctx.rotate(m.rot);
        drawCutPiece(ctx, m.id, m.size, [{ la: m.la, d: m.d, side }], px());
        ctx.restore();
      }
      drawMitt(ctx, (m.mx == null ? m.from.x : m.mx) - 10, (m.my == null ? m.from.y : m.my) + 30, 0.25, 0.9 * itemScale());
    }
  }

  // Tutorial: a ghost blade sweeping across the slow cucumber, or "Leave it." over the chocolate.
  function drawTutorial(ctx) {
    const tut = run.tutorial;
    if (!tut || !tut.body || tut.body.wait > 0) return;
    const b = tut.body;
    ctx.save();
    ctx.font = `800 ${Math.round(Math.max(40, 22 / L().s))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    const label = (str, x, y) => {
      ctx.lineWidth = 9;
      ctx.strokeStyle = PALETTE.ui.paper;
      ctx.strokeText(str, x, y);
      ctx.fillStyle = INK;
      ctx.fillText(str, x, y);
    };
    const top = b.y - Math.max(b.size[0], b.size[1]) * 0.7;
    if (tut.step === 0) {
      const ph = (time % 1.1) / 1.1;
      const w = b.size[0] * 0.9;
      const x0 = b.x - w;
      const x1 = b.x + w;
      const xx = x0 + (x1 - x0) * ease.inOutSine(Math.min(1, ph * 1.3));
      ctx.globalAlpha = ph < 0.8 ? 0.9 : (1 - ph) * 4.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, b.y - 40);
      ctx.lineTo(xx, b.y - 40 + (xx - x0) * 0.08);
      ctx.stroke();
      ctx.globalAlpha = 1;
      label(S.swipe, b.x, top - 20);
    } else {
      label(S.leaveItHint, b.x, top - 20);
    }
    ctx.restore();
  }

  // ---------- Sort & Feed drawing ----------

  function drawTray(ctx) {
    const z = Z().tray;
    ctx.save();
    ctx.fillStyle = 'rgba(58,36,24,0.12)';
    ctx.beginPath();
    roundRectPath(ctx, z.x + 4, z.y + 8, z.w, z.h, 22);
    ctx.fill();
    ctx.fillStyle = '#EFE3CC';
    ctx.beginPath();
    roundRectPath(ctx, z.x, z.y, z.w, z.h, 22);
    ctx.fill();
    ctx.strokeStyle = '#D8C9B0';
    ctx.lineWidth = 4;
    ctx.stroke();
    const sw = z.w / z.slots;
    ctx.strokeStyle = 'rgba(58,36,24,0.12)';
    ctx.lineWidth = 3;
    for (let i = 1; i < z.slots; i++) {
      ctx.beginPath();
      ctx.moveTo(z.x + sw * i, z.y + 14);
      ctx.lineTo(z.x + sw * i, z.y + z.h - 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPieceAt(ctx, piece, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    if (piece.rot) ctx.rotate(piece.rot);
    ctx.scale(scale, scale);
    drawPiece(ctx, piece);
    ctx.restore();
    if (piece.marker && piece.state !== 'fly' && !uiHidden) drawMarker(ctx, piece.cat, x + 40 * scale, y - 38 * scale, Math.max(15, 8 / L().s));
  }

  // Tray pieces (resting and hopping); the selected one gets a ring, the puppy-eyes target a pink pulse.
  function drawTrayPieces(ctx) {
    const sh = run.shift;
    const sc = pieceScale();
    for (const piece of sh.pieces) {
      if (piece.state === 'rest') {
        const pos = traySlot(piece.slot);
        if (piece === run.selected && !uiHidden) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 56 * sc, 0, TAU);
          ctx.lineWidth = 6;
          ctx.strokeStyle = PALETTE.ui.primary;
          ctx.stroke();
        }
        drawPieceAt(ctx, piece, pos.x, pos.y, sc);
      } else if (piece.state === 'hop' && piece.anim && piece.anim.t >= 0) drawPieceAt(ctx, piece, piece.x, piece.y, sc);
    }
  }

  function drawMovingPieces(ctx) {
    const sh = run.shift;
    const sc = pieceScale();
    for (const piece of sh.pieces) if (piece.state === 'fly') drawPieceAt(ctx, piece, piece.x, piece.y, sc);
    if (run.held) drawPieceAt(ctx, run.held.piece, run.held.piece.x, run.held.piece.y, sc * 1.1);
  }

  // Tutorial arcs: from a tray piece to where it belongs.
  function drawSortHints(ctx) {
    const tut = run.tutorial;
    if (!tut || !tut.sorting) return;
    const piece = tut.pieces.find(p => p.state === 'rest');
    if (!piece) return;
    const target = correctTarget(piece);
    const a = traySlot(piece.slot);
    const b = targetPoint(target);
    const mx = (a.x + b.x) / 2;
    const my = Math.min(a.y, b.y) - 140;
    ctx.save();
    ctx.setLineDash([16, 14]);
    ctx.lineDashOffset = -time * 60;
    ctx.lineWidth = Math.max(7, 4 / L().s);
    ctx.strokeStyle = 'rgba(58,36,24,0.55)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `800 ${Math.round(Math.max(40, 22 / L().s))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    const text = target === 'bin' ? S.binIt : S.flick;
    ctx.lineWidth = 9;
    ctx.strokeStyle = PALETTE.ui.paper;
    ctx.strokeText(text, mx, my + 10);
    ctx.fillStyle = INK;
    ctx.fillText(text, mx, my + 10);
    ctx.restore();
  }

  // Event banner and booster chips, in CSS pixels at the top center (hidden by H).
  function drawOverlayCss(ctx) {
    const sh = run.shift;
    const chips = [];
    for (const name of ['freezer', 'zoomies', 'blender']) {
      const left = run.boosts[name] - time;
      if (left > 0) chips.push({ text: S.boosters[name].name, left, total: BOOST_SECONDS[name] * run.tune.boostK });
    }
    const shields = run.shields + (sh ? sh.freeBlocks : 0);
    if (shields > 0) chips.push({ text: `${S.boosters.shield.name} ×${shields}`, left: 1, total: 1 });
    const ev = sh && sh.event;
    if (!ev && !chips.length) return;
    const Lx = L();
    const us = Lx.uiScale;
    ctx.setTransform(vp.kx, 0, 0, vp.ky, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = Math.max(Lx.compact ? 52 : 70, 74 * us) + Lx.safe.t;
    const cx = Lx.cssW / 2;
    if (ev) {
      const fs = Math.round(Lx.compact ? 12 : Math.max(14, 20 * us));
      ctx.font = `900 ${fs}px ${FONT}`;
      const label = EVENTS[ev.id].label + (ev.id === 'jammed' ? ` · ${S.petHim} ${ev.pets}/3` : '');
      const w = ctx.measureText(label).width + fs * 2.4;
      const h = fs * 2;
      ctx.beginPath();
      roundRectPath(ctx, cx - w / 2, y - h / 2, w, h, h / 2);
      ctx.fillStyle = 'rgba(58,36,24,0.88)';
      ctx.fill();
      // Time left as a bar along the bottom edge.
      const left = Math.max(0, 1 - ev.t / ev.dur);
      ctx.fillStyle = PALETTE.ui.primary;
      ctx.fillRect(cx - w / 2 + h / 2, y + h / 2 - 4, (w - h) * left, 3);
      ctx.fillStyle = PALETTE.ui.paper;
      ctx.fillText(label, cx, y + 1);
      y += h + 6;
    }
    if (chips.length) {
      const fs = Math.round(Lx.compact ? 10 : Math.max(12, 15 * us));
      ctx.font = `800 ${fs}px ${FONT}`;
      const widths = chips.map(c => ctx.measureText(c.text).width + fs * 1.8);
      let x = cx - (widths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 6) / 2;
      const h = fs * 1.8;
      chips.forEach((c, i) => {
        const w = widths[i];
        ctx.beginPath();
        roundRectPath(ctx, x, y - h / 2, w, h, h / 2);
        ctx.fillStyle = 'rgba(255,248,236,0.95)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = PALETTE.ui.primaryLip;
        ctx.stroke();
        ctx.fillStyle = PALETTE.ui.primary;
        ctx.fillRect(x + h / 2, y + h / 2 - 4, (w - h) * clamp(c.left / c.total, 0, 1), 3);
        ctx.fillStyle = INK;
        ctx.fillText(c.text, x + w / 2, y + 1);
        x += w + 6;
      });
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Debug profiling (session.dev.profile): average ms per render part.
  let prof = null;
  let profT = 0;
  let profCtx = null;
  function mark(name) {
    if (!prof) return;
    if (prof.flush && profCtx) profCtx.getImageData(0, 0, 1, 1);
    const t = performance.now();
    prof[name] = (prof[name] || 0) + (t - profT);
    profT = t;
  }

  function render(ctx, now) {
    if (prof) {
      prof.frames = (prof.frames || 0) + 1;
      profCtx = ctx;
      if (prof.flush) ctx.getImageData(0, 0, 1, 1);
      profT = performance.now();
    }
    kitchen.drawBack(ctx, vp, now);
    mark('back');
    vp.worldTransform(ctx);
    drawBowlContents(ctx);
    dog.draw(ctx, vp);
    mark('dog');
    kitchen.drawFront(ctx, vp);
    dog.drawPaws(ctx, vp);
    vp.worldTransform(ctx);
    drawBin(ctx);
    mark('front');
    const playing = run && run.shift && mode === 'game';
    if (playing) {
      const sort = run.mode === 'sort';
      if (sort) {
        drawTray(ctx);
        drawTrayPieces(ctx);
      }
      drawHalves(ctx);
      drawBodies(ctx);
      drawFlights(ctx);
      if (sort) drawMovingPieces(ctx);
      drawMitts(ctx);
      if (!uiHidden) {
        drawTutorial(ctx);
        if (sort) drawSortHints(ctx);
      }
      mark('items');
    }
    fx.draw(ctx, (g, icon) => drawPiece(g, icon), uiHidden);
    mark('fx');
    const req = playing && run.phase === 'play' ? run.shift.request : null;
    if (req && !uiHidden) {
      const a = dog.anchor('bubble');
      drawBubble(ctx, { text: '', x: a.x, y: a.y, t: req.t, life: req.life, ring: req.life, icon: { kind: 'spare', ingredient: req.ingredient } }, (g, icon) => drawPiece(g, icon));
    }
    blade.drawTrail(ctx, time, Math.max(18, 12 / L().s));
    // The knife cursor never hovers over Crumb, and it hides while a tray piece is in hand or under the mouse.
    if (!uiHidden && playing && run.phase === 'play' && pointer && pointer.type === 'mouse' && !run.held && !zoneHit('sink', pointer) && !(run.mode === 'sort' && pieceAt(pointer))) {
      drawKnife(ctx, pointer.x, pointer.y, blade.active ? -0.9 : -0.6);
    }
    if (playing && !uiHidden && run.phase === 'play') drawOverlayCss(ctx);
    mark('overlay');
  }

  // World units stay valid while the mode is the same, so a resize needs nothing. A rotation moves the arena:
  // whole items in the air are cleared without penalty, flights land at once, mitts finish.
  function onLayout(Lnew, modeChanged) {
    if (!run || !run.shift || !modeChanged) return;
    const sh = run.shift;
    cancelPointer();
    // Tray pieces snap to their slots; pieces in the air land at once.
    for (const piece of sh.pieces.slice()) {
      const a = piece.anim;
      if (!a) continue;
      a.t = 1;
    }
    stepPieces(0);
    for (const b of sh.bodies.splice(0)) {
      if (b.it.type === 'produce') sh.produce--;
      if (run.tutorial && run.tutorial.body === b) run.tutorial.body = null;
    }
    sh.halves.length = 0;
    for (const f of sh.flights) f.t = 1;
    stepFlights(0);
    for (const m of run.mitts) if (m.piece) removePiece(m.piece);
    run.mitts.length = 0;
  }

  function setUiHidden(on) {
    uiHidden = on;
  }

  return {
    start,
    toTitle,
    update,
    render,
    pointer: pointerEvent,
    key: keyEvent,
    onLayout,
    cancelPointer,
    setUiHidden,
    get mode() {
      return mode;
    },
    get phase() {
      return run ? run.phase : 'title';
    },
    get playing() {
      return mode === 'game' && run && run.phase === 'play';
    },
    // Debug hooks (used only with ?debug=1, tests and tools/capture.html).
    dev: {
      state() {
        if (!run) return { mode };
        const sh = run.shift;
        return {
          mode,
          phase: run.phase,
          shift: sh.def.day,
          index: run.index,
          timer: +sh.timer.toFixed(1),
          timerOn: sh.timerOn,
          bodies: sh.bodies.filter(b => b.wait <= 0).map(b => ({ uid: b.uid, id: b.id, type: b.it.type, variant: b.variant, x: Math.round(b.x), y: Math.round(b.y) })),
          halves: sh.halves.length,
          cuts: sh.halves.map(h => h.planes.map(pl => Math.round(pl.d))),
          flights: sh.flights.map(f => f.kind),
          produce: sh.produce,
          sliced: sh.sliced,
          quota: quota(sh),
          misses: sh.misses,
          strikes: sh.strikes,
          gameMode: run.mode,
          tray: sh.tray.map(p => (p ? `${p.kind}:${p.itemId}:${p.cat}` : null)),
          pieces: sh.pieces.length,
          portions: sh.portions,
          errors: sh.errors,
          lost: sh.lost,
          score: run.score,
          streak: run.streak,
          tummy: +run.tummy.toFixed(1),
          coma: run.coma > 0,
          event: sh.event ? sh.event.id : null,
          request: sh.request ? sh.request.ingredient : null,
          boosts: Object.keys(run.boosts).filter(k => run.boosts[k] > time),
          shields: run.shields + sh.freeBlocks,
          picks: run.picks.slice(),
          tutorial: run.tutorial ? run.tutorial.step : null,
          treats: run.treats,
          stars: run.stars.slice(),
          dogBase: dog.base,
        };
      },
      // Slice a body by uid (or the first produce in the air), as if by a swipe through its middle.
      slice(id, angle = 0.3) {
        if (!run) return false;
        const b = id == null ? lowestProduce() : run.shift.bodies.find(x => x.uid === id);
        if (!b || b.wait > 0) return false;
        if (!stroke) stroke = { count: 0, pressAt: { cx: 0, cy: 0 }, pressT: 0, onDog: false, swished: true };
        sliceBody(b, angle, false);
        return true;
      },
      // Sort & Feed: send the piece in a tray slot to 'dog' | 'bowl' | 'bin'.
      send(slot, target) {
        const piece = run && run.shift.tray[slot];
        if (!piece || piece.state !== 'rest') return false;
        const pos = traySlot(piece.slot);
        piece.x = pos.x;
        piece.y = pos.y;
        launch(piece, target);
        return true;
      },
      endStroke() {
        endStroke();
        stroke = null;
      },
      toss(id, variant = null, opts = {}) {
        if (!run) return null;
        const b = toss(id, variant, { d: 0.3, ...opts });
        if (INGREDIENTS[id].type === 'produce') run.shift.extraProduce++;
        return b.uid;
      },
      // Place a whole item at (x, y) without motion (screenshots).
      place(id, x, y, rot = 0, variant = null) {
        if (!run) return null;
        const b = toss(id, variant, { d: 0.3 });
        Object.assign(b, { x, y, vx: 0, vy: 0, g: 0, vr: 0, rot, wait: 0 });
        return b.uid;
      },
      freeze() {
        if (run) for (const b of run.shift.bodies) Object.assign(b, { vx: 0, vy: 0, g: 0, vr: 0 });
      },
      event(id) {
        if (run && run.shift && !run.shift.event) startEvent(id);
      },
      boost(name) {
        if (run) activateBoost(name);
      },
      skipCard() {
        ui.skipCard();
      },
      setTimer(s) {
        if (run) run.shift.timer = s;
      },
      setTummy(v) {
        if (run) run.tummy = v;
      },
      fillBowl(ids) {
        if (run) run.shift.bowl = ids.slice();
      },
      request(id) {
        if (run) run.shift.request = { ingredient: id, t: 0, life: 99, queued: true };
      },
      puppy(uidN) {
        if (run) run.shift.puppy = { uid: uidN, t: 0 };
      },
      hideMarkers() {
        if (run) for (const b of run.shift.bodies) b.marker = false;
      },
      clearPlan() {
        if (run) run.shift.next = run.shift.plan.salvos.length;
      },
      // Removes everything in the air (screenshots). Not a gameplay action: no misses are counted.
      clearAir() {
        if (!run) return;
        const sh = run.shift;
        for (const b of sh.bodies) if (b.it.type === 'produce') sh.produce--;
        sh.bodies.length = 0;
        sh.halves.length = 0;
        sh.flights.length = 0;
        run.mitts.length = 0;
        fx.clear();
      },
      get time() {
        return time;
      },
      profile(on, flush = false) {
        if (on) {
          prof = { flush };
          return null;
        }
        const p = prof || {};
        prof = null;
        const n = p.frames || 1;
        const out = {};
        for (const [k, v] of Object.entries(p)) if (k !== 'frames' && k !== 'flush') out[k] = +(v / n).toFixed(3);
        return out;
      },
    },
  };
}
