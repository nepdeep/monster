// The monster: a soft round body with shell-rendered fur, a big friendly
// face, stubby arms and little feet. It owns attachment anchors for every
// accessory category and a small layered pose system for its animations.

import * as THREE from 'three';
import { buildAccessory, shoeLift } from './accessories.js';
import { NONE, getOption } from './catalog.js';
import { mat, mesh, settings, tweens, easeOutBack, easeInOut, easeOut, disposeTree } from './util.js';

const FUR_LAYERS = 12;
const FUR_DEPTH = 0.085;

let furTexture = null;
function getFurTexture() {
  if (furTexture) return furTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  let seed = 12345;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(Math.pow(rand(), 0.7) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  furTexture = new THREE.CanvasTexture(canvas);
  furTexture.wrapS = furTexture.wrapT = THREE.RepeatWrapping;
  furTexture.generateMipmaps = false;
  furTexture.minFilter = THREE.LinearFilter;
  furTexture.repeat.set(5, 3);
  return furTexture;
}

function shellGeometry(geo, offset, droop) {
  const g = geo.clone();
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + nrm.getX(i) * offset,
      pos.getY(i) + nrm.getY(i) * offset - droop,
      pos.getZ(i) + nrm.getZ(i) * offset,
    );
  }
  return g;
}

/** Shared fur materials so one colour change recolours every furry part. */
class FurPalette {
  constructor() {
    this.base = mat(0x5fbfff, { roughness: 0.9 });
    this.shells = [];
    for (let i = 1; i <= FUR_LAYERS; i++) {
      const t = i / FUR_LAYERS;
      this.shells.push(
        new THREE.MeshStandardMaterial({
          color: 0x5fbfff,
          roughness: 0.95,
          alphaMap: getFurTexture(),
          alphaTest: 0.12 + 0.8 * t,
        }),
      );
    }
    this.belly = mat(0xd4f0ff, { roughness: 0.85 });
    this.current = { fur: new THREE.Color(0x5fbfff), tip: new THREE.Color(0x9fdcff), belly: new THREE.Color(0xd4f0ff) };
  }

  set(fur, tip, belly) {
    this.current.fur.copy(fur);
    this.current.tip.copy(tip);
    this.current.belly.copy(belly);
    this.base.color.copy(fur).multiplyScalar(0.8);
    this.shells.forEach((m, i) => m.color.copy(fur).lerp(tip, (i + 1) / FUR_LAYERS));
    this.belly.color.copy(belly);
  }

  /** Furry mesh = opaque base + alpha-tested shells pushed out along normals. */
  build(geometry, layers = FUR_LAYERS, depth = FUR_DEPTH) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(geometry, this.base);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const step = Math.max(1, Math.round(FUR_LAYERS / layers));
    for (let i = step - 1, k = 1; i < FUR_LAYERS; i += step, k++) {
      const t = (i + 1) / FUR_LAYERS;
      const shell = new THREE.Mesh(shellGeometry(geometry, depth * t, depth * t * t * 0.25), this.shells[i]);
      shell.receiveShadow = true;
      shell.raycast = () => {};
      group.add(shell);
    }
    group.userData.base = base;
    return group;
  }
}

const EYE_LAYOUTS = {
  1: [{ dir: [0, 0.34, 0.94], r: 0.37 }],
  2: [
    { dir: [-0.34, 0.3, 0.89], r: 0.26 },
    { dir: [0.34, 0.3, 0.89], r: 0.26 },
  ],
  3: [
    { dir: [-0.42, 0.22, 0.88], r: 0.2 },
    { dir: [0, 0.5, 0.87], r: 0.22 },
    { dir: [0.42, 0.22, 0.88], r: 0.2 },
  ],
};

const BODY_Y = 1.2;
const BODY_SQUASH = 0.95;

export class Monster {
  constructor({ outfit, friend }) {
    this.root = new THREE.Group();
    this.root.name = 'monster';
    this.rig = new THREE.Group();
    this.root.add(this.rig);
    this.bodyPivot = new THREE.Group();
    this.rig.add(this.bodyPivot);

    this.palette = new FurPalette();
    this.actions = new Set();
    this.time = 0;
    this.blinkTimer = 2;
    this.blink = 0;
    this.look = new THREE.Vector2();
    this.lookTarget = new THREE.Vector2();
    this.baseRotY = 0;
    this.lift = 0;
    this.accessories = { hat: null, wings: null, shoes: null, hair: null };
    this.outfit = { ...outfit };
    this.friend = { ...friend };

    this.buildBody();
    this.buildFace(friend.eyes);
    this.buildArms();
    this.buildFeet();
    this.setOutfit(outfit, { animate: false });
  }

  // ------------------------------------------------------------ construction

  buildBody() {
    this.body = new THREE.Group();
    this.body.position.y = BODY_Y;
    this.body.scale.y = BODY_SQUASH;
    this.bodyPivot.add(this.body);

    const fur = this.palette.build(new THREE.SphereGeometry(1, 56, 40));
    fur.userData.base.userData.part = 'body';
    this.body.add(fur);

    const belly = mesh(new THREE.SphereGeometry(1, 40, 24), this.palette.belly, { y: -0.3, z: 0.62, s: [0.6, 0.5, 0.42] });
    belly.userData.part = 'tummy';
    this.body.add(belly);

    // Generous invisible tap zone over the tummy.
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), hidden);
    tummy.position.set(0, -0.32, 0.72);
    tummy.userData.part = 'tummy';
    this.body.add(tummy);

    this.face = new THREE.Group();
    this.body.add(this.face);

    this.hairAnchor = new THREE.Group();
    this.body.add(this.hairAnchor);

    this.hatAnchor = new THREE.Group();
    this.hatAnchor.position.set(0, BODY_Y + BODY_SQUASH * 0.93, 0);
    this.bodyPivot.add(this.hatAnchor);

    this.wingAnchor = new THREE.Group();
    this.wingAnchor.position.set(0, BODY_Y + 0.25, -0.82);
    this.bodyPivot.add(this.wingAnchor);
  }

  buildFace(eyeCount) {
    for (const child of [...this.face.children]) {
      this.face.remove(child);
      disposeTree(child);
    }
    this.eyes = [];
    const white = mat(0xffffff, { roughness: 0.25 });
    const dark = mat(0x22163a, { roughness: 0.3 });
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (const { dir, r } of EYE_LAYOUTS[eyeCount]) {
      const n = new THREE.Vector3(...dir).normalize();
      const eye = new THREE.Group();
      eye.position.copy(n).multiplyScalar(0.98 - r * 0.25);
      // face mostly forward so the eyes look at the child, not off to the sides
      const facing = n.clone().lerp(new THREE.Vector3(0, 0.1, 1), 0.65).normalize();
      eye.lookAt(eye.position.clone().add(facing));
      const open = new THREE.Group();
      open.add(mesh(new THREE.SphereGeometry(r, 32, 24), white));
      const pupilPivot = new THREE.Group();
      const pupil = new THREE.Group();
      pupil.position.z = r * 0.7;
      pupil.add(mesh(new THREE.SphereGeometry(r * 0.55, 24, 16), dark, { s: [1, 1, 0.75] }));
      pupil.add(mesh(new THREE.SphereGeometry(r * 0.17, 12, 8), shine, { x: r * 0.18, y: r * 0.2, z: r * 0.38, shadow: false }));
      pupil.add(mesh(new THREE.SphereGeometry(r * 0.08, 8, 6), shine, { x: -r * 0.17, y: -r * 0.14, z: r * 0.4, shadow: false }));
      pupilPivot.add(pupil);
      open.add(pupilPivot);
      eye.add(open);
      const happy = mesh(new THREE.TorusGeometry(r * 0.55, r * 0.13, 8, 20, Math.PI), dark, { z: r * 0.9, y: -r * 0.2 });
      happy.visible = false;
      eye.add(happy);
      this.face.add(eye);
      this.eyes.push({ eye, open, happy, pupilPivot });
    }

    // Smiling mouth with a tongue and one goofy tooth.
    const mouthShape = new THREE.Shape();
    mouthShape.moveTo(-0.27, 0);
    mouthShape.quadraticCurveTo(0, -0.5, 0.27, 0);
    mouthShape.quadraticCurveTo(0, 0.07, -0.27, 0);
    const mouth = new THREE.Group();
    const mDir = new THREE.Vector3(0, -0.12, 1).normalize();
    mouth.position.copy(mDir).multiplyScalar(1.075);
    mouth.lookAt(mouth.position.clone().add(mDir));
    mouth.add(
      mesh(new THREE.ExtrudeGeometry(mouthShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), mat(0x5a1533, { roughness: 0.5 })),
    );
    mouth.add(mesh(new THREE.SphereGeometry(0.11, 16, 10), mat(0xff7a9c), { y: -0.14, z: 0.05, s: [1.1, 0.6, 0.35] }));
    mouth.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), mat(0xffffff, { roughness: 0.3 }), { x: 0.07, y: -0.025, z: 0.065 }));
    this.mouth = mouth;
    this.face.add(mouth);

    const blush = new THREE.MeshBasicMaterial({ color: 0xff7aa8, transparent: true, opacity: 0.55, depthWrite: false });
    for (const side of [-1, 1]) {
      const d = new THREE.Vector3(side * 0.6, -0.05, 0.8).normalize();
      const cheek = mesh(new THREE.CircleGeometry(0.12, 24), blush, { s: [1.3, 0.8, 1], shadow: false });
      cheek.position.copy(d).multiplyScalar(1.09);
      cheek.lookAt(cheek.position.clone().add(d));
      this.face.add(cheek);
    }
  }

  buildArms() {
    this.arms = [];
    const geo = new THREE.CapsuleGeometry(0.15, 0.32, 6, 16);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.86, BODY_Y - 0.1, 0.15);
      const arm = this.palette.build(geo, 4, 0.05);
      arm.position.y = -0.24;
      arm.userData.base.userData.part = 'body';
      pivot.add(arm);
      pivot.userData.side = side;
      this.bodyPivot.add(pivot);
      this.arms.push(pivot);
    }
  }

  buildFeet() {
    this.feet = [];
    const footGeo = new THREE.SphereGeometry(1, 32, 20);
    footGeo.scale(0.27, 0.16, 0.34);
    const toeMat = this.palette.belly;
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    for (const side of [-1, 1]) {
      const foot = new THREE.Group();
      foot.position.set(side * 0.42, 0, 0.2);
      const bare = new THREE.Group();
      const pad = this.palette.build(footGeo, 4, 0.04);
      pad.position.y = 0.15;
      pad.userData.base.userData.part = 'feet';
      bare.add(pad);
      for (let t = -1; t <= 1; t++) {
        const toe = mesh(new THREE.SphereGeometry(0.075, 12, 8), toeMat, { x: t * 0.12, y: 0.08, z: 0.3 - Math.abs(t) * 0.04 });
        toe.userData.part = 'feet';
        bare.add(toe);
      }
      foot.add(bare);
      const shoeSlot = new THREE.Group();
      foot.add(shoeSlot);
      const zone = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 1.0), hidden);
      zone.position.set(0, 0.15, 0.1);
      zone.userData.part = 'feet';
      foot.add(zone);
      this.rig.add(foot);
      this.feet.push({ foot, bare, shoeSlot, side });
    }
  }

  // ------------------------------------------------------------ outfit

  setColor(colorId, animate) {
    const opt = getOption('color', colorId);
    const target = { fur: new THREE.Color(opt.fur), tip: new THREE.Color(opt.tip), belly: new THREE.Color(opt.belly) };
    if (!animate) {
      this.palette.set(target.fur, target.tip, target.belly);
      return;
    }
    const from = {
      fur: this.palette.current.fur.clone(),
      tip: this.palette.current.tip.clone(),
      belly: this.palette.current.belly.clone(),
    };
    const fur = new THREE.Color();
    const tip = new THREE.Color();
    const belly = new THREE.Color();
    tweens.tween(settings.reducedMotion ? 0.25 : 0.45, (t) => {
      this.palette.set(fur.lerpColors(from.fur, target.fur, t), tip.lerpColors(from.tip, target.tip, t), belly.lerpColors(from.belly, target.belly, t));
    });
  }

  setFriend(friend) {
    this.friend = { ...friend };
    this.buildFace(friend.eyes);
  }

  setOutfit(outfit, { animate = true, changed = null } = {}) {
    const cats = changed ?? Object.keys(outfit);
    for (const cat of cats) {
      if (cat === 'color') this.setColor(outfit.color, animate);
      else this.swapAccessory(cat, outfit[cat], animate);
    }
    this.outfit = { ...outfit };
    this.updateHairUnderHat();
  }

  slotsFor(category) {
    if (category === 'hat') return [this.hatAnchor];
    if (category === 'wings') return [this.wingAnchor];
    if (category === 'hair') return [this.hairAnchor];
    if (category === 'shoes') return this.feet.map((f) => f.shoeSlot);
    return [];
  }

  swapAccessory(category, id, animate) {
    const slots = this.slotsFor(category);
    const old = this.accessories[category] ?? [];
    const fresh = [];
    slots.forEach((slot) => {
      const item = id === NONE ? null : buildAccessory(category, id);
      if (item) {
        item.userData.accessory = { category, id };
        slot.add(item);
        fresh.push(item);
      }
    });
    this.accessories[category] = fresh;

    const outDur = settings.reducedMotion ? 0.12 : 0.18;
    for (const item of old) {
      if (!animate) {
        item.parent?.remove(item);
        disposeTree(item);
        continue;
      }
      const s0 = item.scale.clone();
      tweens.tween(outDur, (t) => item.scale.copy(s0).multiplyScalar(Math.max(0.001, 1 - t))).then(() => {
        item.parent?.remove(item);
        disposeTree(item);
      });
    }
    if (animate) {
      for (const item of fresh) {
        const s1 = item.scale.clone();
        item.scale.setScalar(0.001);
        const ease = settings.reducedMotion ? easeOut : easeOutBack;
        tweens.tween(settings.reducedMotion ? 0.22 : 0.45, (t) => item.scale.copy(s1).multiplyScalar(Math.max(0.001, ease(t))));
      }
    }

    if (category === 'shoes') {
      for (const f of this.feet) f.bare.visible = id === NONE;
      const from = this.lift;
      const to = shoeLift(id);
      if (animate) tweens.tween(0.3, (t) => (this.lift = from + (to - from) * easeInOut(t)));
      else this.lift = to;
    }
  }

  updateHairUnderHat() {
    const hatOn = this.outfit.hat !== NONE;
    for (const hair of this.accessories.hair ?? []) {
      hair.traverse((o) => {
        if (o.userData.top) o.visible = !hatOn;
      });
    }
  }

  anchorWorldPosition(category, target = new THREE.Vector3()) {
    const offsets = { hat: [0, 0.3, 0], wings: [0, 0.3, -0.2], hair: [0, 0.9, 0], shoes: [0, 0.2, 0], color: [0, 0, 0.6] };
    const [x, y, z] = offsets[category] ?? [0, 0, 0];
    if (category === 'shoes') return this.rig.localToWorld(target.set(0, 0.25, 0.4));
    if (category === 'color' || category === 'hair') return this.body.localToWorld(target.set(x, y, z));
    const slot = this.slotsFor(category)[0];
    return slot.localToWorld(target.set(x, y, z));
  }

  // ------------------------------------------------------------ animation

  /** Run a timed action. fn(t, pose, seconds) adds to the pose each frame. */
  play(duration, fn) {
    return new Promise((resolve) => {
      this.actions.add({ elapsed: 0, duration, fn, resolve });
    });
  }

  get motion() {
    return settings.reducedMotion ? 0.3 : 1;
  }

  giggle() {
    const m = this.motion;
    return this.play(1.6, (t, p, s) => {
      const fade = 1 - t;
      p.tiltZ += Math.sin(s * 30) * 0.07 * fade * m;
      p.squash += Math.abs(Math.sin(s * 15)) * 0.06 * fade * m;
      p.y += Math.abs(Math.sin(s * 15)) * 0.06 * fade * m;
      p.happy = t < 0.92;
      p.mouth += 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.3));
      p.armL += 1.0 * fade;
      p.armR += 1.0 * fade;
      p.armFwd += 0.9 * fade;
    });
  }

  dance() {
    const m = this.motion;
    return this.play(3.2, (t, p, s) => {
      const env = Math.sin(Math.PI * t);
      const beat = s * Math.PI * 2 * 1.6;
      p.footL += Math.max(0, Math.sin(beat)) * 0.28 * env * m;
      p.footR += Math.max(0, -Math.sin(beat)) * 0.28 * env * m;
      p.y += Math.abs(Math.sin(beat)) * 0.14 * env * m;
      p.tiltZ += Math.sin(beat) * 0.14 * env * m;
      p.rotY += Math.sin(beat * 0.5) * 0.35 * env * m;
      p.armL += (1.6 + Math.sin(beat) * 0.6) * env;
      p.armR += (1.6 - Math.sin(beat) * 0.6) * env;
      p.flap += 1.2 * env;
      p.happy = env > 0.3;
      p.mouth += 0.3 * env;
    });
  }

  hop(height = 0.4, duration = 0.5) {
    const m = this.motion;
    return this.play(duration, (t, p) => {
      const arc = Math.sin(Math.PI * t);
      p.y += arc * height * m;
      p.squash += (t < 0.15 ? -t : t > 0.85 ? -(1 - t) : arc * 0.35) * 0.25 * m;
      p.armL += arc * 0.8;
      p.armR += arc * 0.8;
    });
  }

  wiggle() {
    const m = this.motion;
    return this.play(0.7, (t, p, s) => {
      p.tiltZ += Math.sin(s * 22) * 0.08 * (1 - t) * m;
      p.mouth += 0.2 * Math.sin(Math.PI * t);
    });
  }

  happyHop() {
    const m = this.motion;
    return this.play(0.55, (t, p) => {
      const arc = Math.sin(Math.PI * t);
      p.y += arc * 0.22 * m;
      p.squash += arc * 0.05 * m;
      p.happy = true;
      p.mouth += 0.3 * arc;
      p.armL += arc * 1.2;
      p.armR += arc * 1.2;
    });
  }

  spin(duration = 0.9) {
    if (settings.reducedMotion) {
      return this.play(duration, (t, p) => {
        p.tiltZ += Math.sin(Math.PI * 2 * t) * 0.05;
        p.happy = true;
      });
    }
    return this.play(duration, (t, p) => {
      p.rotY += easeInOut(t) * Math.PI * 2;
      p.y += Math.sin(Math.PI * t) * 0.25;
      p.armL += Math.sin(Math.PI * t) * 1.6;
      p.armR += Math.sin(Math.PI * t) * 1.6;
      p.happy = true;
    });
  }

  tada(duration = 1.4) {
    const m = this.motion;
    return this.play(duration, (t, p) => {
      const up = Math.min(1, t * 4) * Math.min(1, (1 - t) * 4);
      p.armL += 2.5 * up;
      p.armR += 2.5 * up;
      p.squash += 0.06 * up * m;
      p.flap += 1.5 * up;
      p.happy = up > 0.5;
      p.mouth += 0.5 * up;
    });
  }

  strut(duration = 1.6) {
    const m = this.motion;
    return this.play(duration, (t, p, s) => {
      const env = Math.sin(Math.PI * t);
      p.tiltZ += Math.sin(s * 7) * 0.12 * env * m;
      p.footL += Math.max(0, Math.sin(s * 7)) * 0.15 * env * m;
      p.footR += Math.max(0, -Math.sin(s * 7)) * 0.15 * env * m;
      p.flap += 1.8 * env;
      p.armL += (0.4 + Math.max(0, Math.sin(s * 7))) * env;
      p.armR += (0.4 + Math.max(0, -Math.sin(s * 7))) * env;
      p.lookX += Math.sin(s * 3) * 0.6 * env;
    });
  }

  /** Hop along a straight line to `to` (world space; root is in world space). */
  async travelTo(to, { hops = 3, duration = 1.6, faceEnd = 0 } = {}) {
    const from = this.root.position.clone();
    const dir = to.clone().sub(from);
    const heading = Math.atan2(dir.x, dir.z);
    const m = this.motion;
    const startRot = this.baseRotY;
    await this.play(duration, (t, p) => {
      const e = easeInOut(t);
      this.root.position.lerpVectors(from, to, e);
      const turnIn = Math.min(1, t * 5);
      const turnOut = Math.max(0, (t - 0.8) * 5);
      this.baseRotY = startRot + (heading - startRot) * turnIn * (1 - turnOut) + (faceEnd - startRot) * turnOut;
      const hopT = (t * hops) % 1;
      const arc = Math.sin(Math.PI * hopT);
      p.y += arc * 0.3 * m;
      p.squash += (arc - 0.4) * 0.08 * m;
      p.armL += 0.6 + arc * 0.6;
      p.armR += 0.6 + arc * 0.6;
    });
    this.baseRotY = faceEnd;
    this.root.position.copy(to);
  }

  setLookTarget(x, y) {
    this.lookTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  }

  update(dt) {
    this.time += dt;
    const s = this.time;
    const m = this.motion;
    const p = {
      y: 0,
      squash: Math.sin(s * 2.2) * 0.018 * m,
      tiltZ: Math.sin(s * 0.9) * 0.025 * m,
      rotY: 0,
      armL: 0.15 + Math.sin(s * 2.2) * 0.05,
      armR: 0.15 + Math.sin(s * 2.2 + 0.5) * 0.05,
      armFwd: 0,
      flap: 0.25,
      footL: 0,
      footR: 0,
      happy: false,
      mouth: 0,
      lookX: 0,
      lookY: 0,
    };

    for (const a of [...this.actions]) {
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / a.duration);
      a.fn(t, p, a.elapsed);
      if (t >= 1) {
        this.actions.delete(a);
        a.resolve();
      }
    }

    // blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = 0.16;
      this.blinkTimer = 2 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt);
    const lid = this.blink > 0 ? Math.max(0.08, Math.abs(this.blink - 0.08) / 0.08) : 1;

    // eyes follow the child's finger, softly
    const k = 1 - Math.exp(-dt * 6);
    this.look.x += (this.lookTarget.x + p.lookX - this.look.x) * k;
    this.look.y += (this.lookTarget.y + p.lookY - this.look.y) * k;
    for (const e of this.eyes) {
      e.open.visible = !p.happy;
      e.happy.visible = p.happy;
      e.eye.scale.y = p.happy ? 1 : lid;
      e.pupilPivot.rotation.y = this.look.x * 0.45;
      e.pupilPivot.rotation.x = -this.look.y * 0.35;
    }

    this.mouth.scale.set(1 + p.mouth * 0.25, 1 + p.mouth * 1.1, 1);
    this.rig.position.y = this.lift + Math.max(0, p.y);
    const sq = THREE.MathUtils.clamp(p.squash, -0.25, 0.3);
    this.bodyPivot.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    this.bodyPivot.rotation.z = p.tiltZ;
    this.root.rotation.y = this.baseRotY + p.rotY;

    this.arms.forEach((arm) => {
      const raise = arm.userData.side < 0 ? p.armL : p.armR;
      arm.rotation.z = arm.userData.side * (0.55 + raise);
      arm.rotation.x = -p.armFwd;
    });
    this.feet[0].foot.position.y = p.footL;
    this.feet[1].foot.position.y = p.footR;
    this.feet[0].foot.rotation.x = -p.footL * 0.8;
    this.feet[1].foot.rotation.x = -p.footR * 0.8;

    const wings = this.accessories.wings?.[0];
    if (wings) {
      const amp = 0.12 + p.flap * 0.25 * (settings.reducedMotion ? 0.4 : 1);
      const speed = 3 + p.flap * 6;
      for (const f of wings.userData.flappers) {
        f.rotation.y = f.userData.baseRotY + Math.sign(f.userData.baseRotY) * Math.sin(s * speed) * amp;
      }
    }
    for (const hair of this.accessories.hair ?? []) {
      hair.traverse((o) => {
        if (o.userData.swing) o.rotation.x = Math.sin(s * 3 + o.userData.swing) * 0.08 * m + p.tiltZ * 0.5;
      });
    }
  }
}
