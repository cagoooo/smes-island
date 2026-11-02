// 島上的老師與學生：分隊走路、過吊橋、跳踏石，抵達後上課、傳球、玩鬼抓人或坐下看書；下雨撐傘踩水窪，入夜拿手電筒觀星
import * as THREE from 'three';
import { Kit, makeRng } from './kit.js';
import { NavGrid, Trail } from './nav.js';
import { C } from './props.js';
import { ISLANDS, PEOPLE_LINES } from '../data/site.js';

const BODY = {
  student: { hip: 0.34, leg: 1, tor: 1, head: 1, arm: 1 },
  teacher: { hip: 0.476, leg: 1.4, tor: 1.25, head: 0.85, arm: 1.25 },
};
const SHIRTS = ['#f2c230', '#fbf6ea', '#5ea85a', '#e8743b', '#4fa3d1', '#ef8fa3', '#f2c230', '#5ea85a'];
const COATS = ['#2f6f8f', '#9c4f3a', '#4a6b4f', '#7a5a9c', '#b5563c'];
const PANTS = ['#2f4a6b', '#3f5a4a', '#4a4560', '#2f6f53'];
const HAIR = ['#2a2118', '#3b2a1c', '#1f1a16', '#4a3524'];
const PACKS = ['#d9432f', '#3d86c6', '#e3a73b', '#5a9b4e', '#a23f8f'];
const SKIN = ['#ffffff', '#fff3ea', '#f4e2d0'];
const UMBRELLAS = ['#d9432f', '#f2c230', '#3d86c6', '#5ea85a', '#ef8fa3', '#7a5a9c', '#2f9c95', '#e8743b'];
const RAIN_AT = 0.15;
const DARK_AT = 0.5;
const HIDE = -9999;
const names = Object.fromEntries(ISLANDS.map((d) => [d.id, d.name]));

const B = new THREE.Matrix4(), L = new THREE.Matrix4(), O = new THREE.Matrix4();
const E = new THREE.Euler(0, 0, 0, 'YXZ');
const V = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const here = { x: 0, y: 0, z: 0 }, ahead = { x: 0, y: 0, z: 0 };

function part(x, y, z, a, sx = 1, sy = 1, sz = 1) {
  L.makeRotationX(a);
  L.scale(V.set(sx, sy, sz));
  L.setPosition(x, y, z);
  return O.multiplyMatrices(B, L);
}

const turn = (a, b, k) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;

export class People {
  constructor(scene, islands, routes, { classes, groups, solos }) {
    this.islands = islands;
    this.ids = Object.keys(islands);
    this.index = Object.fromEntries(this.ids.map((id, i) => [id, i]));
    this.bobs = new Float32Array(this.ids.length);
    this.r = makeRng(2026);
    this.adj = Object.fromEntries(this.ids.map((id) => [id, []]));
    for (const route of routes) {
      this.adj[route.a].push({ to: route.b, pts: route.pts });
      this.adj[route.b].push({ to: route.a, pts: [...route.pts].reverse() });
    }
    this.queue = [];
    this.list = [];
    this.crews = [];
    this.followed = null;
    this.wet = false;
    this.dark = false;
    this.pace = 1;
    this.spawn(classes, groups, solos);
    this.buildMeshes(scene);
  }

  pick(list) { return list[Math.floor(this.r() * list.length)]; }

  spawn(classes, groups, solos) {
    const stops = ['core', 'library', 'course', 'forest', 'inquiry', 'walk', 'digital', 'results', 'brand', 'teacher', 'admin', 'future'];
    let at = 0;
    const next = () => stops[at++ % stops.length];
    for (let i = 0; i < classes; i++) this.addCrew(next(), ['teacher', 'student', 'student', 'student', 'student', 'student'], 1);
    for (let i = 0; i < groups; i++) this.addCrew(next(), this.r() > 0.5 ? ['student', 'student', 'student'] : ['student', 'student'], 1.25);
    for (let i = 0; i < solos; i++) this.addCrew(next(), [i % 3 === 2 ? 'student' : 'teacher'], 1.1);
    // 打散順序，夜晚與假日留下來的才不會全是同一種隊伍
    const order = this.crews.map((_, i) => i).sort(() => this.r() - 0.5);
    order.forEach((c, i) => { this.crews[c].rank = (i + 0.5) / order.length; });
  }

  addCrew(id, kinds, speed) {
    const r = this.r;
    const nav = this.islands[id].nav;
    const spot = this.pick(nav.spots.filter((s) => !s.taken));
    const g = this.islands[id].group.position;
    const c = { id: this.crews.length, here: id, to: id, spot, speed, trail: new Trail(), s: 0, state: 'wait', timer: r() * 7, act: null, members: [], ball: null, rank: 1, on: true, teacher: kinds[0] === 'teacher', at: { x: spot.x, z: spot.z, id }, pud: 0, fire: 0 };
    spot.taken = c;
    kinds.forEach((kind, i) => {
      const a = r() * 6.28, cell = nav.nearest(spot.x + Math.cos(a) * 0.8, spot.z + Math.sin(a) * 0.8);
      const lx = nav.cx(cell), lz = nav.cz(cell);
      const wx = g.x + lx, wz = g.z + lz, wy = this.islands[id].base + nav.y(lx, lz);
      const p = {
        idx: this.list.length, kind, crew: c, slot: i, body: BODY[kind], s: kind === 'teacher' ? 1.22 : 0.92 + r() * 0.18,
        x: wx, y: wy, z: wz, tx: wx, ty: wy, tz: wz, lx, lz, yaw: r() * 6.28, spd: 0, phase: r() * 6.28, ph: r() * 6.28,
        aL: 0, aR: 0, lL: 0, lR: 0, lift: 0, lean: 0, mode: 'idle', goal: 'idle', face: null, book: false, vis: 1, hidden: false,
        umb: 0, lamp: 0, look: 0, aim: 1.95, sweep: 0, reach: 1, bare: kind === 'student' && r() < 0.2, lit: kind === 'teacher' || r() < 0.8,
      };
      c.members.push(p);
      this.list.push(p);
    });
    this.crews.push(c);
  }

  buildMeshes(scene) {
    const r = this.r;
    const geo = (fn) => { const k = new Kit(77); fn(k); return k.build().children[0].geometry; };
    const inst = (g, count, shadow, mat) => {
      const m = new THREE.InstancedMesh(g, mat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), Math.max(1, count));
      m.frustumCulled = false;
      m.castShadow = shadow;
      for (let i = 0; i < m.count; i++) m.setMatrixAt(i, ZERO);
      scene.add(m);
      return m;
    };
    const n = this.list.length;
    this.torso = inst(geo((k) => k.cyl(0.19, 0.38, '#ffffff', 0, 0, 0, { rt: 0.15, seg: 7, ao: 1, jitter: 0, wonk: 0 })), n, true);
    this.head = inst(geo((k) => {
      k.ball(0.23, C.skin, 0, 0.2, 0, { detail: 1, jitter: 0, wonk: 0 });
      for (const s of [-1, 1]) {
        k.ball(0.034, C.ink, s * 0.085, 0.21, 0.205, { wonk: 0, jitter: 0 });
        k.ball(0.04, '#f0a58e', s * 0.135, 0.135, 0.17, { sy: 0.6, wonk: 0, jitter: 0 });
      }
    }), n, false);
    const shortHair = (k) => k.ball(0.245, '#ffffff', 0, 0.285, -0.045, { detail: 1, sy: 0.78, jitter: 0, wonk: 0, ao: 1 });
    this.hairA = inst(geo(shortHair), n, false);
    this.hairB = inst(geo((k) => {
      shortHair(k);
      k.ball(0.11, '#ffffff', 0, 0.3, -0.27, { sy: 1.4, jitter: 0, wonk: 0, ao: 1 });
      k.ball(0.05, '#ffffff', 0, 0.42, -0.26, { jitter: 0, wonk: 0, ao: 1 });
    }), n, false);
    this.arms = inst(geo((k) => {
      k.cyl(0.058, 0.32, '#ffffff', 0, -0.32, 0, { seg: 5, ao: 1, jitter: 0, wonk: 0 });
      k.ball(0.066, '#ffffff', 0, -0.33, 0, { jitter: 0, wonk: 0, ao: 1 });
    }), n * 2, false);
    this.legs = inst(geo((k) => {
      k.cyl(0.078, 0.3, '#ffffff', 0, -0.3, 0, { seg: 5, ao: 1, jitter: 0, wonk: 0 });
      k.box(0.14, 0.07, 0.22, '#3b2c1d', 0, -0.34, 0.035, { jitter: 0, wonk: 0, ao: 1 });
    }), n * 2, true);
    this.pack = inst(geo((k) => k.box(0.27, 0.31, 0.13, '#ffffff', 0, 0.05, -0.2, { ao: 0.85, jitter: 0 })), n, false);
    this.bookMesh = inst(geo((k) => {
      k.box(0.3, 0.035, 0.22, '#c0392b', 0, 0, 0, { jitter: 0, wonk: 0, ao: 1 });
      k.box(0.27, 0.03, 0.2, C.paper, 0, 0.03, 0, { jitter: 0, wonk: 0, ao: 1 });
    }), n, false);
    this.flagMesh = inst(geo((k) => {
      k.cyl(0.016, 0.62, '#6a5541', 0, -0.92, 0, { seg: 4, jitter: 0, wonk: 0, ao: 1 });
      k.box(0.03, 0.2, 0.32, '#d9432f', 0, -0.92, 0.17, { jitter: 0, wonk: 0, ao: 1 });
    }), n, false);
    this.ballMesh = inst(geo((k) => k.ball(0.13, '#e8743b', 0, 0, 0, { detail: 1, jitter: 0.1, wonk: 0, ao: 1 })), this.crews.length, true);
    const plain = { jitter: 0, wonk: 0, ao: 1 };
    const bright = () => new THREE.MeshBasicMaterial({ vertexColors: true });
    const nc = this.crews.length;
    this.umbrella = inst(geo((k) => {
      k.cyl(0.022, 0.8, '#6a5541', 0, 0, 0, { seg: 4, ...plain });
      k.cone(0.74, 0.3, '#ffffff', 0, 0.62, 0, { seg: 8, ...plain });
      k.ball(0.035, '#ffffff', 0, 0.93, 0, plain);
    }), n, true);
    this.torch = inst(geo((k) => {
      k.cyl(0.036, 0.2, '#3b3f46', 0, 0, 0, { seg: 6, ...plain });
      k.cyl(0.058, 0.07, '#fff2c4', 0, 0.2, 0, { seg: 6, ...plain });
    }), n, false, bright());
    const light = { color: '#ffe9a8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    this.beam = inst(new THREE.ConeGeometry(0.8, 3.4, 12, 1, true).rotateX(Math.PI).translate(0, 1.7, 0), n, false,
      new THREE.MeshBasicMaterial({ ...light, alphaMap: beamTexture(), opacity: 0.34, side: THREE.DoubleSide }));
    this.spot = inst(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), n, false, new THREE.MeshBasicMaterial({ ...light, opacity: 0.3 }));
    this.logs = inst(geo((k) => {
      k.box(0.62, 0.09, 0.12, '#5a3a22', 0, 0, 0, plain);
      k.box(0.12, 0.09, 0.62, '#4a3019', 0, 0.06, 0, plain);
    }), nc, true);
    this.flame = inst(geo((k) => {
      k.cone(0.2, 0.52, '#ff9a2e', 0, 0, 0, { seg: 6, ...plain });
      k.cone(0.11, 0.34, '#ffe68a', 0, 0.02, 0, { seg: 6, ...plain });
    }), nc, false, bright());
    this.puddle = inst(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), nc, false, new THREE.MeshBasicMaterial({ color: '#a9d6ee', transparent: true, opacity: 0.62, depthWrite: false }));
    this.ring = inst(new THREE.RingGeometry(0.91, 1, 18).rotateX(-Math.PI / 2), n, false, new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0.6, depthWrite: false }));
    this.glowAt = new Float32Array(nc * 3).fill(HIDE);
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.BufferAttribute(this.glowAt, 3));
    this.glow = new THREE.Points(shape, new THREE.PointsMaterial({ size: 5, map: glowTexture(), color: '#ffc06a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    this.glow.frustumCulled = false;
    scene.add(this.glow);
    const col = new THREE.Color();
    this.list.forEach((p, i) => {
      const teacher = p.kind === 'teacher';
      const shirt = teacher ? this.pick(COATS) : SHIRTS[i % SHIRTS.length];
      const skin = this.pick(SKIN);
      const pants = col.set(teacher ? '#4a4038' : this.pick(PANTS)).clone();
      this.torso.setColorAt(i, col.set(shirt));
      this.head.setColorAt(i, col.set(skin));
      const hair = col.set(this.pick(HAIR)).clone();
      this.hairA.setColorAt(i, hair);
      this.hairB.setColorAt(i, hair);
      p.hair = r() > 0.5 ? this.hairA : this.hairB;
      p.other = p.hair === this.hairA ? this.hairB : this.hairA;
      // 老師穿長袖，手臂跟著上衣顏色；學生短袖露出皮膚
      const arm = col.set(teacher ? shirt : C.skin).clone();
      this.arms.setColorAt(i * 2, arm);
      this.arms.setColorAt(i * 2 + 1, arm);
      this.legs.setColorAt(i * 2, pants);
      this.legs.setColorAt(i * 2 + 1, pants);
      this.pack.setColorAt(i, col.set(this.pick(PACKS)));
      this.bookMesh.setColorAt(i, col.set(this.pick(['#ffffff', '#ffd9a0', '#bfe3ff', '#c9efc4'])));
      this.flagMesh.setColorAt(i, col.set('#ffffff'));
      this.umbrella.setColorAt(i, col.set(UMBRELLAS[Math.floor(r() * UMBRELLAS.length)]));
    });
    for (let i = 0; i < this.crews.length; i++) this.ballMesh.setColorAt(i, col.set('#ffffff'));
  }

  // ───────── 找路 ─────────
  hops(from, to) {
    if (from === to) return [];
    const prev = { [from]: null };
    const queue = [from];
    while (queue.length) {
      const id = queue.shift();
      if (id === to) break;
      for (const e of this.adj[id]) {
        if (prev[e.to] === undefined) { prev[e.to] = { id, e }; queue.push(e.to); }
      }
    }
    const out = [];
    for (let n = to; prev[n]; n = prev[n].id) out.unshift(prev[n].e);
    return out;
  }

  walkOn(trail, id, ax, az, bx, bz) {
    const is = this.islands[id];
    const i = this.index[id];
    const g = is.group.position;
    let px = ax, pz = az;
    for (const [x, z] of [...is.nav.find(ax, az, bx, bz), [bx, bz]]) {
      // 主島有階梯，路線切細才貼得住地面高度
      const steps = is.nav.floor ? Math.ceil(Math.hypot(x - px, z - pz) / 0.4) : 1;
      for (let s = 1; s <= steps; s++) {
        const lx = px + ((x - px) * s) / steps, lz = pz + ((z - pz) * s) / steps;
        trail.add(g.x + lx, is.base + is.nav.y(lx, lz), g.z + lz, i);
      }
      px = x; pz = z;
    }
  }

  plan(c, toId, spot) {
    const t = c.trail;
    const lead = c.members[0];
    let id = c.here;
    let g = this.islands[id].group.position;
    let x = lead.x - g.x, z = lead.z - g.z;
    t.reset();
    t.add(lead.x, this.islands[id].base + this.islands[id].nav.y(x, z), lead.z, this.index[id]);
    for (const e of this.hops(c.here, toId)) {
      const pts = e.pts, a = this.index[id], b = this.index[e.to];
      this.walkOn(t, id, x, z, pts[0][0] - g.x, pts[0][2] - g.z);
      pts.forEach((p, i) => t.add(p[0], p[1], p[2], a, b, i / (pts.length - 1)));
      t.marks.push({ s: t.len, id: e.to });
      const last = pts[pts.length - 1];
      id = e.to;
      g = this.islands[id].group.position;
      x = last[0] - g.x; z = last[2] - g.z;
    }
    this.walkOn(t, id, x, z, spot.x, spot.z);
  }

  destination(c) {
    const r = this.r;
    let to = c.here;
    const roll = r();
    if (roll > 0.35) {
      to = this.pick(this.adj[c.here]).to;
      if (roll > 0.82) to = this.pick(this.adj[to]).to;
    }
    const nav = this.islands[to].nav;
    const size = c.members.length;
    const want = size >= 4 ? 4 : size > 1 ? 4 : 2;
    let options = nav.spots.filter((s) => (!s.taken || s.taken === c) && s.clr >= want);
    if (c.teacher && size > 1) {
      const seen = options.filter((s) => s.look);
      if (seen.length) options = seen;
    }
    if (!options.length) options = nav.spots;
    return { to, spot: this.pick(options) };
  }

  depart(c) {
    const { to, spot } = this.destination(c);
    if (c.spot) c.spot.taken = null;
    this.plan(c, to, spot);
    spot.taken = c;
    c.spot = spot;
    c.to = to;
    c.s = 0;
    c.state = 'travel';
    c.act = null;
    c.ball = null;
    this.ballMesh.setMatrixAt(c.id, ZERO);
    c.members.forEach((m) => { m.goal = 'walk'; m.face = null; m.book = false; });
  }

  // ───────── 抵達後的活動 ─────────
  seat(c, m, x, z, goal, face, book = false) {
    const nav = this.islands[c.here].nav;
    const cell = nav.free(x, z) ? -1 : nav.nearest(x, z);
    m.lx = cell < 0 ? x : nav.cx(cell);
    m.lz = cell < 0 ? z : nav.cz(cell);
    m.goal = goal;
    m.face = face;
    m.book = book;
  }

  arrive(c) {
    const r = this.r;
    const { x, z, clr, look } = c.spot;
    const n = c.members.length;
    c.state = 'play';
    c.at = { x, z, id: c.here };
    if (c.teacher && n > 1) {
      c.act = this.wet ? 'rainclass' : this.dark ? 'stars' : 'lesson';
      c.timer = 15 + r() * 10;
      const talk = c.act === 'stars' ? 'point' : 'talk';
      const kid = { lesson: 'sit', rainclass: 'idle', stars: 'gaze' }[c.act];
      // 老師背對地標講解，孩子圍成半圓；雨天站著聽，夜晚坐下看星星
      const ang = look ? Math.atan2(look[1] - z, look[0] - x) + Math.PI : r() * 6.28;
      c.members.forEach((m, i) => {
        if (i === 0) { this.seat(c, m, x, z, talk, Math.atan2(Math.cos(ang), Math.sin(ang))); return; }
        const a = ang + (i - (n) / 2) * 0.44, R = 1.9;
        const sx = x + Math.cos(a) * R, sz = z + Math.sin(a) * R;
        this.seat(c, m, sx, sz, kid, Math.atan2(x - sx, z - sz));
      });
      return;
    }
    if (n === 1) {
      const teacher = c.teacher;
      c.act = this.wet ? 'catch' : this.dark ? (teacher ? 'patrol' : 'nightread') : teacher ? 'wave' : 'read';
      c.timer = 6 + r() * 7;
      const goal = { wave: 'wave', patrol: 'wave', catch: 'catch' }[c.act] || 'sit';
      this.seat(c, c.members[0], x, z, goal, r() * 6.28, !teacher && goal === 'sit');
      return;
    }
    const day = clr >= 5 ? ['tag', 'ball', 'ball', 'read', 'jump'] : clr >= 4 ? ['ball', 'read', 'jump'] : ['read', 'jump'];
    const acts = this.wet ? ['puddle', 'puddle', 'huddle', 'catch'] : this.dark ? (clr >= 4 ? ['camp', 'flash', 'flash', 'stars'] : ['flash', 'stars']) : day;
    c.act = this.pick(acts);
    c.timer = { tag: 10, ball: 12, read: 14, jump: 6, puddle: 11, huddle: 12, catch: 9, camp: 18, stars: 15, flash: 12 }[c.act] + r() * 7;
    c.orbit = r() * 6.28;
    const R = { read: 0.75, huddle: 0.3, puddle: 1, catch: 0.9, camp: 1.15, stars: 0.95, flash: 1.3 }[c.act] ?? 1.5;
    const goal = { jump: 'jump', puddle: 'splash', catch: 'catch', camp: 'warm', stars: 'gaze', flash: 'flash' }[c.act] || 'idle';
    const outward = c.act === 'read' || c.act === 'stars' || c.act === 'catch' || c.act === 'flash';
    c.members.forEach((m, i) => {
      const a = (i / n) * 6.283;
      const sx = x + Math.cos(a) * R, sz = z + Math.sin(a) * R;
      const toCenter = Math.atan2(x - sx, z - sz);
      if (c.act === 'tag') { m.goal = 'run'; m.face = null; m.book = false; return; }
      if (c.act === 'read') this.seat(c, m, sx, sz, 'sit', toCenter + Math.PI, true);
      else this.seat(c, m, sx, sz, goal, outward ? toCenter + Math.PI : toCenter);
    });
    if (c.act === 'ball') c.ball = { from: 0, to: 1, u: 0 };
  }

  tick(c, t, dt) {
    if (c.state === 'wait') {
      c.timer -= dt;
      if (c.timer <= 0 && !this.queue.includes(c)) this.queue.push(c);
      this.hold(c);
      return;
    }
    if (c.state === 'travel') {
      c.s = Math.min(c.trail.len, c.s + c.speed * this.pace * dt);
      while (c.trail.marks.length && c.trail.marks[0].s <= c.s) c.here = c.trail.marks.shift().id;
      const tr = c.trail;
      c.members.forEach((m, i) => {
        // 隊伍兩人一排，走在老師後面
        const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? 0.24 : -0.24);
        const s = c.s - row * 0.72;
        tr.at(s, here, this.bobs);
        tr.at(s + 0.15, ahead, this.bobs);
        const dx = ahead.x - here.x, dz = ahead.z - here.z, d = Math.hypot(dx, dz) || 1;
        m.tx = here.x - (dz / d) * side;
        m.tz = here.z + (dx / d) * side;
        m.ty = here.y;
      });
      if (c.s >= tr.len) { c.here = c.to; this.arrive(c); }
      return;
    }
    c.timer -= dt;
    if (c.act === 'tag') {
      const R = 1.7;
      c.orbit += (2.7 / R) * dt;
      c.members.forEach((m, i) => {
        const a = c.orbit + (i / c.members.length) * 6.283 * 0.8;
        m.lx = c.spot.x + Math.cos(a) * R;
        m.lz = c.spot.z + Math.sin(a) * R * 0.86;
      });
    }
    if (c.ball) this.throwBall(c, dt);
    this.hold(c);
    if (c.timer <= 0) {
      c.state = 'wait';
      c.timer = 0.8 + this.r() * 2.4;
      c.members.forEach((m) => { m.goal = 'idle'; m.book = false; });
      c.ball = null;
      this.ballMesh.setMatrixAt(c.id, ZERO);
    }
  }

  // 依活動位置算出世界座標目標
  hold(c) {
    const is = this.islands[c.here];
    const g = is.group.position;
    for (const m of c.members) {
      m.tx = g.x + m.lx;
      m.tz = g.z + m.lz;
      m.ty = is.group.position.y + is.nav.y(m.lx, m.lz);
    }
  }

  throwBall(c, dt) {
    const b = c.ball;
    const n = c.members.length;
    const A = c.members[b.from], Z = c.members[b.to];
    if (A.goal === 'idle' && Math.hypot(A.x - A.tx, A.z - A.tz) > 0.1) return;
    b.u += dt / 1.05;
    if (b.u >= 1) {
      b.u = 0;
      b.from = b.to;
      b.to = (b.to + 1 + Math.floor(this.r() * (n - 1))) % n;
      if (b.to === b.from) b.to = (b.from + 1) % n;
      return;
    }
    const x = A.x + (Z.x - A.x) * b.u, z = A.z + (Z.z - A.z) * b.u;
    const y = A.y + 0.72 + Math.sin(b.u * Math.PI) * 1.05;
    L.makeTranslation(x, y, z);
    this.ballMesh.setMatrixAt(c.id, L);
  }

  // ───────── 每位人物的移動與姿勢 ─────────
  move(p, dt) {
    const c = p.crew;
    const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
    if (!dt) return;
    const tag = c.act === 'tag';
    const pace = c.speed * this.pace * (1 + Math.min(1.1, Math.max(0, d - 0.3) * 0.6)) * (tag ? 2.8 : 1);
    if (d > 0.03) {
      const step = Math.min(d, pace * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      p.spd = step / dt;
      p.yaw = turn(p.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
    } else {
      p.spd = 0;
      if (p.face !== null) p.yaw = turn(p.yaw, p.face, 1 - Math.exp(-dt * 6));
    }
    p.y += (p.ty - p.y) * (1 - Math.exp(-dt * 14));
    p.mode = p.spd > 0.2 ? 'walk' : p.goal === 'run' || p.goal === 'walk' ? 'idle' : p.goal;
  }

  pose(p, t, dt) {
    const k = 1 - Math.exp(-dt * 12);
    const b = p.body;
    let lL = 0, lR = 0, aL = 0.06, aR = 0.06, lift = 0, lean = 0, look = 0;
    const c = p.crew;
    if (p.mode === 'walk') {
      const fast = p.spd > 2;
      p.phase += p.spd * dt * (p.kind === 'teacher' ? 4.6 : 6.4);
      const amp = fast ? 0.95 : 0.55;
      lL = Math.sin(p.phase) * amp;
      lR = -lL;
      aL = -lL * 0.85;
      aR = lL * 0.85;
      lift = Math.abs(Math.cos(p.phase)) * (fast ? 0.08 : 0.04);
      lean = fast ? 0.22 : 0.05;
    } else if (p.mode === 'sit' || p.mode === 'gaze' || p.mode === 'warm') {
      lift = 0.1 - b.hip;
      lL = lR = -1.45;
      aL = aR = p.book ? -1 : -0.5;
      if (p.mode === 'warm') aL = aR = -1.25 + Math.sin(t * 2 + p.ph) * 0.08;
      if (p.mode === 'gaze') {
        look = 0.85;
        if (p.slot % 2 === 0) aR = -2.45 + Math.sin(t * 1.6 + p.ph) * 0.2;
      }
    } else if (p.mode === 'splash') {
      lift = Math.abs(Math.sin(t * 5.2 + p.ph)) * 0.4;
      aL = -0.7 + Math.sin(t * 5.2 + p.ph) * 0.4;
      lL = lR = -0.3;
    } else if (p.mode === 'catch') {
      look = 0.7;
      aL = -1.6 + Math.sin(t * 3 + p.ph) * 0.14;
    } else if (p.mode === 'point') {
      look = 0.6;
      aR = -2.55 + Math.sin(t * 1.5 + p.ph) * 0.18;
      aL = -0.4;
    } else if (p.mode === 'talk') {
      aR = -1.15 + Math.sin(t * 2.3 + p.ph) * 0.4;
      aL = -0.35 + Math.sin(t * 1.4 + p.ph) * 0.15;
    } else if (p.mode === 'wave') {
      aR = -2.7 + Math.sin(t * 9 + p.ph) * 0.34;
    } else if (p.mode === 'jump') {
      lift = Math.abs(Math.sin(t * 4.6 + p.ph)) * 0.36;
      aL = aR = -2.6;
      lL = lR = -0.2;
    } else if (c.ball && c.ball.to === p.slot) {
      aL = aR = -1.2;
    } else if (c.ball && c.ball.from === p.slot && c.ball.u < 0.22) {
      aR = -2.4;
    }
    const lead = p.slot === 0 && c.teacher && c.members.length > 1 && c.state === 'travel' && !this.wet;
    if (lead) aR = -2.65;
    p.flag = lead;
    // 擠大傘時只有第一個人撐；沒帶傘的抱著頭
    const huddle = c.act === 'huddle' && c.state === 'play';
    const holds = this.wet && (huddle ? p.slot === 0 : !p.bare);
    if (holds) aR = -2.1;
    else if (huddle) aL = aR = -0.9;
    else if (this.wet) { aL = aR = -2.85; lean = Math.max(lean, 0.16); }
    // 手電筒拿在左手：走路照地上、看星星照天空、看書照書本
    const lamp = this.dark && p.lit && p.mode !== 'warm';
    if (lamp) aL = p.mode === 'gaze' ? -2.4 : p.mode === 'sit' ? -1 : -1.35;
    const wide = p.mode === 'flash' ? 1.05 : p.mode === 'wave' ? 0.9 : 0.4;
    const quick = p.mode === 'flash' ? 3.2 : p.mode === 'wave' ? 0.9 : 1.2;
    const aim = p.mode === 'gaze' ? 0.5 : p.mode === 'sit' ? 2.6 : p.mode === 'flash' ? 1.3 : 1.95;
    p.sweep = Math.sin(t * quick + p.ph) * wide;
    p.aim += (aim - p.aim) * k;
    p.reach += ((p.mode === 'gaze' ? 1.5 : p.mode === 'sit' ? 0.3 : 1) - p.reach) * k;
    const open = 1 - Math.exp(-dt * 7);
    p.umb += ((holds ? (huddle ? 1.8 : 1) : 0) - p.umb) * open;
    p.lamp += ((lamp ? 1 : 0) - p.lamp) * open;
    p.look += (look - p.look) * k;
    p.lL += (lL - p.lL) * k; p.lR += (lR - p.lR) * k;
    p.aL += (aL - p.aL) * k; p.aR += (aR - p.aR) * k;
    p.lift += (lift - p.lift) * k;
    p.lean += (lean - p.lean) * k;
  }

  draw(p, t) {
    const i = p.idx;
    if (p.vis < 0.02) {
      if (p.hidden) return;
      p.hidden = true;
      for (const m of [this.torso, this.head, p.hair, this.pack, this.bookMesh, this.flagMesh, this.umbrella, this.torch, this.beam, this.spot, this.ring]) m.setMatrixAt(i, ZERO);
      for (const j of [0, 1]) { this.arms.setMatrixAt(i * 2 + j, ZERO); this.legs.setMatrixAt(i * 2 + j, ZERO); }
      return;
    }
    p.hidden = false;
    const b = p.body;
    const s = p.s * p.vis;
    B.makeRotationFromEuler(E.set(p.lean, p.yaw, 0));
    B.scale(V.set(s, s, s));
    B.setPosition(p.x, p.y + p.lift * s, p.z);
    this.torso.setMatrixAt(i, part(0, b.hip, 0, 0, 1, b.tor, 1));
    this.pack.setMatrixAt(i, p.kind === 'student' ? part(0, b.hip, 0, 0, 1, b.tor, 1) : ZERO);
    this.bookMesh.setMatrixAt(i, p.book && p.spd < 0.2 ? part(0, b.hip + 0.2 * b.tor, 0.27, -0.75) : ZERO);
    const neck = b.hip + 0.38 * b.tor;
    part(0, neck, 0, -p.look, b.head, b.head, b.head);
    this.head.setMatrixAt(i, O);
    p.hair.setMatrixAt(i, O);
    p.other.setMatrixAt(i, ZERO);
    const shoulder = b.hip + 0.33 * b.tor;
    this.arms.setMatrixAt(i * 2, part(-0.205, shoulder, 0, p.aL, 1, b.arm, 1));
    this.arms.setMatrixAt(i * 2 + 1, part(0.205, shoulder, 0, p.aR, 1, b.arm, 1));
    this.flagMesh.setMatrixAt(i, p.flag ? O : ZERO);
    const u = p.umb;
    this.umbrella.setMatrixAt(i, u > 0.03 ? part(0.17, shoulder, 0.06, 0, u, 0.5 + 0.5 * Math.min(1, u), u) : ZERO);
    const lit = p.lamp;
    if (lit > 0.03) {
      L.makeRotationFromEuler(E.set(p.aim, p.sweep, 0));
      L.setPosition(-0.205, shoulder - 0.06, 0.3);
      O.multiplyMatrices(B, L);
      this.torch.setMatrixAt(i, O);
      L.makeScale(lit, lit * p.reach, lit);
      L.setPosition(0, 0.27, 0);
      this.beam.setMatrixAt(i, O.multiply(L));
      this.drawSpot(p, shoulder * s, lit);
    } else {
      for (const m of [this.torch, this.beam, this.spot]) m.setMatrixAt(i, ZERO);
    }
    if (p.mode === 'splash' && p.spd < 0.2) {
      const r = 0.25 + ((t * 0.83 + p.ph) % 1) * 0.75;
      L.makeScale(r, 1, r);
      L.setPosition(p.x, p.y + 0.06, p.z);
      this.ring.setMatrixAt(i, L);
    } else this.ring.setMatrixAt(i, ZERO);
    this.legs.setMatrixAt(i * 2, part(-0.088, b.hip, 0, p.lL, 1, b.leg, 1));
    this.legs.setMatrixAt(i * 2 + 1, part(0.088, b.hip, 0, p.lR, 1, b.leg, 1));
  }

  // 光束打到地面的光點；照向天空或超出島面就不畫
  drawSpot(p, height, lit) {
    const down = -Math.cos(p.aim);
    const is = this.islands[p.crew.here];
    const g = is.group.position;
    const d = (height * Math.sin(p.aim)) / Math.max(down, 0.01);
    const a = p.yaw + p.sweep;
    const lx = p.x + Math.sin(a) * d - g.x, lz = p.z + Math.cos(a) * d - g.z;
    if (down < 0.2 || d > 3.2 || !is.nav.free(lx, lz)) { this.spot.setMatrixAt(p.idx, ZERO); return; }
    const r = 0.62 * lit;
    L.makeScale(r, 1, r * 1.3);
    L.setPosition(g.x + lx, g.y + is.nav.y(lx, lz) + 0.06, g.z + lz);
    this.spot.setMatrixAt(p.idx, L);
  }

  // 水窪與營火留在活動地點，換地方時慢慢消失
  props(c, t, dt) {
    const k = 1 - Math.exp(-dt * 4);
    c.pud += ((c.on && c.act === 'puddle' ? 1 : 0) - c.pud) * k;
    c.fire += ((c.on && c.act === 'camp' ? 1 : 0) - c.fire) * k;
    const g = this.islands[c.at.id].group.position;
    const x = g.x + c.at.x, z = g.z + c.at.z;
    const y = g.y + this.islands[c.at.id].nav.y(c.at.x, c.at.z);
    if (c.pud > 0.02) {
      L.makeScale(1.75 * c.pud, 1, 1.45 * c.pud);
      L.setPosition(x, y + 0.04, z);
      this.puddle.setMatrixAt(c.id, L);
    } else this.puddle.setMatrixAt(c.id, ZERO);
    const glow = c.id * 3;
    if (c.fire > 0.02) {
      L.makeScale(c.fire, c.fire, c.fire);
      L.setPosition(x, y + 0.04, z);
      this.logs.setMatrixAt(c.id, L);
      const f = c.fire * (1 + Math.sin(t * 13 + c.id) * 0.13);
      L.makeScale(f, f * (1 + Math.sin(t * 17 + c.id) * 0.1), f);
      L.setPosition(x, y + 0.12, z);
      this.flame.setMatrixAt(c.id, L);
      this.glowAt[glow] = x;
      this.glowAt[glow + 1] = y + 0.45;
      this.glowAt[glow + 2] = z;
    } else {
      this.logs.setMatrixAt(c.id, ZERO);
      this.flame.setMatrixAt(c.id, ZERO);
      this.glowAt[glow + 1] = HIDE;
    }
  }

  // 天氣或日夜一變，正在進行的活動很快收尾，換成適合的事
  react(env) {
    const wet = (env.rain || 0) > RAIN_AT, dark = env.night > DARK_AT;
    if (wet === this.wet && dark === this.dark) return;
    this.wet = wet;
    this.dark = dark;
    this.pace = wet ? 1.3 : dark ? 0.85 : 1;
    for (const c of this.crews) if (c.state === 'play') c.timer = Math.min(c.timer, this.r() * 1.8);
  }

  update(t, dt, env, islands) {
    this.ids.forEach((id, i) => { this.bobs[i] = islands[id].group.position.y - islands[id].base; });
    this.react(env);
    const ratio = { all: 1, few: 0.45, none: 0.3 }[env.kidsVisible] ?? 1;
    if (dt && this.queue.length) this.depart(this.queue.shift());
    for (const c of this.crews) {
      c.on = c.rank < ratio || c === this.followed;
      if (dt) { this.tick(c, t, dt); this.props(c, t, dt); }
    }
    const k = 1 - Math.exp(-dt * 3.2);
    for (const p of this.list) {
      this.move(p, dt);
      if (dt) this.pose(p, t, dt);
      p.vis += ((p.crew.on ? 1 : 0) - p.vis) * k;
      this.draw(p, t);
    }
    for (const m of [this.torso, this.head, this.hairA, this.hairB, this.arms, this.legs, this.pack, this.bookMesh, this.flagMesh, this.ballMesh, this.umbrella, this.torch, this.beam, this.spot, this.logs, this.flame, this.puddle, this.ring]) m.instanceMatrix.needsUpdate = true;
    const mat = this.glow.material;
    if (dt) mat.opacity += ((this.dark ? 0.5 : 0) - mat.opacity) * (1 - Math.exp(-dt * 2));
    this.glow.visible = mat.opacity > 0.01;
    this.beam.visible = this.spot.visible = this.torch.visible = this.dark || this.list.some((p) => p.lamp > 0.03);
    this.glow.geometry.attributes.position.needsUpdate = true;
  }

  // ───────── 點選、對話與跟隨 ─────────
  // 用螢幕距離判斷，人物很小時也點得到；太遠就讓給島嶼
  pickAt(nx, ny, camera, H) {
    let best = null, bestD = Infinity;
    const scale = H / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const p of this.list) {
      if (p.vis < 0.5) continue;
      const v = V.set(p.x, p.y + 0.6 * p.s, p.z);
      const dist = v.distanceTo(camera.position);
      const px = (1.15 * p.s * scale) / dist;
      if (px < 16) continue;
      v.project(camera);
      if (v.z > 1) continue;
      const d = Math.hypot(((v.x - nx) * camera.aspect * H) / 2, ((v.y - ny) * H) / 2);
      if (d < Math.max(20, px * 0.7) && d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  headOf(p, out) { return out.set(p.x, p.y + p.lift * p.s + 1.32 * p.s * (p.kind === 'teacher' ? 1.18 : 1), p.z); }

  lineOf(p) {
    const c = p.crew;
    if (c.state === 'play') {
      const lead = p.slot === 0;
      const key = { lesson: lead ? 'teach' : 'listen', rainclass: lead ? 'rainteach' : 'rainlisten', stars: c.teacher && lead ? 'starteach' : 'stars' }[c.act] || c.act;
      const set = PEOPLE_LINES.act[key];
      if (set) return this.pick(set);
    }
    if (this.wet) return this.pick(PEOPLE_LINES.rain);
    if (this.dark) return this.pick(PEOPLE_LINES.night);
    return this.pick(PEOPLE_LINES.island[c.here]);
  }

  guide() {
    const list = this.crews.filter((c) => c.on && c.teacher && c.members.length > 1 && c !== this.followed);
    const moving = list.filter((c) => c.state === 'travel');
    return this.pick(moving.length ? moving : list.length ? list : this.crews.filter((c) => c.on));
  }

  status(c) {
    const place = names[c.here];
    if (c.state === 'travel') return c.here === c.to ? `正在${place}逛逛` : `正從${place}走向${names[c.to]}`;
    if (c.state === 'wait') return `在${place}準備出發`;
    return `${{ lesson: '老師正在講解', read: '大家坐下來看書', ball: '大家在傳球', tag: '大家在玩鬼抓人', jump: '大家開心跳起來', wave: '正在和大家揮手', rainclass: '老師撐著傘繼續上課', puddle: '大家在踩水窪', huddle: '大家擠在同一把大傘下', catch: '正在伸手接雨滴', stars: '大家抬頭看星星', camp: '大家圍著營火聊天', flash: '大家拿手電筒玩光束遊戲', patrol: '老師拿手電筒巡視', nightread: '打開手電筒安靜看書' }[c.act] ?? '正在休息'}（${place}）`;
  }
}

// 光束越遠越淡
function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d');
  const r = g.createLinearGradient(0, 0, 0, 64);
  r.addColorStop(0, '#ffffff');
  r.addColorStop(0.55, '#666666');
  r.addColorStop(1, '#000000');
  g.fillStyle = r;
  g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.28, 'rgba(255,255,255,.42)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function buildNav(islands, defs) {
  for (const [id, is] of Object.entries(islands)) is.nav = new NavGrid(defs[id], is.terrain, is.anchors, is.walk);
}
