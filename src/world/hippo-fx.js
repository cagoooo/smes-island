// 找到小河馬的場景特效：翻跳、彩紙、光暈、頭上的金星與尚未找到時的閃光提示
import * as THREE from 'three';

const PIECES = 340;
const COLORS = ['#d9432f', '#f2c230', '#3d86c6', '#5ea85a', '#ef8fa3', '#7a5a9c', '#fff4d2'];
const GRAVITY = 6.5;
const DRAG = 1.1;
const HOP_TIME = 1.7;
const BASE = 1.15;
const STAR_Y = 1.02;

const D = new THREE.Object3D();
const P = new THREE.Vector3();
const COL = new THREE.Color();

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.3, 'rgba(255,255,255,.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class HippoFx {
  constructor(scene, hippos, calm) {
    this.hippos = hippos;
    this.calm = calm;
    this.byId = Object.fromEntries(hippos.map((h) => [h.id, h]));
    this.queue = [];
    this.clock = 0;
    this.next = 0;
    this.alive = 0;
    this.pos = new Float32Array(PIECES * 3);
    this.vel = new Float32Array(PIECES * 3);
    this.rot = new Float32Array(PIECES * 3);
    this.spin = new Float32Array(PIECES * 3);
    this.life = new Float32Array(PIECES);
    this.size = new Float32Array(PIECES);

    this.paper = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.62), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), PIECES);
    this.paper.frustumCulled = false;
    this.paper.visible = false;
    for (let i = 0; i < PIECES; i++) this.paper.setColorAt(i, COL.set(COLORS[i % COLORS.length]));
    scene.add(this.paper);

    const soft = softTexture();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: '#ffd76a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    this.flash.visible = false;
    this.flashLife = 0;
    this.flashSize = 1;
    scene.add(this.flash);

    this.glintAt = new Float32Array(hippos.length * 3);
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.BufferAttribute(this.glintAt, 3));
    this.glint = new THREE.Points(shape, new THREE.PointsMaterial({ size: 1.8, map: soft, color: '#fff3b8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.glint.frustumCulled = false;
    scene.add(this.glint);

    const starGeo = new THREE.OctahedronGeometry(0.17, 0);
    const starMat = new THREE.MeshStandardMaterial({ color: '#ffc93c', emissive: '#ff9d00', emissiveIntensity: 0.7, flatShading: true });
    for (const h of hippos) {
      h.star = new THREE.Mesh(starGeo, starMat);
      h.star.position.y = STAR_Y;
      h.star.scale.setScalar(0);
      h.star.scale.y = 0;
      h.mesh.add(h.star);
      h.found = false;
      h.hop = null;
    }
  }

  // 重新開啟網站時，已找到的直接戴上金星
  restore(ids) {
    for (const id of ids) {
      const h = this.byId[id];
      if (!h) continue;
      h.found = true;
      h.star.scale.set(1, 1.5, 1);
    }
  }

  hop(id, power = 1) {
    const h = this.byId[id];
    if (!h || this.calm) return;
    const was = h.hop;
    h.hop = { u: 0, y: was ? was.y : h.mesh.position.y, ry: was ? was.ry : h.mesh.rotation.y, power };
  }

  burst(at, count, reach, size) {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (i + 1) % PIECES;
      const a = Math.random() * 6.283, up = 0.45 + Math.random() * 0.55;
      const sp = reach * (0.45 + Math.random() * 0.75);
      const side = Math.sqrt(1 - up * up) * sp;
      this.pos.set([at.x, at.y + 0.6, at.z], i * 3);
      this.vel.set([Math.cos(a) * side, up * sp, Math.sin(a) * side], i * 3);
      this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
      this.spin.set([4 + Math.random() * 8, 3 + Math.random() * 7, 2 + Math.random() * 5], i * 3);
      this.life[i] = 1.5 + Math.random() * 1;
      this.size[i] = size * (0.7 + Math.random() * 0.6);
    }
    this.alive = 3;
    this.paper.visible = true;
  }

  pop(h, k, count) {
    if (this.calm) return;
    h.mesh.getWorldPosition(P);
    this.burst(P, count, 7 * k, 0.16 * k);
    this.flash.position.set(P.x, P.y + 0.7, P.z);
    this.flashSize = 5.5 * k;
    this.flashLife = 1;
    this.flash.visible = true;
  }

  found(id, camera) {
    const h = this.byId[id];
    if (!h) return;
    h.found = true;
    h.mesh.getWorldPosition(P);
    const k = Math.max(1, Math.min(3.5, camera.position.distanceTo(P) / 55));
    this.hop(id);
    this.pop(h, k, 70);
  }

  // 全部找到：每座島輪流噴彩紙，所有小河馬一起跳
  celebrate() {
    this.clock = 0;
    this.queue = [];
    if (this.calm) return;
    [0, 1.1, 2.2].forEach((round) => this.hippos.forEach((h, i) => this.queue.push({ at: round + i * 0.07, h })));
  }

  updateHop(h, dt) {
    const a = h.hop, m = h.mesh;
    const n = a.power < 1 ? 1 : 3;
    a.u = Math.min(1, a.u + dt / (HOP_TIME * (a.power < 1 ? 0.45 : 1)));
    const s = Math.abs(Math.sin(a.u * Math.PI * n));
    const landing = 1 - s;
    m.position.y = a.y + s * 1.5 * a.power * (1 - a.u * 0.35);
    const wide = 1 + landing * 0.16 * (1 - a.u) - s * 0.08;
    m.scale.set(BASE * wide, BASE * (1 + s * 0.2 - landing * 0.14 * (1 - a.u)), BASE * wide);
    m.rotation.y = a.ry + (1 - (1 - a.u) ** 3) * 6.283 * (a.power < 1 ? 0 : 1);
    if (a.u >= 1) {
      m.position.y = a.y;
      m.rotation.y = a.ry;
      m.scale.setScalar(BASE);
      h.hop = null;
    }
  }

  updatePaper(dt) {
    const { pos, vel, rot, spin, life, size } = this;
    const drag = Math.exp(-DRAG * dt);
    for (let i = 0; i < PIECES; i++) {
      if (life[i] <= 0) {
        if (life[i] > -1) { life[i] = -2; this.paper.setMatrixAt(i, D.matrix.makeScale(0, 0, 0)); }
        continue;
      }
      life[i] -= dt;
      const j = i * 3;
      vel[j] *= drag; vel[j + 2] *= drag;
      vel[j + 1] = vel[j + 1] * drag - GRAVITY * dt;
      for (let c = 0; c < 3; c++) {
        pos[j + c] += vel[j + c] * dt;
        rot[j + c] += spin[j + c] * dt;
      }
      D.position.set(pos[j], pos[j + 1], pos[j + 2]);
      D.rotation.set(rot[j], rot[j + 1], rot[j + 2]);
      D.scale.setScalar(size[i] * Math.min(1, life[i] * 2.5));
      D.updateMatrix();
      this.paper.setMatrixAt(i, D.matrix);
    }
    this.paper.instanceMatrix.needsUpdate = true;
    this.alive -= dt;
    if (this.alive <= 0) this.paper.visible = false;
  }

  update(t, dt) {
    this.clock += dt;
    while (this.queue.length && this.queue[0].at <= this.clock) {
      const { h } = this.queue.shift();
      this.hop(h.id);
      this.pop(h, 2.6, 22);
    }
    let hidden = 0;
    this.hippos.forEach((h, i) => {
      if (h.hop) this.updateHop(h, dt);
      if (h.found) {
        const s = h.star.scale;
        const target = 1 + Math.sin(t * 2.4 + i) * 0.08;
        s.x += (target - s.x) * Math.min(1, dt * 6);
        s.z = s.x;
        s.y = s.x * 1.5;
        h.star.rotation.y += dt * 1.8;
        h.star.position.y = STAR_Y + Math.sin(t * 1.9 + i) * 0.06;
        return;
      }
      h.mesh.getWorldPosition(P);
      this.glintAt.set([P.x, P.y + 0.75, P.z], hidden * 3);
      hidden += 1;
    });
    this.glint.geometry.setDrawRange(0, hidden);
    this.glint.geometry.attributes.position.needsUpdate = true;
    this.glint.visible = hidden > 0 && !this.calm;
    this.glint.material.opacity = Math.max(0, Math.sin(t * 1.7)) ** 4 * 0.9;
    if (this.paper.visible) this.updatePaper(dt);
    if (this.flash.visible) {
      this.flashLife -= dt * 2.2;
      const f = Math.max(0, this.flashLife);
      this.flash.material.opacity = f * 0.85;
      this.flash.scale.setScalar(this.flashSize * (1.3 - f * 0.7));
      if (f <= 0) this.flash.visible = false;
    }
  }
}
