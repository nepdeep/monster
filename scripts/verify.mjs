// End-to-end check of the real game in a headless browser.
// Verifies: picture buttons fit accessories, undo, shuffle, tummy/feet taps,
// the optional wish, the stage show + sticker, and returning from the stage
// (both "keep decorating" and "new friend"), plus mute and calm motion.
//
//   npm run verify            (uses Playwright's Chromium)
//   CHROMIUM_PATH=/path/to/chrome npm run verify
//
// Screenshots are written to ./verify-output/.

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'verify-output');
mkdirSync(outDir, { recursive: true });

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${label}`);
  if (!cond) failures++;
};

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false, hmr: false, watch: null } });
await server.listen();
const url = server.resolvedUrls.local[0];

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({
  executablePath,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const game = (fn, arg) => page.evaluate(fn, arg);
const state = () => game(() => ({ outfit: { ...window.__fuzzy.store.outfit }, mounted: window.__fuzzy.mounted(), canUndo: window.__fuzzy.store.canUndo, mode: window.__fuzzy.mode }));
const idle = () => page.waitForFunction(() => window.__fuzzy.busy().length === 0, null, { timeout: 60000 });
const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

function mountedMatches(s) {
  const expect = (cat) => (s.outfit[cat] === 'none' ? [] : cat === 'shoes' ? [s.outfit[cat], s.outfit[cat]] : [s.outfit[cat]]);
  return ['hat', 'wings', 'shoes', 'hair'].every((cat) => JSON.stringify(s.mounted[cat]) === JSON.stringify(expect(cat))) && s.mounted.color === s.outfit.color;
}

try {
  console.log(`Fuzzy Friends verify → ${url}`);
  await page.goto(url);
  await page.waitForFunction(() => window.__fuzzy?.mode === 'dress', null, { timeout: 90000 });
  await shot('01-dressing-room');

  console.log('Picture buttons');
  const tabCount = await page.locator('.tab').count();
  ok(tabCount === 5, `five category tabs (found ${tabCount})`);
  for (const cat of ['color', 'hat', 'wings', 'shoes', 'hair']) {
    await page.click(`.tab[data-category="${cat}"]`);
    const n = await page.locator('.option').count();
    const imgs = await page.locator('.option img').evaluateAll((els) => els.every((e) => e.src.startsWith('data:image/png') && e.naturalWidth > 0));
    ok(n >= 3 && n <= 5 && imgs, `${cat}: ${n} picture choices, all rendered`);
  }
  const visibleText = await page.evaluate(() => document.getElementById('hud').innerText.trim());
  ok(visibleText === '', 'no reading needed: interface has no visible text');

  console.log('Accessory changes fit instantly');
  const picks = [
    ['hat', 'crown'],
    ['wings', 'dragon'],
    ['shoes', 'skates'],
    ['hair', 'rainbow'],
    ['color', 'mint'],
  ];
  for (const [cat, id] of picks) {
    await page.click(`.tab[data-category="${cat}"]`);
    await page.click(`.option[data-id="${id}"]`);
    const s = await state();
    const selected = await page.locator(`.option[data-id="${id}"]`).evaluate((e) => e.classList.contains('selected'));
    ok(s.outfit[cat] === id && mountedMatches(s) && selected, `${cat} → ${id} is worn and highlighted`);
  }
  const lift = await game(() => window.__fuzzy.monster.lift);
  await idle();
  ok(lift > 0.2, `roller skates lift the monster onto its wheels (lift ${lift.toFixed(2)})`);
  const hairTopHidden = await game(() => {
    let hidden = 0;
    window.__fuzzy.monster.accessories.hair[0].traverse((o) => o.userData.top && !o.visible && hidden++);
    return hidden;
  });
  ok(hairTopHidden > 0, 'hair tucks neatly under the hat');
  await shot('02-dressed-up');

  console.log('Undo');
  const undoSteps = [...picks].reverse();
  for (const [cat] of undoSteps) {
    const before = await state();
    await page.click('#undo');
    const after = await state();
    ok(after.outfit[cat] !== before.outfit[cat] && mountedMatches(after), `undo reverts ${cat} (${before.outfit[cat]} → ${after.outfit[cat]})`);
  }
  const cleared = await state();
  ok(!cleared.canUndo && (await page.locator('#undo').isDisabled()), 'undo button greys out when there is nothing left to undo');
  await page.click('#undo', { force: true });
  ok(JSON.stringify((await state()).outfit) === JSON.stringify(cleared.outfit), 'extra undo taps are harmless');

  console.log('Shuffle');
  for (let i = 0; i < 4; i++) {
    const before = await state();
    await page.click('#shuffle');
    const after = await state();
    const changed = Object.keys(after.outfit).filter((k) => after.outfit[k] !== before.outfit[k]);
    ok(changed.length >= 3 && mountedMatches(after), `shuffle ${i + 1} changed ${changed.length} things and every item is fitted`);
    await idle();
  }
  const preUndo = await state();
  await page.click('#undo');
  const postUndo = await state();
  ok(JSON.stringify(postUndo.outfit) !== JSON.stringify(preUndo.outfit) && mountedMatches(postUndo), 'undo reverses a shuffle');
  await shot('03-shuffled');

  console.log('Tummy and feet');
  await idle();
  let p = await game(() => window.__fuzzy.screenPointOf('tummy'));
  await page.mouse.click(p.x, p.y);
  ok((await game(() => window.__fuzzy.busy())).includes('giggle'), 'tapping the tummy makes it giggle');
  await idle();
  p = await game(() => window.__fuzzy.screenPointOf('foot'));
  await page.mouse.click(p.x, p.y);
  ok((await game(() => window.__fuzzy.busy())).includes('dance'), 'tapping the feet makes it dance');
  await page.waitForTimeout(800);
  await shot('04-dancing');
  await idle();

  console.log('Optional wish');
  const wish = await game(() => window.__fuzzy.store.makeWish());
  await page.waitForTimeout(400);
  ok(await page.locator('#wish.show').isVisible(), `wish bubble shows a picture (${wish.category}: ${wish.id})`);
  await shot('05-wish');
  // ignoring it is fine: other changes keep working
  const other = wish.category === 'hat' ? 'wings' : 'hat';
  await page.click(`.tab[data-category="${other}"]`);
  await page.locator('.option:not(.selected)').first().click();
  ok((await game(() => window.__fuzzy.store.wish)) !== null, 'ignoring the wish is allowed (nothing breaks, no penalty)');
  await page.click('#wish');
  ok((await page.locator('#tray').getAttribute('data-category')) === wish.category, 'tapping the bubble opens the matching picture choices');
  await page.click(`.option[data-id="${wish.id}"]`);
  ok((await game(() => window.__fuzzy.store.wish)) === null, 'wearing the wished item grants it');
  await page.waitForTimeout(500);
  ok(await page.locator('#heart-burst.go').count(), 'happy heart animation plays');
  await shot('06-hearts');
  await idle();

  console.log('Fashion show');
  const outfitBeforeShow = (await state()).outfit;
  await page.click('#stage-btn');
  ok((await state()).mode === 'show', 'stage button starts the show');
  await page.waitForTimeout(2500);
  await shot('07-show');
  await page.waitForFunction(() => window.__fuzzy.mode === 'sticker', null, { timeout: 240000 });
  await page.waitForTimeout(1200);
  const stickerSrc = await page.locator('#sticker-img').getAttribute('src');
  ok(stickerSrc?.startsWith('data:image/png') && (await page.locator('#sticker-screen').isVisible()), 'show ends with an in-game sticker picture');
  await shot('08-sticker');

  console.log('Return from the stage');
  await page.click('#again');
  await page.waitForFunction(() => window.__fuzzy.mode === 'dress', null, { timeout: 120000 });
  const back = await state();
  const home = await game(() => window.__fuzzy.monster.root.position.toArray());
  ok(JSON.stringify(back.outfit) === JSON.stringify(outfitBeforeShow) && mountedMatches(back), 'keep decorating returns with the outfit intact');
  ok(Math.abs(home[0]) < 0.01 && Math.abs(home[1]) < 0.01, 'monster is back on the rug');
  ok(await page.locator('#tray').isVisible(), 'picture buttons are back');
  await page.click('.tab[data-category="hat"]');
  await page.click('.option[data-id="party"]');
  ok((await state()).outfit.hat === 'party', 'decorating continues after the show');
  await shot('09-back-in-dressing-room');

  await page.click('#stage-btn');
  await page.waitForFunction(() => window.__fuzzy.mode === 'sticker', null, { timeout: 240000 });
  const oldColor = (await state()).outfit.color;
  await page.click('#new-friend');
  await page.waitForFunction(() => window.__fuzzy.mode === 'dress', null, { timeout: 120000 });
  const fresh = await state();
  ok(
    fresh.outfit.color !== oldColor && ['hat', 'wings', 'shoes', 'hair'].every((c) => fresh.outfit[c] === 'none') && mountedMatches(fresh) && !fresh.canUndo,
    'new friend starts fresh with a new colour',
  );
  await page.waitForTimeout(600);
  await shot('10-new-friend');

  console.log('Settings');
  await page.click('#mute');
  ok((await page.getAttribute('#mute', 'aria-pressed')) === 'true', 'mute toggles on');
  await page.click('#mute');
  ok((await page.getAttribute('#mute', 'aria-pressed')) === 'false', 'mute toggles off');
  const calmBefore = await page.evaluate(() => document.body.classList.contains('calm'));
  await page.click('#motion');
  ok((await page.evaluate(() => document.body.classList.contains('calm'))) !== calmBefore, 'calm (reduced) motion toggles');

  ok(errors.length === 0, `no errors in the console${errors.length ? `: ${errors.join(' | ')}` : ''}`);
} catch (err) {
  failures++;
  console.error('  ✘ verification crashed:', err.message);
  await shot('error').catch(() => {});
} finally {
  await browser.close();
  await server.close();
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
