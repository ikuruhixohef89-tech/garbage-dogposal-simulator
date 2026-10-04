import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerf } from '../../src/core/perf.js';

// Feed `seconds` of frames: work ms per frame and an interval generator.
function feed(p, seconds, workMs, intervalFn, start = 0) {
  let now = start;
  let changes = 0;
  while (now < start + seconds * 1000) {
    const iv = intervalFn();
    now += iv;
    if (p.frame(workMs, iv, now)) changes++;
  }
  return { now, changes };
}

test('raster overload (slow, jittery frames) lowers the DPR cap even when work is tiny', () => {
  const p = createPerf();
  let k = 0;
  feed(p, 5, 0.5, () => (k++ % 2 ? 28 : 40));
  assert.ok(p.dynCap < 2, `dynCap ${p.dynCap}`);
});

test('a steady 30 fps cap (iOS Low Power Mode) is not treated as overload', () => {
  const p = createPerf();
  feed(p, 6, 0.5, () => 33.3);
  assert.equal(p.dynCap, 2);
});

test('after a slow level, the cap never climbs back above it', () => {
  const p = createPerf();
  let k = 0;
  const r = feed(p, 4, 0.5, () => (k++ % 2 ? 28 : 40));
  const lowered = p.dynCap;
  assert.ok(lowered < 2);
  feed(p, 30, 0.5, () => 16.7, r.now);
  assert.equal(p.dynCap, lowered);
});

test('stalls (hidden tab) are ignored', () => {
  const p = createPerf();
  feed(p, 10, 0.5, () => 1500);
  assert.equal(p.dynCap, 2);
});

test('a steady but very slow device (8 fps) still lowers the cap', () => {
  const p = createPerf();
  feed(p, 6, 0.5, () => 125);
  assert.ok(p.dynCap < 2, `dynCap ${p.dynCap}`);
});

test('one drop per real slowdown: old slow frames are forgotten after a change', () => {
  const p = createPerf();
  const r = feed(p, 3.1, 16, () => 16.7); // work too heavy at the first level; dropped at ~3.0 s
  assert.equal(p.dynCap, 1.75);
  feed(p, 6, 6, () => 16.7, r.now); // the lower level is fine
  assert.equal(p.dynCap, 1.75);
});

test('coming back from a long hidden period does not count as slow time', () => {
  const p = createPerf();
  let r = feed(p, 2, 15, () => 16.7); // borderline frames
  // The tab was hidden for 60 s (the loop was stopped), then good frames.
  r = feed(p, 0.1, 5, () => 60000, r.now);
  feed(p, 1, 5, () => 16.7, r.now);
  assert.equal(p.dynCap, 2);
});
