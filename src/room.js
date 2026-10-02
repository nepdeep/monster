// The bright dressing room: wallpaper, wooden floor, round rug, a star mirror
// with bulbs, chunky accessory shelves (whose items can be tapped to try on)
// and a tiny celebration stage with curtains and spotlights.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildHat, buildShoe } from './accessories.js';
import { OPTIONS } from './catalog.js';
import { mat, shiny, gold, mesh, starShape, starGeometry, canvasTexture, settings } from './util.js';

export const HOME = new THREE.Vector3(0, 0, 0.3);
export const STAGE_CENTER = new THREE.Vector3(4.05, 0, -0.9);
export const STAGE_HEIGHT = 0.42;

const W = 16;
const D_BACK = -3.6;
const D_FRONT = 17;
const H = 8;

function wallpaper() {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffe6f2';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffd3e8';
      for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 32, h);
      const drawStar = (cx, cy, r, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? r * 0.45 : r;
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      };
      drawStar(48, 48, 14, '#ffffff');
      drawStar(176, 176, 14, '#ffffff');
      ctx.fillStyle = '#ffb8d9';
      for (const [x, y] of [[176, 48], [48, 176], [112, 112], [240, 112], [112, 240]]) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { repeat: [6, 3] },
  );
}

function floorTexture() {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const tones = ['#f2c48d', '#eebb80', '#f5cc99', '#e9b478'];
      const plank = h / 8;
      for (let i = 0; i < 8; i++) {
        let x = (i % 2) * -120;
        while (x < w) {
          const len = 200 + ((i * 53 + x) % 140);
          ctx.fillStyle = tones[(i + Math.floor(x / 97)) % tones.length];
          ctx.fillRect(x, i * plank, len, plank);
          ctx.fillStyle = 'rgba(150,90,40,0.35)';
          ctx.fillRect(x, i * plank, 3, plank);
          x += len;
        }
        ctx.fillStyle = 'rgba(150,90,40,0.4)';
        ctx.fillRect(0, i * plank, w, 3);
      }
    },
    { repeat: [4, 4] },
  );
}

function rugTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const rings = ['#7b5cff', '#4fc3ff', '#5be37a', '#ffe14d', '#ff9a3d', '#ff5fa2'];
    for (let i = 0; i < rings.length; i++) {
      ctx.fillStyle = rings[i];
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (w / 2) * (1 - i / rings.length), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
  });
}

export class Room {
  constructor() {
    this.group = new THREE.Group();
    this.tappables = [];
    this.bulbs = [];
    this.balloons = [];
    this.showAmount = 0;
    this.buildShell();
    this.buildMirror();
    this.buildShelves();
    this.buildStage();
    this.buildDecor();
  }

  buildShell() {
    const wall = mat(0xffffff, { map: wallpaper(), roughness: 0.95 });
    const back = mesh(new THREE.PlaneGeometry(W, H), wall, { y: H / 2, z: D_BACK });
    back.castShadow = false;
    this.group.add(back);
    const sideTex = wallpaper();
    sideTex.repeat.set(6, 3);
    const sideMat = mat(0xffffff, { map: sideTex, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const depth = D_FRONT - D_BACK;
      const s = mesh(new THREE.PlaneGeometry(depth, H), sideMat, { x: (side * W) / 2, y: H / 2, z: (D_BACK + D_FRONT) / 2, ry: -side * Math.PI / 2 });
      s.castShadow = false;
      this.group.add(s);
    }
    const front = mesh(new THREE.PlaneGeometry(W, H), wall, { y: H / 2, z: D_FRONT, ry: Math.PI, shadow: false });
    this.group.add(front);
    const ceiling = mesh(new THREE.PlaneGeometry(W, D_FRONT - D_BACK), mat(0xfff4fa), { y: H, z: (D_BACK + D_FRONT) / 2, rx: Math.PI / 2, shadow: false });
    this.group.add(ceiling);

    const floor = mesh(new THREE.PlaneGeometry(W, D_FRONT - D_BACK), mat(0xffffff, { map: floorTexture(), roughness: 0.7 }), {
      z: (D_BACK + D_FRONT) / 2,
      rx: -Math.PI / 2,
    });
    floor.castShadow = false;
    floor.userData.part = 'floor';
    this.group.add(floor);

    const trim = mat(0xffffff, { roughness: 0.6 });
    this.group.add(mesh(new THREE.BoxGeometry(W, 0.35, 0.12), trim, { y: 0.175, z: D_BACK + 0.06 }));

    const rug = mesh(new THREE.CircleGeometry(1.75, 64), mat(0xffffff, { map: rugTexture(), roughness: 1 }), { x: HOME.x, y: 0.012, z: HOME.z, rx: -Math.PI / 2 });
    rug.castShadow = false;
    this.group.add(rug);
  }

  buildMirror() {
    const g = new THREE.Group();
    g.position.set(0, 3.45, D_BACK + 0.05);
    const frame = mesh(starGeometry(1.55, 0.86, 0.14, 0.1), shiny(0xff8fc8, { emissive: 0xff5fa2, emissiveIntensity: 0.15 }), {});
    g.add(frame);
    const glassShape = starShape(5, 1.3, 0.72);
    let glass;
    try {
      glass = new Reflector(new THREE.ShapeGeometry(glassShape, 12), {
        clipBias: 0.003,
        textureWidth: 512,
        textureHeight: 512,
        color: 0xe4ecff,
      });
    } catch {
      glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), shiny(0xcfe3ff, { metalness: 0.6, roughness: 0.1 }));
    }
    glass.position.z = 0.2;
    g.add(glass);
    // glassy highlight streaks
    const streak = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    for (const [x, w] of [[-0.35, 0.22], [0.05, 0.1]]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.5), streak);
      s.position.set(x, 0.1, 0.21);
      s.rotation.z = -0.6;
      g.add(s);
    }
    this.mirror = glass;
    // bulbs around the star frame
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe28a, emissiveIntensity: 1.2 });
    const bulbGeo = new THREE.SphereGeometry(0.085, 14, 10);
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 1.47 : 0.84;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const b = mesh(bulbGeo, bulbMat.clone(), { x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0.22, shadow: false });
      b.userData.phase = i;
      this.bulbs.push(b);
      g.add(b);
    }
    // little vanity table under the mirror
    const table = new THREE.Group();
    table.position.set(0, 0, D_BACK + 0.55);
    table.add(mesh(new RoundedBoxGeometry(2.6, 0.18, 0.8, 3, 0.07), mat(0xffffff), { y: 1.55 }));
    for (const x of [-1.1, 1.1]) table.add(mesh(new RoundedBoxGeometry(0.22, 1.5, 0.22, 2, 0.08), mat(0xffb3dc), { x, y: 0.75, z: 0.15 }));
    table.add(mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.3, 16), shiny(0x7b5cff), { x: -0.8, y: 1.79 }));
    table.add(mesh(new THREE.SphereGeometry(0.16, 16, 12), shiny(0x4fc3ff), { x: -0.45, y: 1.78 }));
    table.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12), shiny(0xff5fa2), { x: 0.9, y: 1.84, rz: 0.3 }));
    this.group.add(g, table);
  }

  buildShelves() {
    const unit = new THREE.Group();
    unit.position.set(-4.35, 0, D_BACK + 0.6);
    const wood = mat(0x9b7bff, { roughness: 0.6 });
    const shelfMat = mat(0xffffff, { roughness: 0.6 });
    const width = 2.7;
    unit.add(mesh(new RoundedBoxGeometry(width + 0.3, 4.5, 0.15, 3, 0.06), wood, { y: 2.25, z: -0.45 }));
    for (const x of [-width / 2, width / 2]) unit.add(mesh(new RoundedBoxGeometry(0.28, 4.6, 1.0, 3, 0.1), wood, { x, y: 2.3 }));
    const levels = [0.25, 1.65, 3.05, 4.45];
    for (const y of levels) unit.add(mesh(new RoundedBoxGeometry(width + 0.2, 0.22, 1.05, 3, 0.09), shelfMat, { y }));
    // a crown of bulbs on top
    for (let i = 0; i < 5; i++) {
      unit.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), shiny([0xff5fa2, 0xffe14d, 0x4fc3ff, 0x5be37a, 0xff9a3d][i]), { x: -1.1 + i * 0.55, y: 4.68 }));
    }
    this.group.add(unit);

    const place = (obj, x, y, z, s, equip, ry = 0.3) => {
      obj.position.set(x, y, z);
      obj.scale.multiplyScalar(s);
      obj.rotation.y += ry;
      obj.userData.equip = equip;
      obj.userData.baseY = y;
      obj.traverse((o) => (o.userData.equipRoot = obj));
      unit.add(obj);
      this.tappables.push(obj);
    };

    // top shelf: hats
    place(buildHat('crown'), -0.65, levels[2] + 0.12, 0.05, 0.72, { category: 'hat', id: 'crown' });
    place(buildHat('star'), 0.65, levels[2] + 0.2, 0.05, 0.62, { category: 'hat', id: 'star' });
    // middle shelf: shoes
    const s1 = buildShoe('sneakers');
    place(s1, -0.7, levels[1] + 0.2, 0.05, 0.85, { category: 'shoes', id: 'sneakers' }, 0.9);
    const s2 = buildShoe('boots');
    place(s2, 0.1, levels[1] + 0.17, 0.05, 0.8, { category: 'shoes', id: 'boots' }, 0.7);
    place(buildShoe('clown'), 0.8, levels[1] + 0.16, 0.0, 0.62, { category: 'shoes', id: 'clown' }, 1.1);
    // bottom shelf: fuzzy paint pots to change colour
    OPTIONS.color.forEach((c, i) => {
      const pot = new THREE.Group();
      pot.add(mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.34, 20), mat(0xffffff, { roughness: 0.4 }), { y: 0.17 }));
      pot.add(mesh(new THREE.SphereGeometry(0.21, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(c.fur, { roughness: 0.9 }), { y: 0.33, s: [1, 0.7, 1] }));
      pot.add(mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.08, 20), mat(c.fur), { y: 0.25 }));
      place(pot, -1.0 + i * 0.5, levels[0] + 0.11, 0.1, 1, { category: 'color', id: c.id }, 0);
    });
  }

  buildStage() {
    const g = new THREE.Group();
    g.position.copy(STAGE_CENTER);
    const top = mesh(new THREE.CylinderGeometry(1.6, 1.7, STAGE_HEIGHT, 48), mat(0xffffff, { roughness: 0.5 }), { y: STAGE_HEIGHT / 2 });
    top.userData.part = 'stage';
    g.add(top);
    const skirt = mesh(new THREE.CylinderGeometry(1.705, 1.705, STAGE_HEIGHT * 0.7, 48, 1, true), shiny(0x7b5cff), { y: STAGE_HEIGHT * 0.38 });
    skirt.userData.part = 'stage';
    g.add(skirt);
    g.add(mesh(new THREE.TorusGeometry(1.62, 0.05, 8, 64), gold(), { y: STAGE_HEIGHT, rx: Math.PI / 2 }));
    const star = mesh(new THREE.CircleGeometry(0.9, 5), mat(0xffe14d, { roughness: 0.6 }), { y: STAGE_HEIGHT + 0.005, rx: -Math.PI / 2, rz: Math.PI / 2 });
    star.geometry = new THREE.ShapeGeometry(starShape(5, 0.9, 0.42));
    star.castShadow = false;
    g.add(star);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe28a, emissiveIntensity: 0.8 });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const b = mesh(new THREE.SphereGeometry(0.07, 10, 8), bulbMat.clone(), { x: Math.sin(a) * 1.71, y: STAGE_HEIGHT * 0.45, z: Math.cos(a) * 1.71, shadow: false });
      b.userData.phase = i * 0.7;
      this.bulbs.push(b);
      g.add(b);
    }

    // curtains: wavy red drapes and a scalloped valance
    const drape = (width, height) => {
      const geo = new THREE.PlaneGeometry(width, height, 40, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 9) * 0.09);
      geo.computeVertexNormals();
      return geo;
    };
    const red = mat(0xff3f6c, { roughness: 0.7, side: THREE.DoubleSide });
    const back = new THREE.Group();
    back.position.set(0, 0, -1.45);
    back.add(mesh(drape(3.6, 4.4), mat(0xb44dff, { roughness: 0.8, side: THREE.DoubleSide }), { y: 2.2, z: -0.1 }));
    for (const side of [-1, 1]) {
      const c = mesh(drape(1.0, 4.4), red, { x: side * 1.55, y: 2.2, z: 0.05 });
      back.add(c);
      back.add(mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 20), gold(), { x: side * 1.55, y: 1.4, z: 0.15 }));
    }
    back.add(mesh(drape(3.9, 0.6), red, { y: 4.3, z: 0.12 }));
    for (let i = 0; i < 6; i++) back.add(mesh(new THREE.SphereGeometry(0.17, 12, 8), red, { x: -1.6 + i * 0.64, y: 3.98, z: 0.14, s: [1.2, 0.8, 0.5] }));
    const signStar = mesh(starGeometry(0.45, 0.22, 0.12, 0.05), shiny(0xffe14d, { emissive: 0xffb000, emissiveIntensity: 0.6 }), { y: 4.75, z: 0.2 });
    this.signStar = signStar;
    back.add(signStar);
    g.add(back);

    // spotlights + visible beams (only lit during the show)
    this.spots = [];
    this.beams = [];
    const target = new THREE.Object3D();
    target.position.set(0, 0.8, 0.1);
    g.add(target);
    for (const side of [-1, 1]) {
      const spot = new THREE.SpotLight(0xfff1c4, 0, 12, 0.42, 0.6, 1.2);
      spot.position.set(side * 1.9, 6.2, 1.8);
      spot.target = target;
      g.add(spot);
      this.spots.push(spot);
      const beamGeo = new THREE.ConeGeometry(1.0, 6, 32, 1, true);
      beamGeo.translate(0, -3, 0);
      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      beam.position.copy(spot.position);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0.8, 0.1).sub(spot.position).normalize());
      beam.visible = false;
      g.add(beam);
      this.beams.push(beam);
    }
    this.stage = g;
    this.group.add(g);
  }

  buildDecor() {
    // bunting along the back wall
    const colors = [0xff5fa2, 0xffe14d, 0x4fc3ff, 0x5be37a, 0xff9a3d, 0xa77bff];
    const flag = new THREE.Shape();
    flag.moveTo(-0.28, 0);
    flag.lineTo(0.28, 0);
    flag.lineTo(0, -0.5);
    const flagGeo = new THREE.ShapeGeometry(flag);
    for (let i = 0; i < 20; i++) {
      const x = -7.2 + i * 0.76;
      const y = 6.1 - Math.sin((i / 19) * Math.PI) * 0.45;
      this.group.add(mesh(flagGeo, mat(colors[i % colors.length], { side: THREE.DoubleSide }), { x, y, z: D_BACK + 0.08, shadow: false }));
    }
    // balloons by the stage
    const string = new THREE.LineBasicMaterial({ color: 0x999999 });
    for (const [x, z, c] of [[6.3, -2.2, 0xff5fa2], [6.9, -1.5, 0x4fc3ff], [6.6, -2.8, 0xffe14d], [2.4, -2.9, 0x5be37a]]) {
      const b = new THREE.Group();
      b.position.set(x, 3.6, z);
      b.add(mesh(new THREE.SphereGeometry(0.42, 24, 16), shiny(c), { s: [1, 1.15, 1] }));
      b.add(mesh(new THREE.ConeGeometry(0.08, 0.12, 10), shiny(c), { y: -0.5, rx: Math.PI }));
      b.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.55, 0), new THREE.Vector3(0.1, -3.6, 0)]), string));
      b.userData.phase = x * 1.3;
      this.balloons.push(b);
      this.group.add(b);
    }
    // a big soft plant pot on the left floor
    const pot = new THREE.Group();
    pot.position.set(-2.4, 0, -2.6);
    pot.add(mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.6, 20), shiny(0x4fc3ff), { y: 0.3 }));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      pot.add(mesh(new THREE.SphereGeometry(0.28, 12, 10), mat(0x5be37a), { x: Math.cos(a) * 0.2, y: 0.95 + (i % 3) * 0.18, z: Math.sin(a) * 0.2, s: [0.8, 1.3, 0.8] }));
    }
    this.group.add(pot);
  }

  /** 0 = normal dressing room, 1 = full show lighting. */
  setShowAmount(v) {
    this.showAmount = v;
    for (const s of this.spots) s.intensity = v * 90;
    for (const b of this.beams) {
      b.visible = v > 0.01;
      b.material.opacity = v * 0.16;
    }
  }

  update(dt, time) {
    const m = settings.reducedMotion ? 0.25 : 1;
    for (const b of this.bulbs) {
      b.material.emissiveIntensity = 0.7 + Math.sin(time * (2 + this.showAmount * 4) + b.userData.phase) * 0.45 * (0.4 + this.showAmount);
    }
    for (const b of this.balloons) {
      b.position.y = 3.6 + Math.sin(time * 0.8 + b.userData.phase) * 0.12 * m;
      b.rotation.z = Math.sin(time * 0.6 + b.userData.phase) * 0.05 * m;
    }
    this.signStar.rotation.y = Math.sin(time * 0.7) * 0.4 * m;
    for (const item of this.tappables) {
      if (item.userData.bounce > 0) {
        item.userData.bounce = Math.max(0, item.userData.bounce - dt * 2);
        const b = item.userData.bounce;
        item.position.y = item.userData.baseY + Math.sin(b * Math.PI) * 0.25 * m;
      }
    }
  }
}

