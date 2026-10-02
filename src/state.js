// Game state: the current outfit, undo history, the monster's optional wish
// and the "friend" (eye count). Pure logic so it is testable without a browser.

import {
  CATEGORY_IDS,
  DEFAULT_OUTFIT,
  EYE_COUNTS,
  NONE,
  OPTIONS,
  isValidOutfit,
} from './catalog.js';

const MAX_HISTORY = 60;

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function diffOutfits(a, b) {
  return CATEGORY_IDS.filter((cat) => a[cat] !== b[cat]);
}

export class GameStore {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.outfit = { ...DEFAULT_OUTFIT };
    this.friend = { eyes: 2 };
    this.history = [];
    this.wish = null; // { category, id } or null
    this.lastWish = null;
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event) {
    for (const fn of this.listeners) fn(event, this);
  }

  get canUndo() {
    return this.history.length > 0;
  }

  /** Put on one item. Returns the list of changed categories (empty if nothing changed). */
  choose(category, id) {
    if (!OPTIONS[category]?.some((o) => o.id === id)) return [];
    if (this.outfit[category] === id) {
      this.emit({ type: 'same', category, id });
      return [];
    }
    return this.applyOutfit({ ...this.outfit, [category]: id }, 'choose');
  }

  applyOutfit(next, reason) {
    if (!isValidOutfit(next)) throw new Error('Invalid outfit');
    const changed = diffOutfits(this.outfit, next);
    if (changed.length === 0) return [];
    this.history.push({ ...this.outfit });
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.outfit = { ...next };
    this.emit({ type: 'outfit', reason, changed, outfit: this.outfit });
    this.checkWish();
    return changed;
  }

  undo() {
    if (!this.canUndo) return [];
    const prev = this.history.pop();
    const changed = diffOutfits(this.outfit, prev);
    this.outfit = prev;
    this.emit({ type: 'outfit', reason: 'undo', changed, outfit: this.outfit });
    this.checkWish();
    return changed;
  }

  /** A surprising, always-valid outfit that differs from the current one in at least 3 places. */
  makeShuffledOutfit() {
    for (let attempt = 0; attempt < 50; attempt++) {
      const next = {};
      for (const cat of CATEGORY_IDS) {
        // Bias accessories towards being "on" so shuffles feel exciting.
        const opts = OPTIONS[cat].filter((o) => cat === 'color' || o.id !== NONE || this.rng() < 0.15);
        next[cat] = pick(opts, this.rng).id;
      }
      if (diffOutfits(this.outfit, next).length >= 3) return next;
    }
    // Deterministic fallback: rotate every category to its next option.
    const next = {};
    for (const cat of CATEGORY_IDS) {
      const opts = OPTIONS[cat];
      const i = opts.findIndex((o) => o.id === this.outfit[cat]);
      next[cat] = opts[(i + 1) % opts.length].id;
    }
    return next;
  }

  shuffle() {
    return this.applyOutfit(this.makeShuffledOutfit(), 'shuffle');
  }

  /** Brand new friend: fresh colour, new eye count, no accessories, empty history. */
  newFriend() {
    const colors = OPTIONS.color.filter((o) => o.id !== this.outfit.color);
    const eyes = EYE_COUNTS.filter((n) => n !== this.friend.eyes);
    this.outfit = { ...DEFAULT_OUTFIT, color: pick(colors, this.rng).id };
    this.friend = { eyes: pick(eyes, this.rng) };
    this.history = [];
    this.wish = null;
    this.emit({ type: 'friend', outfit: this.outfit, friend: this.friend });
    return this.outfit;
  }

  /** The monster's optional picture request. Never something already worn, never "none". */
  makeWish() {
    const candidates = [];
    for (const cat of CATEGORY_IDS) {
      for (const o of OPTIONS[cat]) {
        if (o.id === NONE || this.outfit[cat] === o.id) continue;
        if (this.lastWish && this.lastWish.category === cat && this.lastWish.id === o.id) continue;
        candidates.push({ category: cat, id: o.id });
      }
    }
    this.wish = pick(candidates, this.rng);
    this.lastWish = this.wish;
    this.emit({ type: 'wish', wish: this.wish });
    return this.wish;
  }

  dropWish() {
    if (!this.wish) return;
    this.wish = null;
    this.emit({ type: 'wish', wish: null });
  }

  checkWish() {
    if (this.wish && this.outfit[this.wish.category] === this.wish.id) {
      const granted = this.wish;
      this.wish = null;
      this.emit({ type: 'wishGranted', wish: granted });
      return granted;
    }
    return null;
  }
}
