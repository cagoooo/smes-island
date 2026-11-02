// 颱風天的場景：雲海下方旋轉的颱風雲系、橫飛的落葉與閃電
import * as THREE from 'three';

const ARMS = 3;
const LEAVES = 90;
const SPAN = 190;
const LEAF_COLORS = ['#7fa23f', '#a7b84a', '#c79a3a', '#8a6a35'];
const DUMMY = new THREE.Object3D();

// 畫一張俯瞰的颱風雲圖：中央留出颱風眼，三條螺旋雲帶往外捲
function spiralTexture() {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;
  for (let arm = 0; arm < ARMS; arm++) {
    const start = (arm / ARMS) * Math.PI * 2;
    for (let i = 0; i < 900; i++) {
      const u = i / 900;
      const a = start + u * Math.PI * 3.4;
      const r = 62 + u * u * 430;
      const spread = 16 + u * 60;
      const x = mid + Math.cos(a) * r + (Math.random() - 0.5) * spread;
      const y = mid + Math.sin(a) * r + (Math.random() - 0.5) * spread;
      const blob = 16 + u * 46;
      const fill = g.createRadialGradient(x, y, 0, x, y, blob);
      fill.addColorStop(0, `rgba(226, 234, 244, ${0.34 * (1 - u * 0.5)})`);
      fill.addColorStop(1, 'rgba(226, 234, 244, 0)');
      g.fillStyle = fill;
      g.beginPath();
      g.arc(x, y, blob, 0, Math.PI * 2);
      g.fill();
    }
  }
  const eye = g.createRadialGradient(mid, mid, 0, mid, mid, 118);
  eye.addColorStop(0, 'rgba(0, 0, 0, 1)');
  eye.addColorStop(0.55, 'rgba(0, 0, 0, 0.9)');
  eye.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = eye;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Storm {
  constructor(scene, calm) {
    this.calm = calm;
    this.level = 0;
    this.flash = 0;
    this.nextFlash = 6;
    this.spin = new THREE.Mesh(
      new THREE.CircleGeometry(520, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: spiralTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false }),
    );
    this.spin.position.y = -96;
    this.spin.visible = false;
    scene.add(this.spin);

    this.leaves = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.6, 0.32),
      new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
      LEAVES,
    );
    this.leaves.frustumCulled = false;
    this.leaves.visible = false;
    this.seeds = Array.from({ length: LEAVES }, (_, i) => ({
      x: Math.random(), y: -12 + Math.random() * 62, z: (Math.random() - 0.5) * SPAN * 1.6,
      speed: 0.16 + Math.random() * 0.18, spin: 2 + Math.random() * 5, phase: Math.random() * 6.28, i,
    }));
    const col = new THREE.Color();
    this.seeds.forEach((s) => this.leaves.setColorAt(s.i, col.set(LEAF_COLORS[s.i % LEAF_COLORS.length])));
    scene.add(this.leaves);
  }

  update(t, dt, on) {
    this.level += ((on ? 1 : 0) - this.level) * Math.min(1, dt * 1.6);
    const live = this.level > 0.02;
    this.spin.visible = live;
    this.leaves.visible = live && !this.calm;
    if (!live) { this.flash = 0; return; }
    this.spin.material.opacity = this.level;
    this.spin.rotation.y = t * 0.07;
    if (this.leaves.visible) {
      for (const s of this.seeds) {
        const x = ((s.x + t * s.speed) % 1) * SPAN * 2 - SPAN;
        DUMMY.position.set(x, s.y + Math.sin(t * 2 + s.phase) * 2.4, s.z + Math.cos(t * 1.3 + s.phase) * 3);
        DUMMY.rotation.set(t * s.spin, t * s.spin * 0.7, s.phase);
        DUMMY.updateMatrix();
        this.leaves.setMatrixAt(s.i, DUMMY.matrix);
      }
      this.leaves.instanceMatrix.needsUpdate = true;
    }
    // 閃電只是短暫提亮，減少動態時不閃
    this.flash *= Math.exp(-dt * 7);
    this.nextFlash -= dt;
    if (this.nextFlash <= 0 && !this.calm && on) {
      this.flash = 0.42;
      this.nextFlash = 7 + Math.random() * 11;
    }
  }
}
