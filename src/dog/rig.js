// Crumb's pose: a flat set of numbers that drawDog() understands.
// States and overlays only change these numbers; drawing never decides anything.

const DEG = Math.PI / 180;

export function defaultPose() {
  return {
    // body
    rootX: 0, rootY: 0,      // u, offset of the whole dog
    squashY: 1,              // vertical squash at the feet (volume is preserved)
    breath: 0,               // 0..1 chest swell
    lean: 0,                 // rad, body lean
    belly: 0,                // 0..1 round tummy (food coma)
    tail: 0,                 // rad, tail swing
    spin: 0,                 // 0..1 a full 2D "turn around" (zoomies)
    rimT: 0,                 // 0 sitting .. 1 standing with front paws on the sink rim
    pawLiftL: 0, pawLiftR: 0,// u, tippy taps
    // head
    tilt: 0,                 // rad, head roll around the neck
    turn: 0,                 // -1..1 fake three-quarter turn
    headDX: 0, headDY: 0,    // u, head offset from the neck
    // ears
    earsBack: 0,             // -0.5 = perked forward, 1 = flat back
    earAsym: 0,              // -1..1, ears in different directions
    earL: 0, earR: 0,        // rad, extra (springs, twitches)
    // eyes
    eyeOpen: 1,              // 0 closed .. 1.1 wide
    eyeOpenL: 1, eyeOpenR: 1,// per-eye multipliers (blinks can start with one eye)
    happy: 0,                // 0..1 eyes become ^ ^
    squint: 0,               // 0..1 eyes become > <
    pupil: 1,                // 0.8..1.3 pupil size (1.3 = puppy eyes)
    lookX: 0, lookY: 0,      // -1..1 gaze direction
    sparkle: 0,              // 0..1 extra star catchlights
    browY: 0,                // -1 down .. 1 up
    browTilt: 0,             // 1 = worried (inner ends up), -1 = frown
    // mouth
    jaw: 0,                  // 0..1 open
    tongue: 0,               // 0..1 out
    tongueX: 0,              // -1..1 tongue sweep
    smile: 0,                // 0..1 corners up
    cheekL: 0, cheekR: 0,    // 0..1 puffed (chewing)
    blush: 0.25,             // 0..1
    noseWrinkle: 0,          // 0..1
  };
}

const NUMERIC_KEYS = Object.keys(defaultPose());

export function copyPose(out, src) {
  for (const k of NUMERIC_KEYS) out[k] = src[k];
  return out;
}

export function lerpPose(out, a, b, t) {
  for (const k of NUMERIC_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

// Expression presets: only the keys that differ from the default pose.
export const EXPRESSIONS = {
  neutral: {},
  alert: { earsBack: -0.45, eyeOpen: 1.08, tilt: 12 * DEG, browY: 0.4 },
  beg: { pupil: 1.22, browTilt: 0.8, browY: 0.3, earsBack: -0.35, blush: 0.45, tilt: 6 * DEG, sparkle: 0.6, smile: 0.3 },
  catch: { jaw: 1, eyeOpen: 1.1, earsBack: 0.2, headDY: -2 },
  chew: { jaw: 0.25, cheekL: 1, eyeOpen: 0.62, blush: 0.4, smile: 0.2 },
  lick: { tongue: 1, tongueX: 0.55, eyeOpen: 0.75, jaw: 0.25, blush: 0.4 },
  happy: { happy: 1, jaw: 0.55, tongue: 0.45, blush: 0.6, smile: 1, earsBack: 0.25 },
  request: { jaw: 0.85, earsBack: 0.45, browY: 0.6, eyeOpen: 1.05, headDY: 1 },
  confused: { tilt: 14 * DEG, earAsym: 0.7, browTilt: 0.35, browY: 0.3, eyeOpen: 1.05 },
  puppyEyes: { pupil: 1.32, browTilt: 1, browY: 0.5, earsBack: 0.7, blush: 0.5, eyeOpen: 1.05, sparkle: 1, tilt: -8 * DEG },
  sleep: { eyeOpen: 0, earsBack: 0.55, headDY: 3, tilt: -7 * DEG, blush: 0.4, smile: 0.2 },
  pet: { happy: 1, earsBack: 0.95, blush: 0.65, tilt: 8 * DEG, smile: 0.8 },
  foodComa: { eyeOpen: 0, belly: 1, earsBack: 0.6, blush: 0.55, smile: 0.6, headDY: 2, lean: -6 * DEG },
};

export function expressionPose(name) {
  return Object.assign(defaultPose(), EXPRESSIONS[name] || {});
}
