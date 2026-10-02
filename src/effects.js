// Little celebratory particles: sparkles, hearts, confetti and music notes.

import * as THREE from 'three';
import { heartGeometry, starGeometry, settings } from './util.js';

const COLORS = [0xff5fa2, 0xffe14d, 0x4fc3ff, 0x5be37a, 0xff9a3d, 0xa77bff];

function noteGeometry() {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 0.13, 0.1, 0, Math.PI * 2, false, 0.3);
  const stem = new THREE.Shape();
  stem.moveTo(0.1, 0.02);
  stem.lineTo(0.14, 0.02);
  stem.lineTo(0.14, 0.5);
  stem.quadraticCurveTo(0.3, 0.42, 0.32, 0.25);
  stem.quadraticCurveTo(0.26, 0.38, 0.14, 0.4);
  stem.lineTo(0.1, 0.5);
  return new THREE.ExtrudeGeometry([shape, stem], { depth: 0.04, bevelEnabled: false });
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.geos = {
      sparkle: starGeometry(0.12, 0.05, 0.03, 0.02),
      star: starGeometry(0.2, 0.09, 0.05, 0.03),
      heart: heartGeometry(0.22, 0.08),
      confetti: new THREE.PlaneGeometry(0.12, 0.2),
      note: noteGeometry(),
    };
    this.mats = new Map();
  }

  material(type, color) {
    const key = `${type}-${color}`;
    if (!this.mats.has(key)) {
      const glow = type === 'sparkle' || type === 'star';
      this.mats.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: glow ? 0.9 : 0.35,
          roughness: 0.4,
          side: THREE.DoubleSide,
          transparent: true,
        }),
      );
    }
    return this.mats.get(key).clone();
  }

  spawn(type, position, { color, velocity, life = 1.2, spin = 3, gravity = -2, scale = 1, drag = 0.98 }) {
    const m = new THREE.Mesh(this.geos[type], this.material(type, color));
    m.position.copy(position);
    m.scale.setScalar(scale);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    if (type === 'heart' || type === 'note') m.rotation.set(0, 0, (Math.random() - 0.5) * 0.4);
    this.scene.add(m);
    this.items.push({ m, v: velocity.clone(), life, age: 0, spin: type === 'heart' || type === 'note' ? 0 : spin, gravity, scale, drag, type });
  }

  sparkles(pos, count = 14) {
    const n = settings.reducedMotion ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.5).normalize();
      const speed = settings.reducedMotion ? 0.6 : 1.6 + Math.random() * 1.4;
      this.spawn(i % 3 ? 'sparkle' : 'star', pos, {
        color: COLORS[i % COLORS.length],
        velocity: dir.multiplyScalar(speed),
        life: 0.9 + Math.random() * 0.4,
        gravity: -1.5,
        spin: settings.reducedMotion ? 0 : 5,
        drag: 0.94,
      });
    }
  }

  hearts(pos, count = 9) {
    const n = settings.reducedMotion ? 3 : count;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.2 + Math.random() * 1.2, (Math.random() - 0.2) * 0.8);
      if (settings.reducedMotion) v.set((i - 1) * 0.4, 0.7, 0.2);
      this.spawn('heart', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, 0)), {
        color: i % 3 === 0 ? 0xff8fc8 : 0xff3f7f,
        velocity: v,
        life: 2.2,
        gravity: 0.15,
        scale: 0.8 + Math.random() * 0.7,
        drag: 0.985,
      });
    }
  }

  confetti(pos, count = 70, spread = 2.5) {
    const n = settings.reducedMotion ? 12 : count;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * spread * 2, 3 + Math.random() * 3, (Math.random() - 0.3) * spread);
      if (settings.reducedMotion) v.set((Math.random() - 0.5) * 1.2, -0.4, 0.2);
      const start = settings.reducedMotion ? pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random(), 0)) : pos;
      this.spawn('confetti', start, {
        color: COLORS[i % COLORS.length],
        velocity: v,
        life: 3 + Math.random(),
        gravity: settings.reducedMotion ? -0.2 : -4.5,
        spin: settings.reducedMotion ? 0.5 : 8,
        drag: 0.965,
      });
    }
  }

  notes(pos, count = 4) {
    const n = settings.reducedMotion ? 2 : count;
    for (let i = 0; i < n; i++) {
      this.spawn('note', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 0.5, 0.4)), {
        color: COLORS[(i * 2 + 1) % COLORS.length],
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.5, 0),
        life: 1.6,
        gravity: 0.1,
        scale: 1.4,
        drag: 0.99,
      });
    }
  }

  update(dt) {
    const k = Math.min(dt, 0.05);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += k;
      p.v.y += p.gravity * k;
      p.v.multiplyScalar(Math.pow(p.drag, k * 60));
      p.m.position.addScaledVector(p.v, k);
      p.m.rotation.x += p.spin * k;
      p.m.rotation.y += p.spin * 1.3 * k;
      if (p.type === 'heart' || p.type === 'note') p.m.rotation.z = Math.sin(p.age * 4) * 0.25;
      const life = p.age / p.life;
      const pop = Math.min(1, p.age * 8);
      p.m.scale.setScalar(p.scale * pop * (life > 0.8 ? 1 - (life - 0.8) * 5 : 1));
      p.m.material.opacity = life > 0.7 ? 1 - (life - 0.7) / 0.3 : 1;
      if (p.age >= p.life || p.m.position.y < -0.5) {
        this.scene.remove(p.m);
        p.m.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
