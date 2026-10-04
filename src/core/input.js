// Pointer and keyboard input.
// Pointer Events with capture, primary pointer only; keys are matched by e.code so they work in any layout.

const KEYMAP = {
  KeyH: 'hideUi',
  KeyF: 'fullscreen',
  KeyM: 'mute',
  KeyP: 'pause',
  Escape: 'pause',
  KeyR: 'restart',
  Space: 'chop',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  KeyQ: 'prev',
  KeyE: 'next',
  Digit1: 'pick1',
  Digit2: 'pick2',
  Digit3: 'pick3',
  Numpad1: 'pick1',
  Numpad2: 'pick2',
  Numpad3: 'pick3',
};

// Actions that must not auto-repeat while a key is held.
const NO_REPEAT = new Set(['hideUi', 'fullscreen', 'mute', 'pause', 'restart', 'confirm', 'pick1', 'pick2', 'pick3']);

export function createInput({ stage, canvas, vp, onPointer, onKey, isCapturing }) {
  let active = null;
  let rect = null;

  const point = (e, r) => {
    const L = vp.layout;
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    return {
      id: e.pointerId,
      cx,
      cy,
      x: L ? (cx - L.ox) / L.s : 0,
      y: L ? (cy - L.oy) / L.s : 0,
      t: e.timeStamp,
      type: e.pointerType || 'mouse',
    };
  };

  canvas.addEventListener('pointerdown', e => {
    // One gesture at a time; a resting second finger must not block the next touch.
    if (active !== null) return;
    active = e.pointerId;
    rect = canvas.getBoundingClientRect();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // Capture can fail if the pointer is already gone; the gesture still works without it.
    }
    onPointer('down', point(e, rect));
  });

  canvas.addEventListener(
    'pointermove',
    e => {
      if (e.pointerId !== active) {
        if (active === null && e.pointerType === 'mouse') onPointer('hover', point(e, canvas.getBoundingClientRect()));
        return;
      }
      const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      if (list && list.length) {
        for (const ce of list) onPointer('move', point(ce, rect));
      } else {
        onPointer('move', point(e, rect));
      }
    },
    { passive: true },
  );

  const end = type => e => {
    if (e.pointerId !== active) return;
    active = null;
    onPointer(type, point(e, rect || canvas.getBoundingClientRect()));
  };
  canvas.addEventListener('pointerup', end('up'));
  canvas.addEventListener('pointercancel', end('cancel'));
  canvas.addEventListener('lostpointercapture', end('cancel'));

  // While a shift is running, block scroll / pull-to-refresh / double-tap zoom.
  // Before PLAY the page around the iframe must stay scrollable, so touches pass through.
  const block = e => {
    if (isCapturing()) e.preventDefault();
  };
  canvas.addEventListener('touchstart', block, { passive: false });
  canvas.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  stage.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('selectstart', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const action = KEYMAP[e.code];
    if (!action) return;
    const target = e.target;
    const onButton = target && typeof target.closest === 'function' && target.closest('button');
    // A focused button activates itself on Space/Enter; do not handle the key twice.
    if (onButton && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) return;
    if (e.repeat && NO_REPEAT.has(action)) {
      e.preventDefault();
      return;
    }
    if (onKey(action, e) !== false) e.preventDefault();
  });

  return {
    get pointerActive() {
      return active !== null;
    },
  };
}
