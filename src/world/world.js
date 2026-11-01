// 3D 世界總控：場景、鏡頭、互動、畫質調節與主迴圈
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { buildIsland } from './islands.js';
import { waterfall } from './base.js';
import { Sky } from './sky.js';
import { Clouds } from './clouds.js';
import { Life } from './life.js';
import { buildBridges, buildCloudSteps, buildArcs, Rain } from './links.js';
import { shared, fallMat } from './materials.js';
import { ISLANDS, BRIDGES, STEPS, LINKS, TALL } from '../data/site.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FALLS = { core: [[2.6, 6], [0.6, 4.6]], course: [[1.5, 3.2]], walk: [[1, 4]], inquiry: [[-0.5, 2.4]], forest: [[-2.2, 3]], future: [[0.9, 2.6]], library: [[2.2, 2.6]] };

export class World {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.tier = this.detectTier();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.tier === 'low' ? 1.25 : 1.75);
    this.renderer.setPixelRatio(this.dpr);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 2, 2400);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 16, maxDistance: 950, maxPolarAngle: Math.PI * 0.53, minPolarAngle: 0.02, rotateSpeed: 0.55, zoomSpeed: 0.8, panSpeed: 0.8 });
    this.controls.screenSpacePanning = true;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    this.sky = new Sky(this.scene);
    this.sky.setShadowSize(this.tier === 'high' ? 2048 : 1024);
    this.clouds = new Clouds(this.scene, this.tier === 'low' ? 0.55 : 1);
    this.rain = new Rain(this.scene);
    this.env = { night: 0, wind: 8, kidsVisible: 'all' };
    this.timeMode = 'live';
    this.weather = { cloud: 0.15, rain: 0, wind: 8, thunder: false };
    this.sun = { sunrise: 6.1, sunset: 17.4 };

    this.defs = Object.fromEntries(ISLANDS.map((d) => [d.id, d]));
    this.islands = {};
    this.setupFrame = 0;
    this.pointer = new THREE.Vector2();
    this.ray = new THREE.Raycaster();
    this.flight = null;
    this.paused = false;
    this.tilt = this.tier === 'high';
    this.target = new THREE.Vector3();
    this.hovered = null;
    this.frames = [];
    this.lastT = performance.now();
    this.time = 0;
    this.reservoirLevel = 0.9;
    this.inset = { x: 0, y: 0 };
    this.insetTarget = { x: 0, y: 0 };
  }

  detectTier() {
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1000);
    const mem = navigator.deviceMemory || 8;
    const core = navigator.hardwareConcurrency || 8;
    if (mem <= 3 || core <= 3) return 'low';
    return mobile ? 'mid' : 'high';
  }

  // 分批建島，讓載入畫面能更新進度
  async build(onProgress) {
    const step = async (label, p, fn) => {
      onProgress(p, label);
      await new Promise((r) => setTimeout(r, 0));
      fn();
    };
    const msgs = ['堆起古老石牆…', '垂下樹根與藤蔓…', '攤開那本大書…', '放滿水庫的水…', '升起訊號塔…', '請大河馬就位…', '點亮燈塔…', '轉動工坊齒輪…', '掛上星星…', '搭起森林小屋…', '繫好鯉魚飛艇…', '迎接第一道曙光…'];
    for (let i = 0; i < ISLANDS.length; i++) {
      const d = ISLANDS[i];
      await step(msgs[i], (i + 1) / (ISLANDS.length + 2), () => {
        const built = buildIsland(d);
        // 直向畫面把群島排成上下較長的隊形，名牌才不會疊在一起
        const tall = window.innerWidth / window.innerHeight < 0.8;
        built.group.position.set(tall ? TALL[d.id][0] : d.pos.x, d.pos.y, tall ? TALL[d.id][1] : d.pos.z);
        this.scene.add(built.group);
        built.base = d.pos.y;
        built.phase = i * 1.3;
        this.islands[d.id] = built;
        for (const [ang, w] of FALLS[d.id] || []) {
          const dep = Math.hypot(d.r) * 0.96;
          const f = waterfall(Math.cos(ang) * dep, 0.1, Math.sin(ang) * dep, ang, w, 54 + d.pos.y);
          built.group.add(f);
        }
      });
    }
    await step('架起吊橋…', 0.93, () => {
      this.scene.add(buildBridges(BRIDGES, this.defs, this.islands));
      STEPS.forEach(([a, b]) => this.scene.add(buildCloudSteps(a, b, this.defs, this.islands)));
      this.arcs = buildArcs(LINKS.map((l) => [l.a, l.b]), this.islands);
      this.scene.add(this.arcs.group);
    });
    await step('放出鱻鯉雲魚…', 0.97, () => {
      this.life = new Life(this.scene, this.islands, { kids: this.tier === 'low' ? 40 : 84 });
      this.addHighlights();
      this.setupComposer();
    });
    this.resize();
    this.setView('home', true);
    this.bind();
    onProgress(1, '完成！');
  }

  addHighlights() {
    for (const d of ISLANDS) {
      const m = new THREE.Mesh(new THREE.RingGeometry(d.r * 1.03, d.r * 1.14, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.position.y = -0.2;
      m.renderOrder = 3;
      this.islands[d.id].group.add(m);
      this.islands[d.id].ring = m;
      // 點選用的簡化碰撞體
      const c = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r * 0.5, 14 + (d.id === 'core' ? 8 : 0), 12), new THREE.MeshBasicMaterial({ visible: false }));
      c.position.y = -3;
      c.userData.island = d.id;
      this.islands[d.id].group.add(c);
      this.islands[d.id].collider = c;
    }
    this.colliders = Object.values(this.islands).map((i) => i.collider);
    this.hippoMeshes = this.life.hippos.map((h) => h.mesh);
  }

  setupComposer() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.hTilt = new ShaderPass(HorizontalTiltShiftShader);
    this.vTilt = new ShaderPass(VerticalTiltShiftShader);
    this.hTilt.uniforms.r.value = 0.5;
    this.vTilt.uniforms.r.value = 0.5;
    this.composer.addPass(this.hTilt);
    this.composer.addPass(this.vTilt);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w; this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(this.dpr);
    this.sky.starMat.uniforms.uPx.value = this.dpr;
    if (this.composer) {
      this.composer.setPixelRatio(this.dpr);
      this.composer.setSize(w, h);
      this.hTilt.uniforms.h.value = 2.2 / (w * this.dpr);
      this.vTilt.uniforms.v.value = 2.2 / (h * this.dpr);
    }
    this.insetDirty = true;
  }

  overviewDistance() {
    const a = this.width / this.height;
    if (a < 0.8) return 205 / a;
    return 208 * Math.max(1, 1.5 / a) ** 0.98;
  }

  setView(name, instant = false) {
    this.viewName = name;
    const d = this.overviewDistance();
    const portrait = this.width / this.height < 0.8;
    const poses = {
      // 直向畫面把鏡頭轉 90 度，讓東西向較寬的群島改成上下排列
      home: portrait
        ? { pos: new THREE.Vector3(0, d * 0.86, d * 0.5), tgt: new THREE.Vector3(0, 2, 4) }
        : { pos: new THREE.Vector3(0, d * 0.56, d * 0.84), tgt: new THREE.Vector3(0, 4, 2) },
      top: portrait
        ? { pos: new THREE.Vector3(0.5, d * 1.02, 0), tgt: new THREE.Vector3(0, 0, 0) }
        : { pos: new THREE.Vector3(0, d * 1.18, 0.5), tgt: new THREE.Vector3(0, 0, 0) },
    };
    const p = poses[name] || poses.home;
    this.controls.minDistance = 16;
    if (instant) {
      this.camera.position.copy(p.pos);
      this.controls.target.copy(p.tgt);
      this.controls.update();
    } else this.flyTo(p.pos, p.tgt, 1.5);
  }

  flyTo(pos, tgt, dur = 1.5, done) {
    this.flight = { t: 0, dur, fromPos: this.camera.position.clone(), fromTgt: this.controls.target.clone(), pos, tgt, done };
    this.controls.enabled = false;
  }

  focusIsland(id) {
    const d = this.defs[id];
    const g = this.islands[id].group.position;
    const dist = d.zoom * (this.width < this.height ? 1.45 : 1) * (d.id === 'core' ? 1.06 : 1);
    const dirFromCenter = new THREE.Vector3(g.x, 0, g.z);
    const heading = dirFromCenter.lengthSq() < 1 ? 0 : Math.atan2(dirFromCenter.x, dirFromCenter.z) * 0.16;
    const dir = new THREE.Vector3(Math.sin(heading), 0.56, Math.cos(heading)).normalize();
    const lift = id === 'core' ? 6 : 2;
    const tgt = new THREE.Vector3(g.x, g.y + lift, g.z);
    const pos = tgt.clone().addScaledVector(dir, dist);
    this.focused = id;
    this.flyTo(pos, tgt, 1.6);
  }

  // 面板佔去的畫面寬高：讓場景落在剩餘區域的中央
  setInset(x, y) { this.insetTarget = { x, y }; }

  clearFocus() { this.focused = null; }

  setHoverRing(id) {
    for (const [k, is] of Object.entries(this.islands)) is.ringTarget = k === id ? 0.78 : 0;
  }

  bind() {
    const c = this.canvas;
    let downAt = null;
    const update = (e) => {
      const r = c.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    c.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; this.hooks.onInteract?.(); });
    c.addEventListener('pointermove', (e) => {
      update(e);
      if (e.pointerType === 'mouse' && !this.flight) this.hoverDirty = true;
    });
    c.addEventListener('pointerleave', () => { this.setHover(null); });
    c.addEventListener('pointerup', (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
      const quick = performance.now() - downAt[2] < 500;
      downAt = null;
      if (moved > 7 || !quick) return;
      update(e);
      this.pick();
    });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input,textarea,select')) return;
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!step || this.flight) return;
      if (this.hooks.onArrow?.(e.key)) return;
      const k = 7;
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd).setY(0).normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const move = right.multiplyScalar(step[0] * k).addScaledVector(fwd, -step[1] * k);
      this.camera.position.add(move); this.controls.target.add(move);
    });
  }

  rayHit(list) {
    this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.intersectObjects(list, true)[0];
  }

  setHover(id) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.canvas.style.cursor = id ? 'pointer' : '';
    this.setHoverRing(id);
    this.hooks.onHover?.(id);
  }

  pick() {
    const hip = this.rayHit(this.hippoMeshes);
    if (hip) {
      let o = hip.object;
      while (o && !o.userData.hippo) o = o.parent;
      if (o) { this.hooks.onHippo?.(o.userData.hippo, o); return; }
    }
    const hit = this.rayHit(this.colliders);
    if (hit) this.hooks.onPick?.(hit.object.userData.island);
  }

  setTimeMode(mode) { this.timeMode = mode; this.applySky(); }

  setWeather(w) { Object.assign(this.weather, w); this.applySky(); }

  setSun(s) { this.sun = s; this.applySky(); }

  setReservoir(ratio) {
    this.reservoirLevel = ratio;
    const dyn = this.islands.walk?.dyn.find((d) => d.lake);
    if (dyn) dyn.obj.position.y = 0.3 + 1.02 * ratio;
  }

  setPaused(v) { this.paused = v; }

  setTilt(v) { this.tilt = v; }

  showArcs(v) { if (this.arcs) this.arcs.group.visible = v; this.arcTarget = v ? 1 : 0; }

  applySky() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const live = now.getHours() + now.getMinutes() / 60;
    const { sunrise, sunset } = this.sun;
    const hour = { live, day: 11, dusk: sunset - 0.1, night: 22 }[this.timeMode] ?? live;
    this.sky.update({ hour, sunrise, sunset, cloud: this.weather.cloud });
    this.env.night = this.sky.env.night;
    this.renderer.toneMappingExposure = 1 + this.env.night * 0.32;
    fallMat.uniforms.uTint.value.copy(this.sky.cloudCol);
    this.env.wind = this.weather.wind;
    this.rain.set(this.weather.rain);
    shared.uWind.value = 0.6 + Math.min(this.weather.wind, 30) / 18;
    const weekday = ![0, 6].includes(now.getDay());
    const schoolHours = hour >= 7.5 && hour <= 16.5;
    const previewDay = this.timeMode === 'day';
    this.env.kidsVisible = this.env.night > 0.5 ? 'none' : (weekday && schoolHours) || previewDay ? 'all' : 'few';
    this.env.schoolState = this.env.night > 0.5 ? '校園休息中' : this.env.kidsVisible === 'all' ? '孩子們正在校園裡' : '假日親子共讀時光';
    this.hooks.onEnv?.(this.env, hour);
  }

  step(now) {
    const real = (now - this.lastT) / 1000;
    const dt = Math.min(real, 0.1);
    this.lastT = now;
    if (!this.paused) this.time += dt;
    const t = this.time;
    shared.uTime.value = t;

    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + Math.min(real, 0.4) / f.dur);
      const e = ease(f.t);
      this.camera.position.lerpVectors(f.fromPos, f.pos, e);
      this.camera.position.y += Math.sin(e * Math.PI) * f.fromPos.distanceTo(f.pos) * 0.06;
      this.controls.target.lerpVectors(f.fromTgt, f.tgt, e);
      this.camera.lookAt(this.controls.target);
      if (f.t >= 1) {
        this.flight = null;
        this.controls.enabled = true;
        f.done?.();
      }
    }
    this.controls.update();
    const ins = this.inset, tar = this.insetTarget, k = Math.min(1, dt * 4.5);
    if (Math.abs(ins.x - tar.x) + Math.abs(ins.y - tar.y) > 0.4 || this.insetDirty) {
      ins.x += (tar.x - ins.x) * k;
      ins.y += (tar.y - ins.y) * k;
      this.insetDirty = false;
      this.camera.setViewOffset(this.width, this.height, ins.x, ins.y, this.width, this.height);
    }

    for (const id in this.islands) {
      const is = this.islands[id];
      is.group.position.y = is.base + Math.sin(t * 0.42 + is.phase) * 0.16;
      is.rocks.position.y = Math.sin(t * 0.6 + is.phase) * 0.36;
      is.rocks.rotation.y = t * 0.012;
      if (is.ring) {
        const m = is.ring.material;
        m.opacity += ((is.ringTarget || 0) - m.opacity) * Math.min(1, dt * 9);
        is.ring.visible = m.opacity > 0.01;
      }
      for (const d of is.dyn) d.update?.(t, this.env);
    }
    this.life.update(t, this.paused ? 0 : dt, this.env, this.islands);
    this.clouds.update(this.paused ? 0 : dt, this.sky);
    if (this.arcs) this.arcs.mat.uniforms.uA.value += ((this.arcTarget || 0) - this.arcs.mat.uniforms.uA.value) * Math.min(1, dt * 5);

    if (this.hoverDirty) {
      this.hoverDirty = false;
      const hit = this.rayHit(this.colliders);
      this.setHover(hit ? hit.object.userData.island : null);
    }
    // 陽光方向更新時才重畫陰影的週期
    this.renderer.shadowMap.autoUpdate = (this.setupFrame++ % (this.tier === 'high' ? 2 : 4)) === 0;

    if (this.tilt && this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    this.hooks.onFrame?.(this.camera, t);
    this.watchPerformance(dt);
  }

  // 自動降畫質，確保互動流暢
  watchPerformance(dt) {
    this.frames.push(dt);
    if (this.frames.length < 90) return;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.frames.length = 0;
    const fps = 1 / avg;
    this.fps = fps;
    if (document.hidden) return;
    if (fps < 28) {
      if (this.tilt) { this.tilt = false; this.hooks.onQuality?.('tilt-off'); }
      else if (this.dpr > 1) { this.dpr = Math.max(1, this.dpr - 0.3); this.resize(); }
      else if (this.tier !== 'low') { this.tier = 'low'; this.sky.setShadowSize(1024); }
    }
  }

  start() {
    this.applySky();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      this.step(now);
    };
    this.raf = requestAnimationFrame(loop);
    setInterval(() => this.applySky(), 60000);
  }
}
