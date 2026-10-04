// Shifts and the toss plan. SOUS-AI "plans" the shift; its mistakes are harmless (never "feed the dog X").
// Pure: a seeded rng in, a list of salvos out. Tested in Node.

import { INGREDIENTS } from '../food/ingredients.js';

export const SHIFTS = [
  {
    id: 'mon', day: 'MON', name: 'First Shift', timer: 45, timerSort: 60, d: [0, 0.35], events: 1, golden: 1, frozen: 0, ball: 0,
    joke: 'I toss the vegetables. You slice them. Crumb supervises.', confidence: 97, requestEvery: [12, 16],
  },
  {
    id: 'wed', day: 'WED', name: 'Lunch Rush', timer: 55, timerSort: 70, d: [0.3, 0.7], events: 2, golden: 1, frozen: 1, ball: 1,
    joke: 'Twice the vegetables. Same tiny dog.', confidence: 88, requestEvery: [10, 14],
  },
  {
    id: 'fri', day: 'FRI', name: 'Dinner Party', timer: 60, timerSort: 80, d: [0.6, 1], events: 3, golden: 2, frozen: 2, ball: 1,
    joke: 'Big menu tonight. Onions included. Do not slice the onions.', confidence: 104, requestEvery: [9, 13],
  },
];

export function pools(shiftIndex) {
  const produce = [];
  const bombs = [];
  const junk = [];
  for (const [id, it] of Object.entries(INGREDIENTS)) {
    if (it.from > shiftIndex || !it.weight) continue;
    if (it.type === 'produce') produce.push(id);
    else if (it.type === 'bomb') bombs.push(id);
    else if (it.type === 'junk') junk.push(id);
  }
  return { produce, bombs, junk };
}

function weighted(rng, ids, boost = null) {
  let total = 0;
  for (const id of ids) total += INGREDIENTS[id].weight * (id === boost ? 3 : 1);
  let r = rng.next() * total;
  for (const id of ids) {
    r -= INGREDIENTS[id].weight * (id === boost ? 3 : 1);
    if (r <= 0) return id;
  }
  return ids[ids.length - 1];
}

// Difficulty 0..1 at time tau (seconds since the shift started). sort: the longer Sort & Feed timer.
export function difficulty(shift, tau, sort = false) {
  const k = Math.min(1, Math.max(0, tau / (sort ? shift.timerSort : shift.timer)));
  return shift.d[0] + (shift.d[1] - shift.d[0]) * k;
}

export function salvoGap(d) {
  return 2.0 - 1.1 * d;
}

export function bombChance(d) {
  return d < 0.12 ? 0 : 0.06 + 0.2 * d;
}

// One salvo at difficulty d. opts: { request: item id to favour, compact: fewer items, noBombs }.
export function makeSalvo(rng, shiftIndex, d, opts = {}) {
  const { produce, bombs, junk } = pools(shiftIndex);
  let n = 1;
  if (rng.next() < 0.3 + 0.4 * d) n++;
  if (rng.next() < 0.6 * d) n++;
  if (d > 0.7 && rng.next() < 0.3) n++;
  if (opts.compact) n = Math.min(n, 3);
  if (opts.maxItems) n = Math.min(n, opts.maxItems);
  const maxBombs = shiftIndex >= 2 ? 2 : 1;
  let nb = 0;
  const items = [];
  for (let i = 0; i < n; i++) {
    let id;
    if (!opts.noBombs && bombs.length && nb < maxBombs && (n === 1 || i > 0) && rng.next() < bombChance(d)) {
      id = weighted(rng, bombs);
      nb++;
    } else if (!opts.noBombs && junk.length && rng.next() < 0.04) {
      id = weighted(rng, junk);
    } else {
      id = weighted(rng, produce, opts.request);
    }
    items.push({ id, variant: null });
  }
  // A group is never all bombs and junk: there is always something to slice.
  if (n > 1 && items.every(x => INGREDIENTS[x.id].type !== 'produce')) items[0] = { id: weighted(rng, produce), variant: null };
  const pattern = n >= 3 && rng.next() < 0.35 ? 'fan' : 'spread';
  return { pattern, items };
}

// The whole shift, planned up front: salvos with times, special variants placed in the middle part.
// tune: { goldenK } from upgrades.
export function planShift(rng, shiftIndex, opts = {}) {
  const shift = SHIFTS[shiftIndex];
  const salvos = [];
  // Sort & Feed: fewer, slower tosses, because every piece is then sorted by hand.
  const timer = opts.sort ? shift.timerSort : shift.timer;
  let t = opts.firstAt == null ? 0.6 : opts.firstAt;
  while (t < timer - (opts.sort ? 8 : 1.6)) {
    const d = difficulty(shift, t, opts.sort);
    salvos.push({ t, ...makeSalvo(rng, shiftIndex, d, { compact: opts.compact, maxItems: opts.sort ? 2 : 0 }) });
    t += salvoGap(d) * (opts.compact ? 1.15 : 1) * (opts.sort ? 2.1 : 1) + (opts.sort ? 0.5 : 0);
  }
  // Specials: golden, frozen and the squeaky ball replace one produce item in a salvo between 25% and 85%.
  const mid = salvos.filter(s => s.t > timer * 0.25 && s.t < timer * 0.85);
  const place = (variant, count) => {
    for (let k = 0; k < count && mid.length; k++) {
      const s = mid[Math.floor(rng.next() * mid.length)];
      const i = s.items.findIndex(x => INGREDIENTS[x.id].type === 'produce' && !x.variant);
      if (i < 0) continue;
      // The ball never takes the only food of a group.
      const food = s.items.filter(x => INGREDIENTS[x.id].type === 'produce').length;
      if (variant === 'ball' && s.items.length > 1 && food < 2) continue;
      if (variant === 'ball') s.items[i] = { id: 'ball', variant: null };
      else s.items[i].variant = variant;
    }
  };
  place('golden', Math.round(shift.golden * (opts.goldenK || 1)));
  place('frozen', shift.frozen);
  place('ball', shift.ball);
  const produce = salvos.reduce((a, s) => a + s.items.filter(x => INGREDIENTS[x.id].type === 'produce').length, 0);
  return { shift, salvos, produce };
}
