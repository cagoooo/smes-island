// 棉花般的雲朵、腳下的深空與遠方積雨雲牆（龍之巢意象）
import * as THREE from 'three';
import { makeRng } from './kit.js';
import { shared } from './materials.js';

function puffGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 4.1 + 1) * Math.cos(v.y * 3.7) * Math.sin(v.z * 4.3 + 2) * 0.13 + Math.sin(v.x * 9 + v.z * 8) * 0.03;
    v.multiplyScalar(1 + n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const uni = { uCloud: { value: new THREE.Color('#ffffff') }, uUnder: { value: new THREE.Color('#b9d2e6') } };

function cloudMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uCloud = uni.uCloud;
    s.uniforms.uUnder = uni.uUnder;
    s.uniforms.uTime = shared.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vUp;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vUp = normal.y;
        transformed += normal * sin(uTime * .25 + position.x * 3. + position.z * 2.) * .025;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vUp;\nuniform vec3 uCloud, uUnder;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(uUnder, uCloud, smoothstep(-.7, .62, vUp));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * .2;`);
  };
  return m;
}

export class Clouds {
  constructor(scene, quality = 1) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const r = makeRng(77);
    const geo = puffGeometry();
    const mat = cloudMaterial();
    const dummy = new THREE.Object3D();

    // 腳下的深空：中央濃藍，往地平線漸淡
    this.floorUni = { uIn: { value: new THREE.Color('#3f9be0') }, uOut: { value: new THREE.Color('#d9eff5') } };
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(1500, 48).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        uniforms: this.floorUni, depthWrite: false,
        vertexShader: `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uIn, uOut; varying vec2 vP;
          void main(){
            float d = length(vP);
            vec3 c = mix(uIn, uOut, smoothstep(130., 1150., d));
            gl_FragColor = vec4(c, 1.);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.floor.position.y = -130;
    this.floor.renderOrder = -8;
    scene.add(this.floor);

    // 腳下成團的棉花雲：近處疏、遠處密
    const seaPuffs = [];
    const cluster = (cx, cy, cz, n, spread, size) => {
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
        seaPuffs.push([cx + Math.cos(a) * d, cy + (r() - 0.3) * size * 0.36, cz + Math.sin(a) * d * 0.72, size * (0.5 + r() * 0.75)]);
      }
    };
    const clusters = Math.round(92 * quality);
    for (let i = 0; i < clusters; i++) {
      const a = r() * Math.PI * 2;
      const near = i < clusters * 0.3;
      const d = near ? 60 + r() * 170 : 240 + r() * 640;
      const size = near ? 8 + r() * 8 : 16 + r() * 18;
      cluster(Math.cos(a) * d, -92 - r() * 24, Math.sin(a) * d, near ? 5 + Math.floor(r() * 4) : 6 + Math.floor(r() * 7), near ? 12 + r() * 16 : 20 + r() * 36, size);
    }
    this.sea = new THREE.InstancedMesh(geo, mat, seaPuffs.length);
    seaPuffs.forEach(([x, y, z, s], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(s * 1.25, s * 0.68, s);
      dummy.rotation.y = r() * 6.28;
      dummy.updateMatrix();
      this.sea.setMatrixAt(i, dummy.matrix);
    });
    this.sea.frustumCulled = false;
    this.group.add(this.sea);

    // 中層浮雲與遠方雲牆
    const puffs = [];
    const bank = (cx, cy, cz, spread, tall, n, base) => {
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
        const t = r();
        puffs.push({
          p: [cx + Math.cos(a) * d, cy + t * tall * (1 - (d / spread) * 0.72), cz + Math.sin(a) * d * 0.72],
          s: base * (0.55 + r() * 0.9) * (1 - t * 0.42),
        });
      }
    };
    bank(-320, -90, -520, 190, 380, 48, 70);
    bank(360, -90, -470, 150, 280, 36, 60);
    bank(40, -90, -680, 280, 230, 40, 72);
    bank(-560, -90, 40, 170, 230, 26, 56);
    bank(580, -90, 120, 170, 250, 28, 58);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + r(), d = 150 + r() * 120;
      bank(Math.cos(a) * d, -26 + r() * 40, Math.sin(a) * d, 24, 12, 7, 11);
    }
    this.mid = new THREE.InstancedMesh(geo, mat, puffs.length);
    puffs.forEach((pf, i) => {
      dummy.position.set(...pf.p);
      dummy.scale.set(pf.s * 1.15, pf.s * 0.84, pf.s);
      dummy.rotation.set(r(), r() * 6, r());
      dummy.updateMatrix();
      this.mid.setMatrixAt(i, dummy.matrix);
    });
    this.mid.frustumCulled = false;
    this.group2 = new THREE.Group();
    this.group2.add(this.mid);
    scene.add(this.group2);
  }

  update(dt, sky) {
    this.group.rotation.y += dt * 0.0035;
    this.group2.rotation.y -= dt * 0.0016;
    uni.uCloud.value.copy(sky.cloudCol);
    uni.uUnder.value.copy(sky.underCol);
    this.floorUni.uIn.value.copy(sky.uniforms.uTop.value).lerp(sky.uniforms.uMid.value, 0.25);
    this.floorUni.uOut.value.copy(sky.uniforms.uHor.value);
  }
}
