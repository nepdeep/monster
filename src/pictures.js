// Renders the picture buttons (from the real 3D accessories, so a button
// always looks exactly like what appears on the monster) and the final
// sticker of the outfit. Uses a small offscreen renderer.

import * as THREE from 'three';
import { buildHat, buildShoe, buildWings } from './accessories.js';
import { DEFAULT_OUTFIT, NONE, OPTIONS, getOption } from './catalog.js';
import { Monster } from './monster.js';
import { hex } from './util.js';

const SIZE = 192;

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd6ec, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9e6ff, 1.2);
  rim.position.set(-4, 2, -3);
  scene.add(rim);
}

function frame(camera, object, { dir = new THREE.Vector3(0, 0.15, 1), pad = 1.15 } = {}) {
  const box = new THREE.Box3().setFromObject(object);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dist = (sphere.radius * pad) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.copy(sphere.center).addScaledVector(dir.clone().normalize(), dist);
  camera.near = dist / 20;
  camera.far = dist * 4;
  camera.lookAt(sphere.center);
  camera.updateProjectionMatrix();
}

export class PictureMaker {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    lights(this.scene);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.cache = new Map();
  }

  snap(object, opts = {}, size = SIZE) {
    this.renderer.setSize(size, size, false);
    this.scene.add(object);
    object.updateMatrixWorld(true);
    frame(this.camera, object, opts);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(object);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /** Builds every picture for the buttons. Returns { [category]: { [id]: url } }. */
  async makeAll() {
    const pics = { color: {}, hat: {}, wings: {}, shoes: {}, hair: {} };
    // One stand-in monster for colour and hair pictures.
    const model = new Monster({ outfit: { ...DEFAULT_OUTFIT }, friend: { eyes: 2 } });
    model.update(0);
    for (const c of OPTIONS.color) {
      model.setColor(c.id, false);
      pics.color[c.id] = this.snap(model.root, { dir: new THREE.Vector3(0.25, 0.2, 1), pad: 0.95 });
    }
    model.setColor('sky', false);
    model.palette.set(new THREE.Color(0xeee6ff), new THREE.Color(0xffffff), new THREE.Color(0xffffff));
    for (const o of OPTIONS.hair) {
      if (o.id === NONE) continue;
      model.setOutfit({ ...DEFAULT_OUTFIT, hair: o.id }, { animate: false, changed: ['hair'] });
      const head = model.body;
      pics.hair[o.id] = this.snapPart(model.root, head, 0.95);
    }
    for (const o of OPTIONS.hat) if (o.id !== NONE) pics.hat[o.id] = this.snap(buildHat(o.id), { dir: new THREE.Vector3(0.2, 0.35, 1) });
    for (const o of OPTIONS.wings) {
      if (o.id === NONE) continue;
      const w = buildWings(o.id);
      for (const f of w.userData.flappers) f.rotation.y = 0;
      pics.wings[o.id] = this.snap(w, { dir: new THREE.Vector3(0, 0.1, -1), pad: 1.0 });
    }
    for (const o of OPTIONS.shoes) if (o.id !== NONE) pics.shoes[o.id] = this.snap(buildShoe(o.id), { dir: new THREE.Vector3(1, 0.5, 0.9), pad: 1.0 });

    const sample = { hat: pics.hat.star, wings: pics.wings.butterfly, shoes: pics.shoes.sneakers, hair: pics.hair.puff };
    for (const cat of ['hat', 'wings', 'shoes', 'hair']) pics[cat][NONE] = await noneIcon(sample[cat]);
    return pics;
  }

  /** Snap the whole object but frame only `part` (e.g. the head). */
  snapPart(object, part, pad) {
    this.renderer.setSize(SIZE, SIZE, false);
    this.scene.add(object);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(part);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphere.center.y += 0.25;
    const dist = (sphere.radius * pad) / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3(0.3, 0.35, 1).normalize(), dist);
    this.camera.lookAt(sphere.center);
    this.camera.near = 0.1;
    this.camera.far = 50;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(object);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /**
   * Render the actual monster into a die-cut sticker. The monster object is
   * borrowed from the main scene and put back exactly where it was.
   */
  makeSticker(monster, outfit) {
    const root = monster.root;
    const parent = root.parent;
    const saved = { pos: root.position.clone(), rotY: root.rotation.y };
    root.position.set(0, 0, 0);
    root.rotation.y = 0.25;
    this.renderer.setSize(512, 512, false);
    this.scene.add(root);
    root.updateMatrixWorld(true);
    frame(this.camera, root, { dir: new THREE.Vector3(0, 0.12, 1), pad: 0.88 });
    this.renderer.render(this.scene, this.camera);
    const shot = document.createElement('canvas');
    shot.width = shot.height = 512;
    shot.getContext('2d').drawImage(this.renderer.domElement, 0, 0);
    parent.add(root);
    root.position.copy(saved.pos);
    root.rotation.y = saved.rotY;
    return composeSticker(shot, getOption('color', outfit.color));
  }
}

async function noneIcon(sampleUrl) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  const img = new Image();
  img.src = sampleUrl;
  try {
    await img.decode();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(img, SIZE * 0.12, SIZE * 0.12, SIZE * 0.76, SIZE * 0.76);
    ctx.globalAlpha = 1;
  } catch {
    /* draw the symbol alone */
  }
  ctx.strokeStyle = '#9b8fb5';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(SIZE * 0.25, SIZE * 0.25);
  ctx.lineTo(SIZE * 0.75, SIZE * 0.75);
  ctx.stroke();
  return c.toDataURL();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function composeSticker(shot, color) {
  const S = 640;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');

  // background: rounded card with sunburst in the monster's colours
  const r = 80;
  ctx.save();
  roundRect(ctx, 20, 20, S - 40, S - 40, r);
  ctx.clip();
  ctx.fillStyle = hex(color.belly);
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = hex(color.tip);
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(S, -70);
    ctx.lineTo(S, 70);
    ctx.fill();
  }
  ctx.restore();
  // little stars
  const star = (x, y, rad, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? rad * 0.45 : rad;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  star(95, 105, 34, '#ffe14d');
  star(540, 140, 26, '#ffffff');
  star(530, 520, 38, '#ffe14d');
  star(110, 530, 22, '#ffffff');

  // die-cut white outline: stamp a white silhouette in a ring of offsets
  const silhouette = document.createElement('canvas');
  silhouette.width = silhouette.height = 512;
  const sctx = silhouette.getContext('2d');
  sctx.drawImage(shot, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, 512, 512);
  const ox = (S - 512) / 2;
  const oy = (S - 512) / 2 + 6;
  ctx.save();
  ctx.shadowColor = 'rgba(60, 20, 90, 0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    ctx.drawImage(silhouette, ox + Math.cos(ang) * 14, oy + Math.sin(ang) * 14);
    if (a === 0) {
      ctx.shadowColor = 'transparent';
    }
  }
  ctx.restore();
  ctx.drawImage(shot, ox, oy);

  // glossy sticker border
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#ffffff';
  roundRect(ctx, 20, 20, S - 40, S - 40, r);
  ctx.stroke();
  return c.toDataURL('image/png');
}
