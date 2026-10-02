// Everything the child can choose from. Pure data: no Three.js here so the
// game rules (state.js) can be unit-tested in Node.

export const CATEGORIES = [
  { id: 'color', label: 'Body color' },
  { id: 'hat', label: 'Hats' },
  { id: 'wings', label: 'Wings' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'hair', label: 'Hair' },
];

export const NONE = 'none';

export const OPTIONS = {
  color: [
    { id: 'sky', label: 'Sky blue', fur: 0x5fbfff, tip: 0x9fdcff, belly: 0xd4f0ff },
    { id: 'bubblegum', label: 'Bubblegum pink', fur: 0xff7fbf, tip: 0xffb3dc, belly: 0xffe0f0 },
    { id: 'mint', label: 'Mint green', fur: 0x4fd69a, tip: 0x92edc2, belly: 0xd6f9e8 },
    { id: 'sunny', label: 'Sunny yellow', fur: 0xffc93c, tip: 0xffe38a, belly: 0xfff5cc },
    { id: 'grape', label: 'Grape purple', fur: 0xa77bff, tip: 0xcbb0ff, belly: 0xece2ff },
  ],
  hat: [
    { id: NONE, label: 'No hat' },
    { id: 'star', label: 'Star hat' },
    { id: 'party', label: 'Party hat' },
    { id: 'crown', label: 'Crown' },
    { id: 'tophat', label: 'Top hat' },
  ],
  wings: [
    { id: NONE, label: 'No wings' },
    { id: 'butterfly', label: 'Butterfly wings' },
    { id: 'fairy', label: 'Fairy wings' },
    { id: 'dragon', label: 'Dragon wings' },
    { id: 'feather', label: 'Feather wings' },
  ],
  shoes: [
    { id: NONE, label: 'Bare feet' },
    { id: 'sneakers', label: 'Sneakers' },
    { id: 'boots', label: 'Rain boots' },
    { id: 'clown', label: 'Clown shoes' },
    { id: 'skates', label: 'Roller skates' },
  ],
  hair: [
    { id: NONE, label: 'No hair' },
    { id: 'puff', label: 'Curly puff' },
    { id: 'spikes', label: 'Spiky hair' },
    { id: 'pigtails', label: 'Pigtails' },
    { id: 'rainbow', label: 'Rainbow mop' },
  ],
};

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const DEFAULT_OUTFIT = Object.freeze({
  color: 'sky',
  hat: NONE,
  wings: NONE,
  shoes: NONE,
  hair: NONE,
});

// Different little "species" so a new friend looks new, not just recoloured.
export const EYE_COUNTS = [1, 2, 3];

export function getOption(category, id) {
  return OPTIONS[category]?.find((o) => o.id === id) ?? null;
}

export function isValidOutfit(outfit) {
  return CATEGORY_IDS.every((cat) => getOption(cat, outfit[cat]) !== null);
}
