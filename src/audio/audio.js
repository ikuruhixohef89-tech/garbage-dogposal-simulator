// Web Audio engine. The AudioContext is created only inside a user gesture (PLAY click or key),
// never at load time, so browsers do not warn about autoplay.

let ctx = null;
let master = null;
let sfxBus = null;
let muted = false;
const MASTER_GAIN = 0.8;

export function unlock() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_GAIN;
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      master.connect(comp);
      comp.connect(ctx.destination);
      // Old iOS needs a sound started inside the gesture to unlock output.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
    if (ctx.state !== 'running') {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function state() {
  return ctx ? ctx.state : 'none';
}

// For sfx.js: the context and the effects bus, or null before the first gesture.
export function engine() {
  return ctx && ctx.state === 'running' ? { ctx, bus: sfxBus } : null;
}

export function suspend() {
  if (ctx && ctx.state === 'running') {
    const p = ctx.suspend();
    if (p && p.catch) p.catch(() => {});
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = !!m;
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime, 0.015);
}

function tone(type, f0, f1, t0, dur, peak, bus = sfxBus) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  o.onended = () => g.disconnect();
}

// PLAY jingle: C5-E5-G5-C6, 55 ms each.
export function playStart() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('triangle', f, f, t + i * 0.055, i === 3 ? 0.35 : 0.09, 0.3));
}

export function uiClick() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  tone('sine', 660, 660, t, 0.025, 0.2);
  tone('sine', 990, 990, t + 0.01, 0.018, 0.15);
}

export function toggleSound(on) {
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  if (on) tone('sine', 660, 880, t, 0.05, 0.2);
  else tone('sine', 880, 660, t, 0.05, 0.2);
}
