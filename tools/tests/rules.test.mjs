import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSlice, resolveFall, resolveTreat, canFeed, shiftStars, comboMultiplier, multiBonus, rankFor, POINTS } from '../../src/game/rules.js';
import { INGREDIENTS, piecesOf } from '../../src/food/ingredients.js';

const spare = id => piecesOf(id).find(p => p.kind === 'spare');

test('slicing produce scores and keeps the streak', () => {
  const r = resolveSlice('cucumber');
  assert.equal(r.result, 'sliced');
  assert.equal(r.points, POINTS.slice);
  assert.equal(r.strike, false);
  assert.ok(r.streak);
});

test('slicing a bomb: red mitt, strike, penalty; a free block catches it without a strike', () => {
  for (const id of Object.keys(INGREDIENTS).filter(k => INGREDIENTS[k].type === 'bomb')) {
    const r = resolveSlice(id);
    assert.equal(r.mitt, 'red', id);
    assert.equal(r.strike, true, id);
    assert.equal(r.points, POINTS.bomb, id);
    const s = resolveSlice(id, { shield: true });
    assert.equal(s.strike, false, id);
    assert.equal(s.points, 0, id);
  }
});

test('the tutorial never strikes or penalizes', () => {
  const r = resolveSlice('chocolate', { tutorial: true });
  assert.equal(r.strike, false);
  assert.equal(r.points, 0);
});

test('junk: yellow stamp, small penalty, no strike; the hard spoon stops the stroke', () => {
  const sponge = resolveSlice('sponge');
  assert.equal(sponge.mitt, 'yellow');
  assert.equal(sponge.strike, false);
  assert.equal(sponge.split, true);
  const spoon = resolveSlice('spoon');
  assert.equal(spoon.stopStroke, true);
  assert.equal(spoon.split, false);
});

test('falls: missed produce breaks the streak, a bomb left alone scores', () => {
  assert.equal(resolveFall('apple').miss, true);
  assert.equal(resolveFall('onion').points, POINTS.leaveIt);
  assert.equal(resolveFall('onion').miss, false);
  assert.equal(resolveFall('ball').miss, false);
});

test('only an ok spare piece is ever fed, and never in a coma or a jam', () => {
  assert.equal(canFeed(spare('cucumber')), true);
  assert.equal(canFeed(spare('cucumber'), { coma: true }), false);
  assert.equal(canFeed(spare('cucumber'), { jammed: true }), false);
  for (const id of Object.keys(INGREDIENTS)) {
    if (INGREDIENTS[id].type === 'toy') continue;
    for (const p of piecesOf(id)) {
      if (p.cat !== 'ok' || p.kind !== 'spare') assert.equal(canFeed(p), false, `${p.kind}:${p.itemId}`);
    }
  }
});

test('a treat that meets the request scores the bonus', () => {
  const r = resolveTreat(spare('carrot'), { coma: false, jammed: false, request: 'carrot' });
  assert.equal(r.eaten, true);
  assert.equal(r.requestMet, true);
  assert.equal(r.points, POINTS.treat + POINTS.request);
  const b = resolveTreat(spare('carrot'), { coma: true, jammed: false, request: null });
  assert.equal(b.eaten, false);
});

test('stars', () => {
  assert.equal(shiftStars({ sliced: 5, produce: 10, strikes: 0 }), 0);
  assert.equal(shiftStars({ sliced: 7, produce: 10, strikes: 0 }), 1);
  assert.equal(shiftStars({ sliced: 9, produce: 10, strikes: 1 }), 2);
  assert.equal(shiftStars({ sliced: 9, produce: 10, strikes: 0 }), 3);
});

test('streak multiplier steps every 5 slices and caps at x2; multi-slice bonus from 3 items', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(5), 1.25);
  assert.equal(comboMultiplier(100), 2);
  assert.equal(multiBonus(2), 0);
  assert.equal(multiBonus(3), 30);
  assert.equal(multiBonus(9), 100);
});

test('ranks', () => {
  assert.equal(rankFor(9), 'goodBoy');
  assert.equal(rankFor(6), 'sousChef');
  assert.equal(rankFor(4), 'lineCook');
  assert.equal(rankFor(0), 'trainee');
});
