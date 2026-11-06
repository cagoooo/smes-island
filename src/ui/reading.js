// 第四段「圖書館共讀達人」：成為尋河馬達人後，選一本讀過的書，答完這本書自己年段的全部題目
// 張校長希望第四段要讀懂書才過得了（2026-11-06）：作答時不公布對錯、要全部答對、沒過要隔天才能再挑戰同一本，讀懂 3 本才領紀念證書
// 題目在學校試算表的「共讀題庫」分頁，由網站和島嶼題庫一起讀取（gas/Code.gs 的 readItems）
import { esc } from './blocks.js';

export const READ_NEED = 3;
const KEY = 'smes-read';
const blank = () => ({ done: {}, tried: {}, run: null });

export const reading = {
  get() {
    try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return blank(); }
  },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 無痕模式略過 */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* 無痕模式略過 */ } },
};

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
export const readCount = (r = reading.get()) => Object.keys(r.done).length;
// 試算表的書名常用「.」分隔集數，畫面上改成「・」比較好讀
export const pretty = (k) => k.replace(/\s*[.．]\s*/g, '・');

// 書單：只列出有自己年段題目的書，照書名排好
export function bookList(books, band) {
  const n = {};
  books.filter((it) => it.b === band).forEach((it) => { n[it.k] = (n[it.k] || 0) + 1; });
  return Object.keys(n).sort((a, b) => a.localeCompare(b, 'zh-Hant')).map((k) => ({ k, n: n[k] }));
}

// done：讀懂了；wait：今天挑戰過了，明天再來；open：可以挑戰
export function bookState(r, k) {
  if (r.done[k]) return 'done';
  if (r.tried[k] === today() && r.run?.k !== k) return 'wait';
  return 'open';
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 一開始就記下今天挑戰過這本書：中途關掉再打開，接著原本的題目作答，不能重新抽
export function startBook(r, books, k, band) {
  const items = shuffle(books.filter((it) => it.k === k && it.b === band).slice());
  r.tried[k] = today();
  r.run = {
    k,
    band,
    state: 'play',
    picks: [],
    levels: items.map((it) => {
      const idx = shuffle(it.o.map((_, n) => n));
      return { q: it.q, o: idx.map((n) => it.o[n]), a: idx.indexOf(it.a), x: it.x || '' };
    }),
  };
  return r.run;
}

// 答完最後一題才算分：全部答對就讀懂這本書
export function pickAnswer(r, n) {
  const run = r.run;
  if (!run || run.state !== 'play') return;
  run.picks.push(n);
  if (run.picks.length < run.levels.length) return;
  run.score = run.levels.filter((lv, i) => run.picks[i] === lv.a).length;
  run.state = run.score === run.levels.length ? 'pass' : 'fail';
  if (run.state === 'pass') r.done[run.k] = { date: today(), n: run.levels.length };
}

export const readRules = `<ul class="ch-rules">
  <li>選一本你在圖書館讀完的書，答完這本書你年段的全部題目</li>
  <li>作答時不會告訴你答對或答錯，要靠自己真的讀懂</li>
  <li>全部答對才算讀懂這本書；沒有全對，要等明天才能再挑戰同一本，先回去把書再讀一次</li>
  <li>讀懂 ${READ_NEED} 本書，就能領「圖書館共讀達人」紀念證書</li>
</ul>`;

// 共讀書架：讀懂的書亮起來
export function shelfHtml(r = reading.get()) {
  const books = Object.keys(r.done);
  const slots = Math.max(READ_NEED, books.length);
  return `<div class="rd-shelf" aria-label="共讀書架：讀懂 ${books.length} 本">${Array.from({ length: slots }, (_, i) => {
    const k = books[i];
    return k ? `<span class="rd-spine on" title="${esc(pretty(k))}">${esc(pretty(k))}</span>` : '<span class="rd-spine"></span>';
  }).join('')}</div>`;
}

export function listHtml(list, r) {
  if (!list.length) return '<p class="note">圖書館老師還在準備共讀題目，過幾天再來看看！</p>';
  return `<div class="rd-books">${list.map(({ k, n }, i) => {
    const st = bookState(r, k);
    const tag = st === 'done' ? '✔ 讀懂了' : st === 'wait' ? '明天再來' : r.run?.k === k && r.run.state === 'play' ? '繼續作答' : `${n} 題`;
    return `<button class="rd-book ${st}" ${st === 'open' ? `data-act="rdStart" data-book="${i}"` : 'disabled'}><strong>${esc(pretty(k))}</strong><span>${tag}</span></button>`;
  }).join('')}</div>`;
}

// 一題的畫面：不顯示對錯，選了就到下一題
export function readLevelHtml(run) {
  const k = run.picks.length;
  const lv = run.levels[k];
  const total = run.levels.length;
  const opts = lv.o.map((t, n) => `<button class="quiz-opt ch-opt" data-rd="${n}">${esc(t)}</button>`).join('');
  return `<div class="ch-top"><span class="ch-lv" style="--c:#2f8f7a">第 ${k + 1} 題／${total}</span><span class="rd-hint">作答時不公布對錯</span></div>
    <p class="ch-ctx">📚 ${esc(pretty(run.k))}</p>
    <p class="quiz-q">${esc(lv.q)}</p>${opts}
    <div class="ch-pips">${run.levels.map((_, i) => `<i class="${i < k ? 'ok' : ''}" style="--c:#2f8f7a"></i>`).join('')}</div>`;
}

// 讀懂了才把每題的答案和解說攤開來看
export function reviewHtml(run) {
  return `<ol class="rd-review">${run.levels.map((lv) => `<li><strong>${esc(lv.q)}</strong><span>答案：${esc(lv.o[lv.a])}</span>${lv.x ? `<small>${esc(lv.x)}</small>` : ''}</li>`).join('')}</ol>`;
}
