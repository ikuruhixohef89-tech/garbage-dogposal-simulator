// Boot: wires viewport, input, audio, UI, the dog and the kitchen session together.

import { S } from './strings.js';
import { createLoop } from './core/loop.js';
import { createViewport, toggleFullscreen, fullscreenSupported } from './core/viewport.js';
import { createInput } from './core/input.js';
import * as storage from './core/storage.js';
import { createPerf } from './core/perf.js';
import * as audio from './audio/audio.js';
import * as sfx from './audio/sfx.js';
import { createKitchenBackground } from './render/kitchen.js';
import { createFx } from './render/fx.js';
import { createDogActor } from './dog/states.js';
import { createSession } from './game/session.js';
import { createScreens, fillStrings } from './ui/screens.js';
import { createHud } from './ui/hud.js';
import { SKINS, skinAt } from './game/skins.js';
import { PALETTE } from './config.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
// Transparent: the static kitchen lives on #bg underneath and is not redrawn every frame.
const ctx = canvas.getContext('2d');
const PARAMS = new URLSearchParams(location.search);
const DEBUG = PARAMS.get('debug') === '1';
// Debug only: the in-app test browser throttles hidden panes to a few frames per second.
const NO_STALL_PAUSE = DEBUG && PARAMS.get('nostall') === '1';

fillStrings(document);
canvas.setAttribute('aria-label', S.ariaGame);

const saved = storage.load();
audio.setMuted(!!saved.muted);

const perf = createPerf();
const vp = createViewport({ stage, canvas, perf });
const kitchen = createKitchenBackground(document.getElementById('bg'));
const fx = createFx();
const dog = createDogActor(7);
const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
fx.setReducedMotion(!!(reducedMotion && reducedMotion.matches));

const game = {
  paused: false,
  pauseReason: null,
  uiHidden: false,
};

// ---------- UI ----------

// Skins recolor the bandana and may add a hat. The choice is a setting; what is unlocked comes from records.
function applySkin(index) {
  const s = skinAt(index);
  [PALETTE.dog.bandana, PALETTE.dog.bandanaDot, PALETTE.dog.bandanaShade] = s.bandana;
  dog.hat = s.hat;
}

const screens = createScreens({
  onPlay: () => startRun('sort'),
  onPlayRush: () => startRun('rush'),
  // Training can be replayed any time: it runs the Sort & Feed tutorial, then the first shift.
  onTraining: () => startRun('sort', { training: true }),
  getTop: (mode, level) => storage.topFor(mode, level),
  getSkins: () => {
    const s = storage.get();
    return { list: SKINS, best: s.best || 0, current: Math.min(s.skin || 0, SKINS.length - 1) };
  },
  onSkin: i => {
    const s = storage.get();
    if ((s.best || 0) < skinAt(i).need) return;
    storage.save({ skin: i });
    applySkin(i);
    sfx.play('tap');
  },
  onResume: resume,
  onToggleSound: toggleMute,
  onHideUi: () => {
    resume();
    setUiHidden(true);
  },
  onRestart: restart,
  onMenu: toMenu,
  onAgain: () => {
    sfx.play('tap');
    screens.hideGameOverlays();
    hud.clearAi();
    session.start(lastMode);
  },
});
const hud = createHud({ onPause: () => pause('user'), onMute: toggleMute, onFullscreen });
hud.setMuted(audio.isMuted());
hud.setFullscreenAvailable(fullscreenSupported());
hud.setInGame(false);
applySkin(saved.skin || 0);
screens.setSoundLabel(audio.isMuted());
refreshTitle();

const session = createSession({
  vp,
  dog,
  fx,
  kitchen,
  storage,
  ui: {
    hud: h => hud.update(h),
    // Cards, shift results and the report are never hidden by H.
    shiftCard: (info, done) => {
      setUiHidden(false);
      return screens.shiftCard(info, done);
    },
    skipCard: () => screens.skipCard(),
    shiftEnd: info => {
      setUiHidden(false);
      screens.shiftEnd(info);
    },
    hideShiftEnd: () => screens.hideShiftEnd(),
    cards: (list, onPick) => {
      setUiHidden(false);
      screens.cards(list, onPick);
    },
    report: d => {
      setUiHidden(false);
      screens.report(d);
    },
    aiLine: (text, ms, priority) => hud.aiLine(text, ms, priority),
  },
});

// ---------- Scene flow ----------

function setPlaying(on) {
  document.documentElement.classList.toggle('playing', on);
}

let lastMode = 'sort'; // restarts and Again keep the mode of the run

function startRun(gameMode = 'sort', opts = {}) {
  if (session.mode === 'game') return;
  lastMode = gameMode;
  audio.unlock(); // inside the click / key handler: counts as a user gesture
  audio.playStart();
  setTimeout(() => sfx.play('yap'), 250);
  setPlaying(true);
  screens.showTitle(false);
  hud.setInGame(true);
  dog.play('wake', { now: true });
  session.start(lastMode, opts);
}

function pause(reason) {
  if (session.mode !== 'game' || game.paused) return;
  game.paused = true;
  game.pauseReason = reason;
  session.cancelPointer(); // a drag in progress must not be left hanging in the air
  setUiHidden(false);
  screens.showPause(reason);
}

function resume() {
  if (!game.paused) return;
  game.paused = false;
  game.pauseReason = null;
  screens.hidePause();
  audio.unlock(); // resumes a suspended or interrupted context; this runs inside a tap
}

function restart() {
  if (session.mode !== 'game') return;
  resume();
  screens.hideGameOverlays();
  hud.clearAi();
  session.start(lastMode);
}

// The title shows the best score and how many skins it has opened.
function refreshTitle() {
  const s = storage.get();
  const best = s.best || 0;
  const open = SKINS.filter(k => best >= k.need).length;
  screens.setTitleBest(best > 0 ? S.titleBest(best, open, SKINS.length) : '');
}

// Back to the title screen from the pause menu or the report. The run is dropped; records are already saved.
function toMenu() {
  resume();
  screens.hideGameOverlays();
  hud.clearAi();
  session.toTitle();
  setPlaying(false);
  setUiHidden(false);
  hud.setInGame(false);
  refreshTitle();
  screens.showTitle(true);
  sfx.play('tap');
}

function toggleMute() {
  const m = !audio.isMuted();
  audio.setMuted(m);
  storage.save({ muted: m ? 1 : 0 });
  hud.setMuted(m);
  screens.setSoundLabel(m);
  if (!m) audio.toggleSound(true);
}

function setUiHidden(on) {
  game.uiHidden = on;
  stage.classList.toggle('ui-hidden', on);
  session.setUiHidden(on);
}

// Some hosts refuse fullscreen (an iframe without allow="fullscreen") or never answer the request
// (embedded app browsers). Either way the player gets a hint instead of a button that does nothing.
let fsHintTimer = 0;
function onFullscreen() {
  const wasFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (!fullscreenSupported() || !toggleFullscreen()) {
    hud.toast(S.fullscreenBlocked, 3200);
    return;
  }
  if (wasFull) return;
  clearTimeout(fsHintTimer);
  fsHintTimer = setTimeout(() => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) hud.toast(S.fullscreenBlocked, 3200);
  }, 1200);
}

// ---------- Input ----------

let cornerTapAt = 0;

createInput({
  stage,
  canvas,
  vp,
  isCapturing: () => session.mode === 'game' && !game.paused,
  onPointer(type, p) {
    // With the UI hidden on a touch screen, a double tap in the top-left corner brings it back.
    if (type === 'down' && game.uiHidden && p.cx < 80 && p.cy < 80) {
      if (p.t - cornerTapAt < 350) setUiHidden(false);
      cornerTapAt = p.t;
    }
    if (game.paused) return;
    // iOS can put the audio context into 'interrupted' (a call, Siri) without hiding the page.
    // pointerup is a user activation, so this is the moment to wake it.
    if (type === 'up' && session.mode === 'game' && audio.state() !== 'running') audio.unlock();
    if (session.mode !== 'game') {
      if (type === 'hover' || type === 'move' || type === 'down') dog.look({ x: p.x, y: p.y });
      return;
    }
    session.pointer(type, p);
  },
  onKey(action) {
    switch (action) {
      case 'hideUi':
        if (game.paused) resume();
        setUiHidden(!game.uiHidden);
        return true;
      case 'fullscreen':
        onFullscreen();
        return true;
      case 'mute':
        toggleMute();
        return true;
      case 'pause':
        if (session.mode === 'game') {
          if (game.paused) resume();
          else pause('user');
        }
        return true;
      case 'restart':
        if (session.mode === 'game' && (game.paused || screens.reportOpen)) {
          resume();
          screens.hideGameOverlays();
          hud.clearAi();
          session.start(lastMode);
        }
        return true;
      case 'pick1':
      case 'pick2':
      case 'pick3':
        if (game.paused) return true;
        if (screens.cardsOpen) screens.pickCard(Number(action.slice(4)) - 1);
        else session.key(action); // Sort & Feed: 1 / 2 / 3 send a tray piece to the dog, bowl or bin
        return true;
      case 'confirm':
      case 'chop':
        if (session.mode !== 'game') {
          startRun();
          return true;
        }
        if (game.paused) {
          resume();
          return true;
        }
        if (screens.reportOpen) {
          screens.hideGameOverlays();
          hud.clearAi();
          session.start(lastMode);
          return true;
        }
        if (screens.overlayOpen) {
          screens.skipCard();
          return true;
        }
        if (action === 'chop') session.key('chop');
        return true;
      default:
        if (!game.paused) session.key(action);
        return true;
    }
  },
});

// ---------- Visibility ----------

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    loop.stop();
    audio.suspend();
    pause('visibility');
  } else {
    vp.mark();
    loop.start();
  }
});

// ---------- Loop ----------

const dbgEl = document.getElementById('dbg');
let dbgAt = 0;

function update(dt) {
  if (!game.paused) session.update(dt);
}

function render(alpha, intervalMs, now) {
  const t0 = performance.now();
  const changed = vp.apply();
  if (changed) {
    const L = vp.layout;
    // A layout change re-paints the kitchen at once (the front rim must match it); a DPR-only change can wait.
    kitchen.invalidate(changed.layout ? 1 : now);
    stage.classList.toggle('compact', L.compact);
    stage.classList.toggle('portrait', L.mode === 'portrait');
    document.documentElement.style.setProperty('--ui', L.uiScale.toFixed(3));
    // Only a real layout change (size, mode, scale) moves things; a new DPR cap just re-bakes.
    if (changed.layout) {
      dog.placeFor(L);
      session.onLayout(L, changed.mode);
    }
  }
  session.render(ctx, now);

  const workMs = performance.now() - t0;
  if (perf.frame(workMs, intervalMs, now)) vp.mark();
  if (DEBUG && now - dbgAt > 500) {
    dbgAt = now;
    const st = perf.stats();
    const L = vp.layout;
    dbgEl.textContent =
      `fps ${st.fps}  work p50 ${st.workP50} / p95 ${st.workP95} ms\n` +
      `${vp.cssW}x${vp.cssH} css  dpr ${vp.dpr.toFixed(2)} (cap ${st.dynCap})  ${vp.bw}x${vp.bh}\n` +
      `${L.mode} s=${L.s.toFixed(3)} ui=${L.uiScale.toFixed(2)}${L.compact ? ' compact' : ''}\n` +
      `${session.mode}/${session.phase}${game.paused ? ' (paused)' : ''}  audio ${audio.state()}`;
  }
}

const loop = createLoop({
  update,
  render,
  onStall() {
    // The frame was throttled (tab hidden, iframe scrolled away): pause instead of jumping ahead.
    if (!NO_STALL_PAUSE) pause('visibility');
  },
});

// ---------- Debug hooks (only with ?debug=1) ----------

// True when no edge row/column of the canvas is pure black (= unpainted, letterbox).
function checkNoBars() {
  const w = canvas.width;
  const h = canvas.height;
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(document.getElementById('bg'), 0, 0, w, h);
  sctx.drawImage(canvas, 0, 0);
  const d = sctx.getImageData(0, 0, w, h).data;
  const at = (x, y) => (y * w + x) * 4;
  const lineBlack = (x0, y0, dx, dy, n) => {
    for (let k = 0; k < n; k++) {
      const i = at(x0 + dx * k, y0 + dy * k);
      if (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8) return false;
    }
    return true;
  };
  const black = [lineBlack(0, 0, 1, 0, w), lineBlack(0, h - 1, 1, 0, w), lineBlack(0, 0, 0, 1, h), lineBlack(w - 1, 0, 0, 1, h)];
  return { ok: !black.includes(true), top: !black[0], bottom: !black[1], left: !black[2], right: !black[3] };
}

if (DEBUG) {
  dbgEl.hidden = false;
  window.__gds = {
    audio: () => audio.state(),
    scene: () => session.mode,
    phase: () => session.phase,
    paused: () => game.paused,
    layout: () => ({ ...vp.layout, zones: undefined }),
    canvas: () => ({ w: canvas.width, h: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight, dpr: vp.dpr }),
    storage: () => ({ available: storage.isAvailable(), data: storage.get() }),
    stats: () => perf.stats(),
    state: () => session.dev.state(),
    dev: session.dev,
    checkNoBars,
    // Advance the simulation by `sec` seconds in fixed 1/60 s steps, then draw one frame.
    advance(sec) {
      const n = Math.round(sec * 60);
      for (let i = 0; i < n; i++) update(1 / 60);
      render(0, 16.7, performance.now());
      return session.dev.state();
    },
    // CPU cost of `frames` update+render steps, with a per-part breakdown of render (ms, averages).
    bench(frames = 120, flush = false) {
      const times = [];
      session.dev.profile(true, flush);
      for (let i = 0; i < frames; i++) {
        update(1 / 60);
        const t0 = performance.now();
        session.render(ctx, performance.now());
        times.push(performance.now() - t0);
      }
      const parts = session.dev.profile(false);
      times.sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / frames;
      return {
        backing: `${canvas.width}x${canvas.height}`,
        avg: +avg.toFixed(3),
        p50: +times[Math.floor(frames * 0.5)].toFixed(3),
        p95: +times[Math.floor(frames * 0.95)].toFixed(3),
        parts,
      };
    },
  };
}

stage.classList.remove('booting');
loop.start();
