// Offscreen canvases for baked layers.

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Zeroing the size lets iOS release canvas memory right away.
export function freeCanvas(c) {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}
