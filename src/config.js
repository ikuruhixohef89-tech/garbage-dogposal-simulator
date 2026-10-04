// All tunable numbers and colors live here. No DOM access: this file is imported by Node tests.

export const SLUG = 'garbage-dogposal-simulator';
export const STORAGE_KEY = 'gds:v1';

// Design boxes in logical units (lu). The box is fitted inside the safe rect;
// the procedural background fills the rest of the screen, so there are never letterbox bars.
export const BOX = {
  landscape: { w: 1600, h: 900 },
  portrait: { w: 900, h: 1600 },
};

export const LAYOUT = {
  hysteresis: 1.04,          // keep the previous mode while the two scales differ by less than 4%
  compactCssH: 300,          // below this CSS height the UI switches to compact mode
  extraYTop: { landscape: 0.65, portrait: 0.4 }, // share of spare vertical space placed above the box
  minHitCss: 48,             // world targets are expanded to at least this size (CSS px)
  edgeGuardSideCss: 24,      // keep interactive zones away from the back-swipe edges
  edgeGuardTopBottomCss: 8,
};

// Interactive zones per layout mode, in lu (x, y, w, h). Coordinates come from GAME_PLAN.md 5.4.
export const ZONES = {
  landscape: {
    sink:  { x: 60,   y: 300, w: 470, h: 520 },
    bowl:  { x: 1250, y: 560, w: 280, h: 230 },
    bin:   { x: 610,  y: 738, w: 170, h: 90 }, // lower than the tray: a flick to the bin is clearly not a flick to the dog
    tray:  { x: 826,  y: 690, w: 412, h: 96, slots: 6 }, // Sort & Feed only
  },
  portrait: {
    sink:  { x: 120, y: 180,  w: 660, h: 520 },
    bin:   { x: 70,  y: 1400, w: 220, h: 150 },
    tray:  { x: 90,  y: 1240, w: 720, h: 112, slots: 6 }, // Sort & Feed only
    bowl:  { x: 540, y: 1380, w: 270, h: 190 },
  },
};

// Where SOUS-AI tosses things, in lu: launch x range, apex height range, gravity, max sideways speed.
// Nothing is tossed over the sink, so the dog's face stays clear.
export const ARENA = {
  landscape: { x0: 660, x1: 1520, apex0: 110, apex1: 390, g: 1150, maxVx: 300, stampY: 210 },
  portrait: { x0: 110, x1: 790, apex0: 760, apex1: 1060, g: 1300, maxVx: 160, stampY: 820 },
};

// Kitchen background geometry, in lu, per mode.
export const KITCHEN = {
  landscape: { wallBottom: 370, counterFront: 780, edge: 22, tileW: 120, tileH: 60 },
  portrait: { wallBottom: 560, counterFront: 1575, edge: 22, tileW: 120, tileH: 60 },
};

// Scene props per mode, in lu. dog: paws position and lu-per-u scale (the paws sit below the sink rim).
export const SCENE = {
  landscape: {
    dog: { x: 295, y: 825, k: 4.3 },
    sink: { x: 72, w: 446, backY: 520, rimY: 692, rimH: 44 },
    faucet: { x: 128, y: 520, h: 150, reach: 92 },
    window: { x: 1190, y: 40, w: 320, h: 250 },
    sticker: { x: 650, y: 54, w: 330, h: 120, rot: -0.035 },
  },
  portrait: {
    dog: { x: 450, y: 813, k: 5.4 },
    sink: { x: 136, w: 628, backY: 588, rimY: 640, rimH: 50 },
    faucet: { x: 196, y: 588, h: 120, reach: 78 },
    window: null,
    sticker: null,
  },
};

export const LIMITS = {
  maxDpr: 2,
  maxBackingPx: 4000000,
  bodies: 8, // whole items in the air
  halves: 24,
  particles: 160,
  voices: 12,
};

export const PERF = {
  sampleMs: 500,
  badWorkMs: 14,      // p95 of frame work above this for badSeconds lowers the DPR cap
  badSeconds: 3,
  goodWorkMs: 8,
  goodSeconds: 10,
  // Raster cost does not show up in "work" (canvas drawing finishes later on the GPU or raster thread),
  // so the frame interval is watched too. A steady 30 fps cap (iOS Low Power Mode) has little jitter
  // and is not treated as overload.
  slowIntervalMs: 22,
  goodIntervalMs: 18,
  jitterMs: 4,
  verySlowIntervalMs: 40,
  ignoreIntervalOverMs: 1000, // stalls (hidden tab, scrolled-away iframe) are not samples; slow frames still are
  dynStep: 0.25,
  stallSeconds: 1,    // a frame gap longer than this pauses a running shift
};

export const UI_SCALE = { refW: 1280, refH: 720, min: 0.5, max: 1.6 };

export const PALETTE = {
  ui: {
    ink: '#3A2418', inkMuted: '#7A6250',
    paper: '#FFF8EC', paperShade: '#F1E6D3', paperLip: '#D8C9B0',
    primary: '#FFC93C', primaryHover: '#FFD866', primaryLip: '#D99A1E',
    good: '#5BB467', danger: '#E5484D', warn: '#F2B233', heart: '#FF6F91',
  },
  dog: {
    coat: '#6B3E26', coatShade: '#4E2A19', coatLight: '#A8693F', line: '#2E1810',
    tan: '#D9A066', cream: '#F2D3A6', earInner: '#E8A48C', earInnerDeep: '#C97C6B',
    iris: '#3B2014', irisLight: '#6B3A1E', pupil: '#120905', sclera: '#F6EEE4', catchlight: '#FFFFFF',
    nose: '#3A2218', noseHi: '#8A5A45',
    tongue: '#F07E8C', tongueShade: '#C95466', mouth: '#6E2A2E',
    blush: '#FF8FA3', rim: '#FFE3B8',
    bandana: '#FFC93C', bandanaDot: '#FFF3D6', bandanaShade: '#D99A1E',
  },
  scene: {
    tile: '#F4EFE6', tileShade: '#E6DED0', grout: '#D6CCBB', wallGlow: '#FFF4DE',
    counter: '#E9E2D6', counterSpeck: '#D8CFC0', counterEdge: '#CFC5B5', counterShadow: '#B8AC99',
    cabinet: '#9DB5A0', cabinetShade: '#7F9883', handle: '#C4CBD2',
    board: '#DDA868', boardGrain: '#C48D50', boardEdge: '#A9733E', boardHi: '#F0C68A',
    steel1: '#E3E7EB', steel2: '#B9C0C7', steel3: '#808992', steel4: '#5E666E', steelSpec: '#FFFFFF',
    chrome1: '#F6F8FA', chrome2: '#C4CBD2', chrome3: '#7B848D', chrome4: '#3F464D',
    mitt: '#E07A5F', mittQuilt: '#C2604A', mittCuff: '#F4EFE6',
    bowl: '#F7F3EC', bowlStripe: '#E07A5F',
    sky: '#BFE3F2', skyLight: '#E9F6FB',
  },
};
