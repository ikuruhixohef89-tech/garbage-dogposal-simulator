// Pure layout math: picks landscape or portrait, fits the design box, maps zones to CSS px.
// No DOM access, so Node tests can import it.

import { BOX, LAYOUT, ZONES, UI_SCALE } from '../config.js';
import { clamp } from './math.js';

export const ZONE_NAMES = ['sink', 'bowl', 'bin', 'tray'];

export function computeLayout(cssW, cssH, safe = { t: 0, r: 0, b: 0, l: 0 }, prevMode = null) {
  const W = Math.max(1, cssW);
  const H = Math.max(1, cssH);
  const sl = safe.l || 0;
  const sr = safe.r || 0;
  const st = safe.t || 0;
  const sb = safe.b || 0;
  const safeW = Math.max(1, W - sl - sr);
  const safeH = Math.max(1, H - st - sb);

  const uL = Math.min(safeW / BOX.landscape.w, safeH / BOX.landscape.h);
  const uP = Math.min(safeW / BOX.portrait.w, safeH / BOX.portrait.h);
  let mode = uP > uL ? 'portrait' : 'landscape';
  if (prevMode && mode !== prevMode && Math.max(uL, uP) / Math.min(uL, uP) < LAYOUT.hysteresis) {
    mode = prevMode;
  }

  const box = BOX[mode];
  const s = Math.min(safeW / box.w, safeH / box.h);
  const extraX = safeW - box.w * s;
  const extraY = safeH - box.h * s;
  const ox = sl + extraX / 2;
  const oy = st + extraY * LAYOUT.extraYTop[mode];

  const uiScale = clamp(Math.min(W / UI_SCALE.refW, H / UI_SCALE.refH), UI_SCALE.min, UI_SCALE.max);

  return {
    mode,
    s,
    ox,
    oy,
    cssW: W,
    cssH: H,
    box,
    safe: { t: st, r: sr, b: sb, l: sl },
    compact: H < LAYOUT.compactCssH,
    uiScale,
    // The whole screen expressed in design units; the background paints this rect.
    view: {
      x0: -ox / s,
      y0: -oy / s,
      x1: (W - ox) / s,
      y1: (H - oy) / s,
    },
    zones: ZONES[mode],
  };
}

export function toCss(L, x, y) {
  return { x: L.ox + x * L.s, y: L.oy + y * L.s };
}

export function toDesign(L, cx, cy) {
  return { x: (cx - L.ox) / L.s, y: (cy - L.oy) / L.s };
}

export function zoneCss(L, name) {
  const z = L.zones[name];
  return { x: L.ox + z.x * L.s, y: L.oy + z.y * L.s, w: z.w * L.s, h: z.h * L.s };
}

// Hit rect for a world target: the zone grown around its center to at least minHitCss on each side.
export function hitRectCss(L, name) {
  const r = zoneCss(L, name);
  const m = LAYOUT.minHitCss;
  const w = Math.max(r.w, m);
  const h = Math.max(r.h, m);
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}
