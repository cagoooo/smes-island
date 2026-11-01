// 島上的可走地面：把島嶼實際幾何投影到網格標出障礙，再用 A* 找路，人物才不會穿牆
import { outline } from './base.js';
import { mats } from './materials.js';

const CELL = 0.4;
const LOW = 0.3; // 跨得過的高度（草皮、踏石）
const HIGH = 1.9; // 鑽得過的高度（樹冠、屋簷）
const CLIMB = 0.6; // 相鄰格子可接受的高低差
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

function segDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return qx * qx + qz * qz;
}

// 格子中心是否落在三角形投影內，或離三角形邊緣很近（細長的牆面、燈柱）
function nearTri(px, pz, ax, az, bx, bz, cx, cz, rr) {
  const d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
  const d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz);
  const d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az);
  if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
  return segDist2(px, pz, ax, az, bx, bz) < rr || segDist2(px, pz, bx, bz, cx, cz) < rr || segDist2(px, pz, cx, cz, ax, az) < rr;
}

export class NavGrid {
  constructor(def, terrain, anchors, { floor = null, clear = null, keepOut = [] } = {}) {
    this.half = Math.ceil((def.r * 1.1) / CELL);
    this.n = this.half * 2 + 1;
    const size = this.n * this.n;
    this.floor = floor;
    this.height = new Float32Array(size);
    this.main = new Uint8Array(size);
    this.clr = new Uint8Array(size);
    this.cost = new Float32Array(size);
    this.from = new Int32Array(size);
    this.seen = new Uint32Array(size);
    this.run = 0;
    const blocked = new Uint8Array(size);
    const open = new Uint8Array(size);
    for (let c = 0; c < size; c++) {
      const x = this.cx(c), z = this.cz(c);
      this.height[c] = floor ? floor(x, z) : 0;
      if (clear?.(x, z)) open[c] = 1;
      const rim = outline(def.r, def.seed, Math.atan2(z, x)) * 0.93;
      if (Math.hypot(x, z) > rim || keepOut.some(([kx, kz, rx, rz]) => ((x - kx) / rx) ** 2 + ((z - kz) / rz) ** 2 < 1)) blocked[c] = 1;
    }
    this.stamp(terrain, blocked, open);
    this.finish(blocked);
    this.spots = [];
    for (let iz = 2; iz < this.n; iz += 5) {
      for (let ix = 2; ix < this.n; ix += 5) {
        const c = iz * this.n + ix;
        if (this.main[c] && this.clr[c] >= 3) this.spots.push({ x: this.cx(c), z: this.cz(c), clr: this.clr[c], look: null, taken: null });
      }
    }
    for (const a of anchors) {
      const c = this.nearest(a.x, a.z);
      if (c >= 0) this.spots.push({ x: this.cx(c), z: this.cz(c), clr: this.clr[c], look: [a.x, a.z], taken: null });
    }
  }

  cx(c) { return ((c % this.n) - this.half) * CELL; }

  cz(c) { return (Math.floor(c / this.n) - this.half) * CELL; }

  cell(x, z) {
    const ix = Math.round(x / CELL) + this.half, iz = Math.round(z / CELL) + this.half;
    return ix < 0 || iz < 0 || ix >= this.n || iz >= this.n ? -1 : iz * this.n + ix;
  }

  y(x, z) { return this.floor ? this.floor(x, z) : 0; }

  free(x, z) {
    const c = this.cell(x, z);
    return c >= 0 && this.main[c] === 1;
  }

  stamp(terrain, blocked, open) {
    const { n, half } = this;
    const rr = (CELL * 0.6) ** 2;
    for (const mesh of terrain.children) {
      const water = mesh.material === mats.water;
      const p = mesh.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 9) {
        const top = Math.max(p[i + 1], p[i + 4], p[i + 7]), low = Math.min(p[i + 1], p[i + 4], p[i + 7]);
        if (!water && top < LOW) continue;
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5], cx = p[i + 6], cz = p[i + 8];
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) / CELL) + half), x1 = Math.min(n - 1, Math.ceil(Math.max(ax, bx, cx) / CELL) + half);
        const z0 = Math.max(0, Math.floor(Math.min(az, bz, cz) / CELL) + half), z1 = Math.min(n - 1, Math.ceil(Math.max(az, bz, cz) / CELL) + half);
        for (let iz = z0; iz <= z1; iz++) {
          for (let ix = x0; ix <= x1; ix++) {
            const c = iz * n + ix;
            if (blocked[c] || open[c]) continue;
            const f = this.height[c];
            if (!water && (top < f + LOW || low > f + HIGH)) continue;
            if (nearTri((ix - half) * CELL, (iz - half) * CELL, ax, az, bx, bz, cx, cz, rr)) blocked[c] = 1;
          }
        }
      }
    }
  }

  // 只保留最大的連通區，再算每格離障礙多遠；貼牆的格子走得過但盡量不走
  finish(blocked) {
    const { n } = this;
    const size = n * n;
    const label = new Int32Array(size);
    let best = 0, bestSize = 0, next = 0;
    const stack = [];
    for (let c = 0; c < size; c++) {
      if (blocked[c] || label[c]) continue;
      next++;
      let count = 0;
      label[c] = next;
      stack.push(c);
      while (stack.length) {
        const a = stack.pop();
        count++;
        for (const b of this.around(a, 4)) {
          if (!blocked[b] && !label[b] && Math.abs(this.height[a] - this.height[b]) <= CLIMB) { label[b] = next; stack.push(b); }
        }
      }
      if (count > bestSize) { bestSize = count; best = next; }
    }
    const queue = [];
    for (let c = 0; c < size; c++) {
      if (label[c] === best) this.main[c] = 1;
      else queue.push(c);
    }
    const dist = new Int16Array(size).fill(-1);
    queue.forEach((c) => { dist[c] = 0; });
    for (let i = 0; i < queue.length; i++) {
      for (const b of this.around(queue[i], 4)) {
        if (dist[b] < 0) { dist[b] = dist[queue[i]] + 1; queue.push(b); }
      }
    }
    for (let c = 0; c < size; c++) this.clr[c] = Math.min(255, Math.max(0, dist[c]));
    this.walkable = bestSize;
  }

  around(c, count) {
    const { n } = this;
    const out = [];
    const ix = c % n, iz = Math.floor(c / n);
    for (let i = 0; i < count; i++) {
      const x = ix + DIRS[i][0], z = iz + DIRS[i][1];
      if (x >= 0 && z >= 0 && x < n && z < n) out.push(z * n + x);
    }
    return out;
  }

  nearest(x, z) {
    const { n, half } = this;
    const c0 = this.cell(x, z);
    if (c0 >= 0 && this.main[c0]) return c0;
    const ix = Math.max(0, Math.min(n - 1, Math.round(x / CELL) + half)), iz = Math.max(0, Math.min(n - 1, Math.round(z / CELL) + half));
    for (let r = 1; r < n; r++) {
      let best = -1, bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const a = ix + dx, b = iz + dz;
          if (a < 0 || b < 0 || a >= n || b >= n || !this.main[b * n + a]) continue;
          const d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; best = b * n + a; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // A*：貼牆的格子加一點成本，路線會自然走在空地中間
  find(ax, az, bx, bz) {
    const s = this.nearest(ax, az), g = this.nearest(bx, bz);
    if (s < 0 || g < 0) return [[bx, bz]];
    const { n, cost, from, seen, clr, height, main } = this;
    const run = ++this.run;
    const gx = g % n, gz = Math.floor(g / n);
    const hOf = (c) => Math.hypot((c % n) - gx, Math.floor(c / n) - gz);
    const heap = [];
    const push = (c, f) => {
      let i = heap.length;
      heap.push([f, c]);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= f) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    cost[s] = 0; seen[s] = run; from[s] = -1;
    push(s, hOf(s));
    while (heap.length) {
      const [f, c] = pop();
      if (c === g) break;
      if (f - hOf(c) > cost[c] + 1e-3) continue;
      const ix = c % n, iz = Math.floor(c / n);
      for (const [dx, dz, w] of DIRS) {
        const x = ix + dx, z = iz + dz;
        if (x < 0 || z < 0 || x >= n || z >= n) continue;
        const b = z * n + x;
        if (!main[b] || Math.abs(height[b] - height[c]) > CLIMB) continue;
        if (dx && dz && (!main[iz * n + x] || !main[z * n + ix])) continue;
        const next = cost[c] + w + (clr[b] < 2 ? 2 : clr[b] < 3 ? 0.5 : 0);
        if (seen[b] === run && next >= cost[b]) continue;
        seen[b] = run; cost[b] = next; from[b] = c;
        push(b, next + hOf(b));
      }
    }
    if (seen[g] !== run) return [[bx, bz]];
    const raw = [];
    for (let c = g; c >= 0; c = from[c]) raw.push([this.cx(c), this.cz(c)]);
    raw.reverse();
    return this.smooth(raw);
  }

  sight(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.ceil(d / 0.2);
    let prev = this.y(a[0], a[1]);
    for (let i = 1; i <= steps; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / steps, z = a[1] + ((b[1] - a[1]) * i) / steps;
      const c = this.cell(x, z);
      if (c < 0 || !this.main[c] || this.clr[c] < 2) return false;
      const y = this.y(x, z);
      if (Math.abs(y - prev) > CLIMB * 0.6) return false;
      prev = y;
    }
    return true;
  }

  smooth(raw) {
    const out = [raw[0]];
    let i = 0;
    while (i < raw.length - 1) {
      let j = i + 1;
      while (j + 1 < raw.length && this.sight(raw[i], raw[j + 1])) j++;
      out.push(raw[j]);
      i = j;
    }
    return out;
  }
}

// 一段可以沿著走的路線；點上記錄所屬的島，才能跟著島一起上下漂浮
export class Trail {
  constructor() { this.reset(); }

  reset() { this.pts = []; this.len = 0; this.marks = []; }

  add(x, y, z, a, b = a, w = 0) {
    const last = this.pts[this.pts.length - 1];
    const s = last ? last.s + Math.hypot(x - last.x, y - last.y, z - last.z) : 0;
    this.pts.push({ x, y, z, a, b, w, s });
    this.len = s;
  }

  at(s, out, bobs) {
    const { pts } = this;
    let lo = 0, hi = pts.length - 1;
    const v = Math.max(0, Math.min(this.len, s));
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (pts[m].s <= v) lo = m; else hi = m;
    }
    const p = pts[lo], q = pts[hi];
    const u = q.s > p.s ? (v - p.s) / (q.s - p.s) : 0;
    const bp = bobs[p.a] * (1 - p.w) + bobs[p.b] * p.w, bq = bobs[q.a] * (1 - q.w) + bobs[q.b] * q.w;
    out.x = p.x + (q.x - p.x) * u;
    out.y = p.y + (q.y - p.y) * u + bp + (bq - bp) * u;
    out.z = p.z + (q.z - p.z) * u;
    return out;
  }
}
