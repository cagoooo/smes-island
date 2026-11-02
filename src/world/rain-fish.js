// 島上水池的魚：平常繞著水面游，下雨時游得更快、躍出水面，水面也會泛起雨圈與水花
import * as THREE from 'three';
import { Kit, makeRng } from './kit.js';

const RINGS = 48;
const DROPS = 160;
const GRAVITY = 11;
const PATH = 0.78; // 沿水池邊緣游，避開中央的書本與雕像
const RIPPLES_PER_SEC = 16;
const COLORS = ['#e8452f', '#ef8a32', '#fff3e4', '#e8452f', '#f2c230'];

const D = new THREE.Object3D();
const P = new THREE.Vector3();
const COL = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class RainFish {
  constructor(scene, islands, calm) {
    this.calm = calm;
    this.onLand = null;
    this.w = 0;
    const lake = islands.walk.dyn.find((d) => d.lake);
    this.ponds = [
      { group: islands.course.group, x: 0, z: 1.6, rx: 8.2, rz: 5.4, y: 0.24, n: 6, s: 1.1 },
      { group: islands.walk.group, x: 0.8, z: -3.4, rx: 7.2, rz: 3.6, lake: lake.obj, n: 4, s: 0.9 },
      { group: islands.library.group, x: 0.4, z: 4, rx: 3.3, rz: 2.1, y: 0.2, n: 3, s: 0.8 },
      { group: islands.core.group, x: 0, z: 12.3, rx: 2, rz: 1.5, y: 0.2, n: 2, s: 0.7 },
    ];
    const r = makeRng(77);
    this.fish = [];
    for (const pond of this.ponds) {
      for (let i = 0; i < pond.n; i++) {
        this.fish.push({ pond, a: (i / pond.n) * 6.283 + r(), dir: r() > 0.3 ? 1 : -1, sp: 0.22 + r() * 0.16, ph: r() * 6.28, u: -1, wait: r() * 4, h: 1 + r() * 0.9, dur: 0.85 + r() * 0.4 });
      }
    }
    const k = new Kit(55);
    k.ball(0.3, '#ffffff', 0, 0, 0, { sx: 0.5, sy: 0.6, sz: 1.2, jitter: 0, wonk: 0 });
    k.ball(0.17, '#ffe2c6', 0, 0.1, 0.1, { sx: 0.8, sy: 0.6, sz: 1.2, jitter: 0, wonk: 0 });
    k.cone(0.16, 0.3, '#d8c4b0', 0, -0.14, -0.46, { seg: 3, sz: 0.2, rx: -1.57, jitter: 0, wonk: 0 });
    this.mesh = new THREE.InstancedMesh(k.build().children[0].geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), this.fish.length);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.fish.forEach((_, i) => this.mesh.setColorAt(i, COL.set(COLORS[i % COLORS.length])));
    scene.add(this.mesh);

    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.86, 1, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), RINGS);
    this.rings.frustumCulled = false;
    this.ringLife = new Float32Array(RINGS);
    this.ringSize = new Float32Array(RINGS);
    this.ringAt = new Float32Array(RINGS * 3);
    this.ringPond = new Array(RINGS).fill(null);
    this.ringNext = 0;
    this.ripple = 0;
    for (let i = 0; i < RINGS; i++) { this.rings.setMatrixAt(i, ZERO); this.rings.setColorAt(i, COL.setScalar(0)); }
    scene.add(this.rings);

    this.drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#d6efff' }), DROPS);
    this.drops.frustumCulled = false;
    this.dropAt = new Float32Array(DROPS * 3);
    this.dropVel = new Float32Array(DROPS * 3);
    this.dropLife = new Float32Array(DROPS);
    this.dropSize = new Float32Array(DROPS);
    this.dropNext = 0;
    this.dropLive = 0;
    for (let i = 0; i < DROPS; i++) this.drops.setMatrixAt(i, ZERO);
    this.drops.visible = false;
    scene.add(this.drops);
  }

  surface(pond) {
    return pond.lake ? pond.lake.position.y + 0.12 : pond.y;
  }

  ring(pond, x, z, size) {
    const i = this.ringNext;
    this.ringNext = (i + 1) % RINGS;
    this.ringLife[i] = 1;
    this.ringSize[i] = size;
    this.ringPond[i] = pond;
    this.ringAt.set([x, this.surface(pond) + 0.03, z], i * 3);
  }

  // 水花：水面濺起，或從空中的雲魚甩下來
  spray(x, y, z, count, speed, size = 0.09) {
    for (let n = 0; n < count; n++) {
      const i = this.dropNext;
      this.dropNext = (i + 1) % DROPS;
      const a = Math.random() * 6.283, side = Math.random() * speed;
      this.dropAt.set([x, y, z], i * 3);
      this.dropVel.set([Math.cos(a) * side, speed * (0.5 + Math.random() * 0.8), Math.sin(a) * side], i * 3);
      this.dropLife[i] = 0.6 + Math.random() * 0.7;
      this.dropSize[i] = size * (0.6 + Math.random() * 0.8);
    }
    this.dropLive = 1.4;
    this.drops.visible = true;
  }

  splash(f, x, z, big) {
    const g = f.pond.group.position;
    this.ring(f.pond, x, z, big ? 1.1 : 0.7);
    this.spray(g.x + x, g.y + this.surface(f.pond) + 0.1, g.z + z, big ? 12 : 7, big ? 2.6 : 1.8);
    if (big) this.onLand?.(P.set(g.x + x, g.y, g.z + z));
  }

  swim(f, dt, wet) {
    const pace = f.sp * (1 + this.w * 1.6);
    if (f.u >= 0) {
      f.u += dt / f.dur;
      f.a += f.dir * pace * dt * 2.2;
      if (f.u >= 1) {
        f.u = -1;
        f.wait = 0.8 + Math.random() * 3.2;
        const { rx, rz } = f.pond;
        this.splash(f, Math.cos(f.a) * rx * PATH, Math.sin(f.a) * rz * PATH, true);
      }
      return;
    }
    f.a += f.dir * pace * dt;
    if (!wet || this.calm) return;
    f.wait -= dt;
    if (f.wait <= 0) {
      f.u = 0;
      const { rx, rz } = f.pond;
      this.splash(f, Math.cos(f.a) * rx * PATH, Math.sin(f.a) * rz * PATH, false);
    }
  }

  drawFish(f, i, t) {
    const { pond } = f;
    const g = pond.group.position;
    const lx = pond.x + Math.cos(f.a) * pond.rx * PATH, lz = pond.z + Math.sin(f.a) * pond.rz * PATH;
    const tx = -Math.sin(f.a) * pond.rx * f.dir, tz = Math.cos(f.a) * pond.rz * f.dir;
    const leap = f.u >= 0 ? Math.sin(f.u * Math.PI) : 0;
    D.position.set(g.x + lx, g.y + this.surface(pond) + leap * f.h * pond.s * 1.4, g.z + lz);
    D.rotation.order = 'YXZ';
    D.rotation.set(f.u >= 0 ? (f.u - 0.5) * 2.2 : 0, Math.atan2(tx, tz) + Math.sin(t * 7 + f.ph) * (f.u >= 0 ? 0.28 : 0.14), f.u >= 0 ? Math.sin(f.u * 9) * 0.3 : 0);
    D.scale.setScalar(pond.s * (1 + leap * 0.15));
    D.updateMatrix();
    this.mesh.setMatrixAt(i, D.matrix);
  }

  updateRings(dt, wet) {
    if (wet && !this.calm) {
      this.ripple += dt * RIPPLES_PER_SEC * this.w;
      while (this.ripple >= 1) {
        this.ripple -= 1;
        const pond = this.ponds[Math.floor(Math.random() ** 1.4 * this.ponds.length)];
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * 0.92;
        const near = pond === this.ponds[0] ? 0.6 + d * 0.4 : d; // 書海中央是書本，雨圈落在外圈
        this.ring(pond, pond.x + Math.cos(a) * pond.rx * near, pond.z + Math.sin(a) * pond.rz * near, 0.28 + Math.random() * 0.26);
      }
    }
    for (let i = 0; i < RINGS; i++) {
      if (this.ringLife[i] <= 0) continue;
      this.ringLife[i] -= dt * 1.5;
      const life = Math.max(0, this.ringLife[i]);
      const g = this.ringPond[i].group.position;
      const s = this.ringSize[i] * (1.7 - life * 1.3);
      D.position.set(g.x + this.ringAt[i * 3], g.y + this.ringAt[i * 3 + 1], g.z + this.ringAt[i * 3 + 2]);
      D.rotation.set(0, 0, 0);
      D.scale.set(s, 1, s);
      D.updateMatrix();
      this.rings.setMatrixAt(i, life > 0 ? D.matrix : ZERO);
      this.rings.setColorAt(i, COL.setScalar(life * 0.8)); // 疊加混色，越暗越透明
    }
    this.rings.instanceMatrix.needsUpdate = true;
    this.rings.instanceColor.needsUpdate = true;
  }

  updateDrops(dt) {
    const { dropAt: at, dropVel: vel, dropLife: life, dropSize: size } = this;
    for (let i = 0; i < DROPS; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { this.drops.setMatrixAt(i, ZERO); continue; }
      const j = i * 3;
      vel[j + 1] -= GRAVITY * dt;
      for (let c = 0; c < 3; c++) at[j + c] += vel[j + c] * dt;
      D.position.set(at[j], at[j + 1], at[j + 2]);
      D.rotation.set(0, 0, 0);
      D.scale.setScalar(size[i]);
      D.updateMatrix();
      this.drops.setMatrixAt(i, D.matrix);
    }
    this.drops.instanceMatrix.needsUpdate = true;
    this.dropLive -= dt;
    if (this.dropLive <= 0) this.drops.visible = false;
  }

  update(t, dt, wet) {
    this.w += ((wet ? 1 : 0) - this.w) * (1 - Math.exp(-dt * 1.2));
    this.fish.forEach((f, i) => {
      this.swim(f, dt, wet);
      this.drawFish(f, i, t);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.updateRings(dt, wet);
    if (this.drops.visible) this.updateDrops(dt);
  }
}
