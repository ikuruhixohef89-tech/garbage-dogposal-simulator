// Sound effects, synthesized with Web Audio. Silent until PLAY created the context.
// Each sound gets a small random pitch and volume spread so repeats do not sound robotic.

import { engine } from './audio.js';
import { LIMITS } from '../config.js';

let noise = null;
let voices = 0;
const last = {};

function noiseBuffer(ctx) {
  if (noise) return noise;
  const len = ctx.sampleRate;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return noise;
}

function env(ctx, g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function track(node, stopAt) {
  voices++;
  node.onended = () => {
    voices--;
  };
  node.stop(stopAt);
}

function osc(E, type, f0, f1, t, a, peak, d, filter) {
  const { ctx, bus } = E;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  env(ctx, g, t, a, peak, d);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter[0];
    f.frequency.value = filter[1];
    f.Q.value = filter[2] || 1;
    o.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(bus);
  o.start(t);
  track(o, t + a + d + 0.03);
}

function burst(E, t, dur, peak, type, freq, q = 1, f2) {
  const { ctx, bus } = E;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(ctx, g, t, Math.min(0.006, dur / 4), peak, dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(t, Math.random() * 0.8);
  track(src, t + dur + 0.03);
}

const vary = (x, p = 0.08) => x * (1 + (Math.random() * 2 - 1) * p);

const SOUNDS = {
  chop(E, t) {
    osc(E, 'sine', vary(190), 85, t, 0.002, 0.7, 0.05);
    burst(E, t, 0.025, 0.35, 'highpass', 2600, 1.4);
    osc(E, 'triangle', vary(340), 300, t, 0.002, 0.12, 0.06);
  },
  swish(E, t, k = 1) {
    burst(E, t, 0.12, 0.08 + 0.2 * k, 'bandpass', 900, 1.5, 3500);
  },
  crunch(E, t) {
    for (let i = 0; i < 5; i++) burst(E, t + i * 0.014 + Math.random() * 0.006, 0.012, 0.45, 'bandpass', vary(1800 + Math.random() * 2700, 0.1), 2.5);
    burst(E, t, 0.09, 0.12, 'lowpass', 1400, 1, 500);
  },
  squish(E, t) {
    burst(E, t, 0.14, 0.35, 'lowpass', 400, 4, 1100);
    osc(E, 'sine', vary(700), 1300, t + 0.05, 0.003, 0.15, 0.025);
  },
  chew(E, t) {
    burst(E, t, 0.045, 0.3, 'bandpass', vary(650), 1.2);
  },
  gulp(E, t) {
    osc(E, 'sine', vary(240), 110, t, 0.005, 0.4, 0.1);
  },
  lick(E, t) {
    burst(E, t, 0.17, 0.22, 'bandpass', 700, 5, 2400);
  },
  yap(E, t) {
    const { ctx, bus } = E;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const p = vary(1, 0.06);
    o.frequency.setValueAtTime(650 * p, t);
    o.frequency.linearRampToValueAtTime(900 * p, t + 0.03);
    o.frequency.exponentialRampToValueAtTime(560 * p, t + 0.11);
    const g = ctx.createGain();
    env(ctx, g, t, 0.004, 0.5, 0.1);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 1150;
    f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 2700;
    f2.Q.value = 7;
    const g2 = ctx.createGain();
    g2.gain.value = 0.6;
    o.connect(f1);
    f1.connect(g);
    o.connect(f2);
    f2.connect(g2);
    g2.connect(g);
    g.connect(bus);
    o.start(t);
    track(o, t + 0.16);
  },
  whine(E, t) {
    const { ctx, bus } = E;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1050, t);
    o.frequency.linearRampToValueAtTime(1500, t + 0.3);
    o.frequency.linearRampToValueAtTime(950, t + 0.65);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6.5;
    const lg = ctx.createGain();
    lg.gain.value = 30;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.09);
    g.gain.setValueAtTime(0.18, t + 0.43);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(f);
    f.connect(g);
    g.connect(bus);
    o.start(t);
    lfo.start(t);
    lfo.stop(t + 0.68);
    track(o, t + 0.68);
  },
  plop(E, t) {
    osc(E, 'sine', vary(600), 300, t, 0.003, 0.35, 0.06);
    for (const [m, a, d] of [[1, 0.2, 0.5], [2.76, 0.09, 0.35], [5.4, 0.05, 0.2]]) osc(E, 'sine', 1150 * m, 0, t + 0.02, 0.002, a, d);
  },
  // A light, quiet "tock" of a lid (it used to be a loud bass thump).
  bin(E, t) {
    osc(E, 'sine', vary(420), 260, t, 0.002, 0.1, 0.05);
    burst(E, t, 0.03, 0.06, 'bandpass', 1400, 1.5);
  },
  mitt(E, t) {
    burst(E, t, 0.12, 0.35, 'lowpass', 900, 0.8, 300);
    burst(E, t, 0.03, 0.25, 'bandpass', 1800, 1.2);
  },
  stamp(E, t, red = true) {
    osc(E, 'sine', 160, 70, t, 0.002, 0.6, 0.12);
    burst(E, t, 0.05, 0.3, 'lowpass', 900, 1);
    if (red) osc(E, 'square', 260, 130, t + 0.06, 0.004, 0.12, 0.25, ['lowpass', 900, 1]);
  },
  ding(E, t) {
    osc(E, 'sine', 1047, 0, t, 0.004, 0.25, 0.4);
    osc(E, 'triangle', 1319, 0, t + 0.06, 0.004, 0.22, 0.45);
  },
  star(E, t) {
    [1047, 1319, 1568].forEach((f, i) => osc(E, 'triangle', f, 0, t + i * 0.08, 0.004, 0.25, 0.35));
  },
  snore(E, t) {
    burst(E, t, 1.3, 0.12, 'lowpass', 450, 1);
    burst(E, t + 1.4, 1.5, 0.1, 'lowpass', 300, 1);
  },
  mmf(E, t) {
    osc(E, 'sine', vary(380), 0, t, 0.05, 0.12, 0.15, ['lowpass', 800, 1]);
  },
  nope(E, t) {
    osc(E, 'square', 260, 130, t, 0.004, 0.12, 0.25, ['lowpass', 900, 1]);
  },
  sigh(E, t) {
    burst(E, t, 1.0, 0.12, 'bandpass', 1400, 0.8, 700);
  },
  boof(E, t) {
    osc(E, 'sawtooth', 300, 190, t, 0.01, 0.35, 0.16, ['lowpass', 900, 1.5]);
  },
  tap(E, t) {
    osc(E, 'sine', vary(1200), 900, t, 0.002, 0.12, 0.03);
  },
  // A wooden spoon hit by the knife.
  clank(E, t) {
    osc(E, 'triangle', vary(520), 380, t, 0.002, 0.35, 0.12);
    burst(E, t, 0.03, 0.3, 'bandpass', 2200, 3);
  },
  squeak(E, t) {
    const { ctx, bus } = E;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(vary(1400), t);
    o.frequency.linearRampToValueAtTime(2100, t + 0.06);
    o.frequency.linearRampToValueAtTime(1500, t + 0.14);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 3;
    const g = ctx.createGain();
    env(ctx, g, t, 0.01, 0.12, 0.14);
    o.connect(f);
    f.connect(g);
    g.connect(bus);
    o.start(t);
    track(o, t + 0.18);
  },
  hic(E, t) {
    osc(E, 'sine', vary(520), 820, t, 0.004, 0.25, 0.06);
    burst(E, t, 0.012, 0.2, 'highpass', 2500, 1);
  },
  sneeze(E, t) {
    burst(E, t, 0.14, 0.35, 'highpass', 2500, 0.8);
    osc(E, 'sine', 300, 120, t, 0.004, 0.25, 0.12);
  },
  doorbell(E, t) {
    for (const [f, dt] of [[784, 0], [659, 0.32]]) {
      osc(E, 'sine', f, 0, t + dt, 0.003, 0.3, 0.6);
      osc(E, 'sine', f * 2.76, 0, t + dt, 0.002, 0.06, 0.3);
    }
  },
  power(E, t) {
    [523, 659, 784, 1047].forEach((f, i) => osc(E, 'triangle', f, 0, t + i * 0.05, 0.004, 0.16, 0.18));
  },
};

// Minimum time between repeats of the same sound (s).
const COOLDOWN = {
  chop: 0.05, swish: 0.12, tap: 0.05, yap: 0.25, whine: 3, snore: 3.5, mmf: 1.2, sigh: 4, crunch: 0.06,
  squish: 0.06, bin: 0.12, boof: 0.3, clank: 0.1, power: 0.3, star: 0.2,
};

export function play(name, ...args) {
  const E = engine();
  if (!E || !SOUNDS[name]) return;
  if (voices >= LIMITS.voices) return;
  const now = E.ctx.currentTime;
  if (COOLDOWN[name] && last[name] !== undefined && now - last[name] < COOLDOWN[name]) return;
  last[name] = now;
  try {
    SOUNDS[name](E, now + 0.005, ...args);
  } catch (e) {
    // A failed sound must never break the game.
  }
}
