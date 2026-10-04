// Particles, floating texts, stamps and speech bubbles, all in world units (lu).
// Fixed pools; nothing allocates per frame once the pools exist.

import { LIMITS, PALETTE } from '../config.js';
import { ease, roundRectPath } from '../core/math.js';

const TAU = Math.PI * 2;
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, "Segoe UI", Roboto, sans-serif';
const INK = PALETTE.ui.ink;

function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
  ctx.closePath();
}

export function createFx() {
  const parts = Array.from({ length: LIMITS.particles }, () => ({ alive: false }));
  const texts = Array.from({ length: 16 }, () => ({ alive: false }));
  const stamps = Array.from({ length: 4 }, () => ({ alive: false }));
  let reduced = false;
  let bubble = null; // { text, x, y, t, life, ring }

  function spawn(type, x, y, vx, vy, life, size, color) {
    let p = parts.find(q => !q.alive);
    if (!p) {
      // Reuse the oldest.
      p = parts.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    }
    Object.assign(p, { alive: true, type, x, y, vx, vy, life, age: 0, size, color, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8 });
  }

  const fx = {
    setReducedMotion(on) {
      reduced = on;
    },

    juice(x, y, color, n = 5) {
      const k = reduced ? 0.5 : 1;
      for (let i = 0; i < Math.round(n * k); i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = 180 + Math.random() * 260;
        spawn('drop', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.4 + Math.random() * 0.2, 5 + Math.random() * 4, color);
      }
    },
    crumbs(x, y, color, n = 6) {
      const k = reduced ? 0.5 : 1;
      for (let i = 0; i < Math.round(n * k); i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        const sp = 120 + Math.random() * 220;
        spawn('crumb', x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5, 6 + Math.random() * 4, color);
      }
    },
    hearts(x, y, n = 2) {
      for (let i = 0; i < n; i++) spawn('heart', x + (i - (n - 1) / 2) * 34, y, (Math.random() - 0.5) * 30, -70, 0.9, 16, PALETTE.ui.heart);
    },
    sparkle(x, y) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        spawn('spark', x, y, Math.cos(a) * 90, Math.sin(a) * 90, 0.4, 10, '#FFF4C2');
      }
    },
    zzz(x, y) {
      spawn('z', x, y, 24, -40, 2, 26, INK);
    },

    text(str, x, y, color = INK, size = 40) {
      // Stack on top of a fresh text at the same spot instead of overlapping it.
      for (const o of texts) {
        if (o.alive && o.age < 0.5 && Math.abs(o.x - x) < 160 && Math.abs(o.y - y) < size) y = o.y - size * 1.1;
      }
      const t = texts.find(q => !q.alive) || texts[0];
      Object.assign(t, { alive: true, str, x, y, color, size, age: 0, life: 0.9 });
    },

    stamp(str, color, x, y) {
      const s = stamps.find(q => !q.alive) || stamps[0];
      Object.assign(s, { alive: true, str, color, x, y, age: 0, life: 1.1, rot: (Math.random() - 0.5) * 0.2 });
    },

    // A speech bubble above the dog. ring: seconds for a countdown ring (requests), or 0.
    say(text, x, y, life = 1.2, ring = 0, icon = null) {
      bubble = { text, x, y, t: 0, life, ring, icon };
    },
    clearBubble() {
      bubble = null;
    },
    // Restart: drop everything that belonged to the previous run.
    clear() {
      for (const p of parts) p.alive = false;
      for (const t of texts) t.alive = false;
      for (const s of stamps) s.alive = false;
      bubble = null;
    },
    get bubble() {
      return bubble;
    },

    update(dt) {
      for (const p of parts) {
        if (!p.alive) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.alive = false;
          continue;
        }
        if (p.type === 'drop' || p.type === 'crumb') p.vy += 1600 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      for (const t of texts) {
        if (!t.alive) continue;
        t.age += dt;
        t.y -= 60 * dt;
        if (t.age >= t.life) t.alive = false;
      }
      for (const s of stamps) {
        if (!s.alive) continue;
        s.age += dt;
        if (s.age >= s.life) s.alive = false;
      }
      if (bubble) {
        bubble.t += dt;
        if (bubble.t >= bubble.life) bubble = null;
      }
    },

    // World transform must already be set on ctx. hideUi (H): skip texts, stamps and bubbles.
    draw(ctx, drawIcon, hideUi = false) {
      for (const p of parts) {
        if (!p.alive) continue;
        const k = 1 - p.age / p.life;
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.color;
        if (p.type === 'heart') {
          const s = p.size * (p.age < 0.15 ? ease.outBack(p.age / 0.15) : 1);
          ctx.save();
          ctx.translate(p.x + Math.sin(p.age * 12) * 4, p.y);
          heartPath(ctx, s);
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#B23A5A';
          ctx.stroke();
          ctx.restore();
        } else if (p.type === 'spark') {
          const s = p.size * Math.sin(Math.PI * (p.age / p.life));
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(0, 0, s, 0);
          ctx.quadraticCurveTo(0, 0, 0, s);
          ctx.quadraticCurveTo(0, 0, -s, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'z') {
          ctx.font = `800 ${Math.round(p.size * (0.6 + 0.6 * (p.age / p.life)))}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText('z', p.x, p.y);
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          if (p.type === 'drop') {
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 0.7, p.size, 0, 0, TAU);
            ctx.fill();
          } else {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          }
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of texts) {
        if (!t.alive || hideUi) continue;
        const k = t.age / t.life;
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const s = t.age < 0.15 ? ease.outBack(t.age / 0.15, 1.6) : 1;
        ctx.font = `800 ${Math.round(t.size * s)}px ${FONT}`;
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#FFF8EC';
        ctx.lineJoin = 'round';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;

      for (const s of stamps) {
        if (!s.alive || hideUi) continue;
        const k = s.age / s.life;
        const sc = s.age < 0.12 ? 1.6 - 0.6 * ease.outQuad(s.age / 0.12) : 1;
        ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.scale(sc, sc);
        ctx.font = `900 30px ${FONT}`;
        const w = ctx.measureText(s.str).width + 36;
        ctx.beginPath();
        roundRectPath(ctx, -w / 2, -27, w, 54, 10);
        ctx.fillStyle = 'rgba(255,248,236,0.92)';
        ctx.fill();
        ctx.lineWidth = 7;
        ctx.strokeStyle = s.color;
        ctx.stroke();
        ctx.fillStyle = s.color;
        ctx.fillText(s.str, 0, 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (bubble && !hideUi) drawBubble(ctx, bubble, drawIcon);
      ctx.textBaseline = 'alphabetic';
    },
  };
  return fx;
}

// A speech bubble (paper, ink outline, tail). b: { text, x, y, t, life, ring, icon }.
export function drawBubble(ctx, b, drawIcon) {
  const pop = b.t < 0.15 ? ease.outBack(b.t / 0.15, 1.6) : 1;
  const fade = b.t > b.life - 0.2 ? Math.max(0, (b.life - b.t) / 0.2) : 1;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = fade;
  ctx.translate(b.x, b.y);
  ctx.scale(pop, pop);
  ctx.font = `800 34px ${FONT}`;
  const tw = b.text ? ctx.measureText(b.text).width : 0;
  const w = Math.max(84, tw + (b.icon ? 96 : 40));
  const h = 78;
  ctx.beginPath();
  roundRectPath(ctx, -w / 2, -h, w, h, 18);
  ctx.moveTo(-18, 0);
  ctx.lineTo(-30, 26);
  ctx.lineTo(6, 0);
  ctx.fillStyle = PALETTE.ui.paper;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  let tx = 0;
  if (b.icon && drawIcon) {
    ctx.save();
    ctx.translate(b.text ? -w / 2 + 48 : 0, -h / 2);
    ctx.scale(0.55, 0.55);
    drawIcon(ctx, b.icon);
    ctx.restore();
    tx = 24;
  }
  if (b.text) {
    ctx.fillStyle = INK;
    ctx.fillText(b.text, tx, -h / 2 + 2);
  }
  if (b.ring) {
    const left = Math.max(0, 1 - b.t / b.ring);
    ctx.beginPath();
    ctx.arc(w / 2 - 4, -h + 4, 16, -Math.PI / 2, -Math.PI / 2 + TAU * left);
    ctx.lineWidth = 6;
    ctx.strokeStyle = left < 0.3 ? PALETTE.ui.danger : PALETTE.ui.good;
    ctx.stroke();
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

// The SOUS-AI safety mitt: a quilted oven mitt with a thumb (no fingers, so no pointing).
export function drawMitt(ctx, x, y, angle = 0, scale = 1) {
  const C = PALETTE.scene;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  const p = new Path2D('M-40 60 L-44 -10 C-46 -52 -18 -72 8 -70 C34 -68 48 -48 46 -20 L44 6 C58 -6 76 -2 76 14 C76 30 56 44 40 46 L36 60 Z');
  ctx.fillStyle = C.mitt;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = C.mittQuilt;
  ctx.lineWidth = 3;
  for (let i = -6; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(-60 + i * 18, -80);
    ctx.lineTo(40 + i * 18, 80);
    ctx.moveTo(60 + i * 18, -80);
    ctx.lineTo(-40 + i * 18, 80);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke(p);
  ctx.fillStyle = C.mittCuff;
  ctx.beginPath();
  roundRectPath(ctx, -50, 52, 94, 34, 12);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
