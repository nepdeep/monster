import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameStore, diffOutfits } from '../src/state.js';
import { CATEGORY_IDS, DEFAULT_OUTFIT, NONE, OPTIONS, isValidOutfit } from '../src/catalog.js';

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('every category offers three to five choices', () => {
  for (const cat of CATEGORY_IDS) {
    assert.ok(OPTIONS[cat].length >= 3 && OPTIONS[cat].length <= 5, cat);
  }
});

test('choosing an accessory changes only that category and records history', () => {
  const store = new GameStore();
  const changed = store.choose('hat', 'crown');
  assert.deepEqual(changed, ['hat']);
  assert.equal(store.outfit.hat, 'crown');
  assert.equal(store.history.length, 1);
  assert.equal(store.choose('hat', 'crown').length, 0, 'same choice is a no-op');
  assert.equal(store.history.length, 1);
  assert.equal(store.choose('hat', 'not-a-hat').length, 0);
});

test('undo walks back through each change in order', () => {
  const store = new GameStore();
  store.choose('hat', 'star');
  store.choose('wings', 'dragon');
  store.choose('color', 'grape');
  assert.deepEqual(store.undo(), ['color']);
  assert.equal(store.outfit.color, DEFAULT_OUTFIT.color);
  assert.deepEqual(store.undo(), ['wings']);
  assert.equal(store.outfit.wings, NONE);
  assert.deepEqual(store.undo(), ['hat']);
  assert.deepEqual(store.outfit, { ...DEFAULT_OUTFIT });
  assert.equal(store.canUndo, false);
  assert.deepEqual(store.undo(), []);
});

test('shuffle always gives a valid, clearly different outfit and is undoable', () => {
  const store = new GameStore({ rng: seeded(7) });
  for (let i = 0; i < 200; i++) {
    const before = { ...store.outfit };
    const changed = store.shuffle();
    assert.ok(isValidOutfit(store.outfit));
    assert.ok(changed.length >= 3, `shuffle ${i} changed only ${changed.length}`);
    assert.deepEqual(changed, diffOutfits(before, store.outfit));
  }
  const afterShuffle = { ...store.outfit };
  store.shuffle();
  store.undo();
  assert.deepEqual(store.outfit, afterShuffle);
});

test('every combination of options is a valid outfit', () => {
  let count = 0;
  const walk = (i, outfit) => {
    if (i === CATEGORY_IDS.length) {
      assert.ok(isValidOutfit(outfit));
      count++;
      return;
    }
    for (const o of OPTIONS[CATEGORY_IDS[i]]) walk(i + 1, { ...outfit, [CATEGORY_IDS[i]]: o.id });
  };
  walk(0, {});
  assert.equal(count, 5 ** 5);
});

test('wishes are optional, never already worn, and are granted by wearing the item', () => {
  const store = new GameStore({ rng: seeded(3) });
  const events = [];
  store.subscribe((e) => events.push(e.type));
  for (let i = 0; i < 50; i++) {
    const wish = store.makeWish();
    assert.notEqual(wish.id, NONE);
    assert.notEqual(store.outfit[wish.category], wish.id);
    // Ignoring the wish is fine: other changes do not clear it.
    const other = CATEGORY_IDS.find((c) => c !== wish.category);
    const alt = OPTIONS[other].find((o) => o.id !== store.outfit[other]);
    store.choose(other, alt.id);
    assert.deepEqual(store.wish, wish);
    store.choose(wish.category, wish.id);
    assert.equal(store.wish, null);
  }
  assert.ok(events.includes('wishGranted'));
});

test('new friend resets accessories and history but keeps things valid', () => {
  const store = new GameStore({ rng: seeded(11) });
  store.shuffle();
  store.choose('hat', 'party');
  const oldColor = store.outfit.color;
  const oldEyes = store.friend.eyes;
  store.newFriend();
  assert.notEqual(store.outfit.color, oldColor);
  assert.notEqual(store.friend.eyes, oldEyes);
  for (const cat of ['hat', 'wings', 'shoes', 'hair']) assert.equal(store.outfit[cat], NONE);
  assert.equal(store.canUndo, false);
});
