// 手作微縮模型的幾何工具：把零件依材質合併成單一網格，降低繪製呼叫
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mats } from './materials.js';

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

const color = new THREE.Color();
const base = new THREE.Color();

// 共用的基本形，避免重複配置
const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make().toNonIndexed());
  return geoCache.get(key);
}

export const G = {
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (seg = 8, top = 1) => cached(`cyl${seg}_${top}`, () => new THREE.CylinderGeometry(top, 1, 1, seg, 1)),
  cone: (seg = 6) => cached(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg, 1)),
  ico: (d = 0) => cached(`ico${d}`, () => new THREE.IcosahedronGeometry(1, d)),
  sphere: (w = 8, h = 6) => cached(`sph${w}${h}`, () => new THREE.SphereGeometry(1, w, h)),
  torus: (seg = 16, tube = 0.12, arc = 1) => cached(`tor${seg}_${tube}_${arc}`, () => new THREE.TorusGeometry(1, tube, 6, seg, Math.PI * 2 * arc)),
  prism: () => cached('prism', () => {
    // 三角柱屋頂：底寬 1、高 1、長 1
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, -0.5);
    return g;
  }),
};

export class Kit {
  constructor(seed = 1) {
    this.r = makeRng(seed);
    this.layers = { solid: [], glow: [], water: [] };
    this.stack = [new THREE.Matrix4()];
    this.anchors = [];
    this.doors = [];
  }

  rand(a = 1, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + (b - a) * this.r();
  }

  pick(list) { return list[Math.floor(this.r() * list.length)]; }

  at(x, y, z, ry, s, fn) {
    if (typeof ry === 'function') { fn = ry; ry = 0; s = 1; }
    if (typeof s === 'function') { fn = s; s = 1; }
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
      new THREE.Vector3(s, s, s),
    );
    this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m));
    fn();
    this.stack.pop();
    return this;
  }

  add(geo, hex, o = {}) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, sway = 0, layer = 'solid', ao = 0.8, wonk = 0.012, jitter = 0.035 } = o;
    const g = geo.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    );
    g.applyMatrix4(m);
    g.applyMatrix4(this.stack[this.stack.length - 1]);
    const pos = g.attributes.position;
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const v = pos.getY(i);
      ymin = Math.min(ymin, v); ymax = Math.max(ymax, v);
    }
    const span = Math.max(ymax - ymin, 1e-4);
    // 頂點輕微歪斜，做出手工裁切的不完美感
    if (wonk) {
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const k = (a) => (hash(px * 3.1 + a, py * 3.3, pz * 3.7) - 0.5) * wonk * 2;
        pos.setXYZ(i, px + k(1) * 3, py + k(2) * 3, pz + k(3) * 3);
      }
    }
    g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    g.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3);
    const swayAttr = new Float32Array(pos.count);
    base.set(hex);
    for (let i = 0; i < pos.count; i += 3) {
      const j = 1 + (this.r() - 0.5) * jitter * 2;
      for (let v = 0; v < 3; v++) {
        const t = (pos.getY(i + v) - ymin) / span;
        const shade = ao + (1 - ao) * Math.min(1, t * 1.6);
        color.copy(base).multiplyScalar(j * shade);
        colors.set([color.r, color.g, color.b], (i + v) * 3);
        swayAttr[i + v] = sway * t;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aSway', new THREE.BufferAttribute(swayAttr, 1));
    this.layers[layer].push(g);
    return this;
  }

  box(w, h, d, hex, x = 0, y = 0, z = 0, o = {}) {
    return this.add(G.box(), hex, { x, y: y + h / 2, z, sx: w, sy: h, sz: d, ...o });
  }

  cyl(rb, h, hex, x = 0, y = 0, z = 0, o = {}) {
    const { rt = rb, seg = 8, ...rest } = o;
    const top = Math.round((rt / rb) * 100) / 100;
    return this.add(G.cyl(seg, top), hex, { x, y: y + h / 2, z, sx: rb, sy: h, sz: rb, ...rest });
  }

  cone(r, h, hex, x = 0, y = 0, z = 0, o = {}) {
    const { seg = 6, ...rest } = o;
    return this.add(G.cone(seg), hex, { x, y: y + h / 2, z, sx: r, sy: h, sz: r, ...rest });
  }

  ball(r, hex, x = 0, y = 0, z = 0, o = {}) {
    const { detail = 0, sy = 1, sx = 1, sz = 1, ...rest } = o;
    return this.add(G.ico(detail), hex, { x, y, z, sx: r * sx, sy: r * sy, sz: r * sz, wonk: 0.03, ...rest });
  }

  roof(w, h, d, hex, x = 0, y = 0, z = 0, o = {}) {
    return this.add(G.prism(), hex, { x, y, z, sx: w, sy: h, sz: d, ao: 0.92, ...o });
  }

  glow(w, h, d, hex, x = 0, y = 0, z = 0, o = {}) {
    return this.box(w, h, d, hex, x, y, z, { layer: 'glow', wonk: 0, ao: 1, jitter: 0.02, ...o });
  }

  // 自訂幾何（已是世界比例）直接併入
  raw(geo, hex, o = {}) {
    return this.add(geo.index ? geo.toNonIndexed() : geo, hex, o);
  }

  // 登記互動定位點
  spot(x, y, z) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(this.stack[this.stack.length - 1]);
    this.anchors.push(v);
    return this;
  }

  // 登記房屋門口：颱風來時島上的人跑到這裡進屋躲雨
  door(x, y, z) {
    this.doors.push(new THREE.Vector3(x, y, z).applyMatrix4(this.stack[this.stack.length - 1]));
    return this;
  }

  point(x, y, z) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.stack[this.stack.length - 1]);
  }

  build() {
    const group = new THREE.Group();
    for (const [name, parts] of Object.entries(this.layers)) {
      if (!parts.length) continue;
      const geo = mergeGeometries(parts, false);
      parts.forEach((p) => p.dispose());
      const mesh = new THREE.Mesh(geo, mats[name]);
      mesh.castShadow = name === 'solid';
      mesh.receiveShadow = name !== 'glow';
      group.add(mesh);
    }
    return group;
  }
}
