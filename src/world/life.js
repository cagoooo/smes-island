// 天空中的生命：鱻鯉雲魚、飛艇、紙飛機、鳥群與小河馬
import * as THREE from 'three';
import { Kit, G, makeRng } from './kit.js';
import { C } from './props.js';
import { shared } from './materials.js';

// ───────── 雲魚：沿身體長軸做波動的大鯉魚 ─────────
function koiGeometry(palette) {
  const k = new Kit(11);
  const pts = [];
  const prof = [[0.02, 3.2], [0.34, 2.9], [0.62, 2.1], [0.8, 1.1], [0.84, 0], [0.72, -1.2], [0.5, -2.3], [0.24, -3.2], [0.08, -3.7]];
  prof.forEach(([r, z]) => pts.push(new THREE.Vector2(r, z)));
  const body = new THREE.LatheGeometry(pts, 14).rotateX(Math.PI / 2).toNonIndexed();
  const pos = body.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const a = new THREE.Color(palette[0]), b = new THREE.Color(palette[1]), d = new THREE.Color(palette[2]);
  for (let i = 0; i < pos.count; i += 3) {
    const z = pos.getZ(i), x = pos.getX(i), y = pos.getY(i);
    const n = Math.sin(z * 1.7 + 0.6) + Math.sin(x * 2.3 + z * 0.8);
    c.copy(y < -0.25 ? b : n > 0.3 ? a : n < -0.9 ? d : b);
    for (let v = 0; v < 3; v++) col.set([c.r, c.g, c.b], (i + v) * 3);
  }
  body.deleteAttribute('uv');
  body.computeVertexNormals();
  body.setAttribute('color', new THREE.BufferAttribute(col, 3));
  body.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  k.layers.solid.push(body);
  const fin = (x, y, z, sx, sy, sz, rx, ry, rz, hex) => k.add(G.cone(3), hex, { x, y, z, sx, sy, sz, rx, ry, rz, wonk: 0.02, ao: 1 });
  fin(0, -0.02, -4.1, 1.05, 1.5, 0.08, -1.57, 0, 0, palette[0]);
  fin(0, 1.05, 0.1, 0.1, 1.2, 1.3, 0.2, 0, 0, palette[0]);
  fin(1.05, -0.3, 1.1, 0.7, 0.9, 0.06, 0.2, 0, -1.2, palette[2]);
  fin(-1.05, -0.3, 1.1, 0.7, 0.9, 0.06, 0.2, 0, 1.2, palette[2]);
  for (const s of [-1, 1]) {
    k.ball(0.15, '#ffffff', s * 0.5, 0.26, 2.3, { detail: 1 });
    k.ball(0.09, C.ink, s * 0.58, 0.28, 2.38, { detail: 1 });
    k.add(G.cyl(4, 0.3), '#e8c27a', { x: s * 0.2, y: -0.2, z: 3.1, sx: 0.04, sy: 0.6, sz: 0.04, rx: 1.3, rz: s * 0.6 });
  }
  return k;
}

const koiUniforms = { uTime: shared.uTime };

function koiMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = koiUniforms.uTime;
    s.uniforms.uPhase = m.userData.phase;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = clamp((3.4 - position.z) / 7.4, 0., 1.);
        transformed.x += sin(position.z * .95 - uTime * 2.3 + uPhase) * w * w * 1.25;`);
  };
  m.customProgramCacheKey = () => 'koi';
  return m;
}

export class Life {
  constructor(scene, islands) {
    this.scene = scene;
    this.fish = [];
    const palettes = [['#e23f2a', '#fff3e4', '#ef8a32'], ['#ffffff', '#fff3e4', '#e8452f'], ['#2f83c8', '#dff0fa', '#7cc0e8'], ['#e8a22f', '#fff0d0', '#d9622b']];
    const paths = [
      { rx: 118, rz: 86, y: 26, sp: 0.075, ph: 0, s: 1.25 },
      { rx: 96, rz: 112, y: 40, sp: -0.06, ph: 2, s: 1.6 },
      { rx: 140, rz: 104, y: 12, sp: 0.05, ph: 4, s: 1 },
      { rx: 66, rz: 58, y: 44, sp: 0.09, ph: 1, s: 0.72 },
    ];
    paths.forEach((p, i) => {
      const k = koiGeometry(palettes[i]);
      const geo = k.build().children[0].geometry;
      const mat = koiMaterial();
      mat.userData.phase = { value: i * 1.7 };
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.scale.setScalar(p.s);
      scene.add(mesh);
      this.fish.push({ mesh, ...p });
    });
    this.buildSchool(scene);
    this.buildPlanes(scene);
    this.buildAirship(scene, islands);
    this.buildHippos(scene, islands);
  }

  // 繞著主島的小魚群
  buildSchool(scene) {
    const k = new Kit(21);
    k.ball(0.5, '#ffffff', 0, 0, 0, { sx: 0.34, sy: 0.5, sz: 1.1 });
    k.add(G.cone(3), '#ffffff', { z: -0.72, rx: -1.57, sx: 0.32, sy: 0.5, sz: 0.04, wonk: 0 });
    const geo = k.build().children[0].geometry;
    const count = 46;
    this.school = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), count);
    const cols = ['#e8452f', '#ef8a32', '#ffffff', '#2f9fc8'];
    const r = makeRng(5);
    this.schoolData = [];
    for (let i = 0; i < count; i++) {
      this.school.setColorAt(i, new THREE.Color(cols[i % 4]));
      this.schoolData.push({ a: r() * 6.28, rad: 30 + r() * 10, y: 22 + r() * 8, sp: 0.2 + r() * 0.08, ph: r() * 6.28 });
    }
    this.school.frustumCulled = false;
    scene.add(this.school);
    this.dummy = new THREE.Object3D();
  }

  buildPlanes(scene) {
    this.planes = [];
    for (let i = 0; i < 4; i++) {
      const k = new Kit(30 + i);
      const verts = [0, 0.07, 0.8, -0.5, 0.14, -0.54, 0, -0.07, -0.34, 0, 0.07, 0.8, 0, -0.07, -0.34, 0.5, 0.14, -0.54];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      k.add(g, '#fbf6ea', { wonk: 0, ao: 1, jitter: 0 });
      const m = k.build();
      m.children[0].material = m.children[0].material.clone();
      m.children[0].material.side = THREE.DoubleSide;
      m.children[0].castShadow = false;
      scene.add(m);
      this.planes.push({ m, sp: 0.16 + i * 0.03, ph: i * 1.6, rx: 60 + i * 18, rz: 46 + i * 12, y: 18 + i * 6 });
    }
  }

  // 繫泊在風信飛艇島的鯉魚飛艇
  buildAirship(scene, islands) {
    const k = new Kit(41);
    k.add(G.sphere(14, 9), '#e9503a', { sx: 2.3, sy: 2.3, sz: 5.4 });
    k.add(G.sphere(14, 9), '#fff0dc', { y: -0.5, sx: 2.1, sy: 1.9, sz: 5.2 });
    for (const s of [-1, 1]) {
      k.add(G.cone(3), C.gold, { x: s * 2.2, z: -3.6, sx: 1.5, sy: 2, sz: 0.1, rz: -s * 1.2, rx: -0.8 });
      k.ball(0.32, '#ffffff', s * 1.5, 0.74, 4.3, { detail: 1 });
      k.ball(0.17, C.ink, s * 1.66, 0.76, 4.5, { detail: 1 });
    }
    k.add(G.cone(3), C.gold, { z: -6.2, rx: -1.57, sx: 2, sy: 2.4, sz: 0.1 });
    k.box(1.8, 0.8, 3, C.wood, 0, -3.1, 0.3);
    k.box(2, 0.1, 3.3, C.wood2, 0, -2.36, 0.3);
    for (const [x, z] of [[-0.8, -1], [0.8, -1], [-0.8, 1.6], [0.8, 1.6]]) k.box(0.05, 0.9, 0.05, C.ink, x, -2.3, z);
    for (let i = 0; i < 4; i++) k.glow(0.34, 0.26, 0.05, C.win, -0.62 + i * 0.4 + 0.02, -2.76, 1.81);
    this.airship = k.build();
    this.airship.scale.setScalar(0.74);
    const home = islands.brand;
    this.airshipHome = home.group.position.clone().add(new THREE.Vector3(-1, 12.6, -2));
    scene.add(this.airship);
  }

  // 藏在各島的十二隻小河馬
  buildHippos(scene, islands) {
    this.hippos = [];
    const r = makeRng(33);
    const spots = {
      core: [-15, 3, 2.6], course: [-11.2, 0.05, -3], inquiry: [2.4, 0.05, 11.4], walk: [-1, 2.9, -9.3], digital: [10.8, 0.05, 2.2], library: [-9.6, 0.05, -3.6],
      admin: [8.6, 0.05, -1.4], teacher: [-9, 0.05, -2.2], results: [-2.4, 2, -0.4], forest: [-5.4, 0.05, 6.4], brand: [8.6, 0.05, 3.4], future: [6.6, 0.05, -3.4],
    };
    for (const [id, [x, y, z]] of Object.entries(spots)) {
      const is = islands[id];
      const k = new Kit(60 + this.hippos.length);
      const col = r() > 0.5 ? '#f09ab0' : '#9aa8a0';
      k.ball(0.28, col, 0, 0.26, -0.04, { detail: 1, sz: 1.2, sy: 0.84 });
      k.ball(0.2, col, 0, 0.3, 0.3, { detail: 1 });
      k.ball(0.14, col, 0, 0.24, 0.46, { detail: 1, sx: 1.1, sy: 0.74 });
      for (const s of [-1, 1]) {
        k.ball(0.045, C.ink, s * 0.09, 0.38, 0.44, {});
        k.ball(0.06, col, s * 0.13, 0.5, 0.2, {});
        k.cyl(0.07, 0.14, col, s * 0.15, 0, 0.14, { seg: 5 });
        k.cyl(0.07, 0.14, col, s * 0.15, 0, -0.2, { seg: 5 });
      }
      const m = k.build();
      m.position.set(x, y, z);
      m.rotation.y = r() * 6.28;
      m.scale.setScalar(1.15);
      m.userData.hippo = id;
      is.group.add(m);
      this.hippos.push({ id, mesh: m });
    }
  }

  update(t) {
    for (const f of this.fish) {
      const a = t * f.sp + f.ph;
      const x = Math.cos(a) * f.rx, z = Math.sin(a) * f.rz;
      const y = f.y + Math.sin(t * 0.3 + f.ph) * 4;
      const a2 = a + 0.02 * Math.sign(f.sp);
      f.mesh.position.set(x, y, z);
      f.mesh.lookAt(Math.cos(a2) * f.rx, f.y + Math.sin((t + 0.2) * 0.3 + f.ph) * 4, Math.sin(a2) * f.rz);
    }
    const d = this.dummy;
    this.schoolData.forEach((s, i) => {
      const a = s.a + t * s.sp;
      const r = s.rad + Math.sin(t * 0.6 + s.ph) * 2.4;
      d.position.set(Math.cos(a) * r, s.y + Math.sin(t * 1.1 + s.ph) * 1.2, Math.sin(a) * r - 3);
      d.rotation.set(0, -a, Math.sin(t * 3 + s.ph) * 0.2);
      d.scale.setScalar(1.2);
      d.updateMatrix();
      this.school.setMatrixAt(i, d.matrix);
    });
    this.school.instanceMatrix.needsUpdate = true;
    for (const p of this.planes) {
      const a = t * p.sp + p.ph;
      const pos = new THREE.Vector3(Math.cos(a) * p.rx, p.y + Math.sin(a * 2) * 5, Math.sin(a) * p.rz);
      p.m.position.copy(pos);
      p.m.lookAt(Math.cos(a + 0.03) * p.rx, p.y + Math.sin((a + 0.03) * 2) * 5, Math.sin(a + 0.03) * p.rz);
      p.m.rotateZ(Math.sin(a * 2) * 0.4);
    }
    this.airship.position.copy(this.airshipHome).add(new THREE.Vector3(Math.sin(t * 0.28) * 1.2, Math.sin(t * 0.6) * 0.6, 0));
    this.airship.rotation.y = -0.6 + Math.sin(t * 0.2) * 0.16;
    this.airship.rotation.z = Math.sin(t * 0.4) * 0.03;

  }
}
