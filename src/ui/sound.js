// 島上的聲音：配樂依天氣與日夜切換、環境音疊在底下、互動音效即時播放
// 來源皆為 Pixabay，採 Pixabay Content License，完整作者列在 README
const COARSE = window.matchMedia?.('(pointer: coarse)').matches;
const VOLUME = COARSE ? 0.62 : 0.34; // 手機喇叭小，音量要比電腦大
const AMBIENCE = COARSE ? 0.42 : 0.24;
const SFX_GAIN = COARSE ? 1 : 0.8;
const FADE = 1.1;
const DIR = './audio/';
const SILENCE = `${DIR}silence.mp3`;

const SCORE = {
  day: { bgm: 'bgm-day', amb: 'amb-birds' },
  cloudy: { bgm: 'bgm-cloudy', amb: null },
  dusk: { bgm: 'bgm-dusk', amb: 'amb-night' },
  storm: { bgm: 'bgm-rain', amb: 'amb-storm' },
  rain: { bgm: 'bgm-rain', amb: 'amb-rain' },
  night: { bgm: 'bgm-night', amb: 'amb-night' },
};

const SFX = {
  tap: 0.3, pop: 0.5, whoosh: 0.35, page: 0.5, stamp: 0.6, found: 0.7, horn: 0.5,
  boing: 0.6, cheer: 0.5, chime: 0.6, correct: 0.55, splash: 0.3, thunder: 0.55,
};
const THUNDER_MIN = 18000;
const THUNDER_SPAN = 26000;

class Music {
  constructor() {
    this.want = true;
    this.sfxOn = true;
    this.started = false;
    this.mood = 'day';
    this.thunder = false;
    this.thunderTimer = 0;
    this.buffers = {};
    this.onChange = null;
    this.onStart = null;
    this.onSfx = null;
  }

  deck() {
    const el = new Audio();
    el.loop = true;
    el.preload = 'none';
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    this.ctx.createMediaElementSource(el).connect(gain).connect(this.ctx.destination);
    return { el, gain, file: null, stop: 0 };
  }

  // 瀏覽器規定要等使用者操作後才能出聲；用增益節點控制音量，iPad 才調得動
  begin() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.started = true;
    if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iPhone 靜音鍵開著也比照影片出聲
    this.ctx = new Ctx();
    this.bgm = { decks: [this.deck(), this.deck()], on: 0 };
    this.amb = { decks: [this.deck(), this.deck()], on: 0 };
    this.ctx.resume();
    // iOS 每個播放器都要在操作當下播過一次，之後換曲才放得出來；先放靜音檔才不會白白下載配樂
    for (const set of [this.bgm, this.amb]) {
      for (const d of set.decks) {
        d.el.addEventListener('playing', () => { if (d.file && set === this.bgm) this.announce(); });
        d.el.src = SILENCE;
        d.el.play().then(() => { if (!d.file) d.el.pause(); }).catch(() => {});
      }
    }
    this.apply();
    this.loadSfx();
  }

  // 第一次真的出聲時通知畫面
  announce() {
    if (this.announced) return;
    this.announced = true;
    this.onStart?.();
  }

  async loadSfx() {
    if (!this.sfxOn || this.loading) return;
    this.loading = true;
    await Promise.all(Object.keys(SFX).map(async (name) => {
      try {
        const res = await fetch(`${DIR}sfx/${name}.mp3`);
        this.buffers[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch { /* 少一個音效不影響其他功能 */ }
    }));
  }

  // 被瀏覽器擋下、來電中斷或切回前景都會變成這個狀態
  get blocked() {
    if (this.ctx.state !== 'running') return true;
    return this.want && this.bgm.decks[this.bgm.on].el.paused;
  }

  wake() {
    if (!this.want && !this.sfxOn) return;
    if (!this.started) { this.begin(); return; }
    if (!this.blocked) return;
    this.ctx.resume();
    this.apply();
  }

  fade(d, level) {
    const now = this.ctx.currentTime;
    clearTimeout(d.stop);
    d.gain.gain.cancelScheduledValues(now);
    d.gain.gain.setTargetAtTime(level, now, FADE);
    if (level) d.el.play().catch(() => {});
    else d.stop = setTimeout(() => d.el.pause(), FADE * 4000);
  }

  // 同一首繼續播；要換曲時在另一台播放器淡入，舊的淡出
  route(set, name, level) {
    const cur = set.decks[set.on];
    const file = name ? `${DIR}${name}.mp3` : null;
    const gain = this.want ? level : 0;
    if (cur.file === file) {
      if (file) this.fade(cur, gain);
      return;
    }
    if (cur.file) this.fade(cur, 0);
    if (!file) { cur.file = null; return; }
    set.on = 1 - set.on;
    const next = set.decks[set.on];
    clearTimeout(next.stop);
    next.file = file;
    next.el.src = file;
    this.fade(next, gain);
  }

  apply() {
    if (!this.started) return;
    const score = SCORE[this.mood];
    this.route(this.bgm, score.bgm, VOLUME);
    this.route(this.amb, score.amb, AMBIENCE);
  }

  setMood({ storm, night, dusk, rain, cloud, thunder }) {
    const mood = storm ? 'storm' : rain ? 'rain' : dusk ? 'dusk' : night ? 'night' : cloud ? 'cloudy' : 'day';
    this.thunder = !!thunder;
    if (this.thunder && !this.thunderTimer) this.roll();
    if (mood === this.mood) return;
    this.mood = mood;
    this.apply();
  }

  // 打雷時隔一段不固定的時間響一次
  roll() {
    this.thunderTimer = setTimeout(() => {
      this.thunderTimer = 0;
      if (!this.thunder) return;
      if (this.want && !document.hidden) this.sfx('thunder');
      this.roll();
    }, THUNDER_MIN + Math.random() * THUNDER_SPAN);
  }

  sfx(name) {
    if (!this.started || !this.sfxOn || !this.buffers[name] || this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = this.buffers[name];
    gain.gain.value = SFX[name] * SFX_GAIN;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  toggle() {
    if (!this.started || (this.want && this.blocked)) { this.want = true; this.wake(); } else { this.want = !this.want; this.apply(); }
    if (this.want) this.ctx?.resume();
    this.onChange?.(this.want);
    return this.want;
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    if (this.sfxOn) {
      if (this.started) { this.ctx.resume(); this.loadSfx(); this.sfx('tap'); } else this.begin();
    }
    this.onSfx?.(this.sfxOn);
  }

  init({ want, sfx, onChange, onStart, onSfx }) {
    this.want = want;
    this.sfxOn = sfx;
    this.onChange = onChange;
    this.onStart = onStart;
    this.onSfx = onSfx;
    // 觸控要等手指放開才算數，手指按下時啟動會被擋；每次操作都檢查，被擋下才有機會補救
    const tap = (e) => { if (!e.target.closest?.('#musicBtn, #sfxBtn')) this.wake(); };
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, tap, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (this.want || this.sfxOn) { this.ctx.resume(); this.apply(); }
    });
  }
}

export const music = new Music();
