// 找到小河馬的畫面動畫：登場卡片、數字飛入計數卡、護照圖鑑、十二隻全滿與通過閱讀挑戰的慶祝
import { HIPPOS, ISLANDS } from '../data/site.js';

const TOTAL = 12;
const CARD_MS = 5200;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ICON = `<svg class="hippo-icon" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="15" cy="17" r="8" fill="#e27f99"/><circle cx="49" cy="17" r="8" fill="#e27f99"/>
  <circle cx="15" cy="17" r="4" fill="#f9c4d0"/><circle cx="49" cy="17" r="4" fill="#f9c4d0"/>
  <ellipse cx="32" cy="29" rx="21" ry="19" fill="#f09ab0"/>
  <ellipse cx="32" cy="43" rx="24" ry="16" fill="#f4adc0"/>
  <circle cx="23" cy="25" r="4.2" fill="#fff"/><circle cx="41" cy="25" r="4.2" fill="#fff"/>
  <circle cx="24" cy="26" r="2.2" fill="#3b2c1d"/><circle cx="40" cy="26" r="2.2" fill="#3b2c1d"/>
  <ellipse cx="24" cy="40" rx="2.4" ry="3" fill="#b95b76"/><ellipse cx="40" cy="40" rx="2.4" ry="3" fill="#b95b76"/>
  <path d="M22 50 Q32 56 42 50" fill="none" stroke="#b95b76" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;

const islandName = Object.fromEntries(ISLANDS.map((d) => [d.id, d.name]));

function progress(n) {
  if (n === 1) return `第一隻！還有 ${TOTAL - 1} 隻在等你`;
  if (n === TOTAL / 2) return '找到一半了，可以領證書囉！';
  if (n === TOTAL - 1) return '只剩最後一隻了！';
  return `還有 ${TOTAL - n} 隻躲在雲端`;
}

let hideTimer = 0;

export function showFound(id, count) {
  const h = HIPPOS[id];
  document.querySelector('#hippoCard')?.remove();
  const el = document.createElement('aside');
  el.id = 'hippoCard';
  el.className = 'hippo-card card';
  el.setAttribute('role', 'status');
  el.innerHTML = `${ICON}<div class="hippo-text"><small>找到第 ${count} 隻小河馬！</small><strong></strong><p></p><div class="pips">${Array.from({ length: TOTAL }, (_, i) => `<i class="${i < count ? 'on' : ''}${i === count - 1 ? ' new' : ''}"></i>`).join('')}</div><span>${progress(count)}</span></div>`;
  el.querySelector('strong').textContent = h.name;
  el.querySelector('p').textContent = `「${h.line}」`;
  el.addEventListener('click', () => el.remove());
  document.body.append(el);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.remove(), CARD_MS);
}

// 「+1」從小河馬身上飛進左下角的計數卡
export function flyCount(from) {
  const hint = document.querySelector('#hint');
  const box = hint && !hint.hidden ? hint.getBoundingClientRect() : null;
  const seen = box && box.width > 0 && getComputedStyle(hint).display !== 'none';
  if (calm) return;
  const el = document.createElement('b');
  el.className = 'hippo-fly';
  el.textContent = '+1';
  document.body.append(el);
  const x = seen ? box.left + 34 : from.x, y = seen ? box.top + 26 : from.y - 120;
  el.animate([
    { transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) scale(.4)`, opacity: 0 },
    { transform: `translate(${from.x}px, ${from.y - 46}px) translate(-50%, -50%) scale(1.5)`, opacity: 1, offset: 0.3 },
    { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.7)`, opacity: seen ? 1 : 0 },
  ], { duration: 1000, easing: 'cubic-bezier(.4, 0, .3, 1)' }).onfinish = () => {
    el.remove();
    if (!seen) return;
    hint.classList.remove('bump');
    void hint.offsetWidth; // 重新觸發動畫
    hint.classList.add('bump');
  };
}

const MILESTONE = {
  6: { badge: '探險家', title: '找到 6 隻小河馬了！', text: '你是尋寶探險家，可以領證書囉！<br>再找 6 隻，還有金色證書等著你', later: '繼續找小河馬' },
  12: { badge: '小達人', title: '十二隻全部找到了！', text: '你走遍每一座島，是尋寶小達人！<br>快來領金色證書，集滿 12 枚章還能挑戰尋河馬達人', later: '看閱讀護照' },
  M: { badge: '達人', title: '通過十二座島的閱讀挑戰！', text: '你是尋河馬達人！<br>領取證書，到校長室兌換小客人招待券', later: '看閱讀護照' },
};

export function showFinale(level = TOTAL, score = 0) {
  const m = MILESTONE[level];
  const n = level === 'M' ? TOTAL : level;
  document.querySelector('#hippoFinale')?.remove();
  const el = document.createElement('div');
  el.id = 'hippoFinale';
  el.className = 'hippo-finale';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', m.title);
  const ring = Array.from({ length: n }, (_, i) => `<span style="--i:${i * TOTAL / n}">${ICON}</span>`).join('');
  el.innerHTML = `<div class="finale-card card">
    <div class="finale-rays"></div>
    <div class="finale-ring">${ring}<div class="finale-badge${level === 'M' ? ' m' : ''}">${m.badge}</div></div>
    <h2>${m.title}</h2>
    <p>${score ? `12 題答對 ${score} 題，` : ''}${m.text}</p>
    <div class="btn-row"><button class="cta koi" data-act="finaleCert" data-level="${level}">領取證書</button><button class="cta lake" data-act="${level === 6 ? 'finaleClose' : 'finalePassport'}">${m.later}</button></div>
  </div>`;
  document.body.append(el);
}

export const closeFinale = () => document.querySelector('#hippoFinale')?.remove();

// 閱讀護照裡的小河馬圖鑑
export function hippoGrid(found) {
  return `<div class="hippo-grid">${Object.entries(HIPPOS).map(([id, h]) => (found.has(id)
    ? `<button class="hippo-chip on" data-goto="${id}" title="${h.line}">${ICON}<strong>${h.name}</strong></button>`
    : `<button class="hippo-chip" data-goto="${id}"><i>?</i><strong>躲在${islandName[id]}</strong></button>`)).join('')}</div>`;
}
