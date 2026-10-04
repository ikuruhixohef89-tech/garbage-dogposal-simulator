// Damped springs for secondary motion (ears, tail, head lag, cheeks). Stepped at the fixed 1/60 s.

import { springK, springC } from '../core/math.js';

export const SPRING = {
  ear: [3.2, 0.35],
  fur: [4.5, 0.3],
  tail: [2.5, 0.4],
  cheek: [6, 0.5],
  head: [4, 0.6],
};

export function makeSpring([freq, zeta], x = 0) {
  return { x, v: 0, k: springK(freq), c: springC(freq, zeta) };
}

export function stepSpring(s, target, dt) {
  s.v += (s.k * (target - s.x) - s.c * s.v) * dt;
  s.x += s.v * dt;
  return s.x;
}

export function kick(s, impulse) {
  s.v += impulse;
}
