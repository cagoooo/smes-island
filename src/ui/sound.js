// 背景音樂：白天與夜晚各一首，跟著場景時間淡入淡出切換
// 音樂來源 Pixabay，採 Pixabay Content License，作者 CHAse9602
// 白天：The Wind Awakening Memories of the Forest／夜晚：The Floating Garden of Stars (Dreamy Edit)
const FILES = { day: './audio/bgm-day.mp3', night: './audio/bgm-night.mp3' };
const VOLUME = 0.34;
const FADE = 1.1;

class Music {
  constructor() {
    this.want = true;
    this.started = false;
    this.mood = 'day';
    this.tracks = {};
    this.onChange = null;
  }

  // 瀏覽器規定要等使用者第一次操作後才能出聲；用增益節點控制音量，iPad 才調得動
  begin() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.started = true;
    this.ctx = new Ctx();
    for (const [key, src] of Object.entries(FILES)) {
      const el = new Audio(src);
      el.loop = true;
      el.preload = 'none';
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      this.ctx.createMediaElementSource(el).connect(gain).connect(this.ctx.destination);
      this.tracks[key] = { el, gain, stop: 0 };
    }
    this.ctx.resume();
    this.apply();
  }

  apply() {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    for (const [key, t] of Object.entries(this.tracks)) {
      const on = this.want && key === this.mood;
      clearTimeout(t.stop);
      t.gain.gain.cancelScheduledValues(now);
      t.gain.gain.setTargetAtTime(on ? VOLUME : 0, now, FADE);
      if (on) t.el.play().catch(() => {});
      else t.stop = setTimeout(() => t.el.pause(), FADE * 4000);
    }
  }

  setNight(night) {
    const mood = night ? 'night' : 'day';
    if (mood === this.mood) return;
    this.mood = mood;
    this.apply();
  }

  toggle() {
    if (!this.started) { this.want = true; this.begin(); } else { this.want = !this.want; this.apply(); }
    if (this.want) this.ctx?.resume();
    this.onChange?.(this.want);
    return this.want;
  }

  init(want, onChange) {
    this.want = want;
    this.onChange = onChange;
    const first = (e) => {
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
      if (this.want && !e.target.closest?.('#musicBtn')) this.begin();
    };
    window.addEventListener('pointerdown', first);
    window.addEventListener('keydown', first);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (this.want) this.ctx.resume();
    });
  }
}

export const music = new Music();
