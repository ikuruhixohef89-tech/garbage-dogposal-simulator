// The blade: a stroke is the path of one press. Each step between two pointer samples is a segment;
// a fast enough segment slices whatever it touches. Also keeps a short trail for drawing.

const TRAIL_LIFE_S = 0.14;
const TRAIL_MAX = 16;

// Squared distance between segments p1-q1 and p2-q2 (2D), with the closest-point parameter on the first.
function segSegDist2(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  const d1x = q1x - p1x;
  const d1y = q1y - p1y;
  const d2x = q2x - p2x;
  const d2y = q2y - p2y;
  const rx = p1x - p2x;
  const ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  let s;
  let t;
  if (a <= 1e-9 && e <= 1e-9) {
    s = 0;
    t = 0;
  } else if (a <= 1e-9) {
    s = 0;
    t = Math.min(1, Math.max(0, f / e));
  } else {
    const c = d1x * rx + d1y * ry;
    if (e <= 1e-9) {
      t = 0;
      s = Math.min(1, Math.max(0, -c / a));
    } else {
      const b = d1x * d2x + d1y * d2y;
      const den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(1, Math.max(0, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.min(1, Math.max(0, (b - c) / a));
      }
    }
  }
  const dx = p1x + d1x * s - (p2x + d2x * t);
  const dy = p1y + d1y * s - (p2y + d2y * t);
  return { d2: dx * dx + dy * dy, s };
}

// Does segment A-B touch a capsule (an item L x H lying along its local x, rotated by rot, centered at c)?
// pad grows (or, if negative, shrinks) the capsule. Returns the hit parameter along A-B (0..1) or -1.
export function segmentHitsItem(ax, ay, bx, by, cx, cy, rot, L, H, pad = 0) {
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const lax = (ax - cx) * cos - (ay - cy) * sin;
  const lay = (ax - cx) * sin + (ay - cy) * cos;
  const lbx = (bx - cx) * cos - (by - cy) * sin;
  const lby = (bx - cx) * sin + (by - cy) * cos;
  const r = Math.max(4, H / 2 + pad);
  const hl = Math.max(0, L / 2 - H / 2);
  const { d2, s } = segSegDist2(lax, lay, lbx, lby, -hl, 0, hl, 0);
  return d2 <= r * r ? s : -1;
}

export function createBlade() {
  const trail = [];
  let active = false;
  let last = null; // { x, y, cx, cy, t } of the previous sample (t in ms)

  return {
    get active() {
      return active;
    },
    get trail() {
      return trail;
    },
    begin(p, time) {
      active = true;
      trail.length = 0;
      trail.push({ x: p.x, y: p.y, t: time });
      last = { x: p.x, y: p.y, cx: p.cx, cy: p.cy, t: p.t };
    },
    // Returns the new segment { ax, ay, bx, by, speed (CSS px per ms) } or null.
    move(p, time) {
      if (!active || !last) return null;
      trail.push({ x: p.x, y: p.y, t: time });
      if (trail.length > TRAIL_MAX) trail.shift();
      const dtMs = Math.max(1, p.t - last.t);
      const speed = Math.hypot(p.cx - last.cx, p.cy - last.cy) / dtMs;
      const seg = { ax: last.x, ay: last.y, bx: p.x, by: p.y, speed };
      last = { x: p.x, y: p.y, cx: p.cx, cy: p.cy, t: p.t };
      return seg;
    },
    end() {
      active = false;
      last = null;
    },
    update(time) {
      while (trail.length && time - trail[0].t > TRAIL_LIFE_S) trail.shift();
    },
    // A tapered ribbon in one fill, plus a thin bright core. World transform must be set on ctx.
    drawTrail(ctx, time, width = 18) {
      const n = trail.length;
      if (n < 2) return;
      const left = [];
      const right = [];
      for (let i = 0; i < n; i++) {
        const a = trail[Math.max(0, i - 1)];
        const b = trail[Math.min(n - 1, i + 1)];
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        const age = 1 - Math.min(1, (time - trail[i].t) / TRAIL_LIFE_S);
        const w = (width / 2) * (i / (n - 1)) * age;
        left.push([trail[i].x + nx * w, trail[i].y + ny * w]);
        right.push([trail[i].x - nx * w, trail[i].y - ny * w]);
      }
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < n; i++) ctx.lineTo(trail[i].x, trail[i].y);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(200,236,255,0.9)';
      ctx.stroke();
    },
  };
}

// A chef's knife (no brand marks), drawn at (x, y) pointing down-left.
export function drawKnife(ctx, x, y, angle = -0.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#DDE3E8';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(150, -10);
  ctx.lineTo(150, 22);
  ctx.quadraticCurveTo(70, 26, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#A0A9B2';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 3);
  ctx.quadraticCurveTo(70, 22, 146, 19);
  ctx.stroke();
  ctx.fillStyle = '#2F3438';
  ctx.beginPath();
  ctx.moveTo(150, -8);
  ctx.lineTo(240, -6);
  ctx.quadraticCurveTo(250, 6, 240, 18);
  ctx.lineTo(150, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#C9CED3';
  for (const px of [175, 200, 225]) {
    ctx.beginPath();
    ctx.arc(px, 6, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
