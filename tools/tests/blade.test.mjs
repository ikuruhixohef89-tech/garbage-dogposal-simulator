import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentHitsItem, createBlade } from '../../src/food/blade.js';
import { cutChord, supportAlong } from '../../src/food/art.js';

test('a stroke through the middle of a round item hits it', () => {
  assert.ok(segmentHitsItem(-200, 0, 200, 0, 0, 0, 0, 120, 120) >= 0);
  assert.ok(segmentHitsItem(0, -200, 0, 200, 0, 0, 1.2, 120, 120) >= 0);
});

test('a stroke that passes beside the item misses it', () => {
  assert.equal(segmentHitsItem(-200, 100, 200, 100, 0, 0, 0, 120, 120), -1);
});

test('a long item is a capsule: its ends count, the empty corners do not', () => {
  // Cucumber 260 x 64 lying along x: a vertical stroke near its end still cuts.
  assert.ok(segmentHitsItem(110, -100, 110, 100, 0, 0, 0, 260, 64) >= 0);
  // Rotated 90 degrees, the same stroke misses (the cucumber now stands upright).
  assert.equal(segmentHitsItem(110, -100, 110, 100, 0, 0, Math.PI / 2, 260, 64), -1);
});

test('padding grows the hit area; negative padding shrinks it (bombs are harder to touch)', () => {
  assert.equal(segmentHitsItem(-200, 70, 200, 70, 0, 0, 0, 120, 120), -1);
  assert.ok(segmentHitsItem(-200, 70, 200, 70, 0, 0, 0, 120, 120, 15) >= 0);
  assert.ok(segmentHitsItem(-200, 55, 200, 55, 0, 0, 0, 120, 120) >= 0);
  assert.equal(segmentHitsItem(-200, 55, 200, 55, 0, 0, 0, 120, 120, -10), -1);
});

test('a segment that ends inside the item counts (fast strokes have few samples)', () => {
  assert.ok(segmentHitsItem(-300, 0, 0, 0, 0, 0, 0, 120, 120) >= 0);
});

test('the blade reports segment speed in CSS px per ms', () => {
  const b = createBlade();
  b.begin({ x: 0, y: 0, cx: 0, cy: 0, t: 1000 }, 0);
  const seg = b.move({ x: 100, y: 0, cx: 50, cy: 0, t: 1010 }, 0.01);
  assert.equal(seg.speed, 5);
  assert.deepEqual([seg.ax, seg.bx], [0, 100]);
  b.end();
  assert.equal(b.move({ x: 1, y: 1, cx: 1, cy: 1, t: 1020 }, 0.02), null);
});

test('cut chords: through the middle the full width, off-center shorter, outside none', () => {
  const size = [200, 100]; // an ellipse 100 x 50 half-axes
  const mid = cutChord(size, 0, 0); // a horizontal cut through the center
  assert.ok(Math.abs(mid.half - 100) < 1e-6);
  const off = cutChord(size, 0, 25);
  assert.ok(off.half < 100 && off.half > 80);
  assert.equal(cutChord(size, 0, 60), null);
  assert.ok(Math.abs(supportAlong(size, 0) - 50) < 1e-6);
  assert.ok(Math.abs(supportAlong(size, Math.PI / 2) - 100) < 1e-6);
});