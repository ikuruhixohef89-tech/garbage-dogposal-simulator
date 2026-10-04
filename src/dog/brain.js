// Crumb's "always on" life: breathing, blinking, ear twitches, gaze, chihuahua shiver, tail.
// An expression (from rig.js) is the base; overlays are added on top every step.

import { defaultPose, copyPose, expressionPose } from './rig.js';
import { makeSpring, stepSpring, kick, SPRING } from './springs.js';
import { makeRng, mulberry32 } from '../core/rng.js';
import { clamp, ease } from '../core/math.js';

const DEG = Math.PI / 180;

// Smooth 1D value noise in [-1, 1].
function makeNoise(seed) {
  const vals = new Float32Array(256);
  const r = mulberry32(seed);
  for (let i = 0; i < 256; i++) vals[i] = r() * 2 - 1;
  return x => {
    const i = Math.floor(x);
    const f = x - i;
    const a = vals[i & 255];
    const b = vals[(i + 1) & 255];
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
}

export function createDogBrain(seed = 1) {
  const rng = makeRng(seed);
  const noiseX = makeNoise(seed * 7 + 1);
  const noiseY = makeNoise(seed * 13 + 5);
  const base = defaultPose();
  let target = defaultPose();
  const pose = defaultPose();
  const springs = {
    earL: makeSpring(SPRING.ear),
    earR: makeSpring(SPRING.ear),
    tail: makeSpring(SPRING.tail),
    turn: makeSpring(SPRING.head),
    tiltLook: makeSpring(SPRING.head),
  };
  let t = rng.range(0, 10);
  let blinkAt = t + rng.range(1, 3);
  let blinkStart = -1;
  let blinkDouble = false;
  let blinkLead = 0; // -1 left eye leads, 1 right eye leads
  let twitchAtL = t + rng.range(2, 6);
  let twitchAtR = t + rng.range(2, 6);
  let lookX = 0;
  let lookY = 0;

  const brain = {
    pose,
    overlays: true,
    shiver: 0.15,
    tailHz: 1.2,
    tailAmp: 8 * DEG,
    look: null, // { x, y } in the dog's local units, or null to look at the camera

    setExpression(name, snap = false) {
      target = expressionPose(name);
      if (snap) copyPose(base, target);
    },

    update(dt) {
      t += dt;
      // Ease the base towards the target expression.
      const k = 1 - Math.exp(-10 * dt);
      for (const key in base) base[key] += (target[key] - base[key]) * k;
      copyPose(pose, base);
      if (!brain.overlays) return pose;

      // Breathing: 2.6 s cycle.
      pose.breath = 0.5 + 0.5 * Math.sin((t / 2.6) * Math.PI * 2);

      // Blink: close 70 ms, hold 40 ms, open 110 ms; sometimes twice; sometimes one eye leads by 16 ms.
      if (blinkStart < 0 && t >= blinkAt) {
        blinkStart = t;
        blinkDouble = rng.chance(0.15);
        blinkLead = rng.chance(0.3) ? (rng.chance(0.5) ? -1 : 1) : 0;
      }
      if (blinkStart >= 0) {
        const lid = e => {
          if (e < 0) return 0;
          if (e < 0.07) return ease.inQuad(e / 0.07);
          if (e < 0.11) return 1;
          if (e < 0.22) return 1 - ease.outQuad((e - 0.11) / 0.11);
          if (blinkDouble && e >= 0.34 && e < 0.56) return lid(e - 0.34);
          return 0;
        };
        const e = t - blinkStart;
        const closeL = lid(e - (blinkLead === 1 ? 0.016 : 0));
        const closeR = lid(e - (blinkLead === -1 ? 0.016 : 0));
        pose.eyeOpenL = 1 - closeL;
        pose.eyeOpenR = 1 - closeR;
        if (e > (blinkDouble ? 0.6 : 0.26)) {
          blinkStart = -1;
          blinkAt = t + rng.range(2.5, 5.5);
        }
      }

      // Ear twitches: an impulse, the spring does the rest.
      if (t >= twitchAtL) {
        kick(springs.earL, -rng.range(2.5, 4.5));
        twitchAtL = t + rng.range(4, 9);
        if (rng.chance(0.3)) twitchAtR = t + 0.05;
      }
      if (t >= twitchAtR) {
        kick(springs.earR, rng.range(2.5, 4.5));
        twitchAtR = t + rng.range(4, 9);
      }
      pose.earL += stepSpring(springs.earL, 0, dt);
      pose.earR += stepSpring(springs.earR, 0, dt);

      // Gaze: eyes are quick, the head follows slowly and only part of the way.
      let gx = 0;
      let gy = 0;
      if (brain.look) {
        const dx = brain.look.x - 0;
        const dy = brain.look.y - -75;
        const d = Math.hypot(dx, dy) || 1;
        gx = clamp(dx / Math.max(d, 60), -1, 1);
        gy = clamp(dy / Math.max(d, 60), -1, 1);
      }
      const ke = 1 - Math.exp(-dt / 0.06);
      lookX += (gx - lookX) * ke;
      lookY += (gy - lookY) * ke;
      pose.lookX = clamp(pose.lookX + lookX, -1, 1);
      pose.lookY = clamp(pose.lookY + lookY, -1, 1);
      pose.turn = clamp(pose.turn + stepSpring(springs.turn, gx * 0.45, dt), -1, 1);
      pose.tilt += stepSpring(springs.tiltLook, gx * 4 * DEG, dt);

      // Chihuahua shiver: value noise, never faster than ~12 Hz.
      const amp = brain.shiver * 0.8;
      pose.rootX += noiseX(t * 12) * amp;
      pose.rootY += noiseY(t * 12) * amp * 0.3;

      // Tail wag around the spring.
      const wag = Math.sin(t * Math.PI * 2 * brain.tailHz) * brain.tailAmp;
      pose.tail += stepSpring(springs.tail, wag, dt);
      return pose;
    },
  };
  return brain;
}
