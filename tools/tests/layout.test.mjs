import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, zoneCss, hitRectCss, ZONE_NAMES } from '../../src/core/layout.js';
import { LAYOUT } from '../../src/config.js';

// [width, height, expected mode, expected scale]
const CASES = [
  [1280, 720, 'landscape', 0.8],
  [1920, 1080, 'landscape', 1.2],
  [1024, 768, 'landscape', 0.64],
  [768, 1024, 'portrait', 0.64],
  [375, 812, 'portrait', 375 / 900],
  [812, 375, 'landscape', 375 / 900],
  [360, 800, 'portrait', 0.4],
  [320, 568, 'portrait', 568 / 1600],
  [343, 193, 'landscape', 343 / 1600], // phone portrait, iframe on the site (measured)
  [733, 412, 'landscape', 733 / 1600], // phone landscape, iframe on the site (measured)
  [747, 420, 'landscape', 747 / 1600], // desktop, iframe on the site (measured)
];

for (const [w, h, mode, s] of CASES) {
  test(`${w}x${h} -> ${mode} s=${s.toFixed(4)}`, () => {
    const L = computeLayout(w, h);
    assert.equal(L.mode, mode);
    assert.ok(Math.abs(L.s - s) < 0.001, `scale ${L.s}`);
    for (const v of [L.s, L.ox, L.oy, L.uiScale, L.view.x0, L.view.y0, L.view.x1, L.view.y1]) {
      assert.ok(Number.isFinite(v), 'finite numbers');
    }
    assert.equal(L.compact, h < LAYOUT.compactCssH);
    // The view covers the whole screen.
    assert.ok(L.view.x0 <= 0 && L.view.y0 <= 0, 'view starts at or before the box');
    assert.ok(L.view.x1 >= L.box.w - 1e-6 && L.view.y1 >= L.box.h - 1e-6, 'view ends at or after the box');

    for (const name of ZONE_NAMES) {
      const z = L.zones[name];
      assert.ok(z, `zone ${name}`);
      assert.ok(z.x >= 0 && z.y >= 0 && z.x + z.w <= L.box.w && z.y + z.h <= L.box.h, `${name} inside the box`);
      const c = zoneCss(L, name);
      assert.ok(c.x >= -1e-6 && c.y >= -1e-6 && c.x + c.w <= w + 1e-6 && c.y + c.h <= h + 1e-6, `${name} on screen`);
      if (!L.compact) {
        assert.ok(c.x >= LAYOUT.edgeGuardSideCss - 1e-6, `${name} left edge guard (${c.x.toFixed(1)} px)`);
        assert.ok(w - (c.x + c.w) >= LAYOUT.edgeGuardSideCss - 1e-6, `${name} right edge guard`);
        assert.ok(c.y >= LAYOUT.edgeGuardTopBottomCss - 1e-6, `${name} top edge guard`);
        assert.ok(h - (c.y + c.h) >= LAYOUT.edgeGuardTopBottomCss - 1e-6, `${name} bottom edge guard`);
      }
      const hit = hitRectCss(L, name);
      assert.ok(Math.min(hit.w, hit.h) >= 44, `${name} hit target >= 44 px`);
    }
  });
}

test('hysteresis keeps the previous mode near 1:1', () => {
  assert.equal(computeLayout(1000, 1000).mode, 'landscape');
  assert.equal(computeLayout(1000, 1000, undefined, 'portrait').mode, 'portrait');
  assert.equal(computeLayout(1000, 1030, undefined, 'landscape').mode, 'landscape');
  assert.equal(computeLayout(1000, 1400, undefined, 'landscape').mode, 'portrait');
});

test('safe area shrinks the fitted box', () => {
  const L = computeLayout(812, 375, { t: 0, r: 44, b: 21, l: 44 });
  assert.equal(L.mode, 'landscape');
  assert.ok(Math.abs(L.s - Math.min((812 - 88) / 1600, (375 - 21) / 900)) < 1e-9);
  assert.ok(L.ox >= 44);
});

test('ui scale is clamped', () => {
  assert.equal(computeLayout(343, 193).uiScale, 0.5);
  assert.equal(computeLayout(1280, 720).uiScale, 1);
  assert.equal(computeLayout(2560, 1440).uiScale, 1.6);
});
