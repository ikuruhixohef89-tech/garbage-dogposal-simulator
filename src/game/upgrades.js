// Upgrade cards: pick 1 of 3 after MON and after WED. They last for the current run only
// (the brief allows localStorage for settings and records, not for progression).

export const BASE_TUNE = {
  bladeK: 1, // hit radius multiplier
  gravityK: 1, // produce gravity multiplier (lower = floats longer)
  multiK: 1, // multi-slice bonus multiplier
  boostK: 1, // booster duration multiplier
  comaAt: 100,
  goldenK: 1,
  requestLife: 7,
  requestK: 1,
  treatK: 1,
  freeBlocks: 0, // bombs per shift caught without a strike
  maxStrikes: 3,
  prepCook: false,
};

export const CARDS = [
  { id: 'sharp', title: 'Sharper Knife', short: '+25% blade', line: 'Sharpened. Do not test on fingers.', rare: false, max: 2, apply: t => { t.bladeK *= 1.25; } },
  { id: 'air', title: 'Air Time', short: 'Produce floats', line: 'Physics adjusted. Physics disagrees.', rare: false, max: 2, apply: t => { t.gravityK *= 0.88; } },
  { id: 'combo', title: 'Combo Chef', short: 'x1.5 multi-slice', line: 'Three at once is a salad. Four is a lifestyle.', rare: false, max: 2, apply: t => { t.multiK *= 1.5; } },
  { id: 'warranty', title: 'Extended Warranty', short: '+40% boosters', line: 'Terms apply. I wrote them.', rare: false, max: 2, apply: t => { t.boostK *= 1.4; } },
  { id: 'appetite', title: 'Big Appetite', short: 'Bigger tummy', line: 'Capacity expanded. Do not ask how.', rare: false, max: 1, apply: t => { t.comaAt = 130; } },
  { id: 'golden', title: 'Golden Hour', short: 'More gold', line: 'Premium produce. Same produce. Higher price.', rare: false, max: 1, apply: t => { t.goldenK = 2; } },
  { id: 'tracker', title: 'Treat Tracker', short: 'Longer requests', line: 'He asked nicely. I logged it.', rare: false, max: 1, apply: t => { t.requestLife = 11; t.requestK = 1.5; } },
  { id: 'snack', title: 'Snack Mode', short: '+50% treats', line: 'More spare bits. Same tiny dog.', rare: false, max: 1, apply: t => { t.treatK = 1.5; } },
  { id: 'mitt', title: 'Second Mitt', short: '1 free block / shift', line: 'Guardrails upgraded. Free trial.', rare: true, max: 2, defensive: true, apply: t => { t.freeBlocks += 1; } },
  { id: 'lenient', title: 'Lenient Board', short: '+1 strike', line: 'The Dog Safety Board agreed. Reluctantly.', rare: true, max: 1, defensive: true, apply: t => { t.maxStrikes = 4; } },
  { id: 'prep', title: 'Prep Cook', short: 'Auto-slice every 10 s', line: 'It chose the cucumber. It always chooses the cucumber.', rare: true, max: 1, apply: t => { t.prepCook = true; } },
];

export function tuneFor(picks) {
  const t = { ...BASE_TUNE };
  for (const id of picks) {
    const c = CARDS.find(x => x.id === id);
    if (c) c.apply(t);
  }
  return t;
}

// Three different cards that are not maxed out, at most one defensive. rareSlot: one slot is rare if possible.
export function drawCards(rng, picks, rareSlot = false) {
  const count = id => picks.filter(p => p === id).length;
  let pool = CARDS.filter(c => count(c.id) < c.max);
  const out = [];
  const take = list => {
    let total = 0;
    for (const c of list) total += c.rare ? 4 : 10;
    let r = rng.next() * total;
    for (const c of list) {
      r -= c.rare ? 4 : 10;
      if (r <= 0) return c;
    }
    return list[list.length - 1];
  };
  if (rareSlot) {
    const rares = pool.filter(c => c.rare);
    if (rares.length) {
      const c = take(rares);
      out.push(c);
    }
  }
  while (out.length < 3) {
    const left = pool.filter(c => !out.includes(c) && !(c.defensive && out.some(o => o.defensive)));
    if (!left.length) break;
    out.push(take(left));
  }
  return out.map(c => ({ id: c.id, title: c.title, short: c.short, line: c.line, rare: c.rare }));
}
