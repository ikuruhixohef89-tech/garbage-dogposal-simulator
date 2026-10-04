// Pure game rules: what a slice, a fall or a treat means. No DOM, no randomness; tested in Node.
// Invariant (checked by tools/check-food.mjs): only an 'ok' spare piece ever reaches the dog's mouth,
// and only when he can eat. Bombs (toxic) and junk (nope) are never eaten.

import { INGREDIENTS } from '../food/ingredients.js';

export const POINTS = {
  slice: 10,
  crack: 5, // a hit on a big item that needs more than one
  dice: 2, // a falling piece cut again
  treat: 5,
  request: 40,
  leaveIt: 10,
  resisted: 50,
  golden: 50,
  bomb: -50,
  junk: -10,
  multi: [0, 0, 0, 30, 60, 100], // by items in one stroke (5 and more: the last value)
  timeBonusPerSecond: 0,
  threeStars: 100,
};

export const TUMMY = {
  start: 30,
  decayPerSecond: 2.2,
  treat: 7,
  slowAt: 85,
  comaAt: 100,
  comaSeconds: 3.5,
  afterComa: 65,
  hungryBelow: 15,
};

export const MAX_STRIKES = 3;
export const STREAK_STEP = 5; // every 5 slices in a row add x0.25
export const STREAK_MAX_MULT = 2;

export function comboMultiplier(streak) {
  return Math.min(STREAK_MAX_MULT, 1 + 0.25 * Math.floor(Math.max(0, streak) / STREAK_STEP));
}

export function multiBonus(n) {
  if (n < 3) return 0;
  return POINTS.multi[Math.min(n, POINTS.multi.length - 1)];
}

// A whole item got sliced. opts: { shield: boolean (a free block is available), tutorial: boolean }
export function resolveSlice(id, opts = {}) {
  const it = INGREDIENTS[id];
  const r = { result: '', points: 0, strike: false, mitt: null, streak: false, breakStreak: false, split: true, stopStroke: false };
  if (!it || it.type === 'toy') return { ...r, result: 'bat', split: false };
  if (it.type === 'bomb') {
    if (opts.shield) return { ...r, result: 'shielded', mitt: 'red', breakStreak: true };
    return { ...r, result: 'blocked', mitt: 'red', strike: !opts.tutorial, points: opts.tutorial ? 0 : POINTS.bomb, breakStreak: true };
  }
  if (it.type === 'junk') {
    const hard = it.material === 'hard';
    return { ...r, result: 'notFood', mitt: 'yellow', points: opts.tutorial ? 0 : POINTS.junk, breakStreak: true, split: !hard, stopStroke: hard };
  }
  return { ...r, result: 'sliced', points: POINTS.slice, streak: true };
}

// A whole item left the screen at the bottom without being sliced.
export function resolveFall(id) {
  const it = INGREDIENTS[id];
  if (!it) return { result: 'none', points: 0, miss: false, breakStreak: false };
  if (it.type === 'produce') return { result: 'missed', points: 0, miss: true, breakStreak: true };
  if (it.type === 'bomb') return { result: 'leftIt', points: POINTS.leaveIt, miss: false, breakStreak: false };
  return { result: 'none', points: 0, miss: false, breakStreak: false };
}

// May this part go to the dog's mouth? part: { kind, cat }. dog: { coma, jammed }.
export function canFeed(part, dog = { coma: false, jammed: false }) {
  return part.kind === 'spare' && part.cat === 'ok' && !dog.coma && !dog.jammed;
}

// A spare piece reached the mouth. dog: { coma, jammed, request: item id or null }.
export function resolveTreat(part, dog = { coma: false, jammed: false, request: null }) {
  if (!canFeed(part, dog)) return { result: 'bounce', eaten: false, tummy: 0, points: 0, requestMet: false };
  const requestMet = !!dog.request && dog.request === part.ingredient;
  return {
    result: 'fed',
    eaten: true,
    tummy: TUMMY.treat,
    points: POINTS.treat + (requestMet ? POINTS.request : 0),
    requestMet,
  };
}

// Stars for one shift. produce: how many produce items flew; sliced: how many got sliced.
// 1 star = 60% sliced; 2 = 85% sliced; 3 = also no strikes.
export function shiftStars({ sliced, produce, strikes }) {
  if (produce <= 0) return 0;
  const share = sliced / produce;
  if (share < 0.6) return 0;
  if (share < 0.85) return 1;
  if (strikes > 0) return 2;
  return 3;
}

// ---------- Sort & Feed (main mode): the player sends every piece from the tray ----------

export const DROP_POINTS = {
  slice: 5,
  plate: 30,
  feed: 20,
  requestBonus: 20,
  binNope: 10,
  binToxic: 15,
  ew: -30,
  dishBinned: -20,
  nopeToDog: -10,
  toxicToDog: -50,
  trayFull: -10,
};

// piece: { kind: 'dish'|'spare'|'scrap', cat: 'ok'|'nope'|'toxic', ingredient }; target: 'dog'|'bowl'|'bin'.
// dog: { coma, jammed, request }.
export function resolveDrop(piece, target, dog = { coma: false, jammed: false, request: null }) {
  const P = DROP_POINTS;
  const r = {
    result: '', points: 0, strike: false, mitt: null, eaten: false, tummy: 0,
    error: false, correct: false, portion: false, portionLost: false, requestMet: false, bounce: false,
  };
  if (target === 'dog') {
    if (piece.cat === 'toxic') return { ...r, result: 'blocked', mitt: 'red', strike: true, points: P.toxicToDog, error: true };
    if (piece.cat === 'nope') return { ...r, result: 'notFood', mitt: 'yellow', points: P.nopeToDog, error: true };
    // From here on the piece is 'ok'.
    if (dog.coma || dog.jammed) return { ...r, result: 'bounce', bounce: true };
    if (piece.kind === 'dish') return { ...r, result: 'dishEaten', eaten: true, tummy: 20, error: true, portionLost: true };
    const requestMet = !!dog.request && dog.request === piece.ingredient;
    return { ...r, result: 'fed', eaten: true, tummy: TUMMY.treat, correct: true, requestMet, points: P.feed + (requestMet ? P.requestBonus : 0) };
  }
  if (target === 'bowl') {
    if (piece.kind === 'dish') return { ...r, result: 'plated', points: P.plate, correct: true, portion: true };
    return { ...r, result: 'ew', points: P.ew, error: true };
  }
  if (target === 'bin') {
    if (piece.kind === 'dish') return { ...r, result: 'dishBinned', points: P.dishBinned, error: true, portionLost: true };
    if (piece.cat === 'ok') return { ...r, result: 'wasted' };
    if (piece.cat === 'nope') return { ...r, result: 'binned', points: P.binNope, correct: true };
    return { ...r, result: 'binned', points: P.binToxic, correct: true };
  }
  return { ...r, result: 'none' };
}

// Stars for a Sort & Feed shift: 1 = half the produce plated; 2 = 80% and at most 2 errors; 3 = also no strikes
// and at most 1 error.
export function sortStars({ portions, total, errors, strikes }) {
  if (total <= 0) return 0;
  const share = portions / total;
  if (share < 0.5) return 0;
  if (share < 0.8 || errors > 2) return 1;
  if (strikes > 0 || errors > 1) return 2;
  return 3;
}

export function quotaFor(produce) {
  return Math.ceil(produce * 0.85);
}

export function rankFor(stars) {
  if (stars >= 8) return 'goodBoy';
  if (stars >= 6) return 'sousChef';
  if (stars >= 4) return 'lineCook';
  return 'trainee';
}
