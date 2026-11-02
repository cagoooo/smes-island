// 手機內容抽屜：收合、一半、全開三段，手指上下拖曳切換
const PEEK = 74; // 與 styles.css 的 .panel.peek 高度相同，不含安全區
const HALF = 0.6;
const FULL = 0.91;
const AIM_MS = 220; // 放手時順著速度多算這段時間，輕甩就能切換
const SLOP = 8;
const NUDGE = 48;

const heights = () => ({ peek: PEEK, half: innerHeight * HALF, full: innerHeight * FULL });

class Sheet {
  constructor() {
    this.state = 'half';
    this.onChange = null;
  }

  get height() { return heights()[this.state]; }

  paint() {
    this.panel.classList.toggle('peek', this.state === 'peek');
    this.panel.classList.toggle('tall', this.state === 'full');
    this.handle.setAttribute('aria-expanded', this.state !== 'peek');
  }

  set(state) {
    const prev = this.state;
    this.state = state;
    this.paint();
    if (state !== prev) this.onChange?.(state, prev);
  }

  // 換島或關閉時回到預設高度，鏡頭由呼叫端處理
  reset() {
    this.state = 'half';
    this.paint();
  }

  toggle() { this.set(this.state === 'half' ? 'peek' : 'half'); }

  // 拖過一小段就順著方向走到下一段，不用拖過一半距離
  snap(height, speed, from) {
    const aim = height - speed * AIM_MS;
    const stops = Object.entries(heights());
    const nearest = () => [...stops].sort((a, b) => Math.abs(a[1] - aim) - Math.abs(b[1] - aim))[0];
    const moved = aim - from;
    const next = Math.abs(moved) < NUDGE ? nearest()
      : moved > 0 ? stops.find(([, h]) => h >= height) : stops.reverse().find(([, h]) => h <= height);
    const [state] = next;
    this.panel.style.height = '';
    this.panel.classList.remove('dragging');
    this.set(state);
  }

  init(panel, enabled, onChange) {
    this.panel = panel;
    this.handle = panel.querySelector('.handle');
    this.onChange = onChange;
    const body = panel.querySelector('.panel-body');
    let g = null;

    panel.addEventListener('touchstart', (e) => {
      if (!enabled() || e.touches.length > 1) { g = null; return; }
      const t = e.touches[0];
      g = { x: t.clientX, y: t.clientY, h: panel.offsetHeight, inBody: !!e.target.closest('.panel-body'), drag: false, lastY: t.clientY, lastT: e.timeStamp, speed: 0 };
    }, { passive: true });

    panel.addEventListener('touchmove', (e) => {
      if (!g) return;
      if (e.touches.length > 1) { g = null; return; }
      const t = e.touches[0];
      if (!g.drag) {
        const dx = t.clientX - g.x, dy = t.clientY - g.y;
        // 內文要在第一個移動就決定：等瀏覽器開始捲動後就攔不下來了
        if (g.inBody) {
          if (!dy) return;
          if (dy < 0 || body.scrollTop > 0 || Math.abs(dx) > Math.abs(dy)) { g = null; return; }
        } else {
          if (Math.hypot(dx, dy) < SLOP) return;
          if (Math.abs(dx) > Math.abs(dy)) { g = null; return; }
        }
        g.drag = true;
        g.y = t.clientY;
        panel.classList.add('dragging');
      }
      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - g.lastT;
      if (dt > 0) g.speed = (t.clientY - g.lastY) / dt;
      g.lastY = t.clientY;
      g.lastT = e.timeStamp;
      const { peek, full } = heights();
      panel.style.height = `${Math.max(peek, Math.min(full, g.h - (t.clientY - g.y)))}px`;
    }, { passive: false });

    const end = (e) => {
      if (!g) return;
      const { drag, speed, lastT, h } = g;
      g = null;
      if (drag) this.snap(panel.offsetHeight, e.timeStamp - lastT > 120 ? 0 : speed, h); // 停住才放手不算甩動
    };
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);

    panel.querySelector('.panel-head').addEventListener('click', (e) => {
      if (enabled() && this.state === 'peek' && !e.target.closest('button')) this.set('half');
    });
  }
}

export const sheet = new Sheet();
