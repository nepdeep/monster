// Procedural accessory builders. Each builder returns a fresh THREE.Group in
// the local frame of the anchor it attaches to (see monster.js for anchors).
// Every accessory is designed to fit with every other one, so any combination
// the child picks looks right.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, shiny, gold, mesh, starGeometry, canvasTexture } from './util.js';

const shared = (geo) => {
  geo.userData.shared = true;
  return geo;
};
const SPHERE = shared(new THREE.SphereGeometry(1, 24, 16));
const SPHERE_LO = shared(new THREE.SphereGeometry(1, 14, 10));
const CONE = shared(new THREE.ConeGeometry(1, 1, 18));
const CYL = shared(new THREE.CylinderGeometry(1, 1, 1, 24));

/** Point on a unit sphere. theta from +Y (top), phi around Y (0 = front, +Z). */
function surface(theta, phi, r = 1) {
  return new THREE.Vector3(r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.cos(phi));
}

function alignTo(obj, normal) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize());
}

function normalizeUVs(geo) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) - min.x) / (max.x - min.x), (pos.getY(i) - min.y) / (max.y - min.y));
  }
  uv.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------- hats

function starHat() {
  const g = new THREE.Group();
  const purple = mat(0x7b5cff, { roughness: 0.8 });
  const dome = mesh(new THREE.SphereGeometry(0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), purple, { y: -0.1, s: [1, 0.8, 1] });
  g.add(dome);
  g.add(mesh(new THREE.TorusGeometry(0.6, 0.11, 14, 40), mat(0xa996ff, { roughness: 0.9 }), { y: -0.06, rx: Math.PI / 2 }));
  g.add(mesh(CYL, purple, { y: 0.45, s: [0.05, 0.25, 0.05] }));
  const starMat = shiny(0xffd23f, { emissive: 0xffb000, emissiveIntensity: 0.35 });
  const star = mesh(starGeometry(0.32, 0.16, 0.1, 0.05), starMat, { y: 0.72 });
  star.name = 'hat-star';
  g.add(star);
  // little sparkly stars dotted on the beanie
  const small = starGeometry(0.07, 0.035, 0.02, 0.012);
  for (let i = 0; i < 6; i++) {
    const p = surface(0.95, (i / 6) * Math.PI * 2 + 0.3, 0.62);
    const s = mesh(small, starMat, { x: p.x, y: p.y * 0.8 - 0.1, z: p.z, shadow: false });
    s.lookAt(p.x * 3, p.y * 2, p.z * 3);
    g.add(s);
  }
  return g;
}

function partyHat() {
  const g = new THREE.Group();
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ff5fa2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffe14d';
    for (let i = -4; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 48, h);
      ctx.lineTo(i * 48 + 24, h);
      ctx.lineTo(i * 48 + 24 + 140, 0);
      ctx.lineTo(i * 48 + 140, 0);
      ctx.fill();
    }
    ctx.fillStyle = '#4fc3ff';
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.arc((i * 71) % w, (i * 37) % h, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const cone = mesh(new THREE.ConeGeometry(0.5, 1.2, 40, 1, true), mat(0xffffff, { map: tex, side: THREE.DoubleSide }), { y: 0.58 });
  g.add(cone);
  const white = mat(0xffffff, { roughness: 0.95 });
  g.add(mesh(new THREE.TorusGeometry(0.5, 0.08, 10, 36), white, { y: 0.02, rx: Math.PI / 2 }));
  const pom = new THREE.Group();
  pom.position.y = 1.2;
  for (let i = 0; i < 9; i++) {
    const p = surface(Math.acos(1 - (2 * (i + 0.5)) / 9), i * 2.4, 0.09);
    pom.add(mesh(SPHERE_LO, white, { x: p.x, y: p.y, z: p.z, s: 0.09 }));
  }
  g.add(pom);
  g.rotation.z = -0.18;
  return g;
}

function crown() {
  const g = new THREE.Group();
  const goldMat = gold({ side: THREE.DoubleSide });
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.3, 40, 1, true), goldMat, { y: 0.15 }));
  g.add(mesh(SPHERE, mat(0xd6266b, { roughness: 0.9 }), { y: 0.1, s: [0.45, 0.32, 0.45] }));
  const gems = [0xff3b6b, 0x3bb8ff, 0x5be37a, 0xb46bff, 0xffe14d];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const x = Math.sin(a) * 0.48;
    const z = Math.cos(a) * 0.48;
    g.add(mesh(CONE, goldMat, { x, y: 0.42, z, s: [0.12, 0.28, 0.12] }));
    g.add(mesh(SPHERE_LO, gold(), { x: x * 1.0, y: 0.6, z: z * 1.0, s: 0.065 }));
    g.add(mesh(SPHERE, shiny(gems[i], { emissive: gems[i], emissiveIntensity: 0.2 }), { x: x * 1.04, y: 0.16, z: z * 1.04, s: 0.075 }));
  }
  g.rotation.z = 0.12;
  return g;
}

function topHat() {
  const g = new THREE.Group();
  const navy = mat(0x2d2466, { roughness: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.06, 40), navy, { y: 0.03 }));
  g.add(mesh(new THREE.CylinderGeometry(0.44, 0.4, 0.8, 40), navy, { y: 0.45 }));
  g.add(mesh(new THREE.CylinderGeometry(0.415, 0.415, 0.16, 40), mat(0xff5fa2), { y: 0.15 }));
  // a big silly flower on the band
  const flower = new THREE.Group();
  flower.position.set(0.18, 0.2, 0.38);
  flower.lookAt(0.6, 0.2, 1.6);
  const petal = mat(0xfff06b);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    flower.add(mesh(SPHERE_LO, petal, { x: Math.cos(a) * 0.1, y: Math.sin(a) * 0.1, s: [0.08, 0.08, 0.03] }));
  }
  flower.add(mesh(SPHERE_LO, mat(0xff8a3d), { z: 0.02, s: [0.06, 0.06, 0.04] }));
  g.add(flower);
  g.rotation.z = 0.14;
  return g;
}

// ---------------------------------------------------------------- wings

function wingPair(buildOne) {
  const group = new THREE.Group();
  const left = new THREE.Group();
  const right = new THREE.Group();
  left.position.x = -0.15;
  right.position.x = 0.15;
  right.add(buildOne());
  const l = buildOne();
  l.scale.x = -1;
  left.add(l);
  left.userData.baseRotY = -0.35;
  right.userData.baseRotY = 0.35;
  left.rotation.y = left.userData.baseRotY;
  right.rotation.y = right.userData.baseRotY;
  group.add(left, right);
  group.userData.flappers = [left, right];
  return group;
}

function butterflyWing() {
  const top = new THREE.Shape();
  top.moveTo(0, 0.05);
  top.bezierCurveTo(0.2, 0.9, 1.2, 1.25, 1.45, 0.85);
  top.bezierCurveTo(1.6, 0.5, 1.0, 0.05, 0, 0.05);
  const bottom = new THREE.Shape();
  bottom.moveTo(0, 0.0);
  bottom.bezierCurveTo(0.8, 0.05, 1.15, -0.35, 0.95, -0.65);
  bottom.bezierCurveTo(0.7, -0.95, 0.2, -0.55, 0, 0.0);
  const geo = normalizeUVs(new THREE.ExtrudeGeometry([top, bottom], { depth: 0.04, bevelEnabled: false, curveSegments: 16 }));
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, w, 0);
    grad.addColorStop(0, '#ff6fb5');
    grad.addColorStop(0.55, '#ffa94d');
    grad.addColorStop(1, '#ffe14d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of [[200, 70, 22], [150, 50, 14], [190, 120, 12], [150, 205, 18], [110, 225, 10]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#7b2fbf';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, w, h);
  });
  const m = mesh(geo, mat(0xffffff, { map: tex, side: THREE.DoubleSide, roughness: 0.6 }), { z: -0.02 });
  const g = new THREE.Group();
  g.add(m);
  g.rotation.z = 0.15;
  return g;
}

function fairyWing() {
  const g = new THREE.Group();
  const film = new THREE.MeshPhysicalMaterial({
    color: 0xbff4ff,
    emissive: 0x5fd8ff,
    emissiveIntensity: 0.25,
    roughness: 0.15,
    transparent: true,
    opacity: 0.6,
    iridescence: 1,
    iridescenceIOR: 1.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const edge = mat(0xffffff, { emissive: 0xaef0ff, emissiveIntensity: 0.4 });
  const lobes = [
    { len: 1.5, wid: 0.36, angle: 0.55 },
    { len: 0.95, wid: 0.26, angle: -0.35 },
  ];
  for (const { len, wid, angle } of lobes) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(len * 0.3, wid, len * 0.9, wid * 1.1, len, 0);
    shape.bezierCurveTo(len * 0.9, -wid * 1.1, len * 0.3, -wid, 0, 0);
    const lobe = new THREE.Group();
    lobe.rotation.z = angle;
    lobe.add(mesh(new THREE.ShapeGeometry(shape, 20), film, { shadow: false }));
    const pts = shape.getPoints(30).map((p) => new THREE.Vector3(p.x, p.y, 0));
    lobe.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 60, 0.018, 6, true), edge, { shadow: false }));
    g.add(lobe);
  }
  return g;
}

function dragonWing() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.15);
  shape.lineTo(0.45, 0.8);
  shape.lineTo(1.5, 0.95);
  shape.quadraticCurveTo(1.3, 0.55, 1.35, 0.25);
  shape.quadraticCurveTo(1.05, 0.25, 0.95, -0.05);
  shape.quadraticCurveTo(0.7, 0.0, 0.55, -0.3);
  shape.quadraticCurveTo(0.3, -0.05, 0, -0.1);
  shape.lineTo(0, 0.15);
  const g = new THREE.Group();
  const membrane = mat(0x8cf06e, { side: THREE.DoubleSide, roughness: 0.7 });
  g.add(mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), membrane, { z: -0.015 }));
  const bone = mat(0x2f9e57);
  const root = new THREE.Vector3(0.45, 0.8, 0);
  const addBone = (a, b, r = 0.045) => {
    const d = b.clone().sub(a);
    const m = mesh(CYL, bone, { s: [r, d.length(), r] });
    m.position.copy(a).add(b).multiplyScalar(0.5);
    alignTo(m, d);
    g.add(m);
  };
  addBone(new THREE.Vector3(0, 0.15, 0), root, 0.06);
  addBone(root, new THREE.Vector3(1.5, 0.95, 0), 0.05);
  addBone(root, new THREE.Vector3(1.35, 0.25, 0));
  addBone(root, new THREE.Vector3(0.95, -0.05, 0));
  addBone(root, new THREE.Vector3(0.55, -0.3, 0));
  g.add(mesh(CONE, bone, { x: 1.55, y: 0.98, rz: -1.3, s: [0.06, 0.16, 0.06] }));
  g.rotation.z = 0.1;
  return g;
}

function featherWing() {
  const g = new THREE.Group();
  const colors = [0xffffff, 0xffd6ea, 0xcfe8ff];
  const rows = [
    { count: 6, len: 0.55, radius: 0.35, spread: [1.35, 0.25] },
    { count: 7, len: 0.8, radius: 0.65, spread: [1.15, -0.05] },
    { count: 6, len: 0.5, radius: 1.05, spread: [0.85, 0.1] },
  ];
  rows.forEach((row, ri) => {
    const m = mat(colors[ri], { roughness: 0.9 });
    for (let i = 0; i < row.count; i++) {
      const t = i / (row.count - 1);
      const a = row.spread[0] + (row.spread[1] - row.spread[0]) * t;
      const f = mesh(SPHERE, m, { s: [0.13, row.len * 0.5, 0.045] });
      const r = row.radius * (0.6 + 0.4 * t);
      f.position.set(Math.cos(a - 0.6) * r + 0.1, Math.sin(a - 0.6) * r * 0.6 + 0.35, -0.01 * ri);
      f.rotation.z = a - Math.PI / 2 - 0.3;
      g.add(f);
    }
  });
  g.add(mesh(SPHERE, mat(0xffffff, { roughness: 0.9 }), { x: 0.3, y: 0.4, s: [0.4, 0.22, 0.08] }));
  return g;
}

// ---------------------------------------------------------------- shoes
// Frame: y = 0 is the sole of the bare foot, +Z is the toe. userData.lift is
// how far the monster is raised so the shoe stands on the floor.

function sneaker() {
  const g = new THREE.Group();
  g.userData.lift = 0.08;
  const white = mat(0xffffff, { roughness: 0.7 });
  g.add(mesh(new RoundedBoxGeometry(0.6, 0.11, 0.84, 3, 0.05), white, { y: -0.025, z: 0.04 }));
  g.add(mesh(SPHERE, mat(0xff4d6d, { roughness: 0.6 }), { y: 0.06, z: 0.02, s: [0.3, 0.24, 0.42] }));
  g.add(mesh(SPHERE, white, { y: 0.05, z: 0.3, s: [0.24, 0.14, 0.17] }));
  g.add(mesh(SPHERE, mat(0x3bb8ff), { x: 0.29, y: 0.1, z: -0.02, s: [0.03, 0.08, 0.18] }));
  g.add(mesh(SPHERE, mat(0x3bb8ff), { x: -0.29, y: 0.1, z: -0.02, s: [0.03, 0.08, 0.18] }));
  for (let i = 0; i < 3; i++) {
    g.add(mesh(CYL, white, { y: 0.27 - i * 0.02, z: 0.02 + i * 0.1, rz: Math.PI / 2, rx: 0.5, s: [0.025, 0.28, 0.025] }));
  }
  return g;
}

function boot() {
  const g = new THREE.Group();
  g.userData.lift = 0.06;
  const yellow = shiny(0xffd23f);
  g.add(mesh(SPHERE, mat(0x6b4a2b), { y: -0.02, z: 0.04, s: [0.32, 0.06, 0.44] }));
  g.add(mesh(SPHERE, yellow, { y: 0.1, z: 0.07, s: [0.31, 0.2, 0.4] }));
  g.add(mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.45, 28), yellow, { y: 0.33, z: -0.05 }));
  g.add(mesh(new THREE.TorusGeometry(0.27, 0.05, 10, 28), shiny(0xff7a29), { y: 0.55, z: -0.05, rx: Math.PI / 2 }));
  const dot = shiny(0xffffff);
  for (const [x, y, z] of [[0.2, 0.3, 0.12], [-0.12, 0.4, 0.2], [0.0, 0.22, 0.23], [-0.22, 0.25, 0.08]]) {
    const d = mesh(SPHERE_LO, dot, { x, y, z, s: [0.045, 0.045, 0.02], shadow: false });
    d.lookAt(x * 4, y, z * 4 + 0.5);
    g.add(d);
  }
  return g;
}

function clownShoe() {
  const g = new THREE.Group();
  g.userData.lift = 0.05;
  g.add(mesh(SPHERE, mat(0x3d2a5c), { y: -0.01, z: 0.18, s: [0.37, 0.05, 0.66] }));
  g.add(mesh(SPHERE, shiny(0xff3b3b), { y: 0.13, z: 0.2, s: [0.37, 0.22, 0.64] }));
  g.add(mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 24), shiny(0xffe14d), { y: 0.3, z: -0.08, rx: Math.PI / 2 }));
  const pom = new THREE.Group();
  pom.position.set(0, 0.36, 0.42);
  const blue = mat(0x4fc3ff, { roughness: 0.95 });
  for (let i = 0; i < 7; i++) {
    const p = surface(Math.acos(1 - (2 * (i + 0.5)) / 7), i * 2.4, 0.07);
    pom.add(mesh(SPHERE_LO, blue, { x: p.x, y: p.y, z: p.z, s: 0.075 }));
  }
  g.add(pom);
  return g;
}

function skate() {
  const g = new THREE.Group();
  g.userData.lift = 0.26;
  const white = mat(0xffffff, { roughness: 0.6 });
  g.add(mesh(SPHERE, white, { y: 0.08, z: 0.06, s: [0.3, 0.22, 0.4] }));
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.32, 24), white, { y: 0.24, z: -0.06 }));
  g.add(mesh(new THREE.TorusGeometry(0.25, 0.04, 8, 24), mat(0xff5fa2), { y: 0.4, z: -0.06, rx: Math.PI / 2 }));
  g.add(mesh(new RoundedBoxGeometry(0.4, 0.07, 0.72, 2, 0.03), mat(0xb0b6c8, { metalness: 0.5, roughness: 0.35 }), { y: -0.1, z: 0.04 }));
  const wheelGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.09, 20);
  const wheelColors = [0xff5fa2, 0x4fc3ff, 0xffe14d, 0x5be37a];
  let i = 0;
  for (const z of [-0.22, 0.3]) {
    for (const x of [-0.17, 0.17]) {
      g.add(mesh(wheelGeo, shiny(wheelColors[i++]), { x, y: -0.165, z, rz: Math.PI / 2 }));
    }
  }
  g.add(mesh(SPHERE, mat(0xff5fa2), { y: -0.14, z: 0.45, s: [0.07, 0.08, 0.07] }));
  return g;
}

// ---------------------------------------------------------------- hair
// Frame: unit sphere = the monster's head/body. Parts flagged
// userData.top are tucked away when a hat is worn, so every hair style still
// shows (curls, tufts, tails) peeking out from under every hat.

function puffHair() {
  const g = new THREE.Group();
  const colors = [mat(0xff7a29, { roughness: 0.95 }), mat(0xff9a4d, { roughness: 0.95 })];
  for (let i = 0; i < 34; i++) {
    const theta = 0.7 * Math.sqrt((i + 0.5) / 34);
    const phi = i * 2.399;
    const p = surface(theta, phi, 1.02);
    const r = 0.2 + ((i * 37) % 10) / 100;
    const m = mesh(SPHERE_LO, colors[i % 2], { x: p.x, y: p.y + 0.1, z: p.z, s: r });
    m.userData.top = true;
    g.add(m);
  }
  for (let i = 0; i < 16; i++) {
    const phi = (i / 16) * Math.PI * 2;
    const front = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) < 0.5;
    const p = surface(front ? 0.82 : 0.95, phi, 1.04);
    g.add(mesh(SPHERE_LO, colors[i % 2], { x: p.x, y: p.y, z: p.z, s: front ? 0.13 : 0.17 }));
  }
  return g;
}

function spikyHair() {
  const g = new THREE.Group();
  const base = mat(0xff4f6d, { roughness: 0.7 });
  const tip = mat(0xffe14d, { roughness: 0.7 });
  for (let i = 0; i <= 13; i++) {
    const t = -0.95 + i * 0.2; // negative = front of head
    const theta = Math.abs(t);
    const phi = t < 0 ? 0 : Math.PI;
    const n = surface(theta, phi, 1);
    const len = 0.5 - Math.abs(t) * 0.12;
    const spike = new THREE.Group();
    spike.position.copy(n.clone().multiplyScalar(0.98));
    alignTo(spike, n);
    spike.add(mesh(CONE, base, { y: len * 0.35, s: [0.16, len * 0.7, 0.16] }));
    spike.add(mesh(CONE, tip, { y: len * 0.78, s: [0.07, len * 0.3, 0.07] }));
    spike.rotateX(t < 0 ? 0.25 : -0.25);
    if (theta < 0.72) spike.userData.top = true;
    g.add(spike);
  }
  // side tufts so spikes still show under wide hats
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const n = surface(1.05 + j * 0.15, side * (1.25 + j * 0.12), 1);
      const s = new THREE.Group();
      s.position.copy(n.clone().multiplyScalar(0.98));
      alignTo(s, n);
      s.add(mesh(CONE, base, { y: 0.12, s: [0.1, 0.28, 0.1] }));
      s.add(mesh(CONE, tip, { y: 0.29, s: [0.045, 0.1, 0.045] }));
      g.add(s);
    }
  }
  return g;
}

function pigtailHair() {
  const g = new THREE.Group();
  const brown = mat(0x6b3f22, { roughness: 0.85 });
  const cap = mesh(new THREE.SphereGeometry(1.07, 40, 20, 0, Math.PI * 2, 0, 0.8), brown, {});
  cap.userData.top = true;
  g.add(cap);
  // fringe
  for (let i = -3; i <= 3; i++) {
    const p = surface(0.78, i * 0.16, 1.05);
    g.add(mesh(SPHERE_LO, brown, { x: p.x, y: p.y, z: p.z, s: [0.12, 0.13, 0.08] }));
  }
  for (const side of [-1, 1]) {
    const root = surface(1.08, side * 1.42, 1.02);
    const tail = new THREE.Group();
    tail.position.copy(root);
    tail.rotation.z = side * -0.9;
    tail.add(mesh(new THREE.TorusGeometry(0.11, 0.05, 10, 20), mat(0xff5fa2), { rx: Math.PI / 2 }));
    tail.add(mesh(SPHERE_LO, mat(0xff5fa2), { x: 0, y: 0.06, z: 0.12, s: [0.12, 0.08, 0.05] }));
    for (let k = 0; k < 4; k++) {
      tail.add(mesh(SPHERE_LO, brown, { y: -0.1 - k * 0.14 + 0.25, x: side * (0.12 + k * 0.1), s: 0.17 - k * 0.025 }));
    }
    tail.userData.swing = side;
    g.add(tail);
  }
  return g;
}

function rainbowHair() {
  const g = new THREE.Group();
  const rainbow = [0xff4d4d, 0xff9a3d, 0xffe14d, 0x5be37a, 0x4fc3ff, 0xa77bff];
  const mats = rainbow.map((c) => mat(c, { roughness: 0.8 }));
  const strands = 18;
  for (let i = 0; i < strands; i++) {
    const phi = (i / strands) * Math.PI * 2;
    const wrapped = Math.atan2(Math.sin(phi), Math.cos(phi));
    const isFront = Math.abs(wrapped) < 0.75;
    const end = isFront ? 0.85 : 1.45;
    const steps = isFront ? 5 : 8;
    for (let k = 0; k < steps; k++) {
      const theta = 0.12 + (end - 0.12) * (k / (steps - 1));
      const p = surface(theta, phi, 1.05);
      const m = mesh(SPHERE_LO, mats[i % mats.length], { x: p.x, y: p.y, z: p.z, s: 0.15 - k * 0.006 });
      if (theta < 0.72) m.userData.top = true;
      g.add(m);
    }
  }
  return g;
}

// ---------------------------------------------------------------- public

const HATS = { star: starHat, party: partyHat, crown, tophat: topHat };
const WINGS = { butterfly: butterflyWing, fairy: fairyWing, dragon: dragonWing, feather: featherWing };
const SHOES = { sneakers: sneaker, boots: boot, clown: clownShoe, skates: skate };
const HAIR = { puff: puffHair, spikes: spikyHair, pigtails: pigtailHair, rainbow: rainbowHair };

export function buildHat(id) {
  return HATS[id] ? HATS[id]() : null;
}
export function buildWings(id) {
  return WINGS[id] ? wingPair(WINGS[id]) : null;
}
export function buildShoe(id) {
  return SHOES[id] ? SHOES[id]() : null;
}
export function buildHair(id) {
  return HAIR[id] ? HAIR[id]() : null;
}

export function buildAccessory(category, id) {
  switch (category) {
    case 'hat':
      return buildHat(id);
    case 'wings':
      return buildWings(id);
    case 'shoes':
      return buildShoe(id);
    case 'hair':
      return buildHair(id);
    default:
      return null;
  }
}

export function shoeLift(id) {
  return { sneakers: 0.08, boots: 0.06, clown: 0.05, skates: 0.26 }[id] ?? 0;
}
