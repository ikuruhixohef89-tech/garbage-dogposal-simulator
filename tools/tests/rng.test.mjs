import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, makeRng, hash2 } from '../../src/core/rng.js';

test('same seed gives the same sequence', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('values are in [0, 1)', () => {
  const r = mulberry32(7);
  for (let i = 0; i < 10000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('different seeds differ', () => {
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('makeRng helpers stay in range', () => {
  const r = makeRng(123);
  for (let i = 0; i < 1000; i++) {
    const n = r.int(3, 5);
    assert.ok(n >= 3 && n <= 5 && Number.isInteger(n));
    const x = r.range(-2, 2);
    assert.ok(x >= -2 && x < 2);
  }
  assert.ok(['a', 'b'].includes(r.pick(['a', 'b'])));
});

test('hash2 is stable and spreads neighbors', () => {
  assert.equal(hash2(3, 4), hash2(3, 4));
  assert.notEqual(hash2(3, 4), hash2(4, 3));
});
