import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIFTS, planShift, makeSalvo, pools } from '../../src/game/shifts.js';
import { planEvents, EVENTS } from '../../src/game/events.js';
import { drawCards, tuneFor, CARDS } from '../../src/game/upgrades.js';
import { INGREDIENTS } from '../../src/food/ingredients.js';
import { makeRng } from '../../src/core/rng.js';

test('every shift plan fits its timer and only uses items unlocked by then', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rng = makeRng(seed);
    SHIFTS.forEach((sh, i) => {
      const p = planShift(rng, i);
      assert.ok(p.salvos.length > 10, `${sh.id}: ${p.salvos.length} salvos`);
      for (const s of p.salvos) {
        assert.ok(s.t < sh.timer, 'salvo inside the shift');
        for (const x of s.items) assert.ok(INGREDIENTS[x.id].from <= i, `${x.id} not unlocked in ${sh.id}`);
        if (s.items.length > 1) assert.ok(s.items.some(x => INGREDIENTS[x.id].type === 'produce'), 'a group always has food');
      }
      assert.ok(p.produce > 0);
    });
  }
});

test('no bombs at the very start of MON; bombs appear later in the run', () => {
  const rng = makeRng(7);
  let early = 0;
  let late = 0;
  for (let k = 0; k < 2000; k++) {
    early += makeSalvo(rng, 0, 0.05).items.filter(x => INGREDIENTS[x.id].type === 'bomb').length;
    late += makeSalvo(rng, 2, 0.9).items.filter(x => INGREDIENTS[x.id].type === 'bomb').length;
  }
  assert.equal(early, 0);
  assert.ok(late > 200, `late bombs ${late}`);
});

test('variants (golden, frozen) only ever sit on produce', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const p = planShift(makeRng(seed), 2, { goldenK: 2 });
    for (const s of p.salvos) for (const x of s.items) if (x.variant) assert.equal(INGREDIENTS[x.id].type, 'produce');
  }
});

test('pools grow by shift', () => {
  assert.ok(pools(2).produce.length > pools(0).produce.length);
  assert.ok(pools(0).bombs.includes('onion'));
  assert.ok(!pools(0).bombs.includes('garlic'));
});

test('events: no repeats, inside the safe window, spaced apart', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const ev = planEvents(makeRng(seed), 2, 60, 3);
    const ids = ev.map(e => e.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const e of ev) {
      assert.ok(e.at >= 12 && e.at <= 50, `at ${e.at}`);
      assert.ok(EVENTS[e.id].scheduled);
    }
    for (let i = 1; i < ev.length; i++) assert.ok(ev[i].at - ev[i - 1].at >= 11);
  }
});

test('upgrade cards: three different ones, never past their max, at most one defensive', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = makeRng(seed);
    const picks = ['mitt', 'mitt', 'appetite'];
    const cards = drawCards(rng, picks, seed % 2 === 0);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map(c => c.id)).size, 3);
    assert.ok(!cards.some(c => c.id === 'mitt' || c.id === 'appetite'), 'maxed cards are not offered');
    const def = cards.filter(c => CARDS.find(x => x.id === c.id).defensive);
    assert.ok(def.length <= 1);
  }
});

test('tune stacks within caps', () => {
  const t = tuneFor(['sharp', 'sharp', 'lenient', 'mitt']);
  assert.ok(Math.abs(t.bladeK - 1.5625) < 1e-9);
  assert.equal(t.maxStrikes, 4);
  assert.equal(t.freeBlocks, 1);
});
