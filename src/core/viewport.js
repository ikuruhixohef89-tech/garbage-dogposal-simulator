// Canvas sizing, DPR cap, safe area, resize pipeline and fullscreen.
// Resize events only set a flag; the canvas is resized at most once per frame in apply().

import { LIMITS } from '../config.js';
import { computeLayout } from './layout.js';

function readSafeArea() {
  const cs = getComputedStyle(document.documentElement);
  const n = name => parseFloat(cs.getPropertyValue(name)) || 0;
  return { t: n('--sat'), r: n('--sar'), b: n('--sab'), l: n('--sal') };
}

export function createViewport({ stage, canvas, perf }) {
  const vp = {
    cssW: 0,
    cssH: 0,
    dpr: 1,
    bw: 1,
    bh: 1,
    kx: 1,
    ky: 1,
    layout: null,
    version: 0,
    needs: true,
  };
  let prevMode = null;
  const mark = () => {
    vp.needs = true;
  };
  vp.mark = mark;

  if (typeof ResizeObserver === 'function') new ResizeObserver(mark).observe(stage);
  window.addEventListener('resize', mark);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', mark);
  window.addEventListener('orientationchange', () => {
    // iOS reports stale sizes right after rotation; check again a little later.
    mark();
    setTimeout(mark, 100);
    setTimeout(mark, 300);
  });
  document.addEventListener('fullscreenchange', mark);
  document.addEventListener('webkitfullscreenchange', mark);

  vp.apply = function apply() {
    if (!vp.needs) return false;
    vp.needs = false;
    const cssW = Math.max(1, stage.clientWidth);
    const cssH = Math.max(1, stage.clientHeight);
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      LIMITS.maxDpr,
      Math.sqrt(LIMITS.maxBackingPx / (cssW * cssH)),
      perf.dynCap,
    );
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    const layout = computeLayout(cssW, cssH, readSafeArea(), prevMode);
    prevMode = layout.mode;
    const old = vp.layout;
    const layoutChanged =
      !old || old.mode !== layout.mode || old.cssW !== layout.cssW || old.cssH !== layout.cssH ||
      Math.abs(old.s - layout.s) > 1e-9 || Math.abs(old.ox - layout.ox) > 1e-6 || Math.abs(old.oy - layout.oy) > 1e-6;
    const sizeChanged = bw !== vp.bw || bh !== vp.bh;
    vp.cssW = cssW;
    vp.cssH = cssH;
    vp.dpr = dpr;
    vp.bw = bw;
    vp.bh = bh;
    vp.kx = bw / cssW;
    vp.ky = bh / cssH;
    vp.layout = layout;
    vp.version++;
    // Callers re-bake on any change, but move game objects only when the layout itself changed.
    if (!layoutChanged && !sizeChanged) return false;
    return { layout: layoutChanged, size: sizeChanged, mode: !old || old.mode !== layout.mode };
  };

  // Transform that maps design units (lu) to backing-store pixels.
  vp.worldTransform = function worldTransform(ctx) {
    const L = vp.layout;
    ctx.setTransform(vp.kx * L.s, 0, 0, vp.ky * L.s, vp.kx * L.ox, vp.ky * L.oy);
  };

  return vp;
}

export function fullscreenSupported() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

// Returns true if the request was sent (the browser may still refuse it, or never answer).
export function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      const p = exit && exit.call(document);
      if (p && p.catch) p.catch(() => {});
      return true;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return false;
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
    return true;
  } catch (e) {
    // Fullscreen refused (no permission in this frame).
    return false;
  }
}
