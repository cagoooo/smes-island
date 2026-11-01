// 島與島之間的吊橋、雲端階梯、跨域串聯弧線與降雨
import * as THREE from 'three';
import { Kit, G } from './kit.js';
import { C } from './props.js';
import { outline } from './base.js';
import { shared } from './materials.js';

function edgePoint(def, group, toward) {
  const dir = toward.clone().sub(group.position).setY(0).normalize();
  const a = Math.atan2(dir.z, dir.x);
  const rr = outline(def.r, def.seed, a) * 0.96;
  return group.position.clone().add(new THREE.Vector3(dir.x * rr, 0.02, dir.z * rr));
}

export function buildBridges(pairs, defs, islands) {
  const k = new Kit(404);
  for (const [a, b] of pairs) {
    const A = edgePoint(defs[a], islands[a].group, islands[b].group.position);
    const B = edgePoint(defs[b], islands[b].group, islands[a].group.position);
    const len = A.distanceTo(B);
    const n = Math.round(len / 0.72);
    const dir = B.clone().sub(A).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const yaw = Math.atan2(dir.x, dir.z);
    const sag = Math.min(2.6, len * 0.075);
    const pt = (t) => A.clone().lerp(B, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0));
    for (let i = 1; i < n; i++) {
      const t = i / n, p = pt(t), q = pt(t + 0.01);
      const slope = Math.atan2(q.y - p.y, 0.01 * len);
      const sway = Math.sin(t * Math.PI) * 0.6;
      k.add(G.box(), k.pick([C.wood, C.wood3, C.wood2]), { x: p.x, y: p.y, z: p.z, ry: yaw, rx: -slope, sx: 1.34, sy: 0.08, sz: 0.46, sway });
    }
    for (const s of [-1, 1]) {
      const c = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => pt(i / 8).addScaledVector(side, s * 0.68).add(new THREE.Vector3(0, 0.62, 0))));
      const tube = new THREE.TubeGeometry(c, 22, 0.035, 4, false);
      k.raw(tube, '#c9b083', { wonk: 0, ao: 1 });
      const posts = Math.round(n / 3);
      for (let i = 0; i <= posts; i++) {
        const p = pt(i / posts).addScaledVector(side, s * 0.66);
        k.box(0.07, 0.66, 0.07, C.wood2, p.x, p.y, p.z, { wonk: 0 });
      }
    }
    for (const end of [A, B]) {
      for (const s of [-1, 1]) {
        const p = end.clone().addScaledVector(side, s * 0.86);
        k.box(0.22, 1.3, 0.22, C.wood2, p.x, p.y, p.z);
        k.glow(0.16, 0.2, 0.16, C.win, p.x, p.y + 1.3, p.z);
      }
    }
  }
  return k.build();
}

// 通往未來島的漂浮石階
export function buildCloudSteps(from, to, defs, islands) {
  const k = new Kit(405);
  const A = edgePoint(defs[from], islands[from].group, islands[to].group.position);
  const B = edgePoint(defs[to], islands[to].group, islands[from].group.position);
  const n = Math.round(A.distanceTo(B) / 2.2);
  for (let i = 1; i < n; i++) {
    const p = A.clone().lerp(B, i / n);
    p.y += Math.sin((i / n) * Math.PI) * 0.8;
    k.at(p.x + k.rand(-0.3, 0.3), p.y, p.z + k.rand(-0.3, 0.3), k.rand(6), 1, () => {
      k.cyl(1, 0.3, '#c9bb9f', 0, -0.3, 0, { seg: 7 });
      k.cone(0.9, 1, '#94795a', 0, -1.3, 0, { seg: 6, rx: Math.PI, y: -0.82 });
      k.cyl(0.92, 0.1, '#9dbd58', 0, 0, 0, { seg: 7, wonk: 0 });
    });
  }
  return k.build();
}

const arcMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false,
  uniforms: { uTime: shared.uTime, uA: { value: 0 } },
  vertexShader: `varying float vU; void main(){ vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uA; varying float vU;
    void main(){
      float dash = step(.5, fract(vU * 18. - uTime * .7));
      vec3 c = mix(vec3(1., .86, .42), vec3(1., .5, .3), vU);
      gl_FragColor = vec4(c, dash * uA);
    }`,
});

export function buildArcs(list, islands) {
  const group = new THREE.Group();
  group.renderOrder = 9;
  list.forEach(([a, b]) => {
    const A = islands[a].group.position.clone().add(new THREE.Vector3(0, 4, 0));
    const B = islands[b].group.position.clone().add(new THREE.Vector3(0, 4, 0));
    const mid = A.clone().lerp(B, 0.5).add(new THREE.Vector3(0, A.distanceTo(B) * 0.3 + 6, 0));
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.32, 6, false), arcMat);
    m.renderOrder = 9;
    group.add(m);
  });
  group.visible = false;
  return { group, mat: arcMat };
}

// 降雨：環繞鏡頭的線段粒子
export class Rain {
  constructor(scene) {
    const n = 1400;
    this.area = 150;
    const pos = new Float32Array(n * 6);
    this.seeds = [];
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * this.area * 2, y = Math.random() * 120 - 30, z = (Math.random() - 0.5) * this.area * 2;
      pos.set([x, y, z, x + 0.1, y - 2.8, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: shared.uTime, uA: { value: 0 } },
      vertexShader: `uniform float uTime; void main(){ vec3 p = position; p.y = mod(p.y - uTime * 62. + 30., 120.) - 30.; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: `uniform float uA; void main(){ gl_FragColor = vec4(.82, .9, 1., .36 * uA); }`,
    });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  set(level) {
    this.mat.uniforms.uA.value = level;
    this.mesh.visible = level > 0.02;
  }
}
