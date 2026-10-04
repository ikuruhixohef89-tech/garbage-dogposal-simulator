// Micro-events: short twists in a shift. One at a time. Pure data and planning; session.js runs the effects.
// Body-related jokes stay appliance jokes: "UNIT JAMMED" is about a gadget, not a medical condition.

export const EVENTS = {
  jammed: {
    label: 'UNIT JAMMED', dur: 6, minShift: 0, scheduled: false,
    lines: ['Unit jammed. Have you tried turning him off and on again?', 'Correction: do not turn the dog off. Pet him.'],
    end: 'Unit cleared. Cause: enthusiasm.',
  },
  hiccups: {
    label: 'HICCUPS', dur: 7.5, minShift: 0, scheduled: true,
    lines: ['Hiccups detected. Recommended action: none. They pass.'],
    end: 'Hiccups resolved. I’m taking credit.',
  },
  sneeze: {
    label: 'SNEEZE INCOMING', dur: 2.4, minShift: 1, scheduled: true,
    lines: ['Pre-sneeze detected. Brace the produce.'],
    end: 'Bless you. Figure of speech. I can’t bless.',
  },
  delivery: {
    label: 'DELIVERY', dur: 4.5, minShift: 1, scheduled: true,
    lines: ['Doorbell. Delivery: lots of vegetables. I may have ordered them twice.'],
    end: 'Delivery handled. The unit barked at it. Security: excellent.',
  },
};

// Picks the scheduled events of a shift and their start times (seconds into the shift).
// Never in the first 12 s or the last 10 s, at least 11 s apart, no repeats within a shift.
export function planEvents(rng, shiftIndex, timer, count) {
  const ids = Object.keys(EVENTS).filter(id => EVENTS[id].scheduled && EVENTS[id].minShift <= shiftIndex);
  const out = [];
  const lo = 12;
  const hi = timer - 10;
  if (hi <= lo) return out;
  for (let k = 0; k < count && ids.length; k++) {
    const i = Math.floor(rng.next() * ids.length);
    const id = ids.splice(i, 1)[0];
    let at = lo + rng.next() * (hi - lo);
    for (let tries = 0; tries < 8 && out.some(e => Math.abs(e.at - at) < 11); tries++) at = lo + rng.next() * (hi - lo);
    if (out.some(e => Math.abs(e.at - at) < 11)) continue;
    out.push({ id, at });
  }
  return out.sort((a, b) => a.at - b.at);
}
