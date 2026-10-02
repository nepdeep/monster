# Fuzzy Friends: Monster Makeover

A playful 3D dress-up game for young children (about age 5), built with
**Three.js**, plain **JavaScript** and **Vite**.

A round, fuzzy monster with big eyes, a happy smile and little feet waits in a
bright dressing room with a star-shaped mirror, chunky accessory shelves and a
tiny celebration stage. Children tap big picture buttons to change its body
colour, hat, wings, shoes and hair, then send it to the stage for a short, silly
fashion show that ends with a sticker of the outfit.

There's nothing to read, no score and no way to fail.

## Run it

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually <http://localhost:5173>). To play
on a tablet on the same Wi-Fi, open the "Network" address Vite prints.

To build a static copy that works from any folder or web host:

```bash
npm run build      # writes dist/
npm run preview    # serves dist/ at http://localhost:4173
```

## How to play (for grown-ups)

| Picture | What it does |
| --- | --- |
| Left column: palette, hat, wings, shoe, hair | Picks which kind of thing to change |
| Big buttons along the bottom | Puts that item on the monster straight away. The circle with a line removes it. |
| Curved arrow (top left) | Undo the last change. It fades out when there's nothing left to undo. |
| Dice (top left) | Shuffle: a surprise outfit |
| Speaker (top right) | Sound on/off |
| Wavy lines (top right) | Calm motion on/off (straight lines mean calm motion is on) |
| Gold star stage button (bottom right) | Starts the fashion show |

- **Tap the monster's tummy** to make it giggle. **Tap its feet** to make it dance.
  Tapping anywhere else on it gives a little wiggle.
- **Items on the shelves can be tapped too.** The crown, star hat, shoes and the
  fuzzy paint pots put that item or colour on the monster.
- **Wishes (optional):** sometimes a thought bubble shows a picture of something
  the monster would like, such as a star hat. Wearing that item makes hearts
  float up. Tapping the bubble opens the matching buttons and gives the right one
  a gentle nudge. A wish can be ignored: after a while it drifts away and
  nothing bad happens.
- **Fashion show:** the monster hops onto the stage, the spotlights come on, and
  it twirls, struts, dances and strikes a pose. Then a "photo" flash makes a
  die-cut **sticker** of the outfit, rendered in the game (no device camera is
  used). After that you can pick:
  - **Hanger:** keep decorating. The monster hops back with its outfit unchanged.
  - **Egg:** make a new friend. You get a new colour, a new number of eyes (one,
    two or three) and a fresh start.

Every combination works: there are 5 × 5 × 5 × 5 × 5 = 3,125 outfits. Hair styles
tuck under any hat and still peek out, and shoes lift the monster to the right
height (roller skates included).

## Accessibility and comfort

- **Fixed camera**, gentle animations and large touch targets: picture buttons
  are about 76–116 px, and the stage button is larger.
- **No required reading.** Every button is a picture. Buttons have `aria-label`s
  for screen readers, and keyboard focus is clearly shown.
- **Mute** and **calm motion** are always available, even during the show.
  Calm motion follows the device's *reduce motion* setting by default. It removes
  the hopping, spinning and flash, and makes particles fewer and slower. Both
  settings are remembered on the device.
- No scoring, timers or failure. Wishes are optional and never pile up.

## Everything is procedural

There are no image, model or sound files. The monster's fur is shell-rendered
from a generated noise texture. The accessories and room are built from Three.js
geometry, and the wallpaper, floor, rug and patterns are drawn on canvases. The
picture buttons are rendered at start-up from the same 3D accessories, so a
button always matches what appears on the monster. All sounds and music are
synthesised with the Web Audio API. The game makes no network requests once it
has loaded.

## Project layout

```
index.html          page shell + HUD markup
src/main.js         renderer, camera framing, input, wishes, fashion show, game loop
src/state.js        outfit, undo history, shuffle, wishes, new friend (pure logic)
src/catalog.js      categories and the choices in each
src/monster.js      the monster: fur, face, anchors, pose/animation system
src/accessories.js  procedural hats, wings, shoes and hair
src/room.js         dressing room, star mirror, shelves, stage, lights
src/pictures.js     renders picture buttons and the final sticker
src/effects.js      sparkles, hearts, confetti, music notes
src/audio.js        Web Audio sound effects and music
src/ui.js, icons.js picture-only interface
src/style.css       layout for landscape and portrait, calm-motion styles
tests/              unit tests for the game rules
scripts/verify.mjs  end-to-end browser check
```

## Checks

```bash
npm test         # unit tests: choices, undo, shuffle, wishes, new friend, all 3,125 combinations
npm run verify   # plays the real game in headless Chromium
```

`npm run verify` starts the game and drives it like a child would, by clicking
the picture buttons and tapping the 3D monster. It checks that:

- every category shows 3–5 rendered picture buttons and the interface has no visible text
- choosing a hat, wings, shoes, hair and colour fits each item to the right
  anchor at once (two shoes, lift for skates, hair tucked under the hat)
- **undo** steps back through every change, greys out when empty, and also
  reverses a shuffle
- **shuffle** always changes at least three things, and every item fits
- tapping the tummy giggles and tapping the feet dances
- the wish bubble can be ignored, tapping it opens the right buttons, and
  granting it plays the heart animation
- the stage button runs the show and ends with a sticker
- **returning from the stage** with "keep decorating" brings back the same
  outfit and the monster's spot on the rug, and decorating carries on afterwards.
  "New friend" starts fresh.
- mute and calm motion toggle, and there are no console errors

Screenshots from each step are saved in `verify-output/`.

The verify script needs Playwright's Chromium. If it isn't installed, run
`npx playwright install chromium` once, or point `CHROMIUM_PATH` at an existing
Chrome or Chromium.
