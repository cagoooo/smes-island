// 把方案內容資料轉成面板 HTML
import data from '../data/content.json';

export const sizes = data.sizes;
export const content = data.islands;

export const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const thumb = (id) => `./images/t/${id}.webp`;
export const full = (id) => `./images/${id}.webp`;

// 同一面板內的圖片編成燈箱序列
let gallery = [];
const reg = (item) => { gallery.push(item); return gallery.length - 1; };
export const currentGallery = () => gallery;
export const resetGallery = () => { gallery = []; };

function photo(item) {
  const i = reg(item);
  return `<button class="ph" data-lb="${i}"><img loading="lazy" decoding="async" src="${thumb(item.id)}" alt="${esc(item.cap)}"><span>${esc(item.cap)}</span></button>`;
}

function fig(item) {
  const i = reg(item);
  const [w, h] = sizes[item.id] || [4, 3];
  return `<button class="fig" data-lb="${i}"><img loading="lazy" decoding="async" src="${full(item.id)}" width="${w}" height="${h}" alt="${esc(item.cap)}"><span>${esc(item.cap)}</span></button>`;
}

// 長條圖：單一色相、細柱、圓角頂端，懸停時顯示數值；表格放在下方作為文字版
function chart(d) {
  const W = 420, H = 170, pad = 26, base = H - 26;
  const max = Math.max(...d.values) * 1.12;
  const step = (W - pad * 2) / d.labels.length;
  const bw = Math.min(46, step * 0.5);
  const bars = d.values.map((v, i) => {
    const h = (v / max) * (base - 14);
    const x = pad + step * i + step / 2 - bw / 2;
    const y = base - h;
    const partial = /月/.test(d.labels[i]);
    const r = 4;
    const path = `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${base} Z`;
    return `<g class="bar-group"><title>${esc(d.labels[i])}：${v.toLocaleString()} ${d.unit}</title>
      <rect class="bar-hit" x="${pad + step * i}" y="0" width="${step}" height="${H}" fill="transparent"/>
      <path d="${path}" fill="#2a7f9f" ${partial ? 'fill-opacity=".5" stroke="#2a7f9f" stroke-dasharray="4 3"' : ''}/>
      <text class="bar-val" x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="12.5" fill="#3b2c1d">${v.toLocaleString()}</text>
      <text x="${x + bw / 2}" y="${base + 17}" text-anchor="middle" font-size="12" fill="#6a5541">${esc(d.labels[i])}</text></g>`;
  }).join('');
  const hasPartial = d.labels.some((l) => /月/.test(l));
  return `<figure class="chart" style="margin:0"><h4>${esc(d.title)}（${d.unit}）</h4>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.title)}長條圖"><line x1="${pad}" x2="${W - pad}" y1="${base}" y2="${base}" stroke="#c9b48c"/>${bars}</svg>
    ${hasPartial ? '<p class="note">虛線長條只統計到 10 月，不是全年數字。</p>' : ''}
    ${table({ head: d.head, rows: d.rows })}</figure>`;
}

function table({ head, rows, total }) {
  const isNum = (s) => /^[\d,.]+$/.test(String(s));
  const body = rows.map((r, i) => `<tr class="${total && i === rows.length - 1 ? 'total' : ''}">${r.map((c) => `<td class="${isNum(c) ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('');
  const headRow = head.map((h, i) => `<th class="${rows.every((r) => isNum(r[i])) ? 'num' : ''}">${esc(h)}</th>`).join('');
  return `<div class="tbl-wrap"><table class="t"><thead><tr>${headRow}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function activities(b, tabIdx) {
  return `<div class="acts">${b.items.map((a, i) => `
    <article class="act ${i === 0 ? 'open' : ''}" data-act="${i}">
      <button data-toggle aria-expanded="${i === 0}"><b>${i + 1}</b><span>${esc(a.title)}</span><i>›</i></button>
      <div class="act-body"><dl>
        <dt>${esc(b.labels[0])}</dt><dd>${esc(a.meaning)}</dd>
        <dt>${esc(b.labels[1])}</dt><dd>${esc(a.how)}</dd></dl>
        ${a.photos.length ? `<div class="act-photos">${a.photos.map(photo).join('')}</div>` : ''}
      </div></article>`).join('')}</div>`;
}

function routes(b) {
  return `<div class="routes">${b.items.map((r, i) => `
    <article class="act route ${i === 0 ? 'open' : ''}" data-act="${i}">
      <button data-toggle aria-expanded="${i === 0}"><em class="grade" style="font-style:normal">${esc(r.grade)}</em><span>${esc(r.title)}<small class="face">${esc(r.face)}</small></span><i>›</i></button>
      <div class="act-body"><dl>
        <dt>地方特色</dt><dd>${esc(r.feature)}</dd>
        <dt>閱讀文本</dt><dd>${esc(r.texts)}</dd>
        <dt>教學活動</dt><dd>${esc(r.how)}</dd>
        <dt>閱讀理解與策略</dt><dd class="strat">${r.strategy.map((s) => `<span class="chip">${esc(s.replace(/^\d\./, ''))}</span>`).join('')}</dd>
        <dt>成果檢核</dt><dd>${esc(r.check)}</dd></dl>
        <div class="act-photos">${r.photos.map(photo).join('')}</div>
      </div></article>`).join('')}</div>`;
}

function ilr(b) {
  const rows = (g) => b.rows.map((r) => `<div class="ilr-row"><b>${esc(r.topic)}<small>${esc(r.facet)}</small></b><span>${esc(r.cells[g])}</span></div>`).join('');
  return `<div class="ilr" data-ilr>
    <div class="ilr-grades" role="tablist">${b.grades.map((g, i) => `<button class="${i === 0 ? 'on' : ''}" data-grade="${i}">${esc(g)}</button>`).join('')}</div>
    <div class="ilr-list">${rows(0)}</div></div>`;
}

export function ilrRows(island, tab, g) {
  const b = content[island].tabs[tab].blocks.find((x) => x.t === 'ilr');
  return b.rows.map((r) => `<div class="ilr-row"><b>${esc(r.topic)}<small>${esc(r.facet)}</small></b><span>${esc(r.cells[g])}</span></div>`).join('');
}

export const reservoirBlock = () => `<div class="live-res" data-live-res><div class="big"><div class="gauge"><i data-res-fill style="height:0"></i></div>
  <div class="res-num"><strong data-res-level>讀取中…</strong><p data-res-note>資料來源：經濟部水利署開放資料</p></div></div>
  <dl data-res-more></dl></div>`;

export function renderBlock(b, ctx) {
  switch (b.t) {
    case 'lead': return `<p class="lead">${esc(b.text)}</p>`;
    case 'p': return `<p>${esc(b.text)}</p>`;
    case 'h': return `<h3 class="block-h">${esc(b.text)}</h3>`;
    case 'list': return `<ul class="bullets">${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    case 'stats': return `<div class="stats">${b.items.map((s) => `<div class="stat"><b>${esc(s.n)}<small>${esc(s.u)}</small></b><span>${esc(s.label)}</span></div>`).join('')}</div>`;
    case 'timeline': return `<div class="timeline">${b.items.map((s) => `<div class="tl" style="--k:${s.color}"><h4>${esc(s.stage)}<small>民國 ${esc(s.years)} 年</small></h4><div class="goal">${esc(s.goal)}</div><ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>`;
    case 'goals': return `<div class="goals">${b.items.map((g) => `<div class="goal-card" style="--k:${g.c}"><b>${esc(g.k)}</b><small>${esc(g.sub)}</small><p>${esc(g.text)}</p></div>`).join('')}</div>`;
    case 'themes': return `<div class="themes">${b.items.map((g) => `<button class="theme" data-goto="${g.id}" style="--k:${ctx.color(g.id)}"><em>${esc(g.k)}</em><b>${esc(g.name)}</b><span>${esc(g.text)}</span></button>`).join('')}</div>`;
    case 'activities': return activities(b);
    case 'routes': return routes(b);
    case 'photos': return `<div class="grid-photos">${b.items.map(photo).join('')}</div>`;
    case 'fig': return fig(b.item);
    case 'steps': return `<div class="steps">${b.items.map((s) => `<div><b>${esc(s.k)}</b>${esc(s.text)}</div>`).join('')}</div>`;
    case 'table': return table(b);
    case 'chart': return chart(b.data);
    case 'ilr': return ilr(b);
    case 'chips': return `<div><div class="chips-label">${esc(b.label)}</div><div class="chips">${b.items.map((i) => `<span class="chip">${esc(i)}</span>`).join('')}</div></div>`;
    case 'domains':
    case 'cards': return `<div class="cards">${b.items.map((c) => `<div class="cardlet"><b>${esc(c.k)}</b>${esc(c.text)}</div>`).join('')}</div>`;
    case 'columns': return `<div class="cols">${b.items.map((c) => `<div class="cardlet"><b>${esc(c.k)}</b><ul class="bullets">${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>`;
    case 'badges': return `<div class="badges">${b.items.map((i) => { const src = `./images/badge/${i.id}.webp`; const n = reg({ ...i, src }); return `<button data-lb="${n}"><img loading="lazy" src="${src}" alt="${esc(i.cap)}"><span>${esc(i.cap)}</span></button>`; }).join('')}</div>`;
    case 'live-reservoir': return reservoirBlock();
    default: return '';
  }
}

// 全文搜尋用：把一座島的內容攤平成文字
export function flatten(id) {
  const out = [];
  const push = (tab, text) => { if (text) out.push({ tab, text }); };
  content[id].tabs.forEach((t, ti) => {
    t.blocks.forEach((b) => {
      if (b.text) push(ti, b.text);
      if (b.t === 'list') b.items.forEach((i) => push(ti, i));
      if (b.t === 'cards' || b.t === 'domains') b.items.forEach((i) => push(ti, `${i.k}：${i.text}`));
      if (b.t === 'activities') b.items.forEach((i) => push(ti, `${i.title}：${i.meaning} ${i.how}`));
      if (b.t === 'routes') b.items.forEach((i) => push(ti, `${i.title}（${i.grade}）：${i.feature}`));
      if (b.t === 'photos') b.items.forEach((i) => push(ti, i.cap));
      if (b.t === 'ilr') b.rows.forEach((r) => push(ti, `${r.topic}：${r.cells.join('、')}`));
      if (b.t === 'table') b.rows.forEach((r) => push(ti, r.join('　')));
      if (b.t === 'timeline') b.items.forEach((s) => push(ti, `${s.stage}（${s.years}）：${s.items.join('、')}`));
      if (b.t === 'goals') b.items.forEach((s) => push(ti, `${s.k}：${s.text}`));
      if (b.t === 'columns') b.items.forEach((c) => push(ti, `${c.k}：${c.items.join('、')}`));
    });
  });
  return out;
}
