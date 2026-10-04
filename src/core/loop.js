// Fixed-step game loop on requestAnimationFrame.
// Logic runs at 1/60 s (max 5 substeps per frame); render runs once per frame.

import { PERF } from '../config.js';

const STEP = 1 / 60;
const MAX_SUBSTEPS = 5;
const MAX_DT = 0.1;

export function createLoop({ update, render, onStall }) {
  let running = false;
  let raf = 0;
  let last = 0;
  let acc = 0;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const gap = (now - last) / 1000;
    last = now;
    if (gap > PERF.stallSeconds && onStall) onStall(gap);
    const dt = Math.min(Math.max(gap, 0), MAX_DT);
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_SUBSTEPS) {
      update(STEP);
      acc -= STEP;
      n++;
    }
    if (n === MAX_SUBSTEPS) acc = 0;
    render(acc / STEP, gap * 1000, now);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}
