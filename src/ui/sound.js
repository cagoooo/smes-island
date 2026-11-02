// 背景音樂：白天與夜晚各一首，跟著場景時間淡入淡出切換
// 音樂來源 Pixabay，採 Pixabay Content License，作者 CHAse9602
// 白天：The Wind Awakening Memories of the Forest／夜晚：The Floating Garden of Stars (Dreamy Edit)
const FILES = { day: './audio/bgm-day.mp3', night: './audio/bgm-night.mp3' };
const VOLUME = window.matchMedia?.('(pointer: coarse)').matches ? 0.62 : 0.34; // 手機喇叭小，音量要比電腦大
const FADE = 1.1;

class Music {
  constructor() {
    this.want = true;
    this.started = false;
    this.mood = 'day';
    this.tracks = {};
    this.onChange = null;
    this.onStart = null;
  }

  // 瀏覽器規定要等使用者操作後才能出聲；用增益節點控制音量，iPad 才調得動
  begin() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.started = true;
    if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iPhone 靜音鍵開著也比照影片出聲
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
    this.tracks[this.mood].el.addEventListener('playing', () => this.onStart?.(), { once: true });
    this.ctx.resume();
    // iOS 每首歌都要在操作當下播過一次，之後日夜自動換曲才放得出來
    for (const t of Object.values(this.tracks)) t.el.play().catch(() => {});
    this.apply();
  }

  // 被瀏覽器擋下、來電中斷或切回前景都會變成這個狀態
  get blocked() {
    return this.ctx.state !== 'running' || this.tracks[this.mood].el.paused;
  }

  wake() {
    if (!this.want) return;
    if (!this.started) { this.begin(); return; }
    if (!this.blocked) return;
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
    if (!this.started || (this.want && this.blocked)) { this.want = true; this.wake(); } else { this.want = !this.want; this.apply(); }
    if (this.want) this.ctx?.resume();
    this.onChange?.(this.want);
    return this.want;
  }

  init(want, onChange, onStart) {
    this.want = want;
    this.onChange = onChange;
    this.onStart = onStart;
    // 觸控要等手指放開才算數，手指按下時啟動會被擋；每次操作都檢查，被擋下才有機會補救
    const tap = (e) => { if (!e.target.closest?.('#musicBtn')) this.wake(); };
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, tap, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (this.want) { this.ctx.resume(); this.apply(); }
    });
  }
}

export const music = new Music();
