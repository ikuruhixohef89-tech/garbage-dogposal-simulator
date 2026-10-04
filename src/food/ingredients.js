// Everything SOUS-AI can toss, and what each part is for a dog. Categories are checked against vet sources:
// see site/sources.md. 'ok' = plain small piece is fine; 'nope' = not food, no strike; 'toxic' = strike.
// The dog's treat is a spare bit of plain flesh, never the ends, peels, pits or cores.

export const CATEGORY = { OK: 'ok', NOPE: 'nope', TOXIC: 'toxic' };

// type: 'produce' (slice it), 'bomb' (toxic: leave it), 'junk' (not food), 'toy' (bat it to the dog).
// size: [length, height] in lu as drawn (lying along x). hits: slices needed to split it.
// scrap: the part that goes to the bin (or null). from: first shift index where it shows up.
export const INGREDIENTS = {
  cucumber: {
    label: 'Cucumber', type: 'produce', size: [260, 64], from: 0, weight: 10,
    flesh: 'ok', spare: 'ok', scrap: { id: 'cucumber-ends', label: 'Cucumber ends', cat: 'nope' },
    sound: 'crunch', bites: 3, juice: '#D9F0B0',
  },
  carrot: {
    label: 'Carrot', type: 'produce', size: [240, 58], from: 0, weight: 9,
    flesh: 'ok', spare: 'ok', scrap: { id: 'carrot-ends', label: 'Carrot ends', cat: 'nope' },
    sound: 'crunch', bites: 4, juice: '#F8BC6A',
  },
  pepper: {
    label: 'Yellow pepper', type: 'produce', size: [150, 132], from: 0, weight: 8,
    flesh: 'ok', spare: 'ok', scrap: { id: 'pepper-cap', label: 'Pepper stem and seeds', cat: 'nope' },
    sound: 'crunch', bites: 3, juice: '#FFE27A',
  },
  apple: {
    label: 'Apple', type: 'produce', size: [124, 122], from: 0, weight: 8,
    flesh: 'ok', spare: 'ok', scrap: { id: 'apple-core', label: 'Apple core', cat: 'toxic' },
    sound: 'crunch', bites: 3, juice: '#F7E7B5',
  },
  strawberry: {
    label: 'Strawberry', type: 'produce', size: [104, 92], from: 0, weight: 7,
    flesh: 'ok', spare: 'ok', scrap: { id: 'strawberry-hulls', label: 'Strawberry tops', cat: 'nope' },
    sound: 'squish', bites: 2, juice: '#FF8A9A',
  },
  banana: {
    label: 'Banana', type: 'produce', size: [230, 64], from: 0, weight: 7,
    flesh: 'ok', spare: 'ok', scrap: { id: 'banana-peel', label: 'Banana peel', cat: 'nope' },
    sound: 'squish', bites: 2, juice: '#FFF1B8',
  },
  blueberries: {
    label: 'Blueberries', type: 'produce', size: [96, 88], from: 0, weight: 6,
    flesh: 'ok', spare: 'ok', scrap: null,
    sound: 'squish', bites: 2, juice: '#7C8FD6',
  },
  tomato: {
    label: 'Tomato', type: 'produce', size: [124, 118], from: 1, weight: 8,
    flesh: 'ok', spare: 'ok', scrap: { id: 'tomato-top', label: 'Tomato top', cat: 'toxic' },
    sound: 'squish', bites: 2, juice: '#F25A44',
  },
  pear: {
    label: 'Pear', type: 'produce', size: [140, 112], from: 1, weight: 7,
    flesh: 'ok', spare: 'ok', scrap: { id: 'pear-core', label: 'Pear core and seeds', cat: 'toxic' },
    sound: 'crunch', bites: 3, juice: '#F3EDB0',
  },
  zucchini: {
    label: 'Zucchini', type: 'produce', size: [270, 66], from: 1, weight: 6,
    flesh: 'ok', spare: 'ok', scrap: null,
    sound: 'crunch', bites: 3, juice: '#E6F0B8',
  },
  watermelon: {
    label: 'Watermelon', type: 'produce', size: [230, 190], from: 1, weight: 4, hits: 2,
    flesh: 'ok', spare: 'ok', scrap: { id: 'watermelon-rind', label: 'Watermelon rind and seeds', cat: 'nope' },
    sound: 'squish', bites: 3, juice: '#FF6F7D',
  },
  peach: {
    label: 'Peach', type: 'produce', size: [124, 120], from: 2, weight: 7,
    flesh: 'ok', spare: 'ok', scrap: { id: 'peach-pit', label: 'Peach pit', cat: 'toxic' },
    sound: 'squish', bites: 2, juice: '#FFD9A0',
  },
  mango: {
    label: 'Mango', type: 'produce', size: [146, 104], from: 2, weight: 6,
    flesh: 'ok', spare: 'ok', scrap: { id: 'mango-pit', label: 'Mango pit', cat: 'toxic' },
    sound: 'squish', bites: 2, juice: '#FFC24A',
  },
  pineapple: {
    label: 'Pineapple', type: 'produce', size: [250, 132], from: 2, weight: 5,
    flesh: 'ok', spare: 'ok', scrap: { id: 'pineapple-skin', label: 'Pineapple core and skin', cat: 'nope' },
    sound: 'crunch', bites: 3, juice: '#FFE680',
  },

  // Bombs: never a treat, never sliced on purpose.
  onion: { label: 'Onion', type: 'bomb', size: [130, 118], from: 0, weight: 10, cat: 'toxic', sound: 'crunch', juice: '#F4EEE6' },
  grapes: { label: 'Grapes', type: 'bomb', size: [140, 122], from: 1, weight: 9, cat: 'toxic', sound: 'squish', juice: '#C9DA96' },
  chocolate: { label: 'Chocolate', type: 'bomb', size: [120, 74], from: 1, weight: 7, cat: 'toxic', sound: 'crunch', juice: '#7A4A33' },
  garlic: { label: 'Garlic', type: 'bomb', size: [104, 100], from: 2, weight: 7, cat: 'toxic', sound: 'crunch', juice: '#F4EEE6' },
  gum: { label: 'Sugar-free gum', type: 'bomb', size: [116, 64], from: 2, weight: 5, cat: 'toxic', sound: 'crunch', juice: '#BFE8F0' },

  // Not food.
  sponge: { label: 'Kitchen sponge', type: 'junk', size: [130, 82], from: 0, weight: 5, cat: 'nope', material: 'soft', juice: '#F4E27A' },
  spoon: { label: 'Wooden spoon', type: 'junk', size: [200, 50], from: 1, weight: 4, cat: 'nope', material: 'hard', juice: '#C9A06A' },

  // A squeaky toy: it is batted to Crumb, never eaten.
  ball: { label: 'Squeaky ball', type: 'toy', size: [84, 84], from: 1, weight: 0, cat: 'nope' },
};

// Short in-game fact lines (English). Wording follows site/sources.md; nothing here calls an item "poison".
export const FACTS = {
  cucumber: 'Plain cucumber is a crunchy, hydrating dog snack. Tiny dogs: a slice or two.',
  'cucumber-ends': 'Vets suggest trimming cucumber ends and peel; they can hold bitter compounds.',
  carrot: 'Raw carrot is a low-calorie dog treat. Cut it small so it can’t be a choking risk.',
  'carrot-ends': 'Carrot ends aren’t toxic, but tough, dirty stubs are a choking risk. Bin them.',
  pepper: 'Sweet bell pepper is safe for dogs in small bites, any color, no seasoning.',
  'pepper-cap': 'Pepper stem, seeds and core aren’t toxic but can upset a dog’s tummy. Bin them.',
  tomato: 'Plain ripe tomato is non-toxic for dogs: tiny bites only, with all green bits removed.',
  'tomato-top': 'Tomato stems and leaves contain tomatine and solanine, which can upset a dog’s stomach.',
  onion: 'Onion in any form (raw, cooked or powdered) can damage a dog’s red blood cells.',
  apple: 'Plain apple slices with no seeds or core make a fine crunchy snack for a dog.',
  'apple-core': 'Apple seeds contain cyanide compounds, and the core and stem can choke a small dog.',
  strawberry: 'Plain strawberry pieces are a sweet, vitamin C-rich treat for dogs in small amounts.',
  'strawberry-hulls': 'Strawberry tops aren’t toxic, but the leaves and stems can upset a dog’s stomach.',
  grapes: 'Grapes and raisins of any color can cause kidney injury in dogs, even in small amounts.',
  chocolate: 'Chocolate contains theobromine and caffeine, and darker chocolate is riskier for dogs.',
  garlic: 'Garlic is several times more toxic to dogs than onion; it’s never a treat.',
  gum: 'Xylitol in sugar-free gum can crash a dog’s blood sugar fast and may harm the liver.',
  banana: 'Banana is a fine occasional dog treat in small pieces. It’s high in sugar, so not every day.',
  'banana-peel': 'Banana peels aren’t toxic to dogs, but they are difficult to digest. Bin the peel.',
  blueberries: 'Blueberries are a safe, antioxidant-rich treat for dogs in small amounts.',
  watermelon: 'Plain watermelon flesh is a juicy dog treat, with the rind and seeds removed.',
  'watermelon-rind': 'Watermelon rind and seeds can cause an intestinal blockage in dogs. Bin them.',
  pear: 'Plain pear flesh is a fine dog treat once the core and seeds are removed.',
  'pear-core': 'Pear seeds contain traces of cyanide, so the core and seeds go in the bin.',
  zucchini: 'Plain zucchini, raw or cooked, is safe for dogs in small pieces.',
  peach: 'Peach flesh, cut away from the pit, is a fine occasional dog treat.',
  'peach-pit': 'A peach pit contains cyanide compounds. Only the flesh around it is for dogs.',
  mango: 'Peeled mango flesh is a safe dog treat once the pit is removed.',
  'mango-pit': 'A mango pit is a choking hazard and contains small amounts of cyanide. Bin it.',
  pineapple: 'Small pieces of plain pineapple flesh are a safe, sweet dog treat.',
  'pineapple-skin': 'Pineapple’s tough core and spiny skin can cause a blockage. Bin them.',
};

export const isProduce = id => INGREDIENTS[id] && INGREDIENTS[id].type === 'produce';

// Every part an item can produce, with its category. Used by rules, Dog Menu and check-food.
// kind: 'dish' (sliced flesh, to the bowl), 'spare' (the treat), 'scrap' (bin), 'intruder' (bomb or junk, whole).
export function piecesOf(id) {
  const it = INGREDIENTS[id];
  if (it.type !== 'produce') return [{ kind: 'intruder', ingredient: id, itemId: id, label: it.label, cat: it.cat }];
  const out = [
    { kind: 'dish', ingredient: id, itemId: id, label: `${it.label}, sliced`, cat: it.flesh },
    { kind: 'spare', ingredient: id, itemId: id, label: `Spare piece of ${it.label.toLowerCase()}`, cat: it.spare },
  ];
  if (it.scrap) out.push({ kind: 'scrap', ingredient: id, itemId: it.scrap.id, label: it.scrap.label, cat: it.scrap.cat });
  return out;
}

export function allPieceTypes() {
  const out = [];
  for (const id of Object.keys(INGREDIENTS)) if (INGREDIENTS[id].type !== 'toy') out.push(...piecesOf(id));
  return out;
}
