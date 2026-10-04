// Kitchen: tiled wall, window, sticker, counter, sink, faucet, bowl, cabinets.
// Two baked layers for the whole screen (no letterbox):
//   back  — everything behind the dog;
//   front — the sink's front rim and the bowl's front, drawn over the dog and the bowl contents.
// Both are rebuilt 120 ms after the size stops changing.

import { PALETTE, KITCHEN, SCENE } from '../config.js';
import { S } from '../strings.js';
import { mulberry32, hash2 } from '../core/rng.js';
import { mixHex, rgba, roundRectPath } from '../core/math.js';
import { makeCanvas, freeCanvas } from './cache.js';

const REBUILD_DELAY_MS = 120;
const C = PALETTE.scene;
const INK = PALETTE.ui.ink;
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, "Segoe UI", Roboto, sans-serif';

function rr(g, x, y, w, h, r) {
  g.beginPath();
  roundRectPath(g, x, y, w, h, r);
}

// ---------- wall ----------

function paintWall(g, v, K) {
  const top = v.y0 - 2;
  g.fillStyle = C.grout;
  g.fillRect(v.x0 - 2, top, v.x1 - v.x0 + 4, K.wallBottom - top);
  const gap = 3;
  const r0 = Math.floor(top / K.tileH);
  const r1 = Math.ceil(K.wallBottom / K.tileH);
  for (let row = r0; row < r1; row++) {
    const shift = row & 1 ? K.tileW / 2 : 0;
    const c0 = Math.floor((v.x0 - shift) / K.tileW) - 1;
    const c1 = Math.ceil((v.x1 - shift) / K.tileW) + 1;
    const y = row * K.tileH;
    for (let col = c0; col <= c1; col++) {
      const x = col * K.tileW + shift;
      const rnd = mulberry32(hash2(col, row))();
      g.fillStyle = mixHex(C.tile, C.tileShade, rnd * 0.45);
      rr(g, x + gap / 2, y + gap / 2, K.tileW - gap, K.tileH - gap, 6);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(x + 8, y + gap / 2 + 3, K.tileW - 16, 5);
    }
  }
  const cx = v.x0 + (v.x1 - v.x0) * 0.75;
  const glow = g.createRadialGradient(cx, top, 0, cx, top, 900);
  glow.addColorStop(0, rgba(C.wallGlow, 0.55));
  glow.addColorStop(1, rgba(C.wallGlow, 0));
  g.fillStyle = glow;
  g.fillRect(v.x0 - 2, top, v.x1 - v.x0 + 4, K.wallBottom - top);
}

function paintWindow(g, W) {
  if (!W) return;
  const { x, y, w, h } = W;
  g.fillStyle = 'rgba(58,36,24,0.12)';
  rr(g, x + 6, y + 10, w, h, 18);
  g.fill();
  g.fillStyle = '#FFFFFF';
  rr(g, x, y, w, h, 18);
  g.fill();
  const ix = x + 18;
  const iy = y + 18;
  const iw = w - 36;
  const ih = h - 36;
  const sky = g.createLinearGradient(0, iy, 0, iy + ih);
  sky.addColorStop(0, C.sky);
  sky.addColorStop(1, C.skyLight);
  g.fillStyle = sky;
  rr(g, ix, iy, iw, ih, 8);
  g.fill();
  g.save();
  rr(g, ix, iy, iw, ih, 8);
  g.clip();
  // A cloud and a bush.
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [cx, cy, r] of [[ix + iw * 0.3, iy + ih * 0.3, 20], [ix + iw * 0.38, iy + ih * 0.25, 26], [ix + iw * 0.47, iy + ih * 0.31, 18]]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#9CC59A';
  for (const [cx, r] of [[0.1, 60], [0.35, 48], [0.6, 66], [0.88, 54]]) {
    g.beginPath();
    g.arc(ix + iw * cx, iy + ih + 18, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  // Frame bars and sill.
  g.fillStyle = '#EDE6DA';
  g.fillRect(x + w / 2 - 5, iy, 10, ih);
  g.fillRect(ix, y + h / 2 - 5, iw, 10);
  g.fillStyle = '#FFFFFF';
  rr(g, x - 14, y + h - 6, w + 28, 22, 8);
  g.fill();
  g.strokeStyle = 'rgba(58,36,24,0.18)';
  g.lineWidth = 3;
  g.stroke();
}

function paintSticker(g, St) {
  if (!St) return;
  g.save();
  g.translate(St.x + St.w / 2, St.y + St.h / 2);
  g.rotate(St.rot);
  g.fillStyle = 'rgba(58,36,24,0.12)';
  rr(g, -St.w / 2 + 5, -St.h / 2 + 7, St.w, St.h, 8);
  g.fill();
  g.fillStyle = '#FFF6C9';
  rr(g, -St.w / 2, -St.h / 2, St.w, St.h, 8);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.fillRect(-36, -St.h / 2 - 10, 72, 22);
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 28px ${FONT}`;
  S.stickerLines.forEach((line, i) => g.fillText(line, 0, -St.h / 2 + 30 + i * 32));
  g.restore();
}

// ---------- counter ----------

function paintCounter(g, v, K) {
  const x = v.x0 - 2;
  const w = v.x1 - v.x0 + 4;
  g.fillStyle = C.counter;
  g.fillRect(x, K.wallBottom, w, K.counterFront - K.wallBottom);
  const sh = g.createLinearGradient(0, K.wallBottom, 0, K.wallBottom + 26);
  sh.addColorStop(0, rgba(C.counterShadow, 0.55));
  sh.addColorStop(1, rgba(C.counterShadow, 0));
  g.fillStyle = sh;
  g.fillRect(x, K.wallBottom, w, 26);
  const rnd = mulberry32(7);
  const area = w * (K.counterFront - K.wallBottom);
  const count = Math.min(1600, Math.floor(area / 1600));
  g.fillStyle = C.counterSpeck;
  g.beginPath();
  for (let i = 0; i < count; i++) {
    const px = x + rnd() * w;
    const py = K.wallBottom + 10 + rnd() * (K.counterFront - K.wallBottom - 14);
    const r = 1.2 + rnd() * 2.2;
    g.moveTo(px + r, py);
    g.arc(px, py, r, 0, Math.PI * 2);
  }
  g.fill();
  g.fillStyle = C.counterEdge;
  g.fillRect(x, K.counterFront, w, K.edge);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(x, K.counterFront, w, 3);
}

function paintCabinets(g, v, K) {
  const top = K.counterFront + K.edge;
  const bottom = v.y1 + 2;
  if (bottom <= top) return;
  const x0 = v.x0 - 2;
  g.fillStyle = C.cabinet;
  g.fillRect(x0, top, v.x1 - v.x0 + 4, bottom - top);
  const sh = g.createLinearGradient(0, top, 0, top + 40);
  sh.addColorStop(0, rgba(C.cabinetShade, 0.9));
  sh.addColorStop(1, rgba(C.cabinetShade, 0));
  g.fillStyle = sh;
  g.fillRect(x0, top, v.x1 - v.x0 + 4, 40);
  const doorW = 400;
  const d0 = Math.floor(v.x0 / doorW) - 1;
  const d1 = Math.ceil(v.x1 / doorW) + 1;
  g.lineWidth = 4;
  g.strokeStyle = C.cabinetShade;
  for (let d = d0; d <= d1; d++) {
    const dx = d * doorW;
    rr(g, dx + 18, top + 26, doorW - 36, Math.max(40, bottom - top - 40), 14);
    g.stroke();
    g.fillStyle = C.handle;
    rr(g, dx + doorW / 2 - 40, top + 46, 80, 12, 6);
    g.fill();
  }
}

// ---------- sink and faucet ----------

function paintSinkBack(g, sk) {
  const { x, w, backY, rimY } = sk;
  // Back rim (lip) of the basin.
  g.fillStyle = C.steel2;
  rr(g, x - 14, backY - 18, w + 28, rimY - backY + 70, 34);
  g.fill();
  // Basin interior: the back wall gets darker towards the bottom.
  const inner = g.createLinearGradient(0, backY, 0, rimY + 40);
  inner.addColorStop(0, C.steel3);
  inner.addColorStop(1, C.steel4);
  g.fillStyle = inner;
  rr(g, x, backY, w, rimY - backY + 60, 26);
  g.fill();
  // Brushed steel streaks.
  g.strokeStyle = 'rgba(255,255,255,0.07)';
  g.lineWidth = 2;
  for (let yy = backY + 12; yy < rimY + 30; yy += 11) {
    g.beginPath();
    g.moveTo(x + 18, yy);
    g.lineTo(x + w - 18, yy);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(x + 20, backY - 13, w - 40, 3);
}

function paintFaucet(g, F) {
  const { x, y, h, reach } = F;
  const top = y - h;
  const pipe = new Path2D();
  pipe.moveTo(x, y - 6);
  pipe.lineTo(x, top + 34);
  pipe.quadraticCurveTo(x, top, x + reach * 0.5, top);
  pipe.quadraticCurveTo(x + reach, top, x + reach, top + 34);
  pipe.lineTo(x + reach, top + 52);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 26;
  g.strokeStyle = C.chrome4;
  g.stroke(pipe);
  g.lineWidth = 20;
  g.strokeStyle = C.chrome3;
  g.stroke(pipe);
  g.lineWidth = 12;
  g.strokeStyle = C.chrome2;
  g.stroke(pipe);
  g.lineWidth = 4;
  g.strokeStyle = C.chrome1;
  g.save();
  g.translate(-4, -2);
  g.stroke(pipe);
  g.restore();
  // Base and lever.
  g.fillStyle = C.chrome3;
  rr(g, x - 24, y - 16, 48, 22, 8);
  g.fill();
  g.fillStyle = C.chrome1;
  g.fillRect(x - 18, y - 13, 36, 4);
  g.strokeStyle = C.chrome3;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(x - 4, y - 40);
  g.lineTo(x - 36, y - 58);
  g.stroke();
}

function paintSinkFront(g, sk) {
  const { x, w, rimY, rimH } = sk;
  const grad = g.createLinearGradient(0, rimY, 0, rimY + rimH);
  grad.addColorStop(0, C.steel1);
  grad.addColorStop(0.55, C.steel2);
  grad.addColorStop(1, C.steel3);
  g.fillStyle = grad;
  rr(g, x - 14, rimY, w + 28, rimH, 18);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(x + 10, rimY + 5, w - 20, 4);
  g.strokeStyle = rgba(C.steel4, 0.6);
  g.lineWidth = 3;
  rr(g, x - 14, rimY, w + 28, rimH, 18);
  g.stroke();
}

// ---------- bowl ----------

export function bowlGeometry(z) {
  const cx = z.x + z.w / 2;
  const rimY = z.y + z.h * 0.3;
  const rx = z.w / 2;
  const ry = Math.min(44, z.h * 0.16);
  const bottom = z.y + z.h - 8;
  return { cx, rimY, rx, ry, bottom };
}

function paintBowlBack(g, z) {
  const b = bowlGeometry(z);
  g.fillStyle = 'rgba(58,36,24,0.16)';
  g.beginPath();
  g.ellipse(b.cx + 8, b.bottom + 4, b.rx * 0.62, 16, 0, 0, Math.PI * 2);
  g.fill();
  // Inside of the bowl (seen over the front lip).
  g.fillStyle = '#E8E0D2';
  g.beginPath();
  g.ellipse(b.cx, b.rimY, b.rx, b.ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(58,36,24,0.12)';
  g.beginPath();
  g.ellipse(b.cx, b.rimY + b.ry * 0.25, b.rx * 0.86, b.ry * 0.7, 0, 0, Math.PI * 2);
  g.fill();
}

function bowlBodyPath(b) {
  const p = new Path2D();
  p.moveTo(b.cx - b.rx, b.rimY);
  p.bezierCurveTo(b.cx - b.rx, b.rimY + (b.bottom - b.rimY) * 0.75, b.cx - b.rx * 0.6, b.bottom, b.cx - b.rx * 0.45, b.bottom);
  p.lineTo(b.cx + b.rx * 0.45, b.bottom);
  p.bezierCurveTo(b.cx + b.rx * 0.6, b.bottom, b.cx + b.rx, b.rimY + (b.bottom - b.rimY) * 0.75, b.cx + b.rx, b.rimY);
  p.ellipse(b.cx, b.rimY, b.rx, b.ry, 0, 0, Math.PI, false);
  p.closePath();
  return p;
}

function paintBowlFront(g, z) {
  const b = bowlGeometry(z);
  const body = bowlBodyPath(b);
  const grad = g.createLinearGradient(b.cx - b.rx, 0, b.cx + b.rx, 0);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.45, C.bowl);
  grad.addColorStop(1, '#DCD3C4');
  g.fillStyle = grad;
  g.fill(body);
  g.save();
  g.clip(body);
  g.fillStyle = C.bowlStripe;
  g.fillRect(b.cx - b.rx, b.rimY + b.ry + 14, b.rx * 2, 14);
  g.restore();
  g.strokeStyle = rgba(INK, 0.55);
  g.lineWidth = 4;
  g.stroke(body);
  g.beginPath();
  g.ellipse(b.cx, b.rimY, b.rx, b.ry, 0, 0, Math.PI, false);
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = 5;
  g.stroke();
}

// ---------- public ----------

// attached: a DOM <canvas> placed under the game canvas. When given, the static kitchen is painted there once
// per layout and the browser composites it for free; the game canvas is transparent and only clears each frame.
// Without it (tools/capture.html), the back layer is baked offscreen and copied into the frame.
// The sink's front rim and the bowl's front are small: they are drawn as vectors every frame (drawFront),
// which is far cheaper than blending a full-screen layer.
export function createKitchenBackground(attached = null) {
  let back = null;
  let dirtyAt = 0;
  let built = false;

  function paintBack(g, vp) {
    const L = vp.layout;
    const K = KITCHEN[L.mode];
    const SC = SCENE[L.mode];
    const Z = L.zones;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.tile;
    g.fillRect(0, 0, vp.bw, vp.bh);
    g.setTransform(vp.kx * L.s, 0, 0, vp.ky * L.s, vp.kx * L.ox, vp.ky * L.oy);
    paintWall(g, L.view, K);
    paintWindow(g, SC.window);
    paintSticker(g, SC.sticker);
    paintCounter(g, L.view, K);
    paintCabinets(g, L.view, K);
    paintSinkBack(g, SC.sink);
    paintFaucet(g, SC.faucet);
    paintBowlBack(g, Z.bowl);
  }

  function rebuild(vp) {
    if (attached) {
      // Resizing the backing store only here keeps the old picture (CSS-stretched) during a live resize.
      if (attached.width !== vp.bw) attached.width = vp.bw;
      if (attached.height !== vp.bh) attached.height = vp.bh;
      paintBack(attached.getContext('2d', { alpha: false }), vp);
    } else {
      if (!back || back.width !== vp.bw || back.height !== vp.bh) {
        freeCanvas(back);
        back = makeCanvas(vp.bw, vp.bh);
      }
      paintBack(back.getContext('2d', { alpha: false }), vp);
    }
    built = true;
  }

  function maybeRebuild(vp, now) {
    if (!built) {
      rebuild(vp);
      dirtyAt = 0;
    } else if (dirtyAt && now - dirtyAt >= REBUILD_DELAY_MS) {
      rebuild(vp);
      dirtyAt = 0;
    }
  }

  return {
    invalidate(now) {
      dirtyAt = now || 1;
    },
    // Start of a frame: the transparent game canvas is cleared (attached) or gets the baked kitchen (offscreen).
    drawBack(ctx, vp, now) {
      maybeRebuild(vp, now);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (attached) ctx.clearRect(0, 0, vp.bw, vp.bh);
      else ctx.drawImage(back, 0, 0, vp.bw, vp.bh);
    },
    // Over the dog: the sink's front rim, then the bowl's front, in world units.
    drawFront(ctx, vp) {
      const L = vp.layout;
      vp.worldTransform(ctx);
      paintSinkFront(ctx, SCENE[L.mode].sink);
      paintBowlFront(ctx, L.zones.bowl);
    },
    get pending() {
      return dirtyAt !== 0;
    },
  };
}
