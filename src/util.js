import * as THREE from 'three';

export const settings = {
  reducedMotion: false,
  muted: false,
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOut = (t) => 1 - (1 - t) ** 3;
export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
export function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts });
}

export function shiny(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.25,
    metalness: 0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
    ...opts,
  });
}

export function gold(opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0xffc83d,
    roughness: 0.3,
    metalness: 0.65,
    emissive: 0x6b4100,
    emissiveIntensity: 0.25,
    ...opts,
  });
}

export function mesh(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (typeof s === 'number') m.scale.setScalar(s);
  else m.scale.set(s[0], s[1], s[2]);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

export function starShape(points = 5, outer = 1, inner = 0.5) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** A chunky, rounded star: the bevel softens the points. */
export function starGeometry(outer = 1, inner = 0.5, depth = 0.2, bevel = 0.08) {
  const geo = new THREE.ExtrudeGeometry(starShape(5, outer, inner), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

export function heartShape(size = 1) {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.9 * s);
  shape.bezierCurveTo(-0.15 * s, -0.75 * s, -1.0 * s, -0.25 * s, -1.0 * s, 0.25 * s);
  shape.bezierCurveTo(-1.0 * s, 0.75 * s, -0.4 * s, 0.95 * s, 0, 0.5 * s);
  shape.bezierCurveTo(0.4 * s, 0.95 * s, 1.0 * s, 0.75 * s, 1.0 * s, 0.25 * s);
  shape.bezierCurveTo(1.0 * s, -0.25 * s, 0.15 * s, -0.75 * s, 0, -0.9 * s);
  return shape;
}

export function heartGeometry(size = 1, depth = 0.3) {
  const geo = new THREE.ExtrudeGeometry(heartShape(size), {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.12 * size,
    bevelSize: 0.12 * size,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

export function canvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.anisotropy = 4;
  return tex;
}

export const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

/**
 * Tiny tween runner. `tween(duration, fn)` calls fn(t in 0..1) each frame and
 * resolves when finished. All game animation goes through here so reduced
 * motion and the frame clock stay in one place.
 */
export class Tweens {
  constructor() {
    this.items = new Set();
  }

  tween(duration, fn, { ease = (t) => t } = {}) {
    return new Promise((resolve) => {
      const item = { t: 0, duration: Math.max(0.001, duration), fn, ease, resolve };
      this.items.add(item);
      fn(0);
    });
  }

  wait(duration) {
    return this.tween(duration, () => {});
  }

  update(dt) {
    for (const item of [...this.items]) {
      item.t = Math.min(1, item.t + dt / item.duration);
      item.fn(item.ease(item.t));
      if (item.t >= 1) {
        this.items.delete(item);
        item.resolve();
      }
    }
  }
}

export const tweens = new Tweens();

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
  });
}
