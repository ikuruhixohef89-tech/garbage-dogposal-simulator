import test from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../../src/core/storage.js';
import { SKINS, unlocked, newlyUnlocked } from '../../src/game/skins.js';

test('top lists keep the 5 best scores per mode and level and report the place', () => {
  assert.equal(storage.addTop('sort', 'mon', 300), 1);
  assert.equal(storage.addTop('sort', 'mon', 500), 1);
  assert.equal(storage.addTop('sort', 'mon', 400), 2);
  for (const s of [10, 20, 30]) storage.addTop('sort', 'mon', s);
  assert.deepEqual(storage.topFor('sort', 'mon'), [500, 400, 300, 30, 20]);
  assert.equal(storage.addTop('sort', 'mon', 5), 0, 'too low for the list');
  assert.deepEqual(storage.topFor('rush', 'mon'), [], 'modes are separate');
  assert.equal(storage.addTop('sort', 'tue', 999), 0, 'unknown levels are ignored');
});

test('skins unlock from the best score only', () => {
  assert.deepEqual(unlocked(0), ['classic']);
  assert.ok(unlocked(99999).length === SKINS.length);
  assert.deepEqual(newlyUnlocked(2900, 6500).map(s => s.id), ['mint', 'berry']);
  assert.deepEqual(newlyUnlocked(6500, 6600), []);
});