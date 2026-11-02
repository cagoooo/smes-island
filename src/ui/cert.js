// 小河馬尋寶證書：找到 6 隻、12 隻各領一張，孩子帶去校長室換獎勵
// 班級姓名只存在這台裝置，用 canvas 畫成圖片，不經過任何伺服器
const KEY = 'smes-hippo-cert';
const W = 2000;
const H = 1414;
const DISPLAY = '"LXGW WenKai TC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", serif';
const INK = '#3b2c1d';

// box 是底圖中央留白處的範圍
export const TIERS = {
  6: { title: '尋寶探險家', color: '#1f7a9c', box: [360, 240, 1680, 1090] },
  12: { title: '尋寶小達人', color: '#b5571a', box: [390, 275, 1640, 1125] },
};

export const certInfo = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 無痕模式略過 */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* 無痕模式略過 */ } },
};

const taipeiDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

// 同一張證書日期固定在第一次領取那天，重新下載內容才會一樣
export function issue(level, cls, name) {
  const info = certInfo.get() || { cls, name, dates: {} };
  info.dates[level] ||= taipeiDate();
  certInfo.set(info);
  return info;
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

export async function drawCert(level, info) {
  const t = TIERS[level];
  const [x0, y0, x1, y1] = t.box;
  const cx = (x0 + x1) / 2;
  const [y, m, d] = info.dates[level].split('-').map(Number);
  const who = `${info.cls}　${info.name}　同學`;
  const texts = [`榮譽證書${who}走遍石門品牌群島找到隻小河馬榮獲「${t.title}」請帶著這張證書到校長室領取獎勵桃園市龍潭區石門國民小學校長張定貴中華民國年月日第號0123456789`];
  await Promise.all([700, 400].map((w) => document.fonts.load(`${w} 60px "LXGW WenKai TC"`, texts[0]).catch(() => null)));
  const [bg, logo] = await Promise.all([load(`./cert/bg${level}.webp`), load('./brand/school-logo-512.png')]);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(bg, 0, 0, W, H);
  ctx.drawImage(logo, cx - 62, y0 + 30, 124, 124 * logo.height / logo.width);
  line(ctx, '榮譽證書', cx, y0 + 262, 98, { color: t.color });
  line(ctx, who, cx, y0 + 380, 66);
  line(ctx, `走遍石門品牌群島，找到 ${level} 隻小河馬`, cx, y0 + 472, 46, { weight: 400 });
  line(ctx, `榮獲「${t.title}」`, cx, y0 + 572, 66, { color: t.color });
  line(ctx, '請帶著這張證書到校長室領取獎勵', cx, y0 + 652, 40, { weight: 400 });
  // 底圖四角有河馬和葉飾，落款集中在中間才不會壓到
  line(ctx, '桃園市龍潭區石門國民小學　校長　張定貴', cx, y1 - 92, 38, { max: 840 });
  line(ctx, `中華民國 ${y - 1911} 年 ${m} 月 ${d} 日　第 ${serial(level, info)} 號`, cx, y1 - 44, 30, { weight: 400, max: 840 });
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

// 閱讀護照裡的證書進度
export function certTiers(count) {
  return `<div class="cert-tiers">${Object.keys(TIERS).map((n) => {
    const t = TIERS[n];
    const ok = count >= +n;
    return `<button class="cert-tier ${ok ? 'on' : ''}" style="--c:${t.color}" ${ok ? `data-act="certOpen" data-level="${n}"` : 'disabled'}><strong>${t.title}</strong><span>找到 ${n} 隻</span><b>${ok ? '領取證書' : `還差 ${n - count} 隻`}</b></button>`;
  }).join('')}</div>`;
}
