// Crumb, drawn entirely with canvas paths.
// Units: u = 1% of the dog's height from paws to the top of the skull (ears not included).
// Origin (0, 0) is on the floor between the front paws; y points down, so the dog lives at negative y.
// The caller sets a transform that maps u to pixels (translate to the paws, scale by px-per-u).

import { PALETTE } from '../config.js';

const P = PALETTE.dog;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const NECK_Y = -54;   // neck pivot
const HEAD_UP = 23;   // head center sits this far above the neck pivot (head center y = -77)

// ---------- static shapes (local units) ----------

const SKULL = new Path2D('M0 -23 C15 -23 26 -15 25.5 -3 C25 8 19 16 11 19 C6 21.5 -6 21.5 -11 19 C-19 16 -25 8 -25.5 -3 C-26 -15 -15 -23 0 -23Z');
// Ear in ear space: base at the origin, tip up; the outer edge is on the -x side.
const EAR = new Path2D('M-10 3 C-11.5 -9 -6 -26 -1 -33.5 C0 -35 1.6 -35 2.4 -33.6 C7.5 -25 11 -10 10 3Z');
const EAR_INNER = new Path2D('M-5.6 0 C-6.6 -8 -3.6 -20 0.2 -27 C3.8 -20 6.8 -8 6 0Z');
// Long silky hair on the outer edge of the ear: [x, y, length], hanging outward and down.
const EAR_FRINGE = [
  [-9.6, 1, 10], [-10.6, -3, 11.5], [-10.9, -7.5, 11.5], [-10.6, -12, 11], [-9.8, -16.5, 10], [-8.6, -20.5, 8.5], [-7.2, -24.2, 7], [-5.6, -27.4, 5],
];
const TORSO = new Path2D('M0 -52 C12 -52 18.5 -41 18.5 -28 C18.5 -15 12.5 -8 0 -8 C-12.5 -8 -18.5 -15 -18.5 -28 C-18.5 -41 -12 -52 0 -52Z');
// Chest ruff with a soft scalloped hem.
const RUFF = new Path2D('M-16 -50 C-18.5 -41 -17 -31 -13.5 -25.5 Q-12 -22.5 -9.5 -24.5 Q-7.5 -20 -4.6 -22.6 Q-2.4 -18.4 0 -21.4 Q2.4 -18.4 4.6 -22.6 Q7.5 -20 9.5 -24.5 Q12 -22.5 13.5 -25.5 C17 -31 18.5 -41 16 -50 C10 -53.5 -10 -53.5 -16 -50Z');
const BANDANA = new Path2D('M-15.5 -51 C-8 -48.5 8 -48.5 15.5 -51 C14 -46 7 -38 0.6 -33.6 C0.2 -33.4 -0.2 -33.4 -0.6 -33.6 C-7 -38 -14 -46 -15.5 -51Z');
const NOSE = new Path2D('M-3.1 -1.7 Q0 -2.5 3.1 -1.7 Q3.7 -0.4 1.2 1.9 Q0 2.7 -1.2 1.9 Q-3.7 -0.4 -3.1 -1.7Z');
const COWLICK = [
  new Path2D('M-3.4 -21.2 Q-2.6 -27.4 2.6 -29.6 Q-0.4 -25.4 0.8 -21.4Z'),
  new Path2D('M-0.4 -21.6 Q3.4 -26.6 8.4 -26.2 Q4.2 -24.4 3.6 -20.6Z'),
  new Path2D('M-6 -20.4 Q-7.6 -25.4 -4.4 -28.4 Q-5 -24.4 -2.6 -21Z'),
];

// ---------- helpers ----------

function makeStyle(silhouette) {
  return {
    sil: silhouette,
    fill: c => (silhouette ? P.line : c),
  };
}

function strokeOutline(ctx, path, lw) {
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.line;
  ctx.stroke(path);
}

function coatGradient(ctx, st, cx, cy, r) {
  if (st.sil) return P.line;
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.08, cx, cy, r * 1.15);
  g.addColorStop(0, P.coatLight);
  g.addColorStop(0.42, P.coat);
  g.addColorStop(1, P.coatShade);
  return g;
}

// A tapered fur strand from (x, y) along (dx, dy). bend > 0 curls the tip to the strand's right
// (in canvas space, y down), which makes hanging hair droop instead of sticking out like a spike.
function leaf(ctx, x, y, dx, dy, len, w, bend = 0) {
  const nx = -dy;
  const ny = dx;
  const tx = x + dx * len + nx * bend;
  const ty = y + dy * len + ny * bend;
  const mx = x + dx * len * 0.5 + nx * bend * 0.35;
  const my = y + dy * len * 0.5 + ny * bend * 0.35;
  ctx.moveTo(x + nx * w, y + ny * w);
  ctx.quadraticCurveTo(mx + nx * w * 1.15, my + ny * w * 1.15, tx, ty);
  ctx.quadraticCurveTo(mx - nx * w * 0.7, my - ny * w * 0.7, x - nx * w, y - ny * w);
  ctx.closePath();
}

const SOFT_LINE = 'rgba(46,24,16,0.55)';

// Fluffy union: stroke every strand with a double-width outline first, then fill them all.
// Overlapping strands hide each other's inner outlines, so only the outer silhouette is outlined.
function fluff(ctx, path, fill, lw, st) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw * 2;
  ctx.strokeStyle = P.line;
  ctx.stroke(path);
  ctx.fillStyle = st.fill(fill);
  ctx.fill(path);
}

// ---------- parts ----------

function drawTail(ctx, pose, st, lw) {
  ctx.save();
  ctx.translate(15, -13);
  ctx.rotate(pose.tail);
  const { core, plume, tips } = tailPaths();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Outline pass for core and plume, then fill pass for both.
  ctx.lineWidth = 6.5 + lw * 2;
  ctx.strokeStyle = P.line;
  ctx.stroke(core);
  ctx.lineWidth = lw * 2;
  ctx.stroke(plume);
  ctx.fillStyle = st.fill(P.coat);
  ctx.fill(plume);
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = st.fill(P.coat);
  ctx.stroke(core);
  if (!st.sil) {
    ctx.fillStyle = P.coatLight;
    ctx.fill(tips);
  }
  ctx.restore();
}

// The tail never changes shape (it only rotates), so its paths are built once.
let TAIL = null;
function tailPaths() {
  if (TAIL) return TAIL;
  const core = new Path2D('M0 0 C12 -2 19 -16 13 -30 C11 -34 7 -36 4 -35');
  // Plume: long hair hanging off the curl, [x, y, dirX, dirY, length]. Strands droop with gravity.
  const pts = [
    [5, -1.5, 0.35, 1, 8], [9.5, -4, 0.75, 0.75, 10], [13.5, -8.5, 0.95, 0.35, 11], [15.8, -14.5, 1, 0.05, 11.5],
    [16.4, -20.5, 1, -0.2, 11], [15.2, -26.5, 0.9, -0.45, 10], [12.5, -31, 0.6, -0.8, 8.5], [8.5, -34.2, 0.2, -1, 6.5],
  ];
  const plume = new Path2D();
  const tips = new Path2D();
  for (const [x, y, dx, dy, len] of pts) {
    const l = Math.hypot(dx, dy);
    const ux = dx / l;
    const uy = dy / l;
    leaf(plume, x, y, ux, uy, len, 3.4, 4.2);
    leaf(tips, x + ux * len * 0.42 - uy * 0.9, y + uy * len * 0.42 + ux * 0.9, ux, uy, len * 0.5, 1.1, 1.6);
  }
  TAIL = { core, plume, tips };
  return TAIL;
}

// Front paw position in body space: sitting on the floor, or (rimT -> 1) up on the sink rim.
// rimY is the rim top in the dog's frame *before* the root offset; the body is already translated by rootY.
function pawPos(pose, s, rimY) {
  const lift = s < 0 ? pose.pawLiftL : pose.pawLiftR;
  const sitX = s * 8.8;
  const sitY = -3.2;
  if (rimY === undefined || pose.rimT <= 0) return { x: sitX, y: sitY - lift };
  const rx = s * 11.5;
  const ry = rimY - pose.rootY - 1.5;
  const t = pose.rimT;
  return { x: sitX + (rx - sitX) * t, y: sitY + (ry - sitY) * t - lift };
}

function drawPaw(ctx, st, lw, p) {
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 5.6, 3.3, 0, 0, TAU);
  ctx.fillStyle = st.fill(P.tan);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  if (!st.sil) {
    ctx.beginPath();
    ctx.moveTo(p.x - 1.6, p.y - 1.4);
    ctx.lineTo(p.x - 1.6, p.y + 0.6);
    ctx.moveTo(p.x + 1.6, p.y - 1.4);
    ctx.lineTo(p.x + 1.6, p.y + 0.6);
    ctx.lineWidth = lw * 0.6;
    ctx.stroke();
  }
}

function drawLeg(ctx, st, lw, s, p) {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 8, -31);
  ctx.lineTo(p.x - s * 0.2, p.y - 0.8);
  ctx.lineWidth = 7 + lw * 2;
  ctx.strokeStyle = P.line;
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.strokeStyle = st.fill(P.coat);
  ctx.stroke();
  if (!st.sil) {
    // Tan sock on the lower part of the leg.
    const dx = p.x - s * 0.2 - s * 8;
    const dy = p.y - 0.8 + 31;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, 8 / len);
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.2 - dx * k, p.y - 0.8 - dy * k);
    ctx.lineTo(p.x - s * 0.2, p.y - 0.8);
    ctx.strokeStyle = P.tan;
    ctx.stroke();
  }
}

function drawBody(ctx, pose, st, lw, rimY) {
  // Haunches behind the front legs.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 13, -14, 14, 13, 0, 0, TAU);
    ctx.fillStyle = coatGradient(ctx, st, s * 13, -14, 14);
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = P.line;
    ctx.stroke();
  }
  // Torso.
  ctx.fillStyle = coatGradient(ctx, st, 0, -30, 22);
  ctx.fill(TORSO);
  strokeOutline(ctx, TORSO, lw);
  // Front legs: outline, coat, tan socks.
  const paws = [pawPos(pose, -1, rimY), pawPos(pose, 1, rimY)];
  drawLeg(ctx, st, lw, -1, paws[0]);
  drawLeg(ctx, st, lw, 1, paws[1]);
  // Round tummy (food coma): in front of the legs, under the ruff.
  if (pose.belly > 0.01) {
    const b = pose.belly;
    ctx.beginPath();
    ctx.ellipse(0, -14 - 2 * b, 6 + 9 * b, 4 + 7.5 * b, 0, 0, TAU);
    if (st.sil) ctx.fillStyle = P.line;
    else {
      const g = ctx.createRadialGradient(-3, -19, 1, 0, -15, 16);
      g.addColorStop(0, P.cream);
      g.addColorStop(1, P.tan);
      ctx.fillStyle = g;
    }
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = P.line;
    ctx.stroke();
    if (!st.sil) {
      // Belly button, because of course.
      ctx.beginPath();
      ctx.arc(0, -12.5, 0.7, 0, TAU);
      ctx.fillStyle = 'rgba(46,24,16,0.45)';
      ctx.fill();
    }
  }
  drawPaw(ctx, st, lw, paws[0]);
  drawPaw(ctx, st, lw, paws[1]);
  // Chest ruff.
  if (st.sil) {
    ctx.fillStyle = P.line;
  } else {
    const g = ctx.createLinearGradient(0, -52, 0, -20);
    g.addColorStop(0, P.tan);
    g.addColorStop(1, P.cream);
    ctx.fillStyle = g;
  }
  ctx.fill(RUFF);
  strokeOutline(ctx, RUFF, lw * 0.85);
  // Bandana with polka dots and a name tag.
  ctx.fillStyle = st.fill(P.bandana);
  ctx.fill(BANDANA);
  if (!st.sil) {
    ctx.save();
    ctx.clip(BANDANA);
    ctx.fillStyle = P.bandanaDot;
    for (const [x, y] of [[-9, -47.5], [-3, -48.6], [3, -48.6], [9, -47.5], [-5.6, -43.4], [0, -44.2], [5.6, -43.4], [-2.6, -39], [2.6, -39], [0, -35.8]]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.15, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = P.bandanaShade;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-11, -49);
    ctx.quadraticCurveTo(-6, -43, -2, -37);
    ctx.moveTo(11, -49);
    ctx.quadraticCurveTo(6, -43, 2, -37);
    ctx.stroke();
    ctx.restore();
  }
  strokeOutline(ctx, BANDANA, lw);
  ctx.beginPath();
  ctx.arc(0, -47.4, 2.4, 0, TAU);
  ctx.fillStyle = st.fill('#E8C26A');
  ctx.fill();
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = P.line;
  ctx.stroke();
}

function drawEar(ctx, pose, st, lw, side) {
  // side: -1 left, +1 right (viewer's left/right).
  const t = pose.turn;
  const far = (side > 0 && t > 0) || (side < 0 && t < 0);
  const k = Math.abs(t);
  const restDeg = side < 0 ? 32 : 29;
  let ang = restDeg + pose.earsBack * 35 + (side < 0 ? pose.earAsym * 18 : -pose.earAsym * 10);
  ang = ang * DEG + (side < 0 ? pose.earL : pose.earR);
  ang += (far ? -12 : 8) * k * DEG * side;
  const sx = far ? 1 - 0.15 * k : 1;
  const sy = 1 - 0.12 * Math.max(0, pose.earsBack);
  ctx.save();
  ctx.translate(side * 15 + t * 3.5, -16);
  ctx.rotate(side * ang);
  ctx.scale(-side * sx, sy);
  // Silky fringe behind the ear, drooping outward and down.
  const fdx = -0.82;
  const fdy = 0.57;
  const fringe = new Path2D();
  for (const [x, y, len] of EAR_FRINGE) leaf(fringe, x + 1.5, y, fdx, fdy, len, 3, -3.6);
  fluff(ctx, fringe, P.coat, lw * 0.85, st);
  if (!st.sil) {
    ctx.beginPath();
    for (const [x, y, len] of EAR_FRINGE) {
      const ox = x + 1 + fdx * len * 0.45 + 0.57 * 1.1;
      const oy = y + fdy * len * 0.45 + 0.82 * 1.1;
      leaf(ctx, ox, oy, fdx, fdy + 0.15, len * 0.5, 1.05, -1.6);
    }
    ctx.fillStyle = P.coatLight;
    ctx.fill();
  }
  ctx.fillStyle = coatGradient(ctx, st, 0, -14, 20);
  ctx.fill(EAR);
  strokeOutline(ctx, EAR, lw);
  if (!st.sil) {
    const g = ctx.createLinearGradient(0, -27, 0, 2);
    g.addColorStop(0, P.earInner);
    g.addColorStop(1, P.earInnerDeep);
    ctx.fillStyle = g;
    ctx.fill(EAR_INNER);
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = 'rgba(46,24,16,0.35)';
    ctx.stroke(EAR_INNER);
  }
  ctx.restore();
}

function drawEye(ctx, pose, st, lw, x, y, sx, open) {
  const r = 6.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.line;
  if (st.sil) {
    ctx.restore();
    return;
  }
  if (pose.happy > 0.5) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, 1.6);
    ctx.quadraticCurveTo(0, -r * 1.05, r * 0.85, 1.6);
    ctx.lineWidth = 2.3;
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (pose.squint > 0.5) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.55);
    ctx.lineTo(r * 0.55, 0);
    ctx.lineTo(-r * 0.7, r * 0.55);
    ctx.lineWidth = 2.1;
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (open <= 0.06) {
    // Closed: a soft downward arc with lashes.
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, -0.4);
    ctx.quadraticCurveTo(0, r * 0.75, r * 0.9, -0.4);
    ctx.lineWidth = 2.1;
    ctx.stroke();
    ctx.restore();
    return;
  }
  // Eyeball.
  ctx.beginPath();
  ctx.arc(0, 0, r + lw * 0.45, 0, TAU);
  ctx.fillStyle = P.line;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = P.sclera;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  const lx = Math.max(-1, Math.min(1, pose.lookX)) * 1.6;
  const ly = Math.max(-1, Math.min(1, pose.lookY)) * 1.3;
  const ir = 6.05;
  const ig = ctx.createLinearGradient(0, ly - ir, 0, ly + ir);
  ig.addColorStop(0, P.iris);
  ig.addColorStop(1, P.irisLight);
  ctx.beginPath();
  ctx.arc(lx, ly, ir, 0, TAU);
  ctx.fillStyle = ig;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lx * 1.1, ly * 1.1, 3.4 * pose.pupil, 0, TAU);
  ctx.fillStyle = P.pupil;
  ctx.fill();
  // Catchlights stay roughly put (they reflect the window), which makes the eye look wet.
  const cx = lx * 0.3;
  const cy = ly * 0.3;
  ctx.fillStyle = P.catchlight;
  ctx.beginPath();
  ctx.arc(-1.8 + cx, -2.1 + cy, 1.8, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(2 + cx, 1.7 + cy, 0.85, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (pose.sparkle > 0.05) {
    const s = 1.3 * pose.sparkle;
    ctx.beginPath();
    const sxp = 2.6 + cx;
    const syp = -2.4 + cy;
    ctx.moveTo(sxp, syp - s);
    ctx.quadraticCurveTo(sxp, syp, sxp + s, syp);
    ctx.quadraticCurveTo(sxp, syp, sxp, syp + s);
    ctx.quadraticCurveTo(sxp, syp, sxp - s, syp);
    ctx.quadraticCurveTo(sxp, syp, sxp, syp - s);
    ctx.fill();
  }
  // Wet rim along the lower lid.
  ctx.beginPath();
  ctx.arc(0, 0, r - 0.9, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Upper lid.
  const o = Math.min(1, open);
  if (o < 0.999) {
    const lidY = -r + 2 * r * (1 - o);
    ctx.beginPath();
    ctx.moveTo(-r - 1, -r - 1);
    ctx.lineTo(r + 1, -r - 1);
    ctx.lineTo(r + 1, lidY);
    ctx.quadraticCurveTo(0, lidY + 1.8, -r - 1, lidY);
    ctx.closePath();
    ctx.fillStyle = P.coat;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r, lidY);
    ctx.quadraticCurveTo(0, lidY + 1.8, r, lidY);
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawMouth(ctx, pose, st, lw, mx) {
  if (st.sil) return;
  const y0 = 17.4;
  const lift = pose.smile * 1.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.line;
  ctx.lineWidth = lw * 0.7;
  if (pose.jaw < 0.12) {
    ctx.beginPath();
    ctx.moveTo(mx, 15.6);
    ctx.lineTo(mx, y0);
    ctx.moveTo(mx - 4.8, y0 - lift);
    ctx.quadraticCurveTo(mx - 2.4, y0 + 2.8, mx, y0);
    ctx.quadraticCurveTo(mx + 2.4, y0 + 2.8, mx + 4.8, y0 - lift);
    ctx.stroke();
  } else {
    const depth = 2 + 8.5 * pose.jaw;
    const w = 4.6 + pose.jaw * 0.8;
    const open = new Path2D();
    open.moveTo(mx - w, y0 - lift * 0.6);
    open.quadraticCurveTo(mx, y0 - 1.2, mx + w, y0 - lift * 0.6);
    open.quadraticCurveTo(mx + w * 0.9, y0 + depth, mx, y0 + depth);
    open.quadraticCurveTo(mx - w * 0.9, y0 + depth, mx - w, y0 - lift * 0.6);
    open.closePath();
    ctx.fillStyle = P.mouth;
    ctx.fill(open);
    ctx.save();
    ctx.clip(open);
    ctx.beginPath();
    ctx.ellipse(mx, y0 + depth, w * 0.75, depth * 0.55, 0, 0, TAU);
    ctx.fillStyle = P.tongue;
    ctx.fill();
    ctx.restore();
    ctx.stroke(open);
    ctx.beginPath();
    ctx.moveTo(mx, 15.6);
    ctx.lineTo(mx, y0 - 0.8);
    ctx.stroke();
  }
  if (pose.tongue > 0.02) {
    // The tongue swings sideways with tongueX (a lick of the lips), pivoting at the mouth.
    const len = 2.5 + 7 * pose.tongue;
    const top = y0 + (pose.jaw < 0.12 ? 0.4 : 2 + 5 * pose.jaw);
    const tw = 2.9;
    ctx.save();
    ctx.translate(mx + pose.tongueX * 1.6, top);
    ctx.rotate(-pose.tongueX * 1.15);
    const tg = new Path2D();
    tg.moveTo(-tw, 0);
    tg.lineTo(-tw, len - tw);
    tg.arc(0, len - tw, tw, Math.PI, 0, true);
    tg.lineTo(tw, 0);
    tg.closePath();
    ctx.fillStyle = P.tongue;
    ctx.fill(tg);
    ctx.lineWidth = lw * 0.6;
    ctx.strokeStyle = P.line;
    ctx.stroke(tg);
    ctx.beginPath();
    ctx.moveTo(0, 0.6);
    ctx.lineTo(0, len - tw * 0.6);
    ctx.strokeStyle = P.tongueShade;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
}

// Debug profiler (tools only): ms per part, optionally forcing raster with a 1-pixel readback.
let PROF = null;
let profT = 0;
export function setDogProfiler(obj) {
  PROF = obj;
}
function pm(ctx, name) {
  if (!PROF) return;
  if (PROF.flush) ctx.getImageData(0, 0, 1, 1);
  const t = performance.now();
  PROF[name] = (PROF[name] || 0) + (t - profT);
  profT = t;
}

function drawHead(ctx, pose, st, lw) {
  const t = pose.turn;
  const k = Math.abs(t);
  // Ears and cheek tufts go behind the skull.
  drawEar(ctx, pose, st, lw, -1);
  drawEar(ctx, pose, st, lw, 1);
  pm(ctx, 'ears');
  const tufts = new Path2D();
  for (const s of [-1, 1]) {
    leaf(tufts, s * 23.5 + t * 3.5, -1, s * 0.92, 0.38, 7, 2.8, s * 2);
    leaf(tufts, s * 23 + t * 3.5, 4.5, s * 0.84, 0.54, 7, 2.8, s * 2);
    leaf(tufts, s * 20.8 + t * 3.5, 9.5, s * 0.62, 0.78, 6, 2.6, s * 1.6);
  }
  fluff(ctx, tufts, P.coat, lw * 0.85, st);

  pm(ctx, 'tufts');
  // Skull.
  ctx.save();
  ctx.translate(t * 3.5, 0);
  ctx.fillStyle = coatGradient(ctx, st, -3, -6, 27);
  ctx.fill(SKULL);
  strokeOutline(ctx, SKULL, lw);
  ctx.restore();

  // Cowlick on top.
  for (const c of COWLICK) {
    ctx.save();
    ctx.translate(t * 5, 0.6);
    ctx.fillStyle = st.fill(P.coat);
    ctx.fill(c);
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = P.line;
    ctx.stroke(c);
    ctx.restore();
  }
  if (st.sil) return;

  pm(ctx, 'skull');
  // Tan face markings: cheeks and muzzle.
  ctx.save();
  ctx.clip(SKULL);
  ctx.fillStyle = P.tan;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 13.5 + t * 9, 11.5, 7.5, 5.5, s * 0.35, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  const mz = t * 12;
  const mg = ctx.createLinearGradient(0, 8, 0, 24);
  mg.addColorStop(0, P.cream);
  mg.addColorStop(1, P.tan);
  ctx.beginPath();
  ctx.ellipse(mz, 16, 11, 8, 0, 0, TAU);
  ctx.fillStyle = mg;
  ctx.fill();
  // Muzzle outline only along the bottom (the chin), so it reads as one face.
  ctx.beginPath();
  ctx.ellipse(mz, 16, 11, 8, 0, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = 'rgba(46,24,16,0.55)';
  ctx.stroke();

  // Puffed cheeks while chewing: the muzzle bulges on that side (same gradient, outer edge only).
  for (const [s, v] of [[-1, pose.cheekL], [1, pose.cheekR]]) {
    if (v < 0.02) continue;
    const cx = mz + s * (8 + 1.6 * v);
    ctx.beginPath();
    ctx.ellipse(cx, 16.2, 3 + 2.4 * v, 4 + 1.6 * v, 0, 0, TAU);
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.beginPath();
    const a0 = s < 0 ? 0.55 * Math.PI : -0.45 * Math.PI;
    ctx.ellipse(cx, 16.2, 3 + 2.4 * v, 4 + 1.6 * v, 0, a0, a0 + 0.9 * Math.PI);
    ctx.lineWidth = lw * 0.55;
    ctx.strokeStyle = 'rgba(46,24,16,0.45)';
    ctx.stroke();
  }

  // Blush.
  if (pose.blush > 0.02) {
    for (const s of [-1, 1]) {
      const bx = s * 15 + t * 9;
      const g = ctx.createRadialGradient(bx, 9.5, 0, bx, 9.5, 5);
      g.addColorStop(0, `rgba(255,143,163,${Math.min(0.6, pose.blush)})`);
      g.addColorStop(1, 'rgba(255,143,163,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(bx, 9.5, 5.5, 3.6, 0, 0, TAU);
      ctx.fill();
    }
  }

  // Brows (tan dots).
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 10 + t * 9, -9 - pose.browY * 2.2);
    ctx.rotate(-s * pose.browTilt * 24 * DEG);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.7, 1.8, 0, 0, TAU);
    ctx.fillStyle = P.tan;
    ctx.fill();
    ctx.restore();
  }

  pm(ctx, 'face');
  // Eyes: the far eye is foreshortened during a turn.
  const ex = t * 9;
  const leftScale = t > 0 ? 1 + 0.06 * k : 1 - 0.28 * k;
  const rightScale = t > 0 ? 1 - 0.28 * k : 1 + 0.06 * k;
  drawEye(ctx, pose, st, lw, -10.5 + ex, 2, leftScale, pose.eyeOpen * pose.eyeOpenL);
  drawEye(ctx, pose, st, lw, 10.5 + ex, 2, rightScale, pose.eyeOpen * pose.eyeOpenR);

  pm(ctx, 'eyes');
  // Nose with a highlight; wrinkles when sniffing.
  ctx.save();
  ctx.translate(t * 14, 13.4);
  ctx.fillStyle = P.nose;
  ctx.fill(NOSE);
  ctx.lineWidth = lw * 0.6;
  ctx.strokeStyle = P.line;
  ctx.stroke(NOSE);
  ctx.fillStyle = P.noseHi;
  ctx.beginPath();
  ctx.ellipse(-0.9, -0.9, 1.2, 0.6, -0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(-1.2, -1.1, 0.45, 0, TAU);
  ctx.fill();
  if (pose.noseWrinkle > 0.05) {
    ctx.strokeStyle = `rgba(46,24,16,${0.6 * pose.noseWrinkle})`;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-2.2, -3.4 - i * 1.4);
      ctx.quadraticCurveTo(0, -4.4 - i * 1.4, 2.2, -3.4 - i * 1.4);
      ctx.stroke();
    }
  }
  ctx.restore();

  drawMouth(ctx, pose, st, lw, t * 13);
  pm(ctx, 'nose+mouth');
}

// ---------- public ----------

// opts: { pxPerU, silhouette }
export function drawDog(ctx, pose, opts = {}) {
  const st = makeStyle(!!opts.silhouette);
  const lw = Math.max(1.8, opts.pxPerU ? 1.25 / opts.pxPerU : 0);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  bodyTransform(ctx, pose);

  // Contact shadow.
  if (!st.sil && !opts.noShadow) {
    ctx.beginPath();
    ctx.ellipse(0, -0.5, 26, 4.5, 0, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();
  }

  if (PROF) {
    if (PROF.flush) ctx.getImageData(0, 0, 1, 1);
    profT = performance.now();
    PROF.frames = (PROF.frames || 0) + 1;
  }
  drawTail(ctx, pose, st, lw);
  pm(ctx, 'tail');
  ctx.save();
  // Breathing swells the chest a little (scale around the paws).
  ctx.scale(1 - 0.01 * pose.breath, 1 + 0.025 * pose.breath);
  drawBody(ctx, pose, st, lw, opts.rimY);
  pm(ctx, 'body');
  ctx.restore();

  ctx.save();
  ctx.translate(0, NECK_Y - 0.6 * pose.breath);
  ctx.rotate(pose.tilt);
  ctx.translate(pose.headDX, -HEAD_UP + pose.headDY);
  drawHead(ctx, pose, st, lw);
  if (opts.hat) drawHat(ctx, opts.hat, lw);
  ctx.restore();

  ctx.restore();
}

// Skin hats, in head-local units (head center at 0, 0; the top of the skull is at about y = -23).
function drawHat(ctx, kind, lw) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = P.line;
  if (kind === 'chef') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.rect(-9, -30, 18, 9);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-7, -34, 6, Math.PI * 0.6, Math.PI * 1.75);
    ctx.arc(0, -38, 7, Math.PI * 1.1, Math.PI * 1.9);
    ctx.arc(7, -34, 6, Math.PI * 1.25, Math.PI * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'party') {
    ctx.fillStyle = '#6FA8E8';
    ctx.beginPath();
    ctx.moveTo(-8, -21);
    ctx.lineTo(3, -46);
    ctx.lineTo(10, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFF3D6';
    for (const [x, y] of [[0, -27], [4, -35], [-2, -33]]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FF6F91';
    ctx.beginPath();
    ctx.arc(3, -47, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'crown') {
    ctx.fillStyle = '#F2C230';
    ctx.beginPath();
    ctx.moveTo(-11, -21);
    ctx.lineTo(-12, -33);
    ctx.lineTo(-5, -27);
    ctx.lineTo(0, -36);
    ctx.lineTo(5, -27);
    ctx.lineTo(12, -33);
    ctx.lineTo(11, -21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E5484D';
    ctx.beginPath();
    ctx.arc(0, -25, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function bodyTransform(ctx, pose) {
  ctx.translate(pose.rootX, pose.rootY);
  const sq = pose.squashY;
  ctx.scale(1 / Math.sqrt(sq), sq);
  ctx.rotate(pose.lean);
  if (pose.spin) {
    // A 2D "turn around": squash to a sliver and flip.
    const c = Math.cos(pose.spin * TAU);
    ctx.scale((c < 0 ? -1 : 1) * Math.max(0.08, Math.abs(c)), 1);
  }
}

// Paws resting on the sink rim, drawn after the rim layer so they sit on top of it.
// opts.rimY: rim top in the dog's frame (u, negative = above the paws' floor).
export function drawRimPaws(ctx, pose, opts = {}) {
  if (opts.rimY === undefined || pose.rimT < 0.35) return;
  const st = makeStyle(false);
  const lw = Math.max(1.8, opts.pxPerU ? 1.25 / opts.pxPerU : 0);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  bodyTransform(ctx, pose);
  ctx.scale(1 - 0.01 * pose.breath, 1 + 0.025 * pose.breath);
  ctx.globalAlpha = Math.min(1, (pose.rimT - 0.35) / 0.3);
  for (const s of [-1, 1]) {
    const p = pawPos(pose, s, opts.rimY);
    // A short stretch of leg above the paw hides the rim edge behind it.
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.6, p.y - 7);
    ctx.lineTo(p.x - s * 0.2, p.y - 0.8);
    ctx.lineWidth = 7 + lw * 2;
    ctx.strokeStyle = P.line;
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = P.tan;
    ctx.stroke();
    drawPaw(ctx, st, lw, p);
  }
  ctx.restore();
}

// Where things are, in the dog's local units (before pose offsets). Used for aiming and effects.
export const ANCHORS = {
  mouth: { x: 0, y: -58 },
  head: { x: 0, y: -77 },
  heart: { x: 0, y: -108 },
  bubble: { x: 26, y: -112 },
};
export const DOG_HEIGHT_WITH_EARS = 122;
