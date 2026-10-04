// Crumb as an actor in the kitchen: a base mood (title sleep, idle, beg, puppy eyes, food coma)
// plus short timed actions (alert, catch -> chew -> lick, happy, tippy taps, confused, pet, zoomies, yap, sulk).
// The game tells the actor what happened; the actor only changes pose numbers.

import { createDogBrain } from './brain.js';
import { drawDog, drawRimPaws, ANCHORS } from './draw.js';
import { SCENE } from '../config.js';
import { ease, clamp } from '../core/math.js';

const DEG = Math.PI / 180;

const BASE = {
  title: { expr: 'sleep', rim: 0, depth: 34, shiver: 0.1, tailHz: 0.6, tailAmp: 4 },
  idle: { expr: 'neutral', rim: 0, depth: 0, shiver: 0.15, tailHz: 1.2, tailAmp: 8 },
  beg: { expr: 'beg', rim: 1, depth: 0, shiver: 0.6, tailHz: 3, tailAmp: 20 },
  slow: { expr: 'chew', rim: 0, depth: 4, shiver: 0.1, tailHz: 0.8, tailAmp: 6 },
  puppy: { expr: 'puppyEyes', rim: 1, depth: 0, shiver: 0.5, tailHz: 0.6, tailAmp: 4 },
  coma: { expr: 'foodComa', rim: 0, depth: 8, shiver: 0, tailHz: 0.3, tailAmp: 3 },
};

// Timed actions: dur (s), priority, apply(pose, t in 0..1, actor).
const ACTIONS = {
  alert: {
    dur: 0.6, pri: 1,
    apply(p, t) {
      const k = t < 0.4 ? ease.outBack(t / 0.4, 1.2) : 1 - ease.inOutSine((t - 0.4) / 0.6);
      p.earsBack += -0.45 * k;
      p.tilt += 12 * DEG * k;
      p.eyeOpen = Math.max(p.eyeOpen, 1 + 0.08 * k);
    },
  },
  catch: {
    dur: 0.28, pri: 2,
    apply(p, t) {
      if (t < 0.43) {
        const k = ease.outQuad(t / 0.43);
        p.jaw = Math.max(p.jaw, k);
        p.headDY -= 4 * k;
        p.eyeOpen = 1.1;
      } else {
        const k = 1 - ease.inCubic((t - 0.43) / 0.57);
        p.jaw = Math.max(p.jaw * k, k);
        // Snap: a quick squash of the head.
        p.squashY *= 1 - 0.06 * Math.sin(Math.PI * clamp((t - 0.43) / 0.3, 0, 1));
        p.earL -= 0.15;
        p.earR += 0.15;
      }
    },
  },
  chew: {
    dur: 0.22 * 3, pri: 2,
    apply(p, t) {
      const bite = (t * 3) % 1;
      const which = Math.floor(t * 3) % 2;
      const k = Math.sin(Math.PI * bite);
      p.jaw = 0.32 * k;
      p.cheekL = which ? 0.3 : 1 * (0.4 + 0.6 * k);
      p.cheekR = which ? 1 * (0.4 + 0.6 * k) : 0.3;
      p.eyeOpen = Math.min(p.eyeOpen, 0.65);
      p.headDY += 1 * k;
      p.blush = Math.max(p.blush, 0.45);
    },
  },
  swallow: {
    dur: 0.25, pri: 2,
    apply(p, t) {
      const k = Math.sin(Math.PI * t);
      p.tilt -= 3 * DEG * k;
      p.eyeOpen = Math.min(p.eyeOpen, 1 - k);
    },
  },
  lick: {
    dur: 0.45, pri: 1,
    apply(p, t, a) {
      const twice = a.lickTwice;
      const local = twice ? (t * 2) % 1 : t;
      const k = Math.sin(Math.PI * local);
      p.tongue = Math.max(p.tongue, k);
      p.tongueX = (local - 0.5) * 1.6;
      p.jaw = Math.max(p.jaw, 0.2 * k);
      p.eyeOpen = Math.min(p.eyeOpen, 0.8);
    },
  },
  happy: {
    dur: 0.9, pri: 1,
    apply(p, t) {
      const hop = t < 0.13 ? -0.4 * Math.sin(Math.PI * t / 0.13) : Math.sin(Math.PI * clamp((t - 0.13) / 0.45, 0, 1));
      p.rootY -= 10 * Math.max(0, hop);
      p.squashY *= t < 0.13 ? 0.92 : 1 + 0.06 * Math.max(0, hop);
      p.happy = 1;
      p.smile = 1;
      p.jaw = Math.max(p.jaw, 0.4);
      p.tongue = Math.max(p.tongue, 0.4);
      p.blush = Math.max(p.blush, 0.6);
    },
  },
  tippy: {
    dur: 1.2, pri: 1,
    apply(p, t) {
      const ph = t * 1.2 * 2.2 * 2;
      p.pawLiftL = 3 * Math.max(0, Math.sin(Math.PI * ph));
      p.pawLiftR = 3 * Math.max(0, Math.sin(Math.PI * (ph + 1)));
      p.happy = 1;
      p.smile = 1;
      p.blush = Math.max(p.blush, 0.55);
    },
  },
  confused: {
    dur: 0.8, pri: 3,
    apply(p, t) {
      const k = t < 0.3 ? ease.outBack(t / 0.3, 1.2) : 1 - ease.inOutSine(clamp((t - 0.7) / 0.3, 0, 1));
      p.tilt += 14 * DEG * k;
      p.earAsym += 0.7 * k;
      p.browTilt += 0.35 * k;
      p.eyeOpen = Math.max(p.eyeOpen, 1.04);
    },
  },
  pet: {
    dur: 0.6, pri: 1,
    apply(p, t) {
      const k = Math.sin(Math.PI * t);
      p.happy = 1;
      p.earsBack = Math.max(p.earsBack, 0.9 * k);
      p.blush = Math.max(p.blush, 0.65);
      p.tilt += 8 * DEG * k;
      p.smile = 1;
    },
  },
  zoomies: {
    dur: 0.8, pri: 2,
    apply(p, t) {
      p.spin = ease.inOutSine(t);
      p.happy = 1;
      p.rootY -= 4 * Math.sin(Math.PI * t);
    },
  },
  yap: {
    dur: 0.35, pri: 1,
    apply(p, t) {
      const k = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
      p.jaw = Math.max(p.jaw, 0.9 * k);
      p.earsBack += 0.5 * k;
      p.headDY += 2 * k;
      p.squashY *= 1 + 0.05 * k;
    },
  },
  sulk: {
    dur: 1.0, pri: 1,
    apply(p, t) {
      const k = Math.sin(Math.PI * t);
      p.earsBack = Math.max(p.earsBack, 0.8 * k);
      p.eyeOpen = Math.min(p.eyeOpen, 1 - 0.3 * k);
      p.browTilt += 0.6 * k;
      p.headDY += 2 * k;
    },
  },
  wake: {
    dur: 0.55, pri: 3,
    apply(p, t) {
      const k = Math.sin(Math.PI * t);
      p.earsBack += -0.5 * k;
      p.eyeOpen = Math.max(p.eyeOpen, 1 + 0.1 * k);
      p.squashY *= 1 + 0.06 * k;
    },
  },
};

export function createDogActor(seed = 7) {
  const brain = createDogBrain(seed);
  let base = 'title';
  let rim = 0;
  let depth = BASE.title.depth;
  const queue = [];
  let action = null;
  let actionT = 0;
  let lastLook = null;

  const actor = {
    brain,
    pose: brain.pose,
    lickTwice: false,
    hat: null, // skin hat: null | 'chef' | 'party' | 'crown'
    world: { x: 0, y: 0, k: 1, rimY: 0 },

    get base() {
      return base;
    },
    get busy() {
      return !!action;
    },
    get actionName() {
      return action ? action.name : null;
    },

    setBase(name) {
      if (!BASE[name] || name === base) return;
      base = name;
      const b = BASE[name];
      brain.setExpression(b.expr);
      brain.shiver = b.shiver;
      brain.tailHz = b.tailHz;
      brain.tailAmp = b.tailAmp * DEG;
    },

    // Start an action now if it outranks the current one; otherwise queue it (max 3).
    play(name, opts = {}) {
      const def = ACTIONS[name];
      if (!def) return;
      const item = { name, def, onDone: opts.onDone || null };
      if (opts.clear) {
        // Drop the queue (callbacks still fire, so nothing waits forever), emptied before they run.
        const dropped = queue.splice(0);
        for (const q of dropped) if (q.onDone) q.onDone();
      }
      if (!action || def.pri >= action.def.pri || opts.now) {
        // Swap first, then notify the interrupted action: its callback may start another action
        // (sulk -> happy), and it must see the new state, not call itself again forever.
        const prev = action;
        action = item;
        actionT = 0;
        if (prev && prev.onDone) prev.onDone();
      } else if (queue.length < 3) {
        queue.push(item);
      }
    },

    // Catch -> chew -> swallow -> (lick 60%). onSwallow fires when the food is gone.
    eat(bites = 3, onSwallow) {
      actor.lickTwice = Math.random() < 0.4;
      // Interrupted callbacks still fire, so nothing waits forever. State is cleared before they run.
      const prev = action;
      const dropped = queue.splice(0);
      action = null;
      if (prev && prev.onDone) prev.onDone();
      for (const q of dropped) if (q.onDone) q.onDone();
      queue.length = 0;
      actor.play('catch', { now: true });
      ACTIONS.chew.dur = 0.22 * bites;
      queue.push({ name: 'chew', def: ACTIONS.chew, onDone: null });
      queue.push({ name: 'swallow', def: ACTIONS.swallow, onDone: onSwallow || null });
      if (Math.random() < 0.6) queue.push({ name: 'lick', def: ACTIONS.lick, onDone: null });
    },

    look(target) {
      lastLook = target;
    },

    // Place the dog for the current layout; returns nothing. Call on every layout change.
    placeFor(layout) {
      const sc = SCENE[layout.mode];
      actor.world.x = sc.dog.x;
      actor.world.y = sc.dog.y;
      actor.world.k = sc.dog.k;
      actor.world.rimY = (sc.sink.rimY - sc.dog.y) / sc.dog.k;
    },

    update(dt) {
      const W = actor.world;
      brain.look = lastLook ? { x: (lastLook.x - W.x) / W.k, y: (lastLook.y - W.y) / W.k } : null;
      const b = BASE[base];
      rim += (b.rim - rim) * (1 - Math.exp(-dt / 0.12));
      depth += (b.depth - depth) * (1 - Math.exp(-dt / (base === 'title' ? 0.6 : 0.18)));
      const p = brain.update(dt);
      p.rimT = rim;
      p.rootY += depth - 14 * rim;
      if (action) {
        actionT += dt / action.def.dur;
        if (actionT >= 1) {
          const done = action;
          action = queue.shift() || null;
          actionT = 0;
          if (done.onDone) done.onDone();
        }
      }
      if (action) action.def.apply(p, Math.min(1, actionT), actor);
      return p;
    },

    draw(ctx, vp) {
      const L = vp.layout;
      const sink = SCENE[L.mode].sink;
      vp.worldTransform(ctx);
      ctx.save();
      // Everything below the middle of the front rim is inside the sink: hide it.
      ctx.beginPath();
      ctx.rect(L.view.x0, L.view.y0, L.view.x1 - L.view.x0, sink.rimY + sink.rimH * 0.6 - L.view.y0);
      ctx.clip();
      const W = actor.world;
      ctx.translate(W.x, W.y);
      ctx.scale(W.k, W.k);
      drawDog(ctx, actor.pose, { pxPerU: W.k * L.s, noShadow: true, rimY: W.rimY, hat: actor.hat });
      ctx.restore();
    },

    drawPaws(ctx, vp) {
      vp.worldTransform(ctx);
      const W = actor.world;
      ctx.translate(W.x, W.y);
      ctx.scale(W.k, W.k);
      drawRimPaws(ctx, actor.pose, { pxPerU: W.k * vp.layout.s, rimY: W.rimY });
    },

    // World position (lu) of an anchor, following the current pose roughly (root and head offsets).
    anchor(name) {
      const W = actor.world;
      const a = ANCHORS[name] || ANCHORS.mouth;
      const p = actor.pose;
      const headish = name !== 'paws';
      return {
        x: W.x + (a.x + p.rootX + (headish ? p.headDX : 0)) * W.k,
        y: W.y + (a.y + p.rootY + (headish ? p.headDY : 0)) * W.k,
      };
    },

    // Rough hit test for petting: an ellipse around the head, in lu.
    hitHead(x, y) {
      const h = actor.anchor('head');
      const k = actor.world.k;
      const dx = (x - h.x) / (32 * k);
      const dy = (y - h.y) / (30 * k);
      return dx * dx + dy * dy <= 1;
    },
  };
  brain.setExpression('sleep', true);
  return actor;
}
