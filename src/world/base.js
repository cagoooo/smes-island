// 浮空島基座：草皮、古石牆、岩層、倒懸岩柱、垂根與瀑布
import * as THREE from 'three';
import { Kit, G } from './kit.js';
import { fallMat } from './materials.js';

const noise1 = (a, seed) => Math.sin(a * 3 + seed) * 0.055 + Math.sin(a * 5 + seed * 1.7) * 0.04 + Math.sin(a * 9 + seed * 2.3) * 0.02;

export function outline(r, seed, a) {
  return r * (1 + noise1(a, seed));
}

function tri(positions, a, b, c) { positions.push(...a, ...b, ...c); }

// 頂面草皮：放射網格，邊緣向下捲出草緣
function grassTop(kit, r, seed, colors) {
  const N = 40;
  const rings = [0, 0.36, 0.68, 0.9, 1];
  const pts = rings.map((f) => {
    const row = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const rr = outline(r, seed, a) * f;
      const y = f >= 1 ? 0 : (kit.r() - 0.5) * 0.06;
      row.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
    }
    return row;
  });
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const part = [];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const a = pts[ring][i], b = pts[ring][j], c = pts[ring + 1][j], d = pts[ring + 1][i];
      if (ring === 0) {
        tri(part, [0, 0, 0], c, d);
      } else {
        tri(part, a, c, d); tri(part, a, b, c);
      }
    }
    for (let t = 0; t < part.length; t += 9) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(part.slice(t, t + 9), 3));
      kit.add(g, kit.pick(colors), { wonk: 0, ao: 1, jitter: 0.012 });
    }
  }
  // 草緣：鋸齒狀垂落
  const lip = [];
  const low = [];
  for (let i = 0; i < N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2;
    const rr = outline(r, seed, a);
    lip.push([Math.cos(a) * rr, 0, Math.sin(a) * rr]);
    const drop = i % 2 ? 0.38 + kit.r() * 0.22 : 0.9 + kit.r() * 0.75;
    low.push([Math.cos(a) * rr * 1.012, -drop, Math.sin(a) * rr * 1.012]);
  }
  const verts = [];
  for (let i = 0; i < lip.length; i++) {
    const j = (i + 1) % lip.length;
    tri(verts, lip[i], lip[j], low[i]); tri(verts, lip[j], low[j], low[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  kit.add(g, colors[0], { wonk: 0, ao: 0.62 });
}

// 古代城牆：一圈圈切割石塊
function stoneWall(kit, r, seed, h, stones) {
  const rows = Math.max(2, Math.round(h / 0.72));
  const rh = h / rows;
  for (let row = 0; row < rows; row++) {
    const y = -0.28 - rh * (row + 1);
    const f = 1 - row * 0.012;
    const count = Math.round((Math.PI * 2 * r) / 1.55);
    for (let i = 0; i < count; i++) {
      const a = ((i + (row % 2) * 0.5) / count) * Math.PI * 2;
      const rr = outline(r, seed, a) * f * 0.985;
      const w = (Math.PI * 2 * rr) / count * 0.96;
      kit.add(G.box(), kit.pick(stones), {
        x: Math.cos(a) * rr, y: y + rh / 2, z: Math.sin(a) * rr, ry: -a + Math.PI / 2,
        sx: w, sy: rh * 0.93, sz: 0.62 + kit.r() * 0.3, wonk: 0.02, ao: 0.86,
      });
    }
  }
  // 牆內填實的暗色核心
  kit.cyl(r * 0.94, h + 0.18, stones[stones.length - 1], 0, -h - 0.28, 0, { seg: 24, wonk: 0 });
  return h + 0.28;
}

// 岩層：往下收窄並帶地層色帶
function rockBody(kit, r, seed, top, depth, strata) {
  const N = 22;
  const K = 7;
  const rings = [];
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    const row = [];
    const f = Math.pow(1 - t, 0.72) * 0.94 + 0.012;
    const y = -top - depth * Math.pow(t, 0.9);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + k * 0.17;
      const rr = outline(r, seed, a) * f * (1 + (kit.r() - 0.5) * 0.22 * (0.4 + t));
      row.push([Math.cos(a) * rr, y + (kit.r() - 0.5) * (depth / K) * 0.4, Math.sin(a) * rr]);
    }
    rings.push(row);
  }
  for (let k = 0; k < K; k++) {
    const verts = [];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      tri(verts, rings[k][i], rings[k][j], rings[k + 1][j]);
      tri(verts, rings[k][i], rings[k + 1][j], rings[k + 1][i]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    kit.add(g, strata[k % strata.length], { wonk: 0, ao: 0.72, jitter: 0.05 });
  }
  // 倒懸岩柱
  const n = Math.round(r * 1.2);
  for (let i = 0; i < n; i++) {
    const a = kit.rand(Math.PI * 2);
    const rr = r * kit.rand(0.15, 0.72);
    const len = kit.rand(depth * 0.25, depth * 0.62);
    kit.add(G.cone(5), kit.pick(strata), {
      x: Math.cos(a) * rr, y: -top - depth * (1 - rr / r) * 0.72 - len / 2, z: Math.sin(a) * rr,
      rx: Math.PI, sx: kit.rand(0.5, 1.2), sy: len, sz: kit.rand(0.5, 1.2), wonk: 0.04, ao: 0.74,
    });
  }
}

// 垂根：沿外緣往下垂的根與藤
function roots(kit, r, seed, top, colors) {
  const n = Math.round(r * 1.1);
  for (let i = 0; i < n; i++) {
    const a = kit.rand(Math.PI * 2);
    const rr = outline(r, seed, a) * 0.98;
    const len = kit.rand(3, 9.5);
    const p0 = new THREE.Vector3(Math.cos(a) * rr, -0.4, Math.sin(a) * rr);
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const curve = new THREE.CatmullRomCurve3([
      p0,
      p0.clone().addScaledVector(out, 0.5).add(new THREE.Vector3(0, -top * 0.7, 0)),
      p0.clone().addScaledVector(out, kit.rand(-0.4, 0.7)).add(new THREE.Vector3(kit.rand(-0.5, 0.5), -len * 0.65, kit.rand(-0.5, 0.5))),
      p0.clone().addScaledVector(out, kit.rand(-1.2, 0.3)).add(new THREE.Vector3(kit.rand(-0.8, 0.8), -len, kit.rand(-0.8, 0.8))),
    ]);
    const g = new THREE.TubeGeometry(curve, 7, kit.rand(0.07, 0.17), 4, false).toNonIndexed();
    kit.add(g, kit.pick(colors), { wonk: 0, sway: -0.5, ao: 1 });
    if (kit.r() > 0.45) {
      const tip = curve.getPoint(0.72);
      kit.ball(kit.rand(0.2, 0.36), '#5f8f3e', tip.x, tip.y, tip.z, { sway: -0.5 });
    }
  }
}

// 懸浮碎石
export function floatingRock(kit, x, y, z, s, grass, strata) {
  kit.at(x, y, z, kit.rand(6), s, () => {
    kit.cyl(1.1, 0.26, grass, 0, -0.26, 0, { seg: 7 });
    kit.cone(1.05, 1.9, strata, 0, -0.26, 0, { seg: 7, rx: Math.PI, y: -1.21, ao: 0.74 });
  });
}

// 瀑布：從島緣流出、向下跌入雲海
export function waterfall(x, y, z, angle, w, h) {
  const seg = 18;
  const pos = [], uv = [], idx = [];
  const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const outward = Math.pow(Math.min(t * 5, 1), 0.6) * 1.15 + t * 1.2;
    const down = t * t * 0.25 * h + t * h * 0.75;
    const ww = w * (1 + t * 0.55);
    const c = new THREE.Vector3(x, y - down, z).addScaledVector(dir, outward);
    const a = c.clone().addScaledVector(side, -ww / 2);
    const b = c.clone().addScaledVector(side, ww / 2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, t * 3, 1, t * 3);
    if (i < seg) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // uv.y 需在片段內視為 0–1
  const uvs = g.attributes.uv;
  for (let i = 0; i < uvs.count; i++) uvs.setY(i, uvs.getY(i) / 3);
  const m = new THREE.Mesh(g, fallMat);
  m.renderOrder = 2;
  return m;
}

const palettes = {
  green: { grass: ['#93b553', '#97b956', '#90b250', '#9abc59'], stone: ['#b9a98f', '#a99a82', '#c4b59b', '#9b8c76', '#756a5a'], strata: ['#a5805a', '#8d6a49', '#b2906a', '#7a5b42'] },
  moss: { grass: ['#82a954', '#86ad57', '#7fa652', '#8ab05a'], stone: ['#a7a692', '#979884', '#b6b49f', '#8a8a78', '#68685a'], strata: ['#8e7a62', '#796752', '#a08a70', '#6a5a48'] },
  amber: { grass: ['#adb45c', '#b1b85f', '#a9b05a', '#b5bb62'], stone: ['#c9b08a', '#b89f7a', '#d4bd97', '#a78f6c', '#83704f'], strata: ['#b98a58', '#a27548', '#c79a68', '#8c6240'] },
  teal: { grass: ['#83b079', '#87b47c', '#7fac76', '#8bb87f'], stone: ['#a9b0a4', '#99a195', '#b8bfb2', '#8a9186', '#646b60'], strata: ['#8b8676', '#777365', '#9c9786', '#666254'] },
};

export function makeBase(kit, { r, seed, palette = 'green', wall = 2, depth = 12 }) {
  const p = palettes[palette];
  grassTop(kit, r, seed, p.grass);
  const top = stoneWall(kit, r, seed, wall, p.stone);
  rockBody(kit, r, seed, top, depth, p.strata);
  roots(kit, r, seed, top, ['#5b4330', '#6a4f38', '#4c3829']);
  return p;
}

export const newKit = (seed) => new Kit(seed);
