// Frame statistics and dynamic resolution.
// "work" = time spent in update + render (what we control); "interval" = time between frames.

import { PERF, LIMITS } from '../config.js';

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

export function createPerf() {
  const SIZE = 240;
  const work = new Float32Array(SIZE);
  const interval = new Float32Array(SIZE);
  let n = 0;
  let i = 0;
  let lastEval = 0;
  let badT = 0;
  let goodT = 0;

  const p = {
    dynCap: LIMITS.maxDpr,
    workP50: 0,
    workP95: 0,
    intervalP50: 0,
    intervalP95: 0,
    fps: 0,
  };

  // Returns true when dynCap changed and the canvas must be resized.
  let ceiling = LIMITS.maxDpr; // once a level proved too slow, never go back above it

  // After a DPR change the old frames no longer describe the new setting: start counting afresh.
  function resetWindow() {
    n = 0;
    i = 0;
    badT = 0;
    goodT = 0;
  }

  p.frame = function frame(workMs, intervalMs, now) {
    // Stalls (hidden tab, iframe scrolled away) are not samples, and the clock restarts after one.
    if (intervalMs > PERF.ignoreIntervalOverMs) {
      lastEval = now;
      return false;
    }
    work[i] = workMs;
    interval[i] = intervalMs;
    i = (i + 1) % SIZE;
    if (n < SIZE) n++;
    if (!lastEval) {
      lastEval = now;
      return false;
    }
    if (now - lastEval < PERF.sampleMs) return false;
    // Never credit more than two sample periods at once (a paused loop must not count as slow time).
    const span = Math.min((now - lastEval) / 1000, (2 * PERF.sampleMs) / 1000);
    lastEval = now;

    const w = Array.from(work.subarray(0, n)).sort((a, b) => a - b);
    const iv = Array.from(interval.subarray(0, n)).sort((a, b) => a - b);
    p.workP50 = percentile(w, 0.5);
    p.workP95 = percentile(w, 0.95);
    p.intervalP50 = percentile(iv, 0.5);
    p.intervalP95 = percentile(iv, 0.95);
    p.fps = p.intervalP50 > 0 ? 1000 / p.intervalP50 : 0;

    let changed = false;
    // Spread of frame intervals: a capped refresh rate is steady, an overloaded one is not.
    const jittery = p.intervalP95 - percentile(iv, 0.1) > PERF.jitterMs;
    // Slow: heavy work, or slow frames that are either jittery (overload) or below ~25 fps (overload even if steady).
    const slow =
      p.workP95 > PERF.badWorkMs ||
      (p.intervalP50 > PERF.slowIntervalMs && (jittery || p.intervalP50 > PERF.verySlowIntervalMs));
    const good = p.workP95 < PERF.goodWorkMs && p.intervalP50 < PERF.goodIntervalMs;
    if (slow) {
      badT += span;
      goodT = 0;
      if (badT >= PERF.badSeconds && p.dynCap > 1) {
        p.dynCap = Math.max(1, p.dynCap - PERF.dynStep);
        ceiling = p.dynCap;
        resetWindow();
        changed = true;
      }
    } else if (good) {
      goodT += span;
      badT = 0;
      if (goodT >= PERF.goodSeconds && p.dynCap < ceiling) {
        p.dynCap = Math.min(ceiling, p.dynCap + PERF.dynStep);
        resetWindow();
        changed = true;
      }
    } else {
      badT = 0;
      goodT = 0;
    }
    return changed;
  };

  p.stats = () => ({
    fps: Math.round(p.fps),
    workP50: +p.workP50.toFixed(2),
    workP95: +p.workP95.toFixed(2),
    intervalP50: +p.intervalP50.toFixed(2),
    intervalP95: +p.intervalP95.toFixed(2),
    dynCap: p.dynCap,
  });

  return p;
}
