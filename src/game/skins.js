// Skins for Crumb. They unlock from records (the best run score in any mode), so nothing is bought or
// stored beyond records and the chosen skin (a setting). Colors: [bandana, dots, shade].

export const SKINS = [
  { id: 'classic', name: 'Classic', need: 0, bandana: ['#FFC93C', '#FFF3D6', '#D99A1E'], hat: null },
  { id: 'mint', name: 'Mint', need: 3000, bandana: ['#7FD6B0', '#F0FFF8', '#4FA884'], hat: null },
  { id: 'berry', name: 'Berry', need: 6000, bandana: ['#E8607A', '#FFE4EA', '#B83A55'], hat: null },
  { id: 'chef', name: 'Head Chef', need: 9000, bandana: ['#FFFFFF', '#E3E3E3', '#BDBDBD'], hat: 'chef' },
  { id: 'party', name: 'Party Unit', need: 12000, bandana: ['#6FA8E8', '#FFF3D6', '#3E70B0'], hat: 'party' },
  { id: 'gold', name: 'Good Boy Gold', need: 15000, bandana: ['#F2C230', '#FFF8D0', '#B88A10'], hat: 'crown' },
];

export function unlocked(best) {
  return SKINS.filter(s => best >= s.need).map(s => s.id);
}

// Skins that a new best score unlocks (were locked at oldBest, open at newBest).
export function newlyUnlocked(oldBest, newBest) {
  return SKINS.filter(s => s.need > oldBest && s.need <= newBest);
}

export function skinAt(index) {
  return SKINS[index] || SKINS[0];
}
