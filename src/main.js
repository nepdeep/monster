import * as THREE from 'three';
import { GameStore } from './state.js';
import { Monster } from './monster.js';
import { Room, HOME, STAGE_CENTER, STAGE_HEIGHT } from './room.js';
import { Effects } from './effects.js';
import { Sound } from './audio.js';
import { PictureMaker } from './pictures.js';
import { UI } from './ui.js';
import { settings, tweens, easeInOut, easeOutBack } from './util.js';

// ------------------------------------------------------------------ settings

const prefs = {
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('fuzzy-friends-prefs') || '{}');
      settings.muted = !!saved.muted;
      settings.reducedMotion = saved.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    } catch {
      settings.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    }
  },
  save() {
    try {
      localStorage.setItem('fuzzy-friends-prefs', JSON.stringify({ muted: settings.muted, reducedMotion: settings.reducedMotion }));
    } catch {
      /* storage unavailable: settings last for this visit only */
    }
  },
};
prefs.load();

// ------------------------------------------------------------------ three.js

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffe6f2);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
const LOOK_AT = new THREE.Vector3(0, 1.75, 0);

const hemi = new THREE.HemisphereLight(0xffffff, 0xffd9ec, 1.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e6, 2.3);
sun.position.set(3.5, 9, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -3;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 25;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xd6ecff, 0.8);
fill.position.set(-6, 4, 5);
scene.add(fill);

const room = new Room();
scene.add(room.group);

const store = new GameStore();
const monster = new Monster({ outfit: store.outfit, friend: store.friend });
monster.root.position.copy(HOME);
scene.add(monster.root);

const effects = new Effects(scene);
const sound = new Sound();

let ui = null;
let mode = 'loading';
const BASE_HEMI = hemi.intensity;
const BASE_SUN = sun.intensity;

// ------------------------------------------------------------------ layout

function layout() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  const free = ui ? ui.freeArea() : { left: 0, right: 0, top: 0, bottom: 0, portrait: W < H };
  const freeW = Math.max(100, W - free.left - free.right);
  const freeH = Math.max(100, H - free.top - free.bottom);
  // World-space box (at the monster's depth) that must stay visible:
  // landscape shows shelves, mirror and stage; portrait favours the monster.
  const content = free.portrait ? { w: 6.2, h: 4.6 } : { w: 11.3, h: 4.5 };
  LOOK_AT.x = free.portrait ? 0 : 0.45;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max((content.h * H) / (2 * tanHalf * freeH), (content.w * H) / (2 * tanHalf * freeW));
  const dir = new THREE.Vector3(0, 0.2, 1).normalize();
  camera.position.copy(LOOK_AT).addScaledVector(dir, Math.min(dist, 14.5));
  camera.lookAt(LOOK_AT);
  const cx = free.left + freeW / 2;
  const cy = free.top + freeH / 2;
  camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));

function toScreen(v) {
  const p = v.clone().project(camera);
  return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
}

// ------------------------------------------------------------------ reactions

const busy = new Set();
function once(tag, fn) {
  if (busy.has(tag)) return Promise.resolve();
  busy.add(tag);
  return fn().finally(() => busy.delete(tag));
}

function sparkleAt(category) {
  effects.sparkles(monster.anchorWorldPosition(category));
}

store.subscribe((event) => {
  switch (event.type) {
    case 'outfit': {
      monster.setOutfit(event.outfit, { changed: event.changed });
      for (const cat of event.changed) sparkleAt(cat);
      if (event.reason === 'undo') {
        sound.unpop();
        monster.wiggle();
      } else if (event.reason === 'shuffle') {
        sound.whoosh();
        once('spin', () => monster.spin(0.9));
      } else {
        sound.pop();
        once('hop', () => monster.happyHop());
      }
      ui?.setOutfit(event.outfit, store.canUndo);
      break;
    }
    case 'same':
      sound.tap();
      once('wiggle', () => monster.wiggle());
      break;
    case 'wish':
      wish.age = 0;
      ui?.setWish(event.wish);
      if (event.wish) sound.hmm();
      break;
    case 'wishGranted':
      grantWish();
      break;
    case 'friend':
      monster.setFriend(event.friend);
      monster.setOutfit(event.outfit, { animate: true });
      ui?.setOutfit(event.outfit, store.canUndo);
      ui?.setWish(null);
      break;
  }
});

// The monster's optional wish. It is never required: if ignored it simply
// drifts away and a different wish may come along later.
const wish = { timer: 7, age: 0 };

function updateWish(dt) {
  if (mode !== 'dress') return;
  if (store.wish) {
    wish.age += dt;
    if (wish.age > 40) {
      store.dropWish();
      wish.timer = 18;
    }
  } else {
    wish.timer -= dt;
    if (wish.timer <= 0) {
      store.makeWish();
      wish.timer = 14;
    }
  }
  if (store.wish && ui) {
    const head = monster.body.localToWorld(new THREE.Vector3(0.75, 1.15, 0.2));
    const p = toScreen(head);
    const size = ui.wishBtn.offsetWidth;
    ui.placeWish(Math.min(window.innerWidth - size - 8, p.x), Math.max(70, p.y - size));
  }
}

function grantWish() {
  ui?.setWish(null);
  const above = monster.body.localToWorld(new THREE.Vector3(0, 1.0, 0.6));
  setTimeout(() => {
    effects.hearts(above);
    sound.hearts();
    const p = toScreen(above);
    ui?.heartBurst(p.x, p.y - 40);
    once('hop', () => monster.happyHop().then(() => monster.happyHop()));
  }, 250);
  wish.timer = 12;
}

// ------------------------------------------------------------------ input

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pick(clientX, clientY) {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([monster.root, room.group], true);
  for (const hit of hits) {
    let o = hit.object;
    while (o) {
      if (o.userData.equipRoot) return { kind: 'equip', target: o.userData.equipRoot };
      if (o.userData.part) return { kind: 'part', part: o.userData.part, point: hit.point };
      if (o.userData.accessory) return { kind: 'part', part: o.userData.accessory.category === 'shoes' ? 'feet' : 'body', point: hit.point };
      o = o.parent;
    }
  }
  return null;
}

function tickle() {
  sound.giggle();
  effects.sparkles(monster.body.localToWorld(new THREE.Vector3(0, -0.3, 1.1)), 6);
  return once('giggle', () => monster.giggle());
}

function dance() {
  const stop = sound.music(12, 140);
  const notes = setInterval(() => effects.notes(monster.body.localToWorld(new THREE.Vector3(0, 1.2, 0.3)), 2), 600);
  return once('dance', () => monster.dance()).finally(() => {
    clearInterval(notes);
    stop();
  });
}

canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (mode !== 'dress') return;
  const hit = pick(e.clientX, e.clientY);
  if (!hit) return;
  if (hit.kind === 'equip') {
    const { category, id } = hit.target.userData.equip;
    hit.target.userData.bounce = 1;
    ui.openCategory(category);
    choose(category, id);
  } else if (hit.part === 'tummy') {
    if (!busy.has('dance')) tickle();
  } else if (hit.part === 'feet') {
    if (!busy.has('dance')) dance();
  } else if (hit.part === 'body') {
    sound.boing();
    once('wiggle', () => monster.wiggle());
  } else if (hit.part === 'stage') {
    startShow();
  }
});

canvas.addEventListener('pointermove', (e) => {
  const head = toScreen(monster.body.localToWorld(new THREE.Vector3(0, 0.3, 1)));
  const scale = Math.min(window.innerWidth, window.innerHeight) * 0.5;
  monster.setLookTarget((e.clientX - head.x) / scale, -(e.clientY - head.y) / scale);
});
canvas.addEventListener('pointerleave', () => monster.setLookTarget(0, 0));
window.addEventListener('pointerdown', () => sound.unlock(), { capture: true });

function choose(category, id) {
  if (mode !== 'dress') return;
  store.choose(category, id);
  const btn = document.querySelector(`.option[data-category="${category}"][data-id="${id}"]`);
  if (btn) ui.pulse(btn);
}

// ------------------------------------------------------------------ the show

function setShowLights(on, duration) {
  const from = room.showAmount;
  const to = on ? 1 : 0;
  return tweens.tween(duration, (t) => {
    const v = from + (to - from) * t;
    room.setShowAmount(v);
    hemi.intensity = BASE_HEMI * (1 - 0.45 * v);
    sun.intensity = BASE_SUN * (1 - 0.6 * v);
  });
}

const STAGE_SPOT = new THREE.Vector3(STAGE_CENTER.x, STAGE_HEIGHT, STAGE_CENTER.z + 0.3);

async function startShow() {
  if (mode !== 'dress') return;
  mode = 'show';
  ui.setMode('show');
  monster.setLookTarget(0, 0);
  sound.chime();
  const calm = settings.reducedMotion;

  const lights = setShowLights(true, 1.2);
  await monster.travelTo(STAGE_SPOT, { hops: calm ? 1 : 4, duration: calm ? 1.4 : 1.9, faceEnd: -0.35 });
  await lights;

  const stopMusic = sound.music(28, 150);
  const confettiFrom = new THREE.Vector3(STAGE_SPOT.x, 4.4, STAGE_SPOT.z);
  effects.confetti(confettiFrom, 40);
  await monster.spin(1.0);
  effects.sparkles(monster.anchorWorldPosition('hat'));
  await monster.strut(1.8);
  effects.notes(monster.body.localToWorld(new THREE.Vector3(0, 1.2, 0.3)), 3);
  await monster.dance();
  sound.applause(2);
  effects.confetti(confettiFrom, 90);
  await monster.tada(1.5);
  stopMusic();

  // Snap! The "photo" is rendered in-game — no camera needed.
  sound.shutter();
  ui.flash();
  await tweens.wait(0.12);
  const url = ui ? pictures.makeSticker(monster, store.outfit) : '';
  await tweens.wait(0.4);
  mode = 'sticker';
  ui.setMode('sticker');
  ui.showSticker(url);
  sound.chime();
  lastSticker = url;
}

async function backToDressingRoom({ fresh }) {
  if (mode !== 'sticker') return;
  mode = 'returning';
  ui.hideSticker();
  ui.setMode('show');
  const lights = setShowLights(false, 0.8);
  if (fresh) {
    // poof! a brand-new friend appears on the rug
    effects.sparkles(monster.body.getWorldPosition(new THREE.Vector3()), 24);
    sound.whoosh();
    await tweens.tween(0.35, (t) => monster.root.scale.setScalar(Math.max(0.001, 1 - easeInOut(t))));
    store.newFriend();
    monster.root.position.copy(HOME);
    monster.baseRotY = 0;
    effects.sparkles(new THREE.Vector3(HOME.x, 1.2, HOME.z), 24);
    sound.pop();
    await tweens.tween(settings.reducedMotion ? 0.3 : 0.6, (t) => monster.root.scale.setScalar(Math.max(0.001, settings.reducedMotion ? t : easeOutBack(t))));
    wish.timer = 8;
  } else {
    await monster.travelTo(HOME.clone(), { hops: settings.reducedMotion ? 1 : 4, duration: settings.reducedMotion ? 1.3 : 1.8, faceEnd: 0 });
  }
  await lights;
  monster.root.scale.setScalar(1);
  mode = 'dress';
  ui.setMode('dress');
}

// ------------------------------------------------------------------ boot

let pictures = null;
let lastSticker = '';

const handlers = {
  tap: () => sound.tap(),
  choose,
  undo: () => {
    if (mode !== 'dress') return;
    if (!store.undo().length) sound.tap();
  },
  shuffle: () => {
    if (mode !== 'dress') return;
    store.shuffle();
  },
  stage: () => startShow(),
  wishTapped: () => {
    if (!store.wish) return;
    sound.hmm();
    ui.openCategory(store.wish.category);
    const btn = document.querySelector(`.option[data-category="${store.wish.category}"][data-id="${store.wish.id}"]`);
    if (btn) ui.pulse(btn);
  },
  toggleMute: () => {
    sound.unlock();
    sound.setMuted(!settings.muted);
    prefs.save();
    ui.refreshToggles();
    if (!settings.muted) sound.tap();
  },
  toggleMotion: () => {
    settings.reducedMotion = !settings.reducedMotion;
    prefs.save();
    ui.refreshToggles();
    sound.tap();
  },
  keepDecorating: () => backToDressingRoom({ fresh: false }),
  newFriend: () => backToDressingRoom({ fresh: true }),
};

const timer = new THREE.Timer();
function frame(now) {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const time = timer.getElapsed();
  tweens.update(dt);
  monster.update(dt);
  room.update(dt, time);
  effects.update(dt);
  updateWish(dt);
  renderer.render(scene, camera);
}

async function boot() {
  layout();
  renderer.setAnimationLoop(frame);
  pictures = new PictureMaker();
  const pics = await pictures.makeAll();
  ui = new UI(pics, handlers);
  ui.setOutfit(store.outfit, store.canUndo);
  layout();
  mode = 'dress';
  ui.setMode('dress');
}

boot();

// Small inspection hook used by the automated checks in scripts/verify.mjs.
window.__fuzzy = {
  store,
  monster,
  room,
  get mode() {
    return mode;
  },
  get lastSticker() {
    return lastSticker;
  },
  screenPointOf(part) {
    const local = { tummy: new THREE.Vector3(0, -0.4, 1.0), head: new THREE.Vector3(0, 0.75, 0.6) }[part];
    if (local) return toScreen(monster.body.localToWorld(local));
    if (part === 'foot') return toScreen(monster.feet[1].foot.localToWorld(new THREE.Vector3(0, 0.12, 0.3)));
    return null;
  },
  mounted() {
    const out = {};
    for (const [cat, items] of Object.entries(monster.accessories)) {
      out[cat] = (items ?? []).filter((i) => i.parent).map((i) => i.userData.accessory.id);
    }
    out.color = monster.outfit.color;
    return out;
  },
  busy: () => [...busy],
};
