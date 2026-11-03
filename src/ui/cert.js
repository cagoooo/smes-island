// 小河馬尋寶證書：找到 6 隻、12 隻各領一張，第三段通過島嶼閱讀挑戰再領「尋河馬達人」，孩子帶去校長室換獎勵
// 證書用 canvas 畫在裝置上；班級姓名另外送到學校的試算表，校長室用來核對領獎（後端在 gas/）
export const API = 'https://script.google.com/macros/s/AKfycbyH1eIe5fGM319XxjBJf5Eb_PHjMvAS9SDXnlffIm0Pjycftp3F8Pd152iIOWnAn9WF/exec';
const KEY = 'smes-hippo-cert';
const W = 2000;
const H = 1414;
const DISPLAY = '"LXGW WenKai TC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", serif';
const INK = '#3b2c1d';

// box 是底圖中央留白處的範圍
export const TIERS = {
  6: { title: '尋寶探險家', color: '#1f7a9c', box: [360, 240, 1680, 1090] },
  12: { title: '尋寶小達人', color: '#b5571a', box: [390, 275, 1640, 1125] },
  M: { title: '尋河馬達人', color: '#7a3f8f', box: [360, 290, 1650, 1110] },
};

export const certInfo = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 無痕模式略過 */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* 無痕模式略過 */ } },
};

const taipeiDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

// 同一張證書日期固定在第一次領取那天，重新下載內容才會一樣；達人證書另外記下挑戰答對幾題
export function issue(level, cls, name, score) {
  const info = certInfo.get() || { cls, name, dates: {} };
  info.dates[level] ||= taipeiDate();
  if (score) { info.scores ||= {}; info.scores[level] ||= score; }
  certInfo.set(info);
  return info;
}

export const validName = (s) => /^[\p{L}\p{M}·‧．]{1,12}$/u.test(s);

// 送不出去不影響孩子拿證書，下次開網站再補送；後端用編號與姓名去除重複
export async function sendCerts() {
  const info = certInfo.get();
  if (!info || !import.meta.env.PROD || location.hostname === 'localhost') return;
  info.sent ||= {};
  for (const level of Object.keys(info.dates)) {
    if (info.sent[level]) continue;
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ level, cls: info.cls, name: info.name, date: info.dates[level], code: serial(level, info) }) });
      const r = await res.json();
      if (r.ok || r.error === 'invalid' || r.error === 'code') {
        info.sent[level] = true; // 資料格式不對時重送也不會過，不要一直試
        certInfo.set(info);
      }
    } catch { /* 網路不通時留待下次補送 */ }
  }
}

function serial(level, info) {
  const date = info.dates[level];
  const [y, m, d] = date.split('-');
  let h = 2166136261;
  for (const c of `${level}|${info.cls}|${info.name}|${date}`) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return `${y - 1911}${m}${d}-${level}-${(h >>> 0).toString(16).slice(-4).toUpperCase().padStart(4, '0')}`;
}

const load = (src) => new Promise((ok, no) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = no;
  im.src = src;
});

function line(ctx, text, x, y, size, opts = {}) {
  const { weight = 700, color = INK, max = 1100, align = 'center' } = opts;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${DISPLAY}`;
  const w = ctx.measureText(text).width;
  if (w > max) ctx.font = `${weight} ${Math.floor(size * max / w)}px ${DISPLAY}`; // 名字太長時縮小，不要超出留白
  ctx.fillText(text, x, y);
}

// 每張證書的說明文字；第三段多了閱讀挑戰的成績，獎勵是校長室小客人招待券
function rows(level, info) {
  const t = TIERS[level];
  if (level !== 'M') {
    return [`走遍石門品牌群島，找到 ${level} 隻小河馬`, `榮獲「${t.title}」`, '請帶著這張證書到校長室領取獎勵'];
  }
  return [`走遍十二座島，通過閱讀挑戰，答對 ${info.scores?.M || 10} 題`, `榮獲「${t.title}」`, '請帶著這張證書到校長室兌換小客人招待券'];
}

export async function drawCert(level, info) {
  const t = TIERS[level];
  const [x0, y0, x1, y1] = t.box;
  const cx = (x0 + x1) / 2;
  const [y, m, d] = info.dates[level].split('-').map(Number);
  const who = `${info.cls}　${info.name}　同學`;
  const [desc, title, tip] = rows(level, info);
  const sign = '桃園市龍潭區石門國民小學　校長　張定貴';
  const stamp = `中華民國 ${y - 1911} 年 ${m} 月 ${d} 日　第 ${serial(level, info)} 號`;
  const texts = `榮譽證書${who}${desc}${title}${tip}${sign}${stamp}`;
  await Promise.all([700, 400].map((w) => document.fonts.load(`${w} 60px "LXGW WenKai TC"`, texts).catch(() => null)));
  const [bg, logo] = await Promise.all([load(`./cert/bg${level}.webp`), load('./brand/school-logo-512.png')]);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(bg, 0, 0, W, H);
  ctx.drawImage(logo, cx - 62, y0 + 30, 124, 124 * logo.height / logo.width);
  line(ctx, '榮譽證書', cx, y0 + 262, 98, { color: t.color });
  line(ctx, who, cx, y0 + 380, 66);
  line(ctx, desc, cx, y0 + 472, 46, { weight: 400 });
  line(ctx, title, cx, y0 + 572, 66, { color: t.color });
  line(ctx, tip, cx, y0 + 652, 40, { weight: 400 });
  // 底圖四角有河馬和葉飾，落款集中在中間才不會壓到
  line(ctx, sign, cx, y1 - 92, 38, { max: 840 });
  line(ctx, stamp, cx, y1 - 44, 30, { weight: 400, max: 840 });
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
}

// 家裡沒有印表機也能帶：手機存圖，或直接印成一張 A4 橫式
export function printCert(url) {
  document.querySelector('#certPrint')?.remove();
  const im = document.createElement('img');
  im.id = 'certPrint';
  im.alt = '小河馬尋寶證書';
  im.onload = () => {
    window.addEventListener('afterprint', () => im.remove(), { once: true });
    window.print();
  };
  im.src = url;
  document.body.append(im);
}

// 閱讀護照裡的證書進度：前兩段看找到幾隻，第三段要集滿章再過閱讀挑戰，第四段先預告
export function certTiers({ hippos, stamps, passed, playing }) {
  const hunt = [6, 12].map((n) => {
    const t = TIERS[n];
    const ok = hippos >= n;
    return `<button class="cert-tier ${ok ? 'on' : ''}" style="--c:${t.color}" ${ok ? `data-act="certOpen" data-level="${n}"` : 'disabled'}><small>第${n === 6 ? '一' : '二'}段</small><strong>${t.title}</strong><span>找到 ${n} 隻</span><b>${ok ? '領取證書' : `還差 ${n - hippos} 隻`}</b></button>`;
  });
  const m = TIERS.M;
  const ready = hippos >= 12 && stamps >= 12;
  const lack = [hippos < 12 ? `${12 - hippos} 隻` : '', stamps < 12 ? `${12 - stamps} 枚章` : ''].filter(Boolean).join('、');
  const master = passed
    ? `<button class="cert-tier on" style="--c:${m.color}" data-act="certOpen" data-level="M"><small>第三段</small><strong>${m.title}</strong><span>通過閱讀挑戰</span><b>領取證書</b></button>`
    : `<button class="cert-tier ${ready ? 'on go' : 'lock'}" style="--c:${m.color}" data-act="challenge"><small>第三段</small><strong>${m.title}</strong><span>12 隻＋12 枚章＋閱讀挑戰</span><b>${ready ? (playing ? '繼續挑戰' : '開始挑戰') : `還差 ${lack}`}</b></button>`;
  const soon = '<div class="cert-tier soon"><small>第四段</small><strong>AI科技島</strong><span>高年級專題發表</span><b>即將登場</b></div>';
  return `<div class="cert-tiers">${hunt.join('')}${master}${soon}</div>`;
}
