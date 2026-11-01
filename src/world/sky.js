// 天空、日月星辰與光照：依真實時間與天氣改變整個世界的氣氛
import * as THREE from 'three';
import { shared } from './materials.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const K = {
  night: { top: '#12274f', mid: '#27406f', hor: '#4a6090', sun: '#c2d3f5', hemiS: '#6f8cc8', hemiG: '#3a4260', dir: 1.7, hemi: 1.9, cloud: '#aebfe0', under: '#55689e', exp: 0.95 },
  dawn: { top: '#3f6db4', mid: '#8fa9d4', hor: '#f6b98b', sun: '#ffb678', hemiS: '#a9bde0', hemiG: '#8a6a58', dir: 2.2, hemi: 0.95, cloud: '#ffe2cf', under: '#c98f95', exp: 1 },
  day: { top: '#2f8fd8', mid: '#7cc0ea', hor: '#d9eff5', sun: '#fff1d2', hemiS: '#cfe7ff', hemiG: '#a58f6b', dir: 3.1, hemi: 1.25, cloud: '#ffffff', under: '#b9d2e6', exp: 1 },
  storm: { top: '#5d6f82', mid: '#8293a3', hor: '#b4bfc6', sun: '#dfe4ea', hemiS: '#b3bfca', hemiG: '#6f6a60', dir: 0.9, hemi: 1.15, cloud: '#c6ced6', under: '#7e8b99', exp: 0.96 },
};
const ck = {};
for (const [n, v] of Object.entries(K)) {
  ck[n] = {};
  for (const [a, b] of Object.entries(v)) ck[n][a] = typeof b === 'string' ? new THREE.Color(b) : b;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0.5, 0.5, -0.6) }, uSunCol: { value: new THREE.Color() }, uSunVis: { value: 1 }, uStars: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.uniforms,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * p; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop, uMid, uHor, uSunCol, uSunDir; uniform float uSunVis; varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir);
            float h = clamp(d.y * .5 + .5, 0., 1.);
            vec3 col = mix(uHor, uMid, smoothstep(.46, .6, h));
            col = mix(col, uTop, smoothstep(.56, .86, h));
            float s = max(dot(d, normalize(uSunDir)), 0.);
            col += uSunCol * (pow(s, 900.) * 3. + pow(s, 60.) * .32 + pow(s, 6.) * .12) * uSunVis;
            gl_FragColor = vec4(col, 1.);
            #include <colorspace_fragment>
          }`,
      }),
    );
    dome.renderOrder = -10;
    scene.add(dome);
    this.dome = dome;

    const n = 900;
    const pos = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.46 + 0.5;
      const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
      pos.set([Math.sin(ph) * Math.cos(th) * 860, Math.cos(ph) * 860, Math.sin(ph) * Math.sin(th) * 860], i * 3);
      sizes[i] = Math.random();
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aS', new THREE.BufferAttribute(sizes, 1));
    this.starMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uStars: this.uniforms.uStars, uTime: shared.uTime, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aS; uniform float uTime, uPx; varying float vA;
        void main(){ vA = .35 + .65 * abs(sin(uTime * (.4 + aS) + aS * 40.)); gl_PointSize = (1.2 + aS * 2.2) * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */ `
        uniform float uStars; varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(1., .97, .9, smoothstep(.5, .1, d) * vA * uStars); }`,
    });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    scene.add(this.stars);

    this.moon = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14), new THREE.MeshBasicMaterial({ color: '#fdf3d0', fog: false, transparent: true }));
    scene.add(this.moon);

    this.dir = new THREE.DirectionalLight('#ffffff', 2);
    this.dir.castShadow = true;
    this.dir.shadow.bias = -0.0006;
    this.dir.shadow.normalBias = 0.05;
    const c = this.dir.shadow.camera;
    c.left = -120; c.right = 120; c.top = 100; c.bottom = -100; c.near = 40; c.far = 460;
    scene.add(this.dir, this.dir.target);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#887766', 1);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog('#ffffff', 460, 1300);
    this.state = { hour: 12, sunrise: 6, sunset: 17.5, cloud: 0.2 };
    this.env = { night: 0, wind: 8, rain: 0, fog: 0, thunder: false };
    this.cloudCol = new THREE.Color();
    this.underCol = new THREE.Color();
  }

  setShadowSize(s) {
    this.dir.shadow.mapSize.set(s, s);
    if (this.dir.shadow.map) { this.dir.shadow.map.dispose(); this.dir.shadow.map = null; }
  }

  // hour: 0–24（台灣時間），cloud: 0–1 陰天程度
  update({ hour, sunrise, sunset, cloud }) {
    const up = hour > sunrise - 1 && hour < sunset + 1;
    const dayLen = sunset - sunrise;
    const p = (hour - sunrise) / dayLen;
    const elev = Math.sin(clamp(p, -0.12, 1.12) * Math.PI); // 太陽高度 -0.4…1
    const dayT = smooth(-0.14, 0.34, up ? elev : -0.3);
    const golden = up ? Math.max(0, 1 - Math.abs(elev - 0.08) / 0.34) : 0;
    const night = 1 - smooth(-0.2, 0.08, up ? elev : -0.4);
    const pick = (key) => {
      const col = new THREE.Color().copy(ck.night[key]).lerp(ck.day[key], dayT).lerp(ck.dawn[key], golden * 0.86);
      return col.lerp(ck.storm[key], cloud * 0.8 * (1 - night * 0.7));
    };
    const num = (key) => lerp(lerp(lerp(K.night[key], K.day[key], dayT), K.dawn[key], golden * 0.86), K.storm[key], cloud * 0.8 * (1 - night * 0.7));
    this.uniforms.uTop.value.copy(pick('top'));
    this.uniforms.uMid.value.copy(pick('mid'));
    this.uniforms.uHor.value.copy(pick('hor'));
    this.uniforms.uSunCol.value.copy(ck.dawn.sun).lerp(ck.day.sun, smooth(0.1, 0.5, elev));
    this.uniforms.uStars.value = night * (1 - cloud * 0.8);
    this.uniforms.uSunVis.value = (1 - cloud * 0.92) * (1 - night);
    // 太陽視覺路徑：由東（右後）往西（左）
    const ang = clamp(p, -0.1, 1.1) * Math.PI;
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.9, Math.max(elev, -0.25) * 0.72, -0.46).normalize();
    this.uniforms.uSunDir.value.copy(sunDir);
    this.moon.position.set(-340, 300, -520);
    this.moon.material.opacity = night * (1 - cloud * 0.7);
    this.moon.visible = this.moon.material.opacity > 0.02;
    // 主光：低於地平線時改用月光方向，並保持足夠斜度
    const l = night > 0.5
      ? new THREE.Vector3(-0.55, 0.72, 0.42)
      : new THREE.Vector3(sunDir.x * 0.9, Math.max(sunDir.y, 0.46), 0.48);
    this.dir.position.copy(l.normalize().multiplyScalar(230));
    this.dir.color.copy(pick('sun'));
    this.dir.intensity = num('dir');
    this.hemi.color.copy(pick('hemiS'));
    this.hemi.groundColor.copy(pick('hemiG'));
    this.hemi.intensity = num('hemi');
    this.scene.fog.color.copy(this.uniforms.uHor.value);
    this.cloudCol.copy(pick('cloud'));
    this.underCol.copy(pick('under'));
    shared.uGlow.value = smooth(0.2, 0.85, night + cloud * 0.25);
    this.env.night = night;
    this.state = { hour, sunrise, sunset, cloud };
  }
}
