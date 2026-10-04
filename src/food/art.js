// Food drawn with canvas paths. Whole items lie horizontally, centered at (0, 0), in lu.
// Slicing = the whole drawing clipped by the cut line into two halves, each with a cut face.

import { makeCanvas, freeCanvas } from '../render/cache.js';

const TAU = Math.PI * 2;

function lin(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function outline(ctx, path, color, w) {
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
}

// ---------- whole ingredients ----------

function capsule(L, H) {
  const p = new Path2D();
  const r = H / 2;
  p.moveTo(-L / 2 + r, -r);
  p.lineTo(L / 2 - r, -r);
  p.arc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  p.lineTo(-L / 2 + r, r);
  p.arc(-L / 2 + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
  p.closePath();
  return p;
}

const WHOLE = {
  cucumber(ctx, L, H) {
    const p = capsule(L, H);
    ctx.fillStyle = lin(ctx, -H / 2, H / 2, [[0, '#6FAE52'], [0.45, '#3F7D3A'], [1, '#2B5E29']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(207,230,164,0.35)';
    ctx.lineWidth = 6;
    for (const y of [-H * 0.22, 0.02 * H, H * 0.25]) {
      ctx.beginPath();
      ctx.moveTo(-L / 2, y);
      ctx.lineTo(L / 2, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,60,28,0.55)';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(-L / 2 + 28 + ((L - 56) * i) / 15, ((i * 37) % 7) * (H / 9) - H / 3, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    outline(ctx, p, '#1F3F1E', 4);
  },
  pepper(ctx, L, H) {
    const p = new Path2D();
    const l = L / 2;
    const h = H / 2;
    p.moveTo(-l + 18, -h * 0.55);
    p.bezierCurveTo(-l + 40, -h * 1.05, -l * 0.1, -h * 0.85, 0, -h * 0.95);
    p.bezierCurveTo(l * 0.35, -h * 1.05, l, -h * 0.85, l, -h * 0.25);
    p.bezierCurveTo(l + 4, h * 0.2, l * 0.9, h * 0.95, l * 0.3, h * 0.95);
    p.bezierCurveTo(0, h * 0.9, -l * 0.2, h * 1.02, -l * 0.5, h * 0.92);
    p.bezierCurveTo(-l + 8, h * 0.85, -l - 4, h * 0.1, -l + 18, -h * 0.55);
    p.closePath();
    ctx.fillStyle = lin(ctx, -h, h, [[0, '#FFE27A'], [0.4, '#F7C531'], [1, '#E0A419']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(224,164,25,0.55)';
    ctx.lineWidth = 5;
    for (const y of [-h * 0.3, h * 0.35]) {
      ctx.beginPath();
      ctx.moveTo(-l, y);
      ctx.bezierCurveTo(-l * 0.3, y + 10, l * 0.3, y - 10, l, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-l * 0.1, -h * 0.55, l * 0.45, h * 0.12, -0.08, 0, TAU);
    ctx.fill();
    ctx.restore();
    outline(ctx, p, '#9A6A0E', 4);
    // Stem on the left.
    ctx.fillStyle = '#4E7A2E';
    ctx.beginPath();
    ctx.ellipse(-l + 10, -h * 0.05, 14, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-l - 16, -h * 0.05 - 6, 24, 12);
    ctx.strokeStyle = '#2F4F1C';
    ctx.lineWidth = 3;
    ctx.strokeRect(-l - 16, -h * 0.05 - 6, 24, 12);
  },
  carrot(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    // Leafy top on the left.
    ctx.fillStyle = '#4FA34A';
    for (const [a, len] of [[-0.6, 70], [0, 80], [0.6, 66]]) {
      ctx.save();
      ctx.translate(-l + 6, 0);
      ctx.rotate(Math.PI + a * 0.6);
      ctx.beginPath();
      ctx.ellipse(len / 2, 0, len / 2, 9, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    const p = new Path2D();
    p.moveTo(-l + 4, -h);
    p.bezierCurveTo(-l * 0.2, -h * 0.95, l * 0.6, -h * 0.35, l, -2);
    p.quadraticCurveTo(l + 4, 2, l - 4, 4);
    p.bezierCurveTo(l * 0.6, h * 0.45, -l * 0.2, h * 0.98, -l + 4, h);
    p.quadraticCurveTo(-l - 8, 0, -l + 4, -h);
    p.closePath();
    ctx.fillStyle = lin(ctx, -h, h, [[0, '#F8A24A'], [0.5, '#F08A24'], [1, '#D06F12']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(160,80,10,0.45)';
    ctx.lineWidth = 3.5;
    for (let i = 1; i < 7; i++) {
      const x = -l + (L * i) / 7;
      ctx.beginPath();
      ctx.moveTo(x, -h * 0.6);
      ctx.quadraticCurveTo(x + 6, -h * 0.4, x + 2, -h * 0.25);
      ctx.stroke();
    }
    ctx.restore();
    outline(ctx, p, '#8A4A0A', 4);
  },
  tomato(ctx, L, H) {
    const r = Math.min(L, H) / 2;
    const p = new Path2D();
    p.ellipse(0, 0, L / 2, H / 2, 0, 0, TAU);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#FF8A70');
    g.addColorStop(0.55, '#E5402F');
    g.addColorStop(1, '#B92A1E');
    ctx.fillStyle = g;
    ctx.fill(p);
    outline(ctx, p, '#7A1A12', 4);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.22, r * 0.12, -0.5, 0, TAU);
    ctx.fill();
    // Green calyx on top.
    ctx.save();
    ctx.translate(0, -H / 2 + 14);
    ctx.fillStyle = '#4E8A3A';
    for (let i = 0; i < 5; i++) {
      ctx.rotate(TAU / 5);
      ctx.beginPath();
      ctx.ellipse(0, -14, 6, 16, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillRect(-3, -26, 6, 16);
    ctx.restore();
  },
  onion(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    const p = new Path2D();
    p.moveTo(l, 0);
    p.bezierCurveTo(l * 0.6, -h * 0.3, l * 0.5, -h, -l * 0.15, -h);
    p.bezierCurveTo(-l * 0.85, -h, -l, -h * 0.4, -l, 0);
    p.bezierCurveTo(-l, h * 0.4, -l * 0.85, h, -l * 0.15, h);
    p.bezierCurveTo(l * 0.5, h, l * 0.6, h * 0.3, l, 0);
    p.closePath();
    ctx.fillStyle = lin(ctx, -h, h, [[0, '#EBCB9E'], [0.5, '#D9B48A'], [1, '#B88B5E']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(140,96,52,0.45)';
    ctx.lineWidth = 3;
    for (const k of [-0.6, -0.25, 0.1, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(-l, k * h);
      ctx.bezierCurveTo(-l * 0.3, k * h * 1.3, l * 0.3, k * h * 0.6, l, 0);
      ctx.stroke();
    }
    ctx.restore();
    outline(ctx, p, '#7A5530', 4);
    // Root tuft on the left.
    ctx.strokeStyle = '#E8DCCB';
    ctx.lineWidth = 3;
    for (const a of [-0.5, -0.2, 0.1, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(-l + 4, a * 12);
      ctx.lineTo(-l - 14, a * 30);
      ctx.stroke();
    }
  },
  apple(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    const p = new Path2D();
    p.moveTo(0, -h * 0.78);
    p.bezierCurveTo(l * 0.5, -h * 1.05, l * 1.05, -h * 0.6, l, 0);
    p.bezierCurveTo(l * 0.95, h * 0.7, l * 0.4, h, 0, h * 0.86);
    p.bezierCurveTo(-l * 0.4, h, -l * 0.95, h * 0.7, -l, 0);
    p.bezierCurveTo(-l * 1.05, -h * 0.6, -l * 0.5, -h * 1.05, 0, -h * 0.78);
    p.closePath();
    const g = ctx.createRadialGradient(-l * 0.35, -h * 0.35, 6, 0, 0, l * 1.1);
    g.addColorStop(0, '#FF8A7A');
    g.addColorStop(0.5, '#E9584A');
    g.addColorStop(1, '#B83A2E');
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.fillStyle = 'rgba(247,231,181,0.35)';
    ctx.beginPath();
    ctx.ellipse(l * 0.35, h * 0.2, l * 0.3, h * 0.35, 0.3, 0, TAU);
    ctx.fill();
    outline(ctx, p, '#7A2018', 4);
    ctx.strokeStyle = '#5A3A22';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.75);
    ctx.quadraticCurveTo(4, -h * 1.05, 12, -h * 1.12);
    ctx.stroke();
    ctx.fillStyle = '#5BB467';
    ctx.beginPath();
    ctx.ellipse(26, -h * 1.02, 18, 8, -0.4, 0, TAU);
    ctx.fill();
  },
  strawberry(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    const p = new Path2D();
    p.moveTo(-l * 0.7, -h * 0.8);
    p.bezierCurveTo(-l * 0.1, -h * 1.05, l * 0.6, -h * 0.6, l, 0);
    p.bezierCurveTo(l * 0.6, h * 0.6, -l * 0.1, h * 1.05, -l * 0.7, h * 0.8);
    p.bezierCurveTo(-l * 1.05, h * 0.4, -l * 1.05, -h * 0.4, -l * 0.7, -h * 0.8);
    p.closePath();
    ctx.fillStyle = lin(ctx, -h, h, [[0, '#FF6B6B'], [0.5, '#E8384F'], [1, '#B81E36']]);
    ctx.fill(p);
    ctx.fillStyle = '#F7D58A';
    for (let i = 0; i < 14; i++) {
      const x = -l * 0.55 + ((i * 53) % 100) / 100 * l * 1.3;
      const y = (((i * 31) % 100) / 100 - 0.5) * h * 1.2 * (1 - Math.max(0, x) / l * 0.6);
      ctx.beginPath();
      ctx.ellipse(x, y, 2.6, 4, 0.6, 0, TAU);
      ctx.fill();
    }
    outline(ctx, p, '#7A1424', 4);
    // Hull on the left.
    ctx.fillStyle = '#4FA34A';
    for (const a of [-1, -0.5, 0, 0.5, 1]) {
      ctx.beginPath();
      ctx.ellipse(-l * 0.82, a * h * 0.45, 22, 9, a * 0.5, 0, TAU);
      ctx.fill();
    }
  },
  grapes(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    ctx.strokeStyle = '#6B5A3A';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-l - 10, -6);
    ctx.lineTo(-l + 40, 0);
    ctx.stroke();
    const berries = [];
    for (let col = 0; col < 5; col++) {
      const n = 4 - Math.floor(col * 0.75);
      for (let i = 0; i < n; i++) {
        const x = -l + 40 + col * (L - 70) / 4;
        const y = (i - (n - 1) / 2) * (H / 4.2);
        berries.push([x, y]);
      }
    }
    const r = H / 8.5;
    for (const [x, y] of berries) {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r * 1.1);
      g.addColorStop(0, '#B884C9');
      g.addColorStop(0.5, '#7A3E8E');
      g.addColorStop(1, '#4E2560');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3A1A48';
      ctx.stroke();
    }
  },
  chocolate(ctx, L, H) {
    ctx.fillStyle = '#5B3221';
    ctx.beginPath();
    ctx.rect(-L / 2, -H / 2, L, H);
    ctx.fill();
    ctx.strokeStyle = '#3A1E12';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#7A4A33';
    ctx.fillRect(-L / 2 + 6, -H / 2 + 6, L - 12, H - 12);
    ctx.strokeStyle = '#5B3221';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -H / 2 + 6);
    ctx.lineTo(0, H / 2 - 6);
    ctx.moveTo(-L / 2 + 6, 0);
    ctx.lineTo(L / 2 - 6, 0);
    ctx.stroke();
  },
  banana(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    const p = new Path2D();
    p.moveTo(-l, -h * 0.55);
    p.quadraticCurveTo(0, h * 1.9, l, -h * 0.55);
    p.quadraticCurveTo(l * 0.95, -h * 0.2, l * 0.85, -h * 0.15);
    p.quadraticCurveTo(0, h * 0.75, -l * 0.85, -h * 0.15);
    p.quadraticCurveTo(-l * 0.95, -h * 0.2, -l, -h * 0.55);
    p.closePath();
    ctx.fillStyle = lin(ctx, -h, h * 1.2, [[0, '#FFE680'], [0.5, '#F7CF3A'], [1, '#D9A81E']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(176,128,20,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-l * 0.9, -h * 0.3);
    ctx.quadraticCurveTo(0, h * 1.35, l * 0.9, -h * 0.3);
    ctx.stroke();
    ctx.restore();
    outline(ctx, p, '#8A6410', 4);
    ctx.fillStyle = '#5A3A1A';
    ctx.beginPath();
    ctx.ellipse(-l + 4, -h * 0.5, 8, 6, 0.5, 0, TAU);
    ctx.ellipse(l - 4, -h * 0.5, 8, 6, -0.5, 0, TAU);
    ctx.fill();
  },
  blueberries(ctx, L, H) {
    const r = H * 0.3;
    for (const [x, y] of [[-L * 0.22, H * 0.14], [L * 0.22, H * 0.14], [0, -H * 0.2]]) {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r * 1.1);
      g.addColorStop(0, '#8FA2E8');
      g.addColorStop(0.55, '#4A5CB0');
      g.addColorStop(1, '#2A3478');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1C2458';
      ctx.stroke();
      // Little crown (calyx) on each berry.
      ctx.strokeStyle = '#1C2458';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.moveTo(x, y - r * 0.55);
        ctx.lineTo(x + Math.cos(a) * r * 0.22, y - r * 0.55 + Math.sin(a) * r * 0.22);
      }
      ctx.stroke();
    }
  },
  watermelon(ctx, L, H) {
    const p = new Path2D();
    p.ellipse(0, 0, L / 2, H / 2, 0, 0, TAU);
    ctx.fillStyle = lin(ctx, -H / 2, H / 2, [[0, '#7DBE5A'], [0.5, '#4E9A3A'], [1, '#2E6B2A']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = '#2B5E24';
    ctx.lineWidth = 12;
    for (let i = -3; i <= 3; i++) {
      const x = (i * L) / 7;
      ctx.beginPath();
      ctx.moveTo(x, -H / 2);
      ctx.bezierCurveTo(x + 14, -H / 6, x - 14, H / 6, x, H / 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.18, -H * 0.28, L * 0.22, H * 0.1, -0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    outline(ctx, p, '#1E4A1A', 5);
  },
  pear(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    const p = new Path2D();
    p.moveTo(-l, 0);
    p.bezierCurveTo(-l, -h * 0.45, -l * 0.2, -h * 0.5, l * 0.1, -h * 0.95);
    p.bezierCurveTo(l * 0.6, -h * 1.15, l * 1.05, -h * 0.6, l, 0);
    p.bezierCurveTo(l * 1.05, h * 0.6, l * 0.6, h * 1.15, l * 0.1, h * 0.95);
    p.bezierCurveTo(-l * 0.2, h * 0.5, -l, h * 0.45, -l, 0);
    p.closePath();
    const g = ctx.createRadialGradient(l * 0.15, -h * 0.35, 6, l * 0.2, 0, l * 1.1);
    g.addColorStop(0, '#F2F59A');
    g.addColorStop(0.55, '#C9D84E');
    g.addColorStop(1, '#93A82E');
    ctx.fillStyle = g;
    ctx.fill(p);
    outline(ctx, p, '#5E6E1A', 4);
    ctx.strokeStyle = '#5A3A22';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-l + 2, 0);
    ctx.quadraticCurveTo(-l - 10, -6, -l - 18, -14);
    ctx.stroke();
  },
  zucchini(ctx, L, H) {
    const p = capsule(L, H);
    ctx.fillStyle = lin(ctx, -H / 2, H / 2, [[0, '#5E9A46'], [0.45, '#346E2C'], [1, '#1F4A1C']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = 'rgba(214,232,170,0.4)';
    for (let i = 0; i < 22; i++) {
      ctx.beginPath();
      ctx.ellipse(-L / 2 + 24 + ((L - 48) * i) / 21, ((i * 29) % 9) * (H / 12) - H / 3, 5, 2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    outline(ctx, p, '#173A15', 4);
    ctx.fillStyle = '#7A8A3A';
    ctx.fillRect(-L / 2 - 14, -9, 20, 18);
  },
  peach(ctx, L, H) {
    const r = Math.min(L, H) / 2;
    const p = new Path2D();
    p.ellipse(0, 0, L / 2, H / 2, 0, 0, TAU);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#FFD9A0');
    g.addColorStop(0.5, '#F7975E');
    g.addColorStop(1, '#D9574A');
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(176,64,50,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -H / 2 + 6);
    ctx.quadraticCurveTo(r * 0.25, 0, -r * 0.05, H / 2 - 8);
    ctx.stroke();
    outline(ctx, p, '#8A3B22', 4);
    ctx.fillStyle = '#5BB467';
    ctx.beginPath();
    ctx.ellipse(r * 0.35, -H / 2 - 4, 20, 9, -0.4, 0, TAU);
    ctx.fill();
  },
  mango(ctx, L, H) {
    const p = new Path2D();
    p.ellipse(0, 0, L / 2, H / 2, 0, 0, TAU);
    const g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
    g.addColorStop(0, '#9CC35A');
    g.addColorStop(0.45, '#F2B23A');
    g.addColorStop(1, '#E8603A');
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.05, -H * 0.25, L * 0.25, H * 0.1, -0.1, 0, TAU);
    ctx.fill();
    outline(ctx, p, '#8A4A1A', 4);
    ctx.fillStyle = '#5A3A22';
    ctx.fillRect(-L / 2 - 10, -4, 14, 8);
  },
  pineapple(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    // Crown on the left.
    ctx.fillStyle = '#4E9A3A';
    for (const [a, len] of [[-0.55, 80], [-0.2, 95], [0.15, 92], [0.5, 78]]) {
      ctx.save();
      ctx.translate(-l * 0.32, 0);
      ctx.rotate(Math.PI + a);
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.quadraticCurveTo(len * 0.6, -10, len, 0);
      ctx.quadraticCurveTo(len * 0.6, 10, 0, 12);
      ctx.fill();
      ctx.restore();
    }
    const bx = l * 0.3;
    const bw = l * 0.68;
    const p = new Path2D();
    p.ellipse(bx, 0, bw, h, 0, 0, TAU);
    ctx.fillStyle = lin(ctx, -h, h, [[0, '#F7C94A'], [0.5, '#E0A030'], [1, '#B87A1E']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(122,74,20,0.6)';
    ctx.lineWidth = 3;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(bx - bw + i * 26, -h);
      ctx.lineTo(bx - bw + i * 26 + H, h);
      ctx.moveTo(bx - bw + i * 26 + H, -h);
      ctx.lineTo(bx - bw + i * 26, h);
      ctx.stroke();
    }
    ctx.restore();
    outline(ctx, p, '#7A4A14', 4);
  },
  garlic(ctx, L, H) {
    const l = L / 2;
    const h = H / 2;
    const p = new Path2D();
    p.moveTo(-l, 0);
    p.bezierCurveTo(-l * 0.6, -h * 0.25, -l * 0.3, -h, l * 0.35, -h * 0.95);
    p.bezierCurveTo(l * 1.05, -h * 0.85, l * 1.05, h * 0.85, l * 0.35, h * 0.95);
    p.bezierCurveTo(-l * 0.3, h, -l * 0.6, h * 0.25, -l, 0);
    p.closePath();
    ctx.fillStyle = lin(ctx, -h, h, [[0, '#FFFFFF'], [0.6, '#F1E8DA'], [1, '#D8C9B4']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(150,110,160,0.45)';
    ctx.lineWidth = 3;
    for (const k of [-0.55, -0.15, 0.25, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(-l, 0);
      ctx.quadraticCurveTo(l * 0.2, k * h * 1.6, l, k * h);
      ctx.stroke();
    }
    ctx.restore();
    outline(ctx, p, '#8A7A66', 4);
    ctx.strokeStyle = '#D8CBB0';
    ctx.lineWidth = 3;
    for (const a of [-0.4, 0, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(l * 0.95, a * 14);
      ctx.lineTo(l + 14, a * 30);
      ctx.stroke();
    }
  },
  gum(ctx, L, H) {
    ctx.fillStyle = '#9ED9E6';
    ctx.beginPath();
    ctx.rect(-L / 2, -H / 2, L, H);
    ctx.fill();
    ctx.strokeStyle = '#3E7F8E';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-L / 2 + 4, -H * 0.18, L - 8, H * 0.36);
    ctx.fillStyle = '#2E6170';
    ctx.font = `900 ${Math.round(H * 0.24)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SUGAR-FREE', 0, 1);
    ctx.textBaseline = 'alphabetic';
  },
  sponge(ctx, L, H) {
    ctx.fillStyle = '#F4E27A';
    ctx.fillRect(-L / 2, -H / 2 + H * 0.3, L, H * 0.7);
    ctx.fillStyle = '#4E9A5A';
    ctx.fillRect(-L / 2, -H / 2, L, H * 0.3);
    ctx.fillStyle = 'rgba(176,150,40,0.55)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(-L / 2 + 14 + ((i * 41) % (L - 28)), -H / 2 + H * 0.42 + ((i * 17) % Math.round(H * 0.5)), 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#7A6A20';
    ctx.lineWidth = 4;
    ctx.strokeRect(-L / 2, -H / 2, L, H);
  },
  spoon(ctx, L, H) {
    const l = L / 2;
    ctx.fillStyle = '#C9A06A';
    ctx.strokeStyle = '#7A5530';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-l, -6);
    ctx.lineTo(l * 0.3, -8);
    ctx.lineTo(l * 0.3, 8);
    ctx.lineTo(-l, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(l * 0.62, 0, l * 0.38, H / 2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(122,85,48,0.3)';
    ctx.beginPath();
    ctx.ellipse(l * 0.64, 2, l * 0.26, H * 0.32, 0, 0, TAU);
    ctx.fill();
  },
  ball(ctx, L) {
    const r = L / 2;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r * 1.1);
    g.addColorStop(0, '#FF9A7A');
    g.addColorStop(0.6, '#F0533A');
    g.addColorStop(1, '#B83322');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#FFF3D6';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(-r * 1.1, 0, r * 1.15, -0.75, 0.75);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#7A1A12';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
  },
};

// Cut face colors: [skin ring, flesh, center detail].
const FACE = {
  cucumber: ['#2F6B2E', '#CFE6A4', '#F4F8DC'],
  pepper: ['#E0A419', '#FBE7A3', '#FFF6D8'],
  carrot: ['#D06F12', '#F8A24A', '#F5C27A'],
  tomato: ['#B92A1E', '#F25A44', '#F9A08A'],
  onion: ['#B88B5E', '#F4EEE6', '#E8DCCB'],
  apple: ['#B83A2E', '#F7E7B5', '#F0DDA0'],
  strawberry: ['#B81E36', '#FF9AA6', '#FFE4E8'],
  grapes: ['#4E2560', '#C9DA96', '#E2ECC0'],
  banana: ['#E8C63A', '#FFF3C4', '#F5E3A0'],
  blueberries: ['#2E3A80', '#8FA2E8', '#C9D2F2'],
  watermelon: ['#2E6B2A', '#FF5E6E', '#FF8C96'],
  pear: ['#A9BC3E', '#F6F1C8', '#EDE3A8'],
  zucchini: ['#2F5E28', '#E8F0C0', '#F4F8DC'],
  peach: ['#E0704A', '#FFD9A0', '#FFC27A'],
  mango: ['#E8903A', '#FFC24A', '#FFD978'],
  pineapple: ['#C98A2A', '#FFE680', '#F5D35A'],
  chocolate: ['#3A1E12', '#7A4A33', '#5B3221'],
  garlic: ['#E8DCCB', '#FBF7EF', '#F0E6D8'],
  gum: ['#6FBFD0', '#E9F7FA', '#FFFFFF'],
  sponge: ['#4E9A5A', '#F4E27A', '#E8D460'],
  spoon: ['#8A5A2E', '#D9B07A', '#C9A06A'],
  ball: ['#B83322', '#F0533A', '#FF9A7A'],
};

export function drawWhole(ctx, id, size) {
  WHOLE[id](ctx, size[0], size[1]);
}

// Baked sprites: each item is painted once per size and pixel scale, then only copied (drawImage) per frame.
// Gradients and many paths per item per frame were the most expensive part of a busy frame on phones.
const sprites = new Map();
let spritePx = 0;

function spriteFor(id, size, px) {
  if (px !== spritePx) {
    for (const s of sprites.values()) freeCanvas(s.canvas);
    sprites.clear();
    spritePx = px;
  }
  const key = `${id}:${size[0]}x${size[1]}`;
  let s = sprites.get(key);
  if (!s) {
    const R = Math.max(size[0], size[1]) * 0.75 + 24; // room for stems, leaves and crowns
    const canvas = makeCanvas(2 * R * px, 2 * R * px);
    const g = canvas.getContext('2d');
    g.setTransform(px, 0, 0, px, R * px, R * px);
    WHOLE[id](g, size[0], size[1]);
    s = { canvas, R };
    sprites.set(key, s);
  }
  return s;
}

// px: backing-store pixels per lu. Without it (Node, capture tools) the item is drawn as vectors.
export function drawWholeFast(ctx, id, size, px) {
  if (!px || typeof document === 'undefined') {
    WHOLE[id](ctx, size[0], size[1]);
    return;
  }
  const s = spriteFor(id, size, Math.round(px * 100) / 100);
  ctx.drawImage(s.canvas, -s.R, -s.R, 2 * s.R, 2 * s.R);
}

// ---------- cut pieces (any cut line, any number of cuts) ----------
// A piece is the whole item clipped by half-planes, all in the item's own frame (they turn with it).
// plane: { la: cut angle relative to the item, d: offset of the cut line from the item's center, side: -1 | 1 }.
// The item outline is treated as an ellipse L/2 x H/2 for chord lengths (close enough for capsules).

// How far the item reaches along the normal of a cut at angle la (the largest useful |d|).
export function supportAlong(size, la) {
  const nx = -Math.sin(la);
  const ny = Math.cos(la);
  return Math.hypot((size[0] / 2) * nx, (size[1] / 2) * ny);
}

// Where the cut line at (la, d) crosses the item: { tc (middle, along the line), half (half length) } or null.
export function cutChord(size, la, d) {
  const a = size[0] / 2;
  const b = size[1] / 2;
  const ux = Math.cos(la);
  const uy = Math.sin(la);
  const px = -Math.sin(la) * d;
  const py = Math.cos(la) * d;
  // (px + ux t)^2 / a^2 + (py + uy t)^2 / b^2 = 1
  const A = (ux * ux) / (a * a) + (uy * uy) / (b * b);
  const B = 2 * ((px * ux) / (a * a) + (py * uy) / (b * b));
  const C = (px * px) / (a * a) + (py * py) / (b * b) - 1;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-B - s) / (2 * A);
  const t2 = (-B + s) / (2 * A);
  return { tc: (t1 + t2) / 2, half: (t2 - t1) / 2 };
}

function clipPlane(ctx, p, R) {
  ctx.rotate(p.la);
  ctx.beginPath();
  ctx.rect(-R, p.side < 0 ? p.d - 2 * R : p.d, R * 2, R * 2);
  ctx.clip();
  ctx.rotate(-p.la);
}

// ctx is at the item's center and already rotated by the item's rotation.
export function drawCutPiece(ctx, id, size, planes, px = 0) {
  const R = Math.max(size[0], size[1]);
  ctx.save();
  for (const p of planes) clipPlane(ctx, p, R);
  drawWholeFast(ctx, id, size, px);
  ctx.restore();
  const face = FACE[id];
  if (!face) return;
  const ry = Math.max(6, Math.min(size[0], size[1]) * 0.09);
  planes.forEach((p, i) => {
    const ch = cutChord(size, p.la, p.d);
    if (!ch) return;
    ctx.save();
    // The face of this cut only shows where the other cuts left the piece.
    planes.forEach((q, j) => {
      if (j !== i) clipPlane(ctx, q, R);
    });
    ctx.rotate(p.la);
    ctx.translate(ch.tc, p.d + p.side * ry * 0.15);
    const hw = ch.half * 0.96;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw, ry, 0, 0, TAU);
    ctx.fillStyle = face[0];
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1, hw - 5), ry * 0.75, 0, 0, TAU);
    ctx.fillStyle = face[1];
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, hw * 0.4, ry * 0.4, 0, 0, TAU);
    ctx.fillStyle = face[2];
    ctx.fill();
    if (id === 'watermelon') {
      ctx.fillStyle = '#2A1A14';
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.ellipse((k * hw) / 3.5, 0, 4, 2.5, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  });
}

// Golden: a warm halo behind the item. Frozen: an ice block over it. t: seconds, for the shimmer.
export function drawVariantBack(ctx, variant, size, t) {
  if (variant !== 'golden') return;
  const r = Math.max(size[0], size[1]) * 0.62;
  const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
  g.addColorStop(0, 'rgba(255,214,90,0.75)');
  g.addColorStop(1, 'rgba(255,214,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * (1 + 0.06 * Math.sin(t * 8)), 0, TAU);
  ctx.fill();
}

export function drawVariantFront(ctx, variant, size, t) {
  if (variant === 'frozen') {
    const w = size[0] + 30;
    const h = size[1] + 30;
    ctx.fillStyle = 'rgba(200,236,255,0.5)';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 16, -h / 2);
    ctx.lineTo(w / 2 - 10, -h / 2 + 4);
    ctx.lineTo(w / 2, h / 2 - 16);
    ctx.lineTo(w / 2 - 18, h / 2);
    ctx.lineTo(-w / 2 + 6, h / 2 - 6);
    ctx.lineTo(-w / 2, -h / 2 + 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 18, -h / 2 + 16);
    ctx.lineTo(-w / 2 + 50, -h / 2 + 12);
    ctx.stroke();
  } else if (variant === 'golden') {
    ctx.fillStyle = '#FFF4C2';
    const r = Math.max(size[0], size[1]) * 0.5;
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i * TAU) / 3;
      const s = 9 + 5 * Math.sin(t * 9 + i);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.quadraticCurveTo(x, y, x + s, y);
      ctx.quadraticCurveTo(x, y, x, y + s);
      ctx.quadraticCurveTo(x, y, x - s, y);
      ctx.quadraticCurveTo(x, y, x, y - s);
      ctx.fill();
    }
  }
}

// ---------- pieces (about 60 lu across, centered) ----------

function slice(ctx, id, x, y, r, tilt = 0) {
  const [skin, flesh, center] = FACE[id];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  if (id === 'pepper' || id === 'mango' || id === 'pineapple') {
    ctx.fillStyle = flesh;
    ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    ctx.strokeStyle = id === 'pineapple' ? center : skin;
    ctx.lineWidth = 6;
    ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
  } else if (id === 'strawberry') {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 1.1, -r, r * 0.9, r * 0.4, 0, r);
    ctx.bezierCurveTo(-r * 0.9, r * 0.4, -r * 1.1, -r, 0, -r);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.05, r * 0.6, r * 0.75, 0, 0, TAU);
    ctx.fillStyle = flesh;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.1, r * 0.25, r * 0.45, 0, 0, TAU);
    ctx.fillStyle = center;
    ctx.fill();
  } else if (id === 'blueberries') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, TAU);
    ctx.fillStyle = '#4A5CB0';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1C2458';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.25, r * 0.2, 0, TAU);
    ctx.fill();
  } else if (id === 'watermelon' || id === 'peach' || id === 'pear') {
    // A wedge: rind (or skin) along the bottom arc.
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r, r * 0.6);
    ctx.quadraticCurveTo(0, r * 1.15, -r, r * 0.6);
    ctx.closePath();
    ctx.fillStyle = flesh;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(r, r * 0.6);
    ctx.quadraticCurveTo(0, r * 1.15, -r, r * 0.6);
    ctx.stroke();
    if (id === 'watermelon') {
      // Seeds are drawn on the rind side only: the treat itself is seedless.
      ctx.fillStyle = center;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.3, r * 0.5, 0, 0, TAU);
      ctx.fill();
    }
  } else if (id === 'onion') {
    for (let k = 4; k >= 1; k--) {
      ctx.beginPath();
      ctx.arc(0, 0, (r * k) / 4, 0, TAU);
      ctx.fillStyle = k % 2 ? flesh : center;
      ctx.fill();
      ctx.strokeStyle = 'rgba(184,139,94,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.fillStyle = flesh;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, TAU);
    ctx.fillStyle = center;
    ctx.fill();
    if (id === 'cucumber' || id === 'tomato' || id === 'zucchini' || id === 'banana') {
      ctx.fillStyle = id === 'tomato' ? '#F7D58A' : id === 'banana' ? '#C9A85A' : '#FFFFFF';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, 2.5, 4, a, 0, TAU);
        ctx.fill();
      }
    }
    // Apple slices are drawn without seeds: seeds belong to the core, which goes in the bin.
  }
  ctx.restore();
}

function rootArc(ctx, color, line, pts) {
  ctx.fillStyle = color;
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

const SCRAP = {
  'cucumber-ends'(ctx) {
    for (const [x, y, a] of [[-18, 4, -0.3], [16, -6, 0.4]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = '#3F7D3A';
      ctx.beginPath();
      ctx.arc(0, 0, 22, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.lineTo(10, -22);
      ctx.lineTo(10, 22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1F3F1E';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#CFE6A4';
      ctx.beginPath();
      ctx.ellipse(10, 0, 6, 19, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },
  'pepper-cap'(ctx) {
    ctx.fillStyle = '#F7C531';
    ctx.beginPath();
    ctx.ellipse(0, 8, 34, 22, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#9A6A0E';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFF6D8';
    ctx.beginPath();
    ctx.ellipse(0, 8, 22, 13, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4E7A2E';
    ctx.fillRect(-5, -28, 10, 26);
  },
  'carrot-ends'(ctx) {
    ctx.fillStyle = '#F08A24';
    ctx.strokeStyle = '#8A4A0A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-36, -10);
    ctx.lineTo(-6, -2);
    ctx.lineTo(-36, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(18, 6, 20, 18, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4FA34A';
    for (const a of [-0.5, 0, 0.5]) {
      ctx.save();
      ctx.translate(18, -8);
      ctx.rotate(a - Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(16, 0, 16, 6, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },
  'tomato-top'(ctx) {
    ctx.fillStyle = '#4E8A3A';
    ctx.save();
    for (let i = 0; i < 5; i++) {
      ctx.rotate(TAU / 5);
      ctx.beginPath();
      ctx.ellipse(0, -18, 8, 20, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#E5402F';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
  },
  'apple-core'(ctx) {
    core(ctx, '#F7E7B5', '#B83A2E');
  },
  'pear-core'(ctx) {
    core(ctx, '#F6F1C8', '#93A82E');
  },
  'strawberry-hulls'(ctx) {
    for (const [x, y] of [[-16, -4], [16, 6]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#4FA34A';
      for (let i = 0; i < 5; i++) {
        ctx.rotate(TAU / 5);
        ctx.beginPath();
        ctx.ellipse(0, -12, 6, 13, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#E8384F';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },
  'banana-peel'(ctx) {
    for (const a of [-0.9, 0, 0.9]) {
      ctx.save();
      ctx.rotate(a);
      rootArc(ctx, '#F7CF3A', '#8A6410', [[-8, 0], [-10, -40], [0, -48], [10, -40], [8, 0]]);
      ctx.restore();
    }
    ctx.fillStyle = '#5A3A1A';
    ctx.beginPath();
    ctx.arc(0, 4, 9, 0, TAU);
    ctx.fill();
  },
  'watermelon-rind'(ctx) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2E6B2A';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(0, -10, 40, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.strokeStyle = '#FF8C96';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -10, 30, 0.35, Math.PI - 0.35);
    ctx.stroke();
    ctx.fillStyle = '#2A1A14';
    for (const [x, y] of [[-14, -6], [0, -2], [14, -6]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 4, 6, 0, 0, TAU);
      ctx.fill();
    }
  },
  'peach-pit'(ctx) {
    ctx.fillStyle = '#9A5A3A';
    ctx.strokeStyle = '#5A2E1A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 30, 0.3, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (const y of [-14, -4, 6, 16]) {
      ctx.moveTo(-12, y);
      ctx.quadraticCurveTo(0, y - 6, 12, y);
    }
    ctx.stroke();
  },
  'mango-pit'(ctx) {
    ctx.fillStyle = '#F2E2B0';
    ctx.strokeStyle = '#B8964A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 36, 0.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(i * 5, -30);
      ctx.lineTo(i * 6, 30);
    }
    ctx.stroke();
  },
  'pineapple-skin'(ctx) {
    ctx.fillStyle = '#4E9A3A';
    for (const a of [-0.5, 0, 0.5]) {
      ctx.save();
      ctx.rotate(a - Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.quadraticCurveTo(30, -6, 50, 0);
      ctx.quadraticCurveTo(30, 6, 0, 8);
      ctx.fill();
      ctx.restore();
    }
    rootArc(ctx, '#C98A2A', '#7A4A14', [[-26, 6], [26, 6], [20, 26], [-20, 26]]);
  },
};

function core(ctx, flesh, skin) {
  ctx.fillStyle = flesh;
  ctx.beginPath();
  ctx.moveTo(-14, -30);
  ctx.quadraticCurveTo(-24, -14, -8, 0);
  ctx.quadraticCurveTo(-24, 14, -14, 30);
  ctx.lineTo(14, 30);
  ctx.quadraticCurveTo(24, 14, 8, 0);
  ctx.quadraticCurveTo(24, -14, 14, -30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = skin;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#5A3A22';
  for (const [x, y] of [[-4, -6], [5, 2], [-3, 9]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 3, 5, 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#5A3A22';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(4, -44);
  ctx.stroke();
}

// The treat bit that flies to Crumb (lu, centered).
export function drawTreat(ctx, id) {
  slice(ctx, id, 0, 0, 26, 0.2);
}

export function drawScrap(ctx, itemId) {
  (SCRAP[itemId] || SCRAP['cucumber-ends'])(ctx);
}

// Icons and the bowl pile. kind: 'dish' | 'spare' | 'scrap' | 'intruder'.
export function drawPiece(ctx, piece) {
  const id = piece.ingredient;
  if (piece.kind === 'intruder') {
    const size = WHOLE_SIZE[id] || [80, 80];
    const k = 90 / Math.max(size[0], size[1]);
    ctx.save();
    ctx.scale(k, k);
    WHOLE[id](ctx, size[0], size[1]);
    ctx.restore();
    return;
  }
  if (piece.kind === 'scrap') {
    drawScrap(ctx, piece.itemId);
    return;
  }
  if (piece.kind === 'spare') {
    slice(ctx, id, 0, 0, 30, 0.2);
    return;
  }
  // Dish: a little pile of three pieces.
  slice(ctx, id, -20, 10, 26, -0.3);
  slice(ctx, id, 20, 8, 26, 0.4);
  slice(ctx, id, 0, -12, 26, 0.1);
}

// Default draw sizes for icons of whole items (bombs, junk). Kept here so art.js does not import the item table.
const WHOLE_SIZE = {
  onion: [130, 118], grapes: [140, 122], chocolate: [120, 74], garlic: [104, 100], gum: [116, 64],
  sponge: [130, 82], spoon: [200, 50], ball: [84, 84],
};

// Small marker: red octagon with a cross for 'toxic', grey circle with a bar for 'nope'.
export function drawMarker(ctx, cat, x, y, r = 16) {
  ctx.save();
  ctx.translate(x, y);
  if (cat === 'toxic') {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#E5484D';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.4);
    ctx.lineTo(r * 0.4, r * 0.4);
    ctx.moveTo(r * 0.4, -r * 0.4);
    ctx.lineTo(-r * 0.4, r * 0.4);
    ctx.stroke();
  } else if (cat === 'nope') {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = '#9A8F80';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, 0);
    ctx.lineTo(r * 0.45, 0);
    ctx.stroke();
  }
  ctx.restore();
}
