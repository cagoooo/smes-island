// 第三段「尋河馬達人」：十二座島的閱讀挑戰關卡，題目優先用試算表題庫，連不上才用內建題
import { BANK, SCENES, QUEST, PASS, MAX_WRONG } from '../data/challenge.js';
import { ISLANDS, HIPPOS } from '../data/site.js';
import { API } from './cert.js';
import { ICON } from './hippo.js';
import { esc } from './blocks.js';

const KEY = 'smes-challenge';
const BANK_KEY = 'smes-bank';
const BANK_TTL = 30 * 60 * 1000; // 老師改了題庫，半小時內各台平板就會換新題
const order = ISLANDS.map((d) => d.id);
const byId = Object.fromEntries(ISLANDS.map((d) => [d.id, d]));
const builtIn = BANK.map(([b, i, q, o, x]) => ({ b, i, q, o, a: 0, x, c: '' }));

export const challenge = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 無痕模式略過 */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* 無痕模式略過 */ } },
};

// 試算表是老師手打的，格式不對的題目直接略過，不讓一題壞掉卡住整個挑戰
const valid = (it) => it && '低中高'.includes(it.b) && (order.includes(it.i) || it.i === '*')
  && typeof it.q === 'string' && it.q.trim() && Array.isArray(it.o) && it.o.length >= 2 && it.o.length <= 4
  && it.o.every((s) => typeof s === 'string' && s.trim()) && Number.isInteger(it.a) && it.a >= 0 && it.a < it.o.length;

// 第四段的共讀題目（一本書一組）跟著一起讀；舊版快取沒有共讀題目，要重抓
const validBook = (it) => it && typeof it.k === 'string' && it.k.trim() && '低中高'.includes(it.b)
  && typeof it.q === 'string' && it.q.trim() && Array.isArray(it.o) && it.o.length >= 2 && it.o.length <= 4
  && it.o.every((s) => typeof s === 'string' && s.trim()) && Number.isInteger(it.a) && it.a >= 0 && it.a < it.o.length;

// 回傳 { items: 島嶼題目, books: 共讀題目 }
export async function loadBank() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(BANK_KEY)); } catch { /* 沒有快取 */ }
  if (cached && Array.isArray(cached.books) && Date.now() - cached.t < BANK_TTL) return { items: cached.items, books: cached.books };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await (await fetch(`${API}?bank=1`, { signal: ctl.signal })).json();
    if (r.ok && Array.isArray(r.items)) {
      const items = r.items.filter(valid);
      const books = (Array.isArray(r.books) ? r.books : []).filter(validBook);
      try { localStorage.setItem(BANK_KEY, JSON.stringify({ t: Date.now(), items, books })); } catch { /* 無痕模式略過 */ }
      return { items, books };
    }
  } catch { /* 連不上就用上次的題庫或內建題 */ } finally { clearTimeout(timer); }
  return { items: cached?.items || [], books: cached?.books || [] };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const truthy = (o) => o.length === 2 && /^[對是○◯Oo]$/.test(o[0].trim()); // 是非題維持「對」在前

// 每座島抽一題：先抽這座島的題目，再來是「不限」的題目，都沒有才用內建題；重新挑戰時避開上一輪的題目
export function newRun(band, sheet, avoid = []) {
  const used = new Set();
  const pick = (list) => {
    const fresh = list.filter((it) => !used.has(it.q));
    const pref = fresh.filter((it) => !avoid.includes(it.q));
    const pool = pref.length ? pref : fresh;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  };
  const live = sheet.filter((it) => it.b === band);
  const levels = order.map((id) => {
    const it = pick(live.filter((x) => x.i === id)) || pick(live.filter((x) => x.i === '*'))
      || pick(builtIn.filter((x) => x.b === band && x.i === id)) || pick(live) || builtIn.find((x) => x.b === band && x.i === id);
    used.add(it.q);
    const idx = it.o.map((_, n) => n);
    if (!truthy(it.o)) shuffle(idx);
    return { i: id, q: it.q, c: it.c || '', o: idx.map((n) => it.o[n]), a: idx.indexOf(it.a), x: it.x || '' };
  });
  return { band, levels, picks: [], wrong: 0, state: 'play' };
}

// 答錯超過可容許的題數就提早結束，不用把十二關做完才知道沒過
export function answer(st, n) {
  const lv = st.levels[st.picks.length];
  st.picks.push(n);
  if (n !== lv.a) st.wrong += 1;
  if (st.wrong > MAX_WRONG) st.state = 'fail';
  else if (st.picks.length === order.length) {
    st.state = 'pass';
    st.score = order.length - st.wrong;
  }
  return n === lv.a;
}

const lives = (st) => `<span class="ch-life" aria-label="還可以答錯 ${MAX_WRONG - st.wrong} 題">${Array.from({ length: MAX_WRONG }, (_, k) => `<i class="${k < MAX_WRONG - st.wrong ? 'on' : ''}">♥</i>`).join('')}</span>`;

const pips = (st, upto) => `<div class="ch-pips">${st.levels.map((lv, k) => {
  const done = k < upto;
  const cls = !done ? '' : st.picks[k] === lv.a ? 'ok' : 'no';
  return `<i class="${cls}" style="--c:${byId[lv.i].color}"></i>`;
}).join('')}</div>`;

// 一關的畫面；shown 為 true 時顯示對錯與解說
export function levelHtml(st, k, shown) {
  const lv = st.levels[k];
  const d = byId[lv.i];
  const h = HIPPOS[lv.i];
  const pick = st.picks[k];
  const opts = lv.o.map((t, n) => {
    const cls = !shown ? '' : n === lv.a ? 'right' : n === pick ? 'wrong' : 'dim';
    return `<button class="quiz-opt ch-opt ${cls}" data-ch="${n}"${shown ? ' disabled' : ''}>${esc(t)}</button>`;
  }).join('');
  const ok = pick === lv.a;
  const last = st.state !== 'play';
  const next = st.state === 'fail' ? '看挑戰結果' : st.state === 'pass' ? '完成挑戰！' : '下一關 ›';
  const fb = shown ? `<div class="ch-fb ${ok ? 'ok' : 'no'}" role="status"><strong>${ok ? '答對了！' : `答錯了，正確答案是「${esc(lv.o[lv.a])}」`}</strong>${lv.x ? `<p>${esc(lv.x)}</p>` : ''}
    <button class="cta ${last ? 'koi' : 'lake'}" data-act="${last ? 'chEnd' : 'chNext'}">${next}</button></div>` : '';
  return `<div class="ch-top"><span class="ch-lv" style="--c:${d.color}">第 ${k + 1} 關／12｜${esc(d.name)}</span>${lives(st)}</div>
    <div class="ch-hippo">${ICON}<p><b>${esc(h.name)}</b>${esc(SCENES[lv.i])}</p></div>
    <p class="ch-state${shown && ok ? ' done' : ''}">島上狀況：${esc(QUEST[lv.i][shown && ok ? 1 : 0])}${shown && !ok ? '（還沒解開）' : ''}</p>
    ${lv.c ? `<p class="ch-ctx">${esc(lv.c)}</p>` : ''}
    <p class="quiz-q">${esc(lv.q)}</p>
    <button class="ch-book" data-act="chBook">📖 ${shown ? `到${esc(d.name)}看更多` : `翻開${esc(d.name)}的資料找答案`}</button>${opts}${fb}${pips(st, shown ? k + 1 : k)}`;
}

export const rules = `<ul class="ch-rules">
  <li>十二座島各有一關，由島上的小河馬出題</li>
  <li>12 題要答對 ${PASS} 題，最多只能答錯 ${MAX_WRONG} 題</li>
  <li>不知道答案時，可以按「翻開島嶼資料」到島上找答案，看完再回來作答</li>
  <li>沒過關也沒關係，小河馬會換新題目，可以再挑戰</li>
</ul>`;
