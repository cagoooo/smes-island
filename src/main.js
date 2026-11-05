// 石門國小品牌群島：介面總控
import './styles.css';
import * as THREE from 'three';
import { World } from './world/world.js';
import { music } from './ui/sound.js';
import { initUpdate } from './ui/update.js';
import { sheet } from './ui/sheet.js';
import { countVisit, rollNumber } from './ui/visits.js';
import { showFound, flyCount, showFinale, closeFinale, hippoGrid } from './ui/hippo.js';
import { TIERS, certInfo, issue, drawCert, printCert, certTiers, sendCerts, validName } from './ui/cert.js';
import { challenge, loadBank, newRun, answer, levelHtml, rules } from './ui/challenge.js';
import { BANDS, PASS, REDEEM, QUEST, bandOf } from './data/challenge.js';
import { ISLANDS, SCHOOL, HONORS, QUOTES, QUIZ, QUIZ_RESULT, LINKS, HIPPOS, PEOPLE_LINES } from './data/site.js';
import { content, renderBlock, currentGallery, resetGallery, esc, full, nativeWidth, ilrRows, flatten } from './ui/blocks.js';
import { fetchWeather, fetchAlert, stormState, fetchAir, fetchReservoir, fetchNews, fmtDate } from './ui/live.js';

const VERSION = `v${__APP_VERSION__}`;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const byId = Object.fromEntries(ISLANDS.map((d) => [d.id, d]));
const order = ISLANDS.map((d) => d.id);
const isMobile = () => window.innerWidth <= 860;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 無痕模式略過 */ } },
};

const S = {
  island: null, tab: 0, listing: false, touring: false, walking: false, tourPaused: false, tourIdx: 0, labels: true, arcs: false, paused: false, time: 'live',
  stamps: new Set(store.get('smes-stamps', [])), hippos: new Set(store.get('smes-hippos', [])), res: null, weather: null, air: null, news: [],
};
let world = null;
let lbIndex = 0;

// ───────── 版面骨架 ─────────
$('#app').innerHTML = `
<header class="topbar">
  <button class="brand card" data-act="home" aria-label="回到群島全景">
    <img src="./brand/school-logo.png" alt="石門國小校徽" width="50" height="50">
    <span><h1>桃園市石門國小品牌群島</h1><p>鱻鯉鰭源，石門活閱｜十二座浮空島的閱讀品牌之旅</p></span>
  </button>
  <div class="quote card"><span class="tagline">今日書語</span><blockquote id="quote"></blockquote><button class="again" data-act="quote" aria-label="換一句" title="換一句">↻</button></div>
  <div class="liveinfo card" id="liveinfo">
    <div class="date"><strong id="dDate"></strong><span id="dWeek"></span></div><span class="sep"></span>
    <div class="wx" id="wx"><i>⛅</i><div><strong>讀取天氣中…</strong><span>龍潭石門</span></div></div>
    <button class="wx-magic" id="wxMagic" data-act="wxMenu" aria-haspopup="dialog" aria-expanded="false" title="換個天氣看看群島的變化"><b aria-hidden="true">🪄</b><span>變天氣</span></button>
  </div>
</header>
<div class="wx-pop card" id="wxPop" role="dialog" aria-label="換個天氣看看" hidden>
  <div class="wx-pop-head"><strong>換個天氣看看</strong><button class="round" data-act="wxMenu" aria-label="關閉">×</button></div>
  <div class="wx-grid" id="wxGrid"></div>
  <p class="wx-note">每種天氣的畫面、人物、配樂和環境音都不一樣，記得打開音樂哦！</p>
</div>

<aside class="watch card" id="watch" aria-label="雲端瞭望台">
  <div class="watch-head"><span class="pulse"></span><h2>雲端瞭望台</h2><button class="round" data-act="watch" aria-label="收起雲端瞭望台" title="收起瞭望台，群島畫面更乾淨">×</button></div>
  <div class="watch-body">
    <p class="status-line" id="schoolState"></p>
    <div class="tile quote-tile"><h3>今日書語</h3><blockquote id="quoteTile"></blockquote><button class="watch-link" data-act="quote">換一句 ›</button></div>
    <button class="tile" data-act="res"><h3>石門水庫即時</h3><div class="res-row"><div class="gauge"><i data-res-fill style="height:0"></i></div><div class="res-num"><strong data-res-level>讀取中…</strong><p data-res-note></p></div></div></button>
    <div class="tile"><h3>校園公告</h3><div class="ticker" id="newsTicker"><span class="tick"><span>讀取公告中…</span></span></div><button class="watch-link" data-act="log">看全部公告 ›</button></div>
    <div class="tile"><h3>榮譽榜</h3><div class="ticker" id="honorTicker"></div><button class="watch-link" data-act="honors">看完整榮譽榜 ›</button></div>
  </div>
</aside>

<section class="panel" id="panel" aria-label="島嶼內容" aria-hidden="true">
  <div class="panel-head">
    <button class="handle" data-act="tall" aria-label="展開或收合內容" aria-expanded="true"></button>
    <div class="ph-row"><button class="round" data-act="prev" aria-label="上一座島">‹</button><span class="kicker" id="pKicker"></span><strong class="peek-name" id="pPeek"></strong><button class="round" data-act="next" aria-label="下一座島">›</button><button class="round" data-act="close" aria-label="關閉">×</button></div>
    <h2 id="pTitle"></h2><p class="motto" id="pMotto"></p>
    <div class="tabs" id="pTabs" role="tablist"></div>
  </div>
  <div class="panel-body" id="pBody"></div>
  <div class="panel-foot"><button data-act="prev" id="footPrev"></button><button data-act="next" id="footNext"></button></div>
</section>

<div class="tourbar card" id="tourbar" hidden><div class="inner">
  <div class="tt"><h3 id="tTitle"></h3><span class="prog" id="tProg"></span></div><p id="tText"></p><p class="t-hippo" id="tHippo" hidden></p>
  <div class="ctl"><button data-act="tourPrev">‹ 上一座</button><button class="main" data-act="tourPause" id="tPause">暫停</button><button data-act="tourNext">下一座 ›</button><button data-act="tourMore" id="tMore">看完整介紹</button><button data-act="tourEnd">結束導覽</button></div>
  <div class="bar"><i id="tBar"></i></div>
</div></div>

<div class="walkbar card" id="walkbar" hidden>
  <div class="txt"><strong id="wTitle"></strong><span id="wText"></span></div>
  <div class="ctl"><button data-act="strollNext">換一隊</button><button data-act="strollIsland">看這座島</button><button class="main" data-act="strollEnd">結束逛島</button></div>
</div>

<button class="book-chip" id="bookChip" data-act="chBack" hidden></button>
<p class="ch-tip" id="chTip" aria-hidden="true" hidden><b>📝 題目在這裡</b><span>讀完題目，點選答案</span></p>
<button class="book-chip stamp-chip" id="stampChip" hidden></button>
<button class="storm-chip" id="stormChip" data-act="storm" hidden><b id="stormTitle"></b><span>點我看防颱小叮嚀</span></button>
<button class="hintcard card" id="hint" data-act="hint">
  <img src="./brand/fish-mascot.webp" alt="" width="44" height="44"><span><strong>點一座島，開始探索！</strong><span id="hintText"></span><span class="visit-line" id="visitLine" hidden>累計 <b id="visitTotal">0</b> 人次登島・今日 <b id="visitToday">0</b> 人</span></span>
</button>
<p class="credit">Made with <span class="site-credit__heart" aria-label="愛心">❤️</span> by <a class="site-credit__author" href="${SCHOOL.teacherUrl}" target="_blank" rel="noopener noreferrer">阿凱老師</a></p>

<nav class="dock" aria-label="工具列">
  <button class="cta koi" data-act="mission">小河馬尋寶</button>
  <button class="cta lake" data-act="qr">掃碼登島</button>
  <button class="cta koi" data-act="quiz">閱讀小測驗</button>
  <button class="cta lake" data-act="tour" id="tourBtn">島嶼導覽</button>
  <button class="cta sun" data-act="stroll" id="strollBtn">跟著逛島</button>
  <button class="cta moss" data-act="passport">閱讀護照</button>
  <button class="cta koi" id="nextBtn" data-act="certReset" hidden>換下一位</button>
  <div class="seg" role="group" aria-label="檢視模式">
    <button class="on" data-view="home">全景</button><button data-view="top">鳥瞰</button><button data-view="list">清單</button>
  </div>
  <div class="seg" role="group" aria-label="場景工具">
    <button class="on" data-act="labels">島名</button>
    <button data-act="arcs">跨域串聯</button>
    <button data-act="pause" id="pauseBtn">暫停</button>
    <button data-act="music" id="musicBtn" aria-pressed="true">音樂</button>
    <button data-act="sfx" id="sfxBtn" aria-pressed="true">音效</button>
    <button data-act="time" id="timeBtn" title="換天氣、換時間">天氣・即時</button>
    <button class="on desk-only" data-act="tilt" id="tiltBtn" aria-pressed="true" title="模型感：畫面上下變模糊，讓群島看起來像桌上的小模型（攝影的移軸效果）">模型感</button>
    <button data-act="log">日誌</button>
    <button data-act="watch" id="watchBtn" aria-pressed="true" title="顯示或收起雲端瞭望台">瞭望台</button>
  </div>
</nav>
<button class="dock-nav prev" id="dockPrev" data-act="dockPrev" aria-label="往前看工具列" hidden>‹</button>
<button class="dock-nav next" id="dockNext" data-act="dockNext" aria-label="往後看更多工具" hidden>›</button>

<section class="listview" id="listview" aria-label="文字清單">
  <div class="wrap">
    <div class="list-head"><h2>全部島嶼</h2><div class="search"><input id="search" type="search" placeholder="搜尋方案內容，例如：讀報、石門水庫、一師一e" aria-label="搜尋方案內容"></div></div>
    <div id="listBody"></div>
  </div>
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-inner">
        <div class="footer-brand"><img src="./brand/school-logo.png" alt="" width="56" height="56"><div><strong>石門國小品牌群島</strong><span>鱻鯉鰭源，石門活閱。用十二座浮空島，認識百年老校的閱讀品牌。</span></div></div>
        <ul class="footer-points">
          <li><span class="fp">魚</span><div><strong>魚閱時光</strong><small>追求幸福閱讀的品牌精神</small></div></li>
          <li><span class="fp">磐</span><div><strong>雙閱讀磐石</strong><small>101、109 年教育部閱讀磐石獎</small></div></li>
          <li><span class="fp">即</span><div><strong>即時資訊</strong><small>天氣、水庫與校園公告同步更新</small></div></li>
        </ul>
        <nav class="footer-links" aria-label="快速連結">
          <a href="${SCHOOL.site}" target="_blank" rel="noopener noreferrer">石門國小官網</a>
          <button data-act="log">校園公告</button>
          <button data-act="honors">榮譽榜</button>
        </nav>
      </div>
      <div class="footer-bottom">
        <p class="site-credit">Made with <span class="site-credit__heart" aria-label="愛心">❤️</span> by <a href="${SCHOOL.teacherUrl}" target="_blank" rel="noopener noreferrer" class="site-credit__author">阿凱老師</a><span class="footer-school"><span class="footer-dot" aria-hidden="true">・</span>${SCHOOL.name}</span></p>
        <p>${SCHOOL.address}｜${SCHOOL.phone}</p>
        <p class="version-tag" title="${__BUILD_VERSION__}">${VERSION}</p>
      </div>
    </div>
  </footer>
</section>

<div class="modal" id="modal" role="dialog" aria-modal="true"><div class="dialog" id="dialog"></div></div>
<div class="lb" id="lb" role="dialog" aria-modal="true"><figure><div class="lb-view" id="lbView"><img id="lbImg" alt=""></div><figcaption><span id="lbCap"></span><a id="lbLink" target="_blank" rel="noopener" hidden>看原始報導 ↗</a><small>點圖片可放大</small></figcaption></figure>
  <button class="round x" data-act="lbClose" aria-label="關閉">×</button><button class="round p" data-act="lbPrev" aria-label="上一張">‹</button><button class="round n" data-act="lbNext" aria-label="下一張">›</button></div>
<div class="toast" id="toast" role="status"></div>`;

// ───────── 小工具 ─────────
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
}

// peek：閱讀挑戰的對話框靠邊放、背景不壓暗，讓孩子看得到鏡頭飛到哪一座島
function openModal(html, wide = false, peek = false) {
  const d = $('#dialog');
  const was = $('#modal').classList.contains('peek');
  $('#chTip').hidden = true;
  d.className = `dialog${wide ? ' wide' : ''}`;
  d.innerHTML = html;
  delete d.dataset.lock;
  $('#modal').classList.toggle('peek', peek);
  if (peek || was) { $('#watch').classList.toggle('away', peek || !!S.island); paintWatch(); }
  $('#modal').classList.add('open');
  $('.round[data-act="modalClose"]', d)?.focus();
  if (peek) requestAnimationFrame(() => world?.setInset(isMobile() ? 0 : (d.offsetWidth + 14) / 2, isMobile() ? d.offsetHeight / 2 - 10 : 0));
  else if (was) updateInset();
}
function closeModal() {
  const was = $('#modal').classList.contains('peek');
  $('#chTip').hidden = true;
  $('#modal').classList.remove('open', 'peek');
  if (!was) return;
  $('#watch').classList.toggle('away', !!S.island);
  paintWatch();
  updateInset();
}
const dialogHead = (title) => `<div class="dialog-head"><h2>${esc(title)}</h2><button class="round" data-act="modalClose" aria-label="關閉">×</button></div>`;

// 共用平板要交給下一位時的清除入口，寫在一起讓文字和按鈕一致
const hasProgress = () => S.hippos.size > 0 || S.stamps.size > 0 || !!certInfo.get() || !!challenge.get();
const passed = () => challenge.get()?.state === 'pass';
const ready = () => S.hippos.size === 12 && S.stamps.size === 12;
const tierState = () => ({ hippos: S.hippos.size, stamps: S.stamps.size, passed: passed(), playing: challenge.get()?.state === 'play' });
const lvl = (v) => (v === 'M' ? 'M' : +v);
const handover = (text, quiet = false) => `<div class="handover${quiet ? ' quiet' : ''}"><p>${text}</p><button class="cta ${quiet ? 'plain' : 'koi'}" data-act="certReset">換下一位同學</button></div>`;
const paintNext = () => { $('#nextBtn').hidden = !hasProgress(); };

function setHint() {
  paintNext();
  const n = S.hippos.size;
  $('#hintText').textContent = n < 12 ? `找到 6 隻、12 隻都能領證書，已找到 ${n} 隻`
    : passed() ? `你是尋河馬達人！${REDEEM}帶證書到校長室兌換招待券`
      : S.stamps.size < 12 ? `12 隻都找到了！再集滿 12 枚章，就能挑戰尋河馬達人（${S.stamps.size} / 12）`
        : '12 隻、12 枚章都集滿了，快來挑戰尋河馬達人！';
}

// ───────── 島嶼名牌與定位點 ─────────
const LABEL_Y = { core: 25, admin: 13.5, digital: 10, future: 11, inquiry: 8.5, walk: 7, library: 8, results: 9, teacher: 7.5, brand: 11, forest: 7.5, course: 5.5 };
const plates = {};
const v3 = new THREE.Vector3();
let pins = [];

function buildPlates() {
  const box = $('#labels');
  for (const d of ISLANDS) {
    const b = document.createElement('button');
    b.className = 'plate';
    b.style.setProperty('--c', d.color);
    b.innerHTML = `<span class="dot"></span>${esc(d.name)}<em>${esc(d.tag)}</em><span class="quest-tag" hidden></span>`;
    b.addEventListener('click', () => openIsland(d.id));
    b.addEventListener('pointerenter', () => world.setHover(d.id));
    b.addEventListener('pointerleave', () => world.setHover(null));
    box.appendChild(b);
    plates[d.id] = b;
  }
}

function spotList(id) {
  const tabs = content[id].tabs;
  for (let t = 0; t < tabs.length; t++) {
    const b = tabs[t].blocks.find((x) => x.t === 'activities' || x.t === 'routes');
    if (b) return b.items.map((it, i) => ({ label: (b.t === 'routes' ? it.title.replace(/^.*?-/, '') : it.title.split(/-+/)[0]).split(' ')[0].replace('石門國小', ''), tab: t, item: i }));
  }
  return tabs.map((t, i) => ({ label: t.label, tab: i }));
}

function buildPins(id) {
  clearPins();
  const d = byId[id];
  const anchors = world.islands[id].anchors;
  const list = spotList(id).slice(0, anchors.length);
  const box = $('#labels');
  pins = list.map((s, i) => {
    const b = document.createElement('button');
    b.className = 'pin';
    b.style.setProperty('--c', d.color);
    b.innerHTML = `<b>${i + 1}</b>${isMobile() ? '' : esc(s.label)}`;
    if (isMobile()) b.setAttribute('aria-label', s.label);
    b.title = s.label;
    b.addEventListener('click', () => { if (sheet.state === 'peek') sheet.set('half'); setTab(s.tab); if (s.item !== undefined) openAct(s.item); });
    box.appendChild(b);
    return { el: b, anchor: anchors[i], spot: s };
  });
}

function clearPins() { pins.forEach((p) => p.el.remove()); pins = []; }

function place(el, camera, W, H) {
  v3.project(camera);
  if (v3.z > 1) { el.style.visibility = 'hidden'; return; }
  el.style.visibility = '';
  const x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
  el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`;
}

// ───────── 老師與學生的對話、跟著逛島 ─────────
let sayEl = null, sayWho = null, sayTimer;

function hideSay() {
  clearTimeout(sayTimer);
  sayEl?.remove();
  sayEl = sayWho = sayDoor = null;
}

const SKY_TAG = { day: '☀️', cloudy: '☁️', rain: '🌧️', storm: '🌀', dusk: '🌇', night: '🌙' };

// 點到的人會轉過來揮手；按「再聊一句」話題會從正在做的事、天氣聊到這座島
function sayHtml(p) {
  const who = p.kind === 'teacher' ? '老師' : '小朋友';
  return `<div class="say-box"><strong>${SKY_TAG[world.people.sky()] || ''} ${who}・${esc(world.people.status(p.crew))}</strong><p>${esc(world.people.lineOf(p))}</p>`
    + '<div class="say-btns"><button data-act="sayMore">再聊一句</button><button data-act="sayFollow">跟著走</button></div></div>';
}

function showSay(p) {
  music.sfx('pop');
  hideSay();
  sayWho = p;
  world.people.greet(p, world.camera);
  sayEl = document.createElement('div');
  sayEl.className = 'say';
  sayEl.innerHTML = sayHtml(p);
  $('#labels').appendChild(sayEl);
  sayTimer = setTimeout(hideSay, 9000);
}

// ───────── 颱風天：跑進屋時自己喊出防颱提醒；進屋後門口出現對話泡泡，點開聽屋裡在聊什麼 ─────────
const autoSays = [];
const doorTags = new Map();
let autoNext = 0, sayDoor = null, cheerUntil = 0;

function onScreen(p, camera) {
  world.people.headOf(p, v3);
  v3.project(camera);
  return v3.z < 1 && Math.abs(v3.x) < 0.85 && v3.y < 0.7 && v3.y > -0.8;
}

function doorPos(g) {
  const is = world.islands[g.id], gp = is.group.position;
  return v3.set(gp.x + g.door.x, gp.y + is.nav.y(g.door.x, g.door.z) + 1.5, gp.z + g.door.z);
}

function stormTalk(camera, W, H) {
  const P = world.people;
  const now = performance.now();
  for (let i = autoSays.length - 1; i >= 0; i--) {
    const a = autoSays[i];
    if (now > a.until || a.p.vis < 0.3 || (!P.storm && !a.cheer)) { a.el.remove(); autoSays.splice(i, 1); continue; }
    P.headOf(a.p, v3);
    place(a.el, camera, W, H);
  }
  // 一次最多三個人喊話，輪流換人，畫面才不會被泡泡塞滿
  // 過關歡呼時泡泡冒得快一點、多一點
  const cheering = now < cheerUntil;
  if ((P.storm || cheering) && now > autoNext && autoSays.length < (cheering ? 5 : 3)) {
    autoNext = now + (cheering ? 500 + Math.random() * 500 : 1600 + Math.random() * 1400);
    const busy = new Set(autoSays.map((a) => a.p));
    if (sayWho) busy.add(sayWho);
    const cand = P.list.filter((p) => (cheering || p.crew.state === 'shelter') && p.crew.on && p.vis > 0.8 && !busy.has(p) && onScreen(p, camera));
    if (cand.length) {
      const p = cand[Math.floor(Math.random() * cand.length)];
      const el = document.createElement('div');
      el.className = `say auto${cheering ? ' cheer' : ''}`;
      el.innerHTML = `<div class="say-box"><p>${esc(cheering ? P.pick(PEOPLE_LINES.cheer) : P.tipOf(p))}</p></div>`;
      $('#labels').appendChild(el);
      autoSays.push({ p, el, until: now + 3400, cheer: cheering });
    }
  }
  const seen = new Set();
  if (P.storm) {
    for (const g of P.indoor()) {
      seen.add(g.key);
      let t = doorTags.get(g.key);
      if (!t) {
        const el = document.createElement('button');
        el.className = 'door-chat';
        el.dataset.act = 'doorTalk';
        el.dataset.key = g.key;
        el.setAttribute('aria-label', '聽聽屋裡在聊什麼');
        $('#labels').appendChild(el);
        doorTags.set(g.key, (t = { el, g, n: -1 }));
      }
      t.g = g;
      if (t.n !== g.n) { t.n = g.n; t.el.innerHTML = `💬<b>${g.n}</b>`; }
      doorPos(g);
      place(t.el, camera, W, H);
    }
  }
  for (const [k, t] of doorTags) if (!seen.has(k)) { t.el.remove(); doorTags.delete(k); }
  if (sayDoor && !seen.has(sayDoor.key)) hideSay();
}

function doorHtml(g) {
  return `<div class="say-box"><strong>🌀 ${esc(byId[g.id].name)}・屋裡有 ${g.n} 人在躲颱風</strong><p>${esc(world.people.indoorLine(g))}</p>`
    + '<div class="say-btns"><button data-act="doorMore">再聽一句</button></div></div>';
}

function showDoor(g) {
  music.sfx('pop');
  hideSay();
  sayDoor = g;
  sayEl = document.createElement('div');
  sayEl.className = 'say';
  sayEl.innerHTML = doorHtml(g);
  $('#labels').appendChild(sayEl);
  sayTimer = setTimeout(hideSay, 9000);
}

function startStroll(crew) {
  hideSay();
  if (S.island) closeIsland();
  if (S.touring) stopTour();
  if (S.listing) setList(false);
  S.walking = true;
  document.body.classList.add('walking');
  document.body.classList.remove('watch-force');
  paintWatch();
  $('#walkbar').hidden = false;
  $('#strollBtn').textContent = '結束逛島';
  syncView('');
  world.follow(crew);
  updateInset();
}

function stopStroll(home = false) {
  if (!S.walking) return;
  S.walking = false;
  document.body.classList.remove('walking');
  paintWatch();
  $('#walkbar').hidden = true;
  $('#strollBtn').textContent = '跟著逛島';
  world.unfollow();
  updateInset();
  if (home) { world.clearFocus(); world.setView('home'); syncView('home'); }
}

function paintStroll() {
  const c = world.people.followed;
  if (!c) return;
  const title = c.teacher && c.members.length > 1 ? '跟著老師帶的隊伍' : c.teacher ? '跟著老師' : '跟著小朋友';
  const text = world.people.status(c);
  if ($('#wTitle').textContent !== title) $('#wTitle').textContent = title;
  if ($('#wText').textContent !== text) $('#wText').textContent = text;
}

function onFrame(camera) {
  const W = world.width, H = world.height;
  for (const d of ISLANDS) {
    const g = world.islands[d.id].group.position;
    v3.set(g.x, g.y + LABEL_Y[d.id], g.z);
    place(plates[d.id], camera, W, H);
  }
  const g = S.island && world.islands[S.island].group;
  if (g) for (const p of pins) { v3.copy(p.anchor).add(g.position); place(p.el, camera, W, H); }
  if (sayEl && sayWho) { world.people.headOf(sayWho, v3); place(sayEl, camera, W, H); }
  if (sayEl && sayDoor) { doorPos(sayDoor); place(sayEl, camera, W, H); }
  stormTalk(camera, W, H);
  if (S.walking) paintStroll();
}

// ───────── 開啟島嶼 ─────────
function openIsland(id, { tab = 0, fly = true, push = true, keepSheet = false } = {}) {
  if (S.listing) setList(false, false);
  if (S.touring) stopTour();
  if (S.walking) stopStroll();
  hideSay();
  const d = byId[id];
  S.island = id;
  S.tab = tab;
  const panel = $('#panel');
  const whole = keepSheet && sheet.state === 'peek';
  panel.style.setProperty('--c', d.color);
  $('#pKicker').textContent = d.kicker;
  $('#pTitle').textContent = d.name;
  $('#pPeek').textContent = d.name;
  $('#pMotto').textContent = d.motto;
  $('#pTabs').innerHTML = content[id].tabs.map((t, i) => `<button role="tab" data-tab="${i}" class="${i === tab ? 'on' : ''}">${esc(t.label)}</button>`).join('');
  const idx = order.indexOf(id);
  $('#footPrev').textContent = `‹ ${byId[order[(idx + order.length - 1) % order.length]].name}`;
  $('#footNext').textContent = `${byId[order[(idx + 1) % order.length]].name} ›`;
  renderTab();
  panel.classList.add('open');
  document.body.classList.add('reading');
  panel.setAttribute('aria-hidden', 'false');
  $('#watch').classList.add('away');
  paintWatch();
  $('#hint').hidden = true;
  Object.entries(plates).forEach(([k, p]) => p.classList.toggle('off', k !== id || isMobile()));
  if (world) {
    if (fly) world.focusIsland(id, whole);
    buildPins(id);
    world.setHoverRing(null);
  }
  if (push && location.hash !== `#/${id}`) history.pushState(null, '', `#/${id}`);
  music.sfx('whoosh');
  if (!S.stamps.has(id)) {
    music.sfx('stamp');
    S.stamps.add(id);
    store.set('smes-stamps', [...S.stamps]);
    setHint();
    if (S.stampRun && S.hippos.size === 12) S.justStamped = d.name; // 蓋章結果寫在上方按鈕，不另外跳提示蓋住它
    else if (S.stamps.size === order.length) toast(S.hippos.size === 12 && !passed() ? '閱讀護照集滿了！到閱讀護照挑戰「尋河馬達人」吧' : '恭喜！閱讀護照十二枚印章全部集滿了');
    else toast(`閱讀護照蓋章：${d.name}（${S.stamps.size} / 12）`);
  }
  paintStampChip();
  if (!whole) sheet.reset();
  syncView('');
  updateInset();
  sheetTip();
}

// 依目前開啟的面板調整場景可視中心
function updateInset() {
  if (!world) return;
  if (S.touring || S.listing || S.walking) { world.setInset(0, 0); return; }
  if (S.island) {
    if (isMobile()) world.setInset(0, Math.min(sheet.height, innerHeight * 0.6) / 2 - 10);
    else world.setInset(($('#panel').offsetWidth + 14) / 2, 0);
    return;
  }
  world.setInset(isMobile() || $('#watch').classList.contains('shut') ? 0 : ($('#watch').offsetWidth + 14) / 2, 0);
}

// 電腦版可以收起瞭望台讓群島畫面更乾淨，選擇會記住；手機版維持點了才展開
function setWatch(on, quiet = false) {
  $('#watch').classList.toggle('shut', !on);
  store.set('smes-watch', on);
  paintWatch();
  updateInset();
  if (!on && !quiet) toast('瞭望台收起來了，下方工具列「瞭望台」可以再打開');
}

// 瞭望台在畫面上看不看得到：逛島、導覽時預設藏起來，孩子自己打開（watch-force）才出現
const watchSeen = () => {
  const w = $('#watch');
  const on = isMobile() ? w.classList.contains('opened') : !w.classList.contains('shut');
  // 島嶼介紹、閱讀挑戰、清單開著時瞭望台會讓位（away），也算看不到
  if (w.classList.contains('away') || S.listing) return false;
  return on && (!(S.walking || S.touring) || document.body.classList.contains('watch-force'));
};

function paintWatch() {
  const on = watchSeen();
  const b = $('#watchBtn');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
}
window.addEventListener('resize', paintWatch);
window.addEventListener('resize', updateInset);

// 頂部列會因書語長短、字型載入而變高，瞭望台跟著往下讓，標題才不會被蓋住；手機的瞭望台在下方，不用調
function fitWatch() {
  const w = $('#watch');
  if (isMobile()) { w.style.top = ''; w.style.maxHeight = ''; return; }
  const top = Math.round($('.topbar').getBoundingClientRect().bottom + 8);
  w.style.top = `${top}px`;
  w.style.maxHeight = `calc(100dvh - ${top + 84}px)`;
}
new ResizeObserver(fitWatch).observe($('.topbar'));
window.addEventListener('resize', fitWatch);

// 收合時鏡頭退遠看整座島，拉回來才恢復近看
function onSheet(state, prev) {
  updateInset();
  if (!world || !S.island) return;
  if (state === 'peek') world.focusIsland(S.island, true);
  else if (prev === 'peek') world.focusIsland(S.island);
}

function sheetTip() {
  if (!isMobile() || store.get('smes-sheet-tip', false)) return;
  store.set('smes-sheet-tip', true);
  setTimeout(() => { if (S.island) toast('內容往下滑可以收起來，看見整座島'); }, 3400);
}

function closeIsland(push = true) {
  if (!S.island) return;
  S.island = null;
  $('#panel').classList.remove('open');
  sheet.reset();
  document.body.classList.remove('reading');
  $('#panel').setAttribute('aria-hidden', 'true');
  $('#watch').classList.remove('away');
  paintWatch();
  $('#hint').hidden = false;
  Object.values(plates).forEach((p) => p.classList.remove('off'));
  clearPins();
  world?.clearFocus();
  world?.setView('home');
  syncView('home');
  updateInset();
  if (push) history.pushState(null, '', location.pathname + location.search);
}

function renderTab() {
  const id = S.island, tab = content[id].tabs[S.tab];
  resetGallery();
  const ctx = { color: (x) => byId[x].color };
  const body = $('#pBody');
  body.innerHTML = tab.blocks.map((b) => renderBlock(b, ctx)).join('');
  body.scrollTop = 0;
  $$('#pTabs button').forEach((b) => b.classList.toggle('on', +b.dataset.tab === S.tab));
  $('#pTabs .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  paintReservoir();
}

function setTab(i) { music.sfx('page'); S.tab = i; renderTab(); }

function openAct(i) {
  const a = $(`#pBody [data-act="${i}"]`);
  if (!a) return;
  $$('#pBody .act').forEach((x) => { x.classList.toggle('open', x === a); });
  a.classList.add('flash');
  setTimeout(() => a.classList.remove('flash'), 1200);
  a.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
  pins.forEach((p) => p.el.classList.toggle('on', p.spot.item === i));
}

function step(dir) {
  const i = order.indexOf(S.island);
  openIsland(order[(i + dir + order.length) % order.length], { keepSheet: true });
}

// ───────── 檢視模式 ─────────
function syncView(name) {
  $$('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
}

function setList(on, push = true) {
  S.listing = on;
  document.body.classList.toggle('listing', on);
  $('#listview').classList.toggle('open', on);
  if (on) {
    if (S.island) closeIsland(false);
    if (S.touring) stopTour();
    renderList('');
    syncView('list');
    if (push) history.pushState(null, '', '#/list');
  } else if (push) {
    history.pushState(null, '', location.pathname + location.search);
  }
  world?.setPaused(on || S.paused);
  updateInset();
}

function renderList(q) {
  const box = $('#listBody');
  const kw = q.trim();
  if (!kw) {
    box.innerHTML = `<div class="island-grid">${ISLANDS.map((d) => `
      <button class="icard" data-open="${d.id}" style="--c:${d.color}"><small>${esc(d.kicker)}</small><h3>${esc(d.name)}</h3><p>${esc(d.motto)}</p>
      <div class="sect">${content[d.id].tabs.map((t) => `<span class="chip">${esc(t.label)}</span>`).join('')}</div></button>`).join('')}</div>`;
    return;
  }
  const out = [];
  for (const d of ISLANDS) {
    for (const r of flatten(d.id)) {
      const i = r.text.indexOf(kw);
      if (i < 0) continue;
      const from = Math.max(0, i - 26);
      const snip = (from ? '…' : '') + r.text.slice(from, i + kw.length + 54);
      out.push({ d, tab: r.tab, html: esc(snip).replace(esc(kw), `<mark>${esc(kw)}</mark>`) });
    }
  }
  box.innerHTML = `<div class="results"><p class="note">找到 ${out.length} 筆與「${esc(kw)}」有關的內容</p>${out.slice(0, 60).map((r) => `
    <button class="result" data-open="${r.d.id}" data-open-tab="${r.tab}"><b>${esc(r.d.name)}</b> <small>${esc(content[r.d.id].tabs[r.tab].label)}</small><p>${r.html}</p></button>`).join('')}</div>`;
}

// ───────── 島嶼導覽 ─────────
let tourTimer = 0;
const TOUR_MS = 9000;
const MISSION_MS = 14000;
const TOUR_STOPS = ISLANDS.length + 1; // 第一站先說明尋寶任務，後面才逛十二座島
const tourWait = () => (S.tourIdx ? TOUR_MS : MISSION_MS);

function showTourStop() {
  music.sfx('whoosh');
  const d = ISLANDS[S.tourIdx - 1];
  $('#tProg').textContent = `${S.tourIdx + 1} / ${TOUR_STOPS}`;
  $('#tMore').textContent = d ? '看完整介紹' : '看尋寶任務';
  $('#tHippo').hidden = !d;
  tourTimer = 0;
  if (!d) {
    $('#tTitle').textContent = '小河馬尋寶任務';
    $('#tText').textContent = '每座島都躲著一隻小河馬！找到 6 隻、12 隻可以領紀念證書；再通過閱讀挑戰成為「尋河馬達人」，石門國小的同學就能到校長室兌換小客人招待券。';
    world.clearFocus();
    world.setView('home');
    syncView('home');
    return;
  }
  $('#tTitle').textContent = d.name;
  $('#tText').textContent = d.tour;
  $('#tHippo').textContent = S.hippos.has(d.id) ? `這座島的${HIPPOS[d.id].name}，你已經找到了！` : '這座島也躲著一隻小河馬，找找看閃閃發光的地方！';
  world.focusIsland(d.id);
}

function startTour() {
  if (S.walking) stopStroll();
  if (S.island) closeIsland(false);
  if (S.listing) setList(false, false);
  S.touring = true; S.tourPaused = false; S.tourIdx = 0;
  document.body.classList.add('touring');
  document.body.classList.remove('watch-force');
  paintWatch();
  $('#tourbar').hidden = false;
  $('#tPause').textContent = '暫停';
  $('#tourBtn').textContent = '結束導覽';
  updateInset();
  showTourStop();
}

function stopTour(home = false) {
  S.touring = false;
  document.body.classList.remove('touring');
  paintWatch();
  $('#tourbar').hidden = true;
  $('#tourBtn').textContent = '島嶼導覽';
  updateInset();
  if (home) { world.clearFocus(); world.setView('home'); syncView('home'); }
}

function tourTick(dt) {
  if (!S.touring || S.tourPaused) return;
  tourTimer += dt;
  $('#tBar').style.width = `${Math.min(100, (tourTimer / tourWait()) * 100)}%`;
  if (tourTimer > tourWait()) {
    if (S.tourIdx + 1 >= TOUR_STOPS) { stopTour(true); showMission(); return; }
    S.tourIdx += 1;
    showTourStop();
  }
}

// ───────── 測驗、護照、公告、榮譽榜 ─────────
function showQuiz(i = 0, tally = {}) {
  if (i >= QUIZ.length) {
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    const r = QUIZ_RESULT[best];
    openModal(`${dialogHead('測驗結果')}<div class="dialog-body quiz-result"><p>最適合你的島嶼是……</p><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p><p style="margin-top:6px"><b>${esc(byId[best].name)}</b>｜${esc(byId[best].motto)}</p>
      <div class="btn-row"><button class="btn main" data-goto="${best}">飛去看看 ›</button><button class="btn" data-act="quiz">重新測驗</button></div><p class="note" style="margin-top:12px">結果只是好玩的閱讀興趣參考，每一座島都歡迎你。</p></div>`);
    return;
  }
  const q = QUIZ[i];
  openModal(`${dialogHead('閱讀小測驗')}<div class="dialog-body"><p class="quiz-progress">第 ${i + 1} 題 / 共 ${QUIZ.length} 題</p><p class="quiz-q">${esc(q.q)}</p>
    ${q.a.map(([t, k]) => `<button class="quiz-opt" data-quiz="${i}" data-k="${k}">${esc(t)}</button>`).join('')}</div>`);
  $('#dialog').dataset.tally = JSON.stringify(tally);
}

const STORM_TITLE = { typhoon: '颱風來襲中', land: '陸上颱風警報', sea: '颱風警報發布中', closure: '桃園市停班停課', gale: '強風豪雨警戒', preview: '颱風模式預覽' };
const liveStorm = () => (S.weather ? stormState(S.weather, S.alert) : null);

// 依目前狀態切換颱風場景與提示；預覽時不看真實資料
function paintStorm() {
  const st = S.time === 'typhoon' ? { kind: 'preview', scene: true } : S.time === 'live' ? liveStorm() : null;
  $('#stormChip').hidden = !st;
  if (st) $('#stormTitle').textContent = `🌀 ${STORM_TITLE[st.kind]}`;
  if (S.time === 'live' && S.weather) world?.setWeather({ storm: !!st?.scene });
  if (st?.scene && S.walking) { stopStroll(true); toast('風雨太大，大家都進屋了，等天氣好再來逛島吧'); }
}

function showStorm() {
  const st = S.time === 'typhoon' ? { kind: 'preview' } : liveStorm();
  if (!st) return;
  const now = {
    preview: '這是預覽畫面，不是真的有颱風。',
    gale: `學校附近陣風每小時約 ${Math.round(st.gust)} 公里，正在下雨，外出要小心。`,
    typhoon: `桃園市：${st.info}`,
    closure: `桃園市：${st.info}`,
    land: `中央氣象署：${st.info}${st.name ? `（${st.name}）` : ''}`,
    sea: `中央氣象署：${st.info}${st.name ? `（${st.name}）` : ''}。學校附近目前不一定有風雨，請留意最新消息。`,
  }[st.kind];
  openModal(`${dialogHead('防颱小叮嚀')}<div class="dialog-body">
    <p class="storm-now">${esc(now)}</p>
    <ul class="storm-tips">
      <li>待在室內，不要到河邊、水庫或山坡看風雨</li>
      <li>遠離窗戶、招牌和大樹，小心掉落物</li>
      <li>準備手電筒和飲用水，幫家人一起檢查門窗</li>
      <li>有沒有停班停課，以官方公告為準，不要聽信傳言</li>
      <li>待在家的時間，正好讀一本喜歡的書</li>
    </ul>
    <div class="btn-row"><a class="cta lake" href="https://www.cwa.gov.tw/V8/C/P/Typhoon/TY_NEWS.html" target="_blank" rel="noopener">氣象署颱風消息</a><a class="cta moss" href="https://www.dgpa.gov.tw/typh/daily/nds.html" target="_blank" rel="noopener">停班停課查詢</a></div>
    <p class="note" style="margin-top:10px">颱風警報來自中央氣象署開放資料，風雨資料來自 Open-Meteo，是依學校位置估算；停班停課資料來自行政院人事行政總處。更新可能有延遲，請以官方公告為準。</p></div>`);
}

// 老師投影給全班掃，或選一座島的 QR；圖檔由 scripts/make-qr.mjs 產生
function showQr(id = 'site') {
  const name = id === 'site' ? '石門品牌群島' : ISLANDS.find((d) => d.id === id).name;
  openModal(`${dialogHead('掃碼登島')}<div class="dialog-body qr-box">
    <img src="./qr/${id}.svg" alt="${esc(name)}的 QR Code" width="360" height="360">
    <p class="qr-name">${esc(name)}</p>
    <p class="qr-tip">打開 iPad 相機對準 QR Code，點跳出來的連結就能登島</p>
    <label class="qr-pick">要去哪裡？<select id="qrPick"><option value="site">全部群島</option>${ISLANDS.map((d) => `<option value="${d.id}"${d.id === id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>
    <div class="btn-row"><button class="cta koi" data-act="qrBig">全班投影</button><a class="cta lake" href="./qr/smes-island-poster.pdf" target="_blank" rel="noopener">列印海報</a><a class="cta moss" href="./qr/smes-island-cards.pdf" target="_blank" rel="noopener">列印 12 島卡</a></div></div>`);
}

function showMission() {
  const n = S.hippos.size;
  const next = n < 6 ? `再找 ${6 - n} 隻，就能領「尋寶探險家」證書` : n < 12 ? `再找 ${12 - n} 隻，就能領金色的「尋寶小達人」證書`
    : passed() ? '你已經是尋河馬達人了！' : S.stamps.size < 12 ? `全部找到了！再集滿 ${12 - S.stamps.size} 枚章，就能挑戰尋河馬達人` : '全部找到了，快去挑戰尋河馬達人！';
  store.set('smes-mission-seen', true);
  openModal(`${dialogHead('小河馬尋寶任務')}<div class="dialog-body">
    <p>12 座浮空島上，各躲著一隻小河馬。找到牠們領證書，一路闖到「尋河馬達人」，就能到校長室兌換小客人招待券！</p>
    <ol class="mission">
      <li><strong>逛島</strong><span>點一座島，或用「島嶼導覽」「跟著逛島」到處走走。</span></li>
      <li><strong>找小河馬</strong><span>放大畫面，找閃閃發光的地方，點一下小河馬就收集到了。</span></li>
      <li><strong>領紀念證書</strong><span>找到 6 隻領「尋寶探險家」，12 隻領「尋寶小達人」。到「閱讀護照」選班級、填姓名就能領，存起來留念。</span></li>
      <li><strong>闖到尋河馬達人</strong><span>只有第三段「尋河馬達人」的證書可以到校長室兌換獎勵，石門國小的同學加油！</span></li>
    </ol>
    <div class="stage3"><div><strong>第三段・尋河馬達人</strong><span>找齊 12 隻、集滿 12 枚閱讀護照章，再通過十二座島的閱讀挑戰（12 題答對 ${PASS} 題），就能領紫色證書，${REDEEM}到校長室兌換<b>小客人招待券</b>！</span></div><button class="cta koi" data-act="challenge">看挑戰</button></div>
    <p class="stage4">第四段「AI科技島」即將登場：高年級專題發表，中低年級一起來觀賞</p>
    <p class="mission-now">目前找到 <b>${n}</b> / 12 隻，${next}</p>
    ${hasProgress() ? handover('平板要交給下一位同學了嗎？按這裡清除紀錄，下一位才能自己尋寶。') : ''}
    <div class="btn-row"><button class="cta koi" data-act="modalClose">開始尋寶</button><button class="cta moss" data-act="passport">看閱讀護照</button></div></div>`);
}

function showPassport() {
  openModal(`${dialogHead('大河馬閱讀護照')}<div class="dialog-body">
    <p>走訪一座島就蓋一枚章。目前集到 <b>${S.stamps.size}</b> / 12 枚，找到 <b>${S.hippos.size}</b> / 12 隻小河馬。小河馬躲在各島的角落，放大畫面找找看閃閃發光的地方。</p>
    <div class="stamps">${ISLANDS.map((d) => `<button class="stamp ${S.stamps.has(d.id) ? 'on' : ''}" style="--c:${d.color}" data-goto="${d.id}">${esc(d.name)}</button>`).join('')}</div>
    <h3 class="hippo-title">小河馬證書</h3>
    <p>找到 6 隻、12 隻各可領一張紀念證書；集滿 12 枚章再通過閱讀挑戰，就能領「尋河馬達人」，${REDEEM}到校長室兌換小客人招待券！</p>
    ${certTiers(tierState())}
    ${hasProgress() ? handover('平板要交給下一位同學了嗎？按這裡清除紀錄，下一位才能自己尋寶。') : ''}
    <h3 class="hippo-title">小河馬圖鑑</h3>
    ${hippoGrid(S.hippos)}
    ${S.hippos.size === 12 ? '<div class="btn-row"><button class="cta koi" data-act="finaleAgain">再慶祝一次</button></div>' : ''}
    <p class="note" style="margin-top:10px">蓋章和小河馬紀錄只存在你這台裝置的瀏覽器裡，領證書時班級和姓名會傳給學校。</p>
    </div>`);
}

// 第一次領證書才填姓名，之後兩張證書都用同一個名字，避免共用平板上直接改名再領一張
function showCertForm(level) {
  openModal(`${dialogHead(`領取「${TIERS[level].title}」證書`)}<div class="dialog-body cert-form">
    <p>請選班級、填上姓名，它們會寫在證書上。</p>
    <div class="cert-row"><label>年級<select id="certGrade"><option value="">請選擇</option>${[...'一二三四五六'].map((g) => `<option>${g}</option>`).join('')}</select></label>
    <label>班級<select id="certRoom"><option value="">請選擇</option>${[...'一二三四五六七八九十'].map((g) => `<option>${g}</option>`).join('')}</select></label></div>
    <label>姓名<input id="certName" maxlength="12" autocomplete="off" placeholder="請寫真實姓名"></label>
    <p class="cert-err" id="certErr" role="alert" hidden></p>
    <div class="btn-row"><button class="cta koi" data-act="certCheck" data-level="${level}">下一步</button></div>
    <p class="note" style="margin-top:10px">班級和姓名會傳給學校，只用來發放獎勵與統計活動成果，活動結束後就會刪除。</p></div>`);
  $('#certGrade').focus();
}

// 學生常忘了按清除就還平板：超過一段下課時間沒人操作，下次碰畫面時先問是不是換人了
const HANDOVER_MS = 15 * 60 * 1000;

function showHandover() {
  closeFinale();
  actions.lbClose();
  openModal(`${dialogHead('這台平板有上一位的紀錄')}<div class="dialog-body">
    <p>這裡已經找到 <b>${S.hippos.size}</b> 隻小河馬、蓋了 <b>${S.stamps.size}</b> 枚章${certInfo.get() ? '，也領過證書了' : ''}。</p>
    <p>如果你是新來的同學，請按「我是新同學」重新開始，才能自己尋寶哦！</p>
    <div class="btn-row"><button class="cta koi" data-act="certResetGo">我是新同學，重新開始</button><button class="cta lake" data-act="modalClose">是我的，繼續尋寶</button></div></div>`);
  $('#dialog').dataset.lock = '1'; // 叫出提醒的那一下點擊落在背景上，不能順手把提醒關掉
}

function checkHandover() {
  const last = store.get('smes-last-active', 0);
  store.set('smes-last-active', Date.now());
  if (last && Date.now() - last > HANDOVER_MS && hasProgress()) showHandover();
}

let certUrl = '';

async function showCert(level) {
  if (level === 'M' && !passed()) { showChallenge(); return; }
  const info = certInfo.get();
  if (!info) { showCertForm(level); return; }
  const fresh = issue(level, '', '', level === 'M' ? challenge.get().score : 0);
  const moved = sendCerts();
  openModal(`${dialogHead(`「${TIERS[level].title}」證書`)}<div class="dialog-body">
    <div class="cert-view" id="certView"><p>證書製作中…</p></div>
    <p class="cert-tip">${level === 'M' ? `把證書存起來或印出來，<b>${REDEEM}</b>帶到校長室兌換小客人招待券！` : '這是紀念證書，存起來或印出來留念；成為「尋河馬達人」就能到校長室兌換小客人招待券！'}手機也可以長按圖片儲存</p>
    <div class="btn-row"><a class="cta koi" id="certSave" download="小河馬證書-${TIERS[level].title}.jpg" hidden>下載證書</a><button class="cta lake" data-act="certPrint">列印證書</button>
    <button class="cta moss go-on" data-act="certClose" data-level="${level}">${level === 'M' || (level === 12 && passed()) ? '關閉證書，繼續逛島' : level === 12 ? '前往第三段：尋河馬達人' : '關閉證書，繼續闖關'} ›</button></div>
    ${handover('平板要交給下一位同學時才按這裡，記得先把證書存好或印好。', true)}</div>`, true);
  try {
    const blob = await drawCert(level, fresh);
    if (certUrl) URL.revokeObjectURL(certUrl);
    certUrl = URL.createObjectURL(blob);
    $('#certView').innerHTML = `<img src="${certUrl}" alt="${esc(`${fresh.cls} ${fresh.name} 的${TIERS[level].title}證書`)}">`;
    $('#certSave').href = certUrl;
    $('#certSave').hidden = false;
  } catch {
    $('#certView').innerHTML = '<p>證書製作失敗，請檢查網路後再試一次。</p>';
  }
  // 以前在別台電腦領過同一張證書：改成第一次的日期和編號再畫一次，免得校長室看到兩張不同編號
  if (!(await moved).includes(String(level)) || !$('#certSave')?.download.includes(TIERS[level].title)) return;
  const first = certInfo.get();
  const [, m, d] = first.dates[level].split('-');
  try {
    const blob = await drawCert(level, first);
    if (certUrl) URL.revokeObjectURL(certUrl);
    certUrl = URL.createObjectURL(blob);
    $('#certView').innerHTML = `<img src="${certUrl}" alt="${esc(`${first.cls} ${first.name} 的${TIERS[level].title}證書`)}">`;
    $('#certSave').href = certUrl;
    $('#certSave').hidden = false;
  } catch { /* 留著剛才那張 */ }
  $('.cert-tip').innerHTML = `你在 <b>${+m} 月 ${+d} 日</b>就領過這張證書了，證書改用第一次領取的日期和編號，${level === 'M' ? '帶哪一張到校長室都一樣哦！' : '存哪一張留念都一樣哦！'}`;
}

// ───────── 第三段：島嶼閱讀挑戰 ─────────
function showChallenge() {
  const st = challenge.get();
  if (st?.state === 'pass') chPassed(st);
  else if (!ready()) chLocked();
  else if (st?.state === 'play') chLevel();
  else if (st?.state === 'fail') chFailed(st);
  else chIntro();
}

function chLocked() {
  const item = (ok, t, n) => `<li class="${ok ? 'ok' : ''}"><strong>${t}</strong><span>${n}</span></li>`;
  openModal(`${dialogHead('第三段：尋河馬達人')}<div class="dialog-body">
    <p>完成下面三件事，就能領「尋河馬達人」證書，${REDEEM}到校長室兌換小客人招待券！</p>
    <ol class="ch-need">${item(S.hippos.size === 12, '找齊 12 隻小河馬', `${S.hippos.size} / 12`)}${item(S.stamps.size === 12, '集滿 12 枚閱讀護照章', `${S.stamps.size} / 12`)}${item(false, '通過島嶼閱讀挑戰', `12 題答對 ${PASS} 題`)}</ol>
    <p class="note">點一座島、打開島嶼介紹，就會蓋一枚章；還沒蓋的島在「閱讀護照」裡看得到。</p>
    ${nextStamp() ? `<button class="cta koi go-stamp" data-act="goStamp">📍 帶我去還沒蓋章的島：${esc(byId[nextStamp()].name)} ›</button>` : ''}
    <div class="btn-row"><button class="cta moss" data-act="passport">看閱讀護照</button><button class="cta lake" data-act="modalClose">繼續尋寶</button></div></div>`);
}

// 照島嶼順序找下一座還沒蓋章的島
const nextStamp = () => order.find((id) => !S.stamps.has(id));

// 從第三段被帶去蓋章時，畫面上方一路提示下一座島；集滿就直接回到第三段
function paintStampChip() {
  const chip = $('#stampChip');
  const on = S.stampRun && S.hippos.size === 12 && !passed();
  chip.hidden = !on;
  if (!on) return;
  const id = nextStamp();
  chip.dataset.act = id ? 'goStamp' : 'stampDone';
  const done = S.justStamped ? `✅ ${S.justStamped}蓋好章了！` : '';
  S.justStamped = '';
  chip.textContent = id ? `${done}📍 下一座：${byId[id].name}（還差 ${order.length - S.stamps.size} 枚）›` : `${done}🦛 12 枚章集滿了！開始第三段挑戰 ›`;
}

// 領過證書就照證書上的年級出題，沒領過才請孩子自己選年級
function chIntro() {
  const info = certInfo.get();
  const grade = info?.cls?.[0];
  const pick = grade
    ? `<p class="ch-band">${esc(info.cls)}的題目來自<b>${BANDS[bandOf(grade)]}</b>題庫</p><div class="btn-row"><button class="cta koi" data-act="chStart" data-band="${bandOf(grade)}">開始挑戰</button></div>`
    : `<p class="ch-band">你是幾年級？小河馬會依年級出題</p><div class="ch-grades">${[...'一二三四五六'].map((g) => `<button class="cta lake" data-act="chStart" data-band="${bandOf(g)}">${g}年級</button>`).join('')}</div>`;
  openModal(`${dialogHead('島嶼閱讀挑戰')}<div class="dialog-body">
    <p>小河馬們在十二座島上等你！通過挑戰就能領「尋河馬達人」證書，${REDEEM}到校長室兌換小客人招待券。</p>${rules}${pick}</div>`);
}

// 鏡頭飛到這一關的島，對話框靠邊放，孩子看得到小河馬住在哪裡
function chLevel(shown = false) {
  const st = challenge.get();
  const k = shown ? st.picks.length - 1 : st.picks.length;
  if (S.touring) stopTour();
  if (S.walking) stopStroll();
  if (S.listing) setList(false);
  if (S.island) closeIsland();
  if (!shown) world?.focusIsland(st.levels[k].i, true);
  S.chShown = shown;
  if (!shown) setQuest(st.levels[k].i, 'stuck');
  openModal(`${dialogHead('📝 島嶼閱讀挑戰')}<div class="dialog-body ch">${levelHtml(st, k, shown)}</div>`, false, true);
  spotQuiz(!shown);
  // 手機上對錯說明常在畫面外，答完自動捲到說明和「下一關」
  if (shown) $('.ch-fb')?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}

// 第三段作答時，作答框發光，旁邊的泡泡指著它：鏡頭飛去島上時，孩子才知道題目在這裡
function spotQuiz(fresh) {
  const d = $('#dialog');
  d.classList.add('ch-spot');
  d.classList.toggle('ch-new', fresh);
  $('#chTip').hidden = !fresh;
  if (fresh) requestAnimationFrame(placeQuizTip);
}
function placeQuizTip() {
  const tip = $('#chTip');
  if (tip.hidden) return;
  const r = $('#dialog').getBoundingClientRect();
  const down = isMobile();
  tip.classList.toggle('down', down);
  tip.style.top = `${down ? r.top - 10 : r.top + 16}px`;
  tip.style.right = down ? '' : `${window.innerWidth - r.left + 16}px`;
}
window.addEventListener('resize', placeQuizTip);

// 島上的狀況跟著小河馬的話走：出題時卡住，答對才解開；挑戰結束就恢復原樣
let questTimer = 0;
function setQuest(id, mode) {
  clearTimeout(questTimer);
  for (const [k, p] of Object.entries(plates)) {
    const tag = $('.quest-tag', p);
    const on = k === id && !!mode;
    tag.hidden = !on;
    p.classList.toggle('quest', on);
    if (on) { tag.textContent = QUEST[id][mode === 'done' ? 1 : 0]; tag.classList.toggle('done', mode === 'done'); }
  }
  world?.setQuest(mode ? id : null, mode);
}
const clearQuest = () => setQuest(null, null);

// 開書作答：挑出和題目、答案字詞最相關的分頁，孩子不用每個分頁翻一遍；答案要自己讀出來
function bookTab(lv) {
  const pairs = (s) => {
    const t = s.replace(/[^一-鿿0-9A-Za-z]/g, '');
    return new Set(Array.from({ length: Math.max(0, t.length - 1) }, (_, i) => t.slice(i, i + 2)));
  };
  const want = pairs(`${lv.q}${lv.o[lv.a]}`);
  let best = 0, top = 0;
  content[lv.i].tabs.forEach((tab, i) => {
    const text = JSON.stringify(tab);
    let n = 0;
    for (const w of want) if (text.includes(w)) n += 1;
    if (n > top) { top = n; best = i; }
  });
  return best;
}

function openBook() {
  const st = challenge.get();
  if (st?.state !== 'play' && !S.chShown) return;
  const k = S.chShown ? st.picks.length - 1 : st.picks.length;
  const lv = st.levels[k];
  S.book = { k, shown: S.chShown };
  closeModal();
  openIsland(lv.i, { tab: bookTab(lv) });
  const chip = $('#bookChip');
  chip.innerHTML = S.chShown ? `📝 看完了，回到第 ${k + 1} 關` : `📝 找到答案了？回到第 ${k + 1} 關題目`;
  chip.classList.toggle('low', !$('#stormChip').hidden);
  chip.hidden = false;
}

function closeBook() {
  const b = S.book;
  $('#bookChip').hidden = true;
  S.book = null;
  if (S.island) closeIsland();
  const st = challenge.get();
  if (!b || !st || (st.state !== 'play' && !b.shown)) { showChallenge(); return; }
  world?.focusIsland(st.levels[b.k].i, true);
  chLevel(b.shown);
}

function chPick(n) {
  const st = challenge.get();
  if (st?.state !== 'play') return;
  const ok = answer(st, n);
  challenge.set(st);
  music.sfx(ok ? 'correct' : 'boing');
  const isle = st.levels[st.picks.length - 1].i;
  if (ok) { world?.hippoFx.hop(isle, 0.55); setQuest(isle, 'done'); }
  chLevel(true);
}

function chFailed(st) {
  clearQuest();
  world?.clearFocus();
  openModal(`${dialogHead('差一點點！')}<div class="dialog-body ch-end">
    <p>這次闖了 <b>${st.picks.length}</b> 關，答對 <b>${st.picks.length - st.wrong}</b> 題。小河馬們幫你換了新題目，再挑戰一次吧！</p>
    <div class="btn-row"><button class="cta koi" data-act="chStart" data-band="${st.band}">再挑戰一次</button><button class="cta lake" data-act="modalClose">先休息一下</button></div></div>`);
}

function chPassed(st) {
  clearQuest();
  openModal(`${dialogHead('尋河馬達人')}<div class="dialog-body ch-end">
    <p>你已經通過十二座島的閱讀挑戰，12 題答對 <b>${st.score}</b> 題！</p>
    <p>領取證書後，<b>${REDEEM}</b>帶到校長室兌換小客人招待券。</p>
    <div class="btn-row"><button class="cta koi" data-act="certOpen" data-level="M">領取證書</button><button class="cta moss" data-act="passport">看閱讀護照</button></div></div>`);
}

// ───────── 校園日誌 ─────────
// 發布者對應處室，分類、上色都用這個；對不到的放「其他」
const DEPTS = [
  { k: 'edu', n: '教務處', c: '#2f8fb0', by: ['教務', '教學', '設備', '註冊', '資訊', '圖書'] },
  { k: 'stu', n: '學務處', c: '#d9432f', by: ['學務', '訓育', '生教', '體衛', '衛生', '體育'] },
  { k: 'gui', n: '輔導室', c: '#4f9a54', by: ['輔導', '特教', '資料'] },
  { k: 'gen', n: '總務處', c: '#c8861f', by: ['總務', '文書', '事務', '出納'] },
  { k: 'etc', n: '其他', c: '#7a6f8f', by: [] },
];
const deptOf = (by = '') => DEPTS.find((d) => d.by.some((w) => by.includes(w))) || DEPTS[DEPTS.length - 1];
const TAG_COLOR = { 研習: '#7a3f8f', 公告: '#b5563c', 活動: '#e0812a', 資源: '#2f9c95' };
const LOG = { dept: 'all', q: '' };
const taipeiDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(d);
const dayGap = (date) => Math.round((Date.parse(`${taipeiDay()}T00:00:00+08:00`) - Date.parse(`${date}T00:00:00+08:00`)) / 864e5);
const WEEK = '日一二三四五六';
const dayLabel = (date) => {
  const [, m, d] = date.split('-');
  return `${+m} 月 ${+d} 日（${WEEK[new Date(`${date}T12:00:00+08:00`).getDay()]}）`;
};

function logItems() {
  const q = LOG.q.trim();
  return S.news.filter((n) => (LOG.dept === 'all' || deptOf(n.by).k === LOG.dept) && (!q || `${n.title}${n.by}${n.tag}`.includes(q)));
}

// 依日期分成今天、昨天、這幾天與更早；每則公告標出處室、發布者與類別
function renderLog() {
  const list = logItems();
  const groups = [];
  for (const n of list) {
    const gap = dayGap(n.date);
    const name = gap <= 0 ? '今天' : gap === 1 ? '昨天' : gap < 7 ? '這幾天' : '更早的公告';
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, items: [] }));
    g.items.push(n);
  }
  const card = (n) => {
    const d = deptOf(n.by);
    const fresh = dayGap(n.date) <= 0;
    return `<a class="log-card" style="--c:${d.c}" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">
      <span class="log-meta"><b class="log-dept">${d.n}</b>${n.by ? `<span>${esc(n.by)}</span>` : ''}${n.tag ? `<i style="--t:${TAG_COLOR[n.tag] || '#6c6f7a'}">${esc(n.tag)}</i>` : ''}${fresh ? '<em>NEW</em>' : ''}</span>
      <strong>${esc(n.title)}</strong>
      <span class="log-foot">${dayLabel(n.date)}<span>看公告 ›</span></span></a>`;
  };
  $('#logBody').innerHTML = list.length
    ? groups.map((g) => `<section class="log-group"><h3>${g.name}<small>${g.items.length} 則</small></h3><div class="log-grid">${g.items.map(card).join('')}</div></section>`).join('')
    : `<p class="log-empty">${S.news.length ? '找不到符合的公告，換個關鍵字或處室試試看。' : '公告暫時無法載入，請到學校官網查看。'}</p>`;
  $$('#logDepts button').forEach((b) => b.classList.toggle('on', b.dataset.dept === LOG.dept));
}

function showLog() {
  const items = S.news;
  const today = items.filter((n) => dayGap(n.date) <= 0).length;
  const week = items.filter((n) => dayGap(n.date) < 7).length;
  const count = (k) => items.filter((n) => deptOf(n.by).k === k).length;
  const updated = S.newsAt ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(S.newsAt)) : '';
  const chips = [{ k: 'all', n: '全部', c: '#3b2c1d', num: items.length }, ...DEPTS.map((d) => ({ ...d, num: count(d.k) })).filter((d) => d.num)];
  openModal(`${dialogHead('校園日誌')}<div class="dialog-body log">
    <div class="log-top">
      <div class="log-stats"><span><b>${today}</b>今天新公告</span><span><b>${week}</b>這一週</span><span><b>${items.length}</b>全部</span></div>
      <p class="note">同步自石門國小官網公告${updated ? `・更新於 ${updated}` : ''}</p>
    </div>
    <div class="log-tools">
      <div class="log-depts" id="logDepts" role="group" aria-label="依處室篩選">${chips.map((d) => `<button data-act="logDept" data-dept="${d.k}" style="--c:${d.c}">${d.n}<small>${d.num}</small></button>`).join('')}</div>
      <input id="logSearch" type="search" placeholder="搜尋公告，例如：研習、營隊、獎學金" aria-label="搜尋公告" value="${esc(LOG.q)}">
    </div>
    <div id="logBody"></div>
    <div class="btn-row"><a class="cta lake" href="${SCHOOL.site}" target="_blank" rel="noopener noreferrer">前往學校官網 ›</a></div></div>`, true);
  renderLog();
}

function showHonors() {
  openModal(`${dialogHead('榮譽榜')}<div class="dialog-body">${HONORS.map((h) => `<button class="news-item" style="width:100%;text-align:left" data-goto="${h.island}"><span class="tag" style="background:${byId[h.island].color}">${esc(h.k)}</span><strong>${esc(h.title)}</strong><small>${esc(h.sub)}</small></button>`).join('')}
    <p class="note" style="margin-top:10px">內容取自「鱻鯉鰭源，石門活閱」品牌學校方案。</p></div>`, true);
}

// 連線橫跨各島，要退回看得到全部島嶼的鏡頭才看得完整；已經在鳥瞰就不用換
function showWholeGroup() {
  const view = world?.viewName === 'top' ? 'top' : 'home';
  if (S.touring) stopTour();
  if (S.walking) stopStroll();
  if (S.listing) setList(false);
  if (S.island) closeIsland();
  world?.clearFocus();
  world?.setView(view);
  syncView(view);
}

function showLinksInfo() {
  openModal(`${dialogHead('跨域串聯')}<div class="dialog-body"><p>金色虛線把彼此合作、能互相延伸的島嶼連起來。</p>
    ${LINKS.map((l) => `<div class="news-item"><small>${esc(byId[l.a].name)} ↔ ${esc(byId[l.b].name)}</small><strong>${esc(l.text)}</strong></div>`).join('')}
    <div class="btn-row"><button class="btn main" data-act="modalClose">回到群島看連線</button></div></div>`);
}

// ───────── 即時資料 ─────────
let quoteIdx = Math.floor(Date.now() / 86400000) % QUOTES.length;
function paintQuote() {
  const q = QUOTES[quoteIdx];
  // 寬螢幕放在頂部，平板和手機頂部放不下，改放在雲端瞭望台裡
  $('#quote').innerHTML = $('#quoteTile').innerHTML = `${esc(q.text)}<cite>${esc(q.by)}</cite>`;
}

function paintClock() {
  const f = fmtDate();
  $('#dDate').textContent = f.date;
  $('#dWeek').textContent = `${f.week}・${f.time}`;
}

// 天氣魔法：七種天氣與時間，每一種的畫面、人物和配樂都不同，說明寫給孩子看
const TIMES = [
  { k: 'live', n: '即時', i: '📡', d: '跟著石門現在的天氣和時間自動變化' },
  { k: 'day', n: '白天', i: '☀️', d: '陽光灑在十二座浮空島上' },
  { k: 'cloudy', n: '陰天', i: '☁️', d: '雲層變厚，配樂換成陰天的曲子' },
  { k: 'rain', n: '雨天', i: '🌧️', d: '孩子撐傘踩水窪，魚兒開心跳出水面' },
  { k: 'typhoon', n: '颱風', i: '🌀', d: '雲海下的颱風在旋轉，大家都躲進屋裡' },
  { k: 'dusk', n: '黃昏', i: '🌇', d: '天空換上黃昏的顏色和配樂' },
  { k: 'night', n: '夜晚', i: '🌙', d: '拿著手電筒看星星，圍著營火聽故事' },
];
const timeOf = (k) => TIMES.find((t) => t.k === k) || TIMES[0];

function paintTime() {
  const t = timeOf(S.time);
  $('#timeBtn').textContent = `天氣・${t.n}`;
  $('#wxMagic span').textContent = S.time === 'live' ? '變天氣' : `${t.n}預覽`;
  $('#wxMagic').classList.toggle('preview', S.time !== 'live');
  $('#wxGrid').innerHTML = TIMES.map((x) => `<button class="wx-opt${x.k === S.time ? ' on' : ''}" data-act="wxSet" data-time="${x.k}" aria-pressed="${x.k === S.time}">`
    + `<i aria-hidden="true">${x.i}</i><strong>${x.n}</strong><span>${x.k === 'live' && S.weather ? `現在${esc(S.weather.label)} ${S.weather.temp}°C，` : ''}${x.d}</span></button>`).join('');
}

function setTime(k) {
  S.time = k;
  world?.setTimeMode(['rain', 'cloudy', 'typhoon'].includes(k) ? 'day' : k);
  if (k === 'typhoon') world?.setWeather({ storm: true });
  else if (k === 'rain') world?.setWeather({ cloud: 0.85, rain: 0.8, storm: false });
  else if (k === 'cloudy') world?.setWeather({ cloud: 0.9, rain: 0, storm: false });
  else if (k !== 'live') world?.setWeather({ cloud: 0.1, rain: 0, storm: false });
  else if (S.weather) world?.setWeather({ cloud: S.weather.cloud, rain: S.weather.rain, storm: !!liveStorm()?.scene });
  paintStorm();
  paintTime();
  if (k === 'typhoon') toast('颱風來了！雲海下的颱風正在旋轉，大家都躲進屋裡了');
  else if (k === 'rain') toast('下雨了！孩子們撐傘踩水窪，魚兒開心得跳出水面');
  else if (k === 'night') toast('夜深了，留下來的孩子拿著手電筒看星星、圍著營火聽故事');
  else if (k === 'live') toast('回到即時天氣，群島跟著石門現在的天氣變化');
  else toast(`換成${timeOf(k).n}囉！${timeOf(k).d}`);
}

// 面板貼在天氣卡片下方；手機改從工具列上方升起
function wxOpen(open) {
  const pop = $('#wxPop');
  pop.hidden = !open;
  $('#wxMagic').setAttribute('aria-expanded', open);
  if (!open) return;
  paintTime();
  store.set('smes-wx-seen', true);
  $('#wxMagic').classList.remove('hint');
  if (isMobile()) { pop.style.top = ''; pop.style.right = ''; return; }
  const r = $('#liveinfo').getBoundingClientRect();
  pop.style.top = `${Math.round(r.bottom + 8)}px`;
  pop.style.right = `${Math.max(10, Math.round(window.innerWidth - r.right))}px`;
}

function paintWeather() {
  const w = S.weather;
  if (!w) return;
  const air = S.air ? `・空品${S.air.level}` : '';
  $('#wx').innerHTML = `<i>${w.icon}</i><div><strong>${esc(w.label)} ${w.temp}°C</strong><span>${w.min}°～${w.max}°・降雨 ${w.pop}%${air}</span></div>`;
  if (!$('#wxPop').hidden) paintTime();
  $('#liveinfo').title = `體感 ${w.feels}°C・濕度 ${w.humidity}%・風速 ${Math.round(w.wind)} km/h${S.air ? `・AQI ${S.air.aqi}（美國標準）・PM2.5 ${S.air.pm25}` : ''}｜龍潭區石門`;
}

function paintReservoir() {
  const r = S.res;
  $$('[data-res-level]').forEach((n) => { n.innerHTML = r ? `${r.level.toFixed(2)}<small> 公尺</small>` : (S.resFail ? '暫時無法取得' : '讀取中…'); });
  $$('[data-res-fill]').forEach((n) => { if (r) n.style.height = `${(r.ratio * 100).toFixed(0)}%`; });
  if (!r) return;
  const t = r.time.slice(5, 16).replace('T', ' ').replace('-', '/');
  $$('[data-res-note]').forEach((n) => { n.textContent = `滿水位 245 公尺｜${t} 觀測`; });
  $$('[data-res-more]').forEach((n) => {
    n.innerHTML = `<div><dt>有效蓄水量</dt><dd>${Math.round(r.storage).toLocaleString()} 萬立方公尺</dd></div><div><dt>進流量</dt><dd>${r.inflow} 立方公尺/秒</dd></div><div><dt>出流量</dt><dd>${r.outflow} 立方公尺/秒</dd></div>`;
  });
  world?.setReservoir(r.ratio);
}

function cycle(el, items, render, ms) {
  let i = 0;
  const go = () => {
    if (!items().length) return;
    el.innerHTML = render(items()[i % items().length]);
    i += 1;
  };
  go();
  return setInterval(go, ms);
}

async function loadLive() {
  const safe = async (fn, ok, fail) => { try { ok(await fn()); } catch (e) { console.warn('即時資料失敗', e.message); fail?.(); } };
  await Promise.all([
    safe(fetchWeather, (w) => {
      S.weather = w;
      paintWeather();
      world?.setSun({ sunrise: w.sunrise, sunset: w.sunset });
      if (S.time === 'live') world?.setWeather({ cloud: w.cloud, rain: w.rain, wind: w.wind, thunder: w.thunder, storm: !!liveStorm()?.scene });
      paintStorm();
    }, () => { if (!S.weather) $('#wx').innerHTML = '<i>⛅</i><div><strong>天氣暫時無法取得</strong><span>龍潭石門</span></div>'; }),
    safe(fetchAir, (a) => { S.air = a; paintWeather(); }),
    safe(fetchAlert, (a) => { S.alert = a; paintStorm(); }),
    safe(fetchReservoir, (r) => { S.res = r; paintReservoir(); }, () => { S.resFail = true; paintReservoir(); }),
    safe(fetchNews, (d) => { S.news = d.items || []; S.newsAt = d.updated; if (!S.news.length) $('#newsTicker').innerHTML = '<span class="tick"><span>公告暫時無法載入</span></span>'; }),
  ]);
}

function startTickers() {
  cycle($('#newsTicker'), () => S.news, (n) => `<a class="tick" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit">${n.tag ? `<b style="background:var(--moss)">${esc(n.tag)}</b>` : ''}<strong>${esc(n.title)}</strong><span>${esc(n.date)}</span></a>`, 6500);
  cycle($('#honorTicker'), () => HONORS, (h) => `<span class="tick"><b>${esc(h.k)}</b><strong>${esc(h.title)}</strong><span>${esc(h.sub)}</span></span>`, 5200);
}

// ───────── 事件 ─────────
const actions = {
  home() { if (S.island) closeIsland(); else if (S.listing) setList(false); world?.clearFocus(); world?.setView('home'); syncView('home'); },
  quote() { quoteIdx = (quoteIdx + 1) % QUOTES.length; paintQuote(); },
  close() { closeIsland(); },
  prev() { step(-1); },
  next() { step(1); },
  tall() { sheet.toggle(); },
  dockPrev() { slideDock(-1); },
  dockNext() { slideDock(1); },
  quiz() { showQuiz(); },
  passport() { showPassport(); },
  mission() { showMission(); },
  // 左下角提示卡：12 隻找齊了就直接進第三段，還沒找齊才看任務說明
  hint() { if (S.hippos.size === 12 && !passed()) showChallenge(); else showMission(); },
  goStamp() {
    const id = nextStamp();
    S.stampRun = true;
    closeModal();
    if (id) openIsland(id);
    else paintStampChip();
  },
  stampDone() {
    S.stampRun = false;
    paintStampChip();
    if (S.island) closeIsland();
    showChallenge();
  },
  qr() { showQr(); },
  qrBig() { $('#dialog').classList.toggle('qr-big'); },
  log() { showLog(); },
  honors() { showHonors(); },
  // 跟著逛島、導覽時瞭望台原本會藏起來，孩子主動按了就讓它出現；被島嶼介紹、清單擋住時說明原因
  watch() {
    const w = $('#watch');
    const on = !watchSeen();
    document.body.classList.toggle('watch-force', on && (S.walking || S.touring));
    if (isMobile()) {
      w.classList.toggle('opened', on);
      if (!S.island) $('#hint').hidden = on;
      paintWatch();
    } else setWatch(on, true);
    const why = !on ? '' : S.listing ? '清單' : S.island ? '島嶼介紹' : $('#modal').classList.contains('peek') ? '閱讀挑戰' : '';
    if (why) toast(`${why}開著時，瞭望台會先讓位，關掉${why}就看得到`);
    else toast(on ? '瞭望台打開了：水庫水位、校園公告、今日書語都在這裡' : '瞭望台收起來了，再按一次「瞭望台」就能打開');
  },
  res() { openIsland('walk', { tab: 2 }); },
  tour() { if (S.touring) stopTour(true); else startTour(); },
  tourPause(el) { S.tourPaused = !S.tourPaused; el.textContent = S.tourPaused ? '繼續' : '暫停'; },
  tourPrev() { S.tourIdx = (S.tourIdx + TOUR_STOPS - 1) % TOUR_STOPS; showTourStop(); },
  tourNext() { S.tourIdx = (S.tourIdx + 1) % TOUR_STOPS; showTourStop(); },
  tourMore() {
    const d = ISLANDS[S.tourIdx - 1];
    stopTour(!d);
    if (d) openIsland(d.id); else showMission();
  },
  tourEnd() { stopTour(true); },
  stroll() {
    if (S.walking) stopStroll(true);
    else if (world.env.storm) toast('風雨太大，大家都進屋了，等天氣好再來逛島吧');
    else startStroll(world.people.guide());
  },
  storm() { showStorm(); },
  strollNext() { startStroll(world.people.guide()); },
  strollIsland() { openIsland(world.people.followed.here); },
  strollEnd() { stopStroll(true); },
  sayFollow() { if (sayWho) startStroll(sayWho.crew); },
  doorTalk(t) { const g = doorTags.get(t.dataset.key)?.g; if (g) showDoor(g); },
  doorMore() {
    if (!sayDoor || !sayEl) return;
    music.sfx('pop');
    sayEl.innerHTML = doorHtml(sayDoor);
    clearTimeout(sayTimer);
    sayTimer = setTimeout(hideSay, 9000);
  },
  sayMore() {
    if (!sayWho || !sayEl) return;
    music.sfx('pop');
    world.people.greet(sayWho, world.camera);
    sayEl.innerHTML = sayHtml(sayWho);
    clearTimeout(sayTimer);
    sayTimer = setTimeout(hideSay, 9000);
  },
  music() { music.toggle(); },
  sfx() { music.toggleSfx(); },
  labels(el) { S.labels = !S.labels; el.classList.toggle('on', S.labels); $('#labels').classList.toggle('hidden', !S.labels); },
  arcs(el) {
    S.arcs = !S.arcs;
    el.classList.toggle('on', S.arcs);
    if (S.arcs) showWholeGroup();
    world?.showArcs(S.arcs);
    if (S.arcs) showLinksInfo();
  },
  pause(el) { S.paused = !S.paused; el.textContent = S.paused ? '播放' : '暫停'; world?.setPaused(S.paused); },
  time() { wxOpen($('#wxPop').hidden); },
  wxMenu() { wxOpen($('#wxPop').hidden); },
  wxSet(t) { setTime(t.dataset.time); wxOpen(false); },
  // 移軸特效對孩子太抽象，按下時說明畫面變了什麼
  tilt(el) {
    const v = !world.tilt;
    world.setTilt(v);
    el.classList.toggle('on', v);
    el.setAttribute('aria-pressed', v);
    toast(v ? '開啟模型感：畫面上下變模糊，群島看起來像桌上的小模型' : '關閉模型感：整個畫面都清楚，電腦跑起來也比較順');
  },
  modalClose() { closeModal(); if (!S.book) clearQuest(); },
  finaleClose() { closeFinale(); },
  finalePassport() { closeFinale(); showPassport(); },
  finaleAgain() { closeModal(); celebrate(); },
  finaleCert(t) { closeFinale(); showCert(lvl(t.dataset.level)); },
  certOpen(t) { showCert(lvl(t.dataset.level)); },
  challenge() { closeFinale(); showChallenge(); },
  async chStart(t) {
    S.stampRun = false;
    paintStampChip();
    const prev = challenge.get();
    t.disabled = true;
    t.textContent = '小河馬準備題目中…';
    const sheetItems = await loadBank();
    challenge.set(newRun(t.dataset.band, sheetItems, prev?.levels?.map((l) => l.q) || []));
    chLevel();
  },
  logDept(t) { LOG.dept = t.dataset.dept; renderLog(); },
  chBook() { openBook(); },
  chBack() { closeBook(); },
  chNext() { chLevel(); },
  chEnd() {
    clearQuest();
    const st = challenge.get();
    if (st.state !== 'pass') { chFailed(st); return; }
    closeModal();
    setHint();
    world?.clearFocus();
    celebrate('M', st.score);
  },
  certCheck(t) {
    const grade = $('#certGrade').value;
    const room = $('#certRoom').value;
    const name = $('#certName').value.trim();
    const err = !grade || !room || !name ? '年級、班級和姓名都要填哦' : validName(name) ? '' : '姓名只能填文字，不能有空格、數字或符號哦';
    if (err) { $('#certErr').textContent = err; $('#certErr').hidden = false; return; }
    const cls = `${grade}年${room}班`;
    const { level } = t.dataset;
    openModal(`${dialogHead('確認證書上的名字')}<div class="dialog-body cert-form">
      <p class="cert-who">${esc(cls)}　${esc(name)}</p>
      <p>確定後就不能修改了，請再看一次有沒有寫對。</p>
      <div class="btn-row"><button class="cta koi" data-act="certIssue" data-level="${level}" data-cls="${esc(cls)}" data-name="${esc(name)}">確定，領取證書</button><button class="cta lake" data-act="certOpen" data-level="${level}">回去修改</button></div></div>`);
  },
  certIssue(t) {
    const level = lvl(t.dataset.level);
    issue(level, t.dataset.cls, t.dataset.name, level === 'M' ? challenge.get()?.score : 0);
    paintNext();
    showCert(level);
  },
  certPrint() { if (certUrl) printCert(certUrl); },
  // 領完證書回到群島，告訴孩子下一步可以做什麼，免得以為結束了就按「換下一位」
  certClose(t) {
    const level = lvl(t.dataset.level);
    closeModal();
    setHint();
    // 領完小達人證書，直接帶到第三段：章還沒集滿就看還差什麼，集滿了就能開始挑戰
    if (level === 12 && !passed()) { showChallenge(); return; }
    toast(level === 6 ? '繼續找小河馬，找齊 12 隻還有金色證書！'
      : level === 'M' ? `${REDEEM}，記得帶證書到校長室兌換小客人招待券！`
        : S.stamps.size < 12 ? `再集滿 12 枚章，就能挑戰尋河馬達人（${S.stamps.size} / 12）`
          : passed() ? '你已經是尋河馬達人了，繼續逛島吧！' : '12 枚章都集滿了，打開閱讀護照挑戰尋河馬達人！');
  },
  certReset() {
    openModal(`${dialogHead('換下一位同學')}<div class="dialog-body">
      <p>這台裝置的小河馬、蓋章和證書紀錄都會清除，下一位同學要重新尋找。已經存下來或印出來的證書不受影響。</p>
      <div class="btn-row"><button class="cta koi" data-act="certResetGo">確定清除</button><button class="cta lake" data-act="modalClose">先不要</button></div></div>`);
  },
  async certResetGo() {
    await Promise.race([sendCerts(), new Promise((ok) => { setTimeout(ok, 3000); })]);
    store.set('smes-hippos', []);
    store.set('smes-stamps', []);
    store.set('smes-mission-seen', false);
    store.set('smes-last-active', 0);
    certInfo.clear();
    challenge.clear();
    location.reload();
  },
  lbClose() { lbZoom(false); $('#lb').classList.remove('open'); },
  lbPrev() { showLb(lbIndex - 1); },
  lbNext() { showLb(lbIndex + 1); },
};

function showLb(i) {
  const g = currentGallery();
  if (!g.length) return;
  lbIndex = (i + g.length) % g.length;
  const it = g[lbIndex];
  const img = $('#lbImg');
  const src = it.src || full(it.id);
  lbZoom(false);
  if (!img.src.endsWith(src.slice(1))) {
    img.classList.add('wait');
    img.src = src;
  }
  // 原圖太小就用原圖大小顯示，也不提供放大，拉大只會更糊
  const native = nativeWidth(it.id);
  img.style.setProperty('--lb-max', native ? `${native}px` : '100%');
  $('#lb').classList.toggle('native', !!native);
  img.alt = it.cap;
  $('#lbCap').textContent = it.cap;
  $('#lbLink').hidden = !it.link;
  if (it.link) $('#lbLink').href = it.link;
  $('#lb').classList.add('open');
}

// 文件類圖片要能看清楚字：點一下放大到點的位置，手機用手指滑、電腦用滑鼠拖曳
function lbZoom(on, e) {
  const img = $('#lbImg');
  const view = $('#lbView');
  if (!on) {
    $('#lb').classList.remove('zoom');
    img.style.width = '';
    return;
  }
  const r = img.getBoundingClientRect();
  const w = Math.max(r.width * 2.5, Math.min(img.naturalWidth, innerWidth * 2));
  $('#lb').classList.add('zoom');
  img.style.width = `${w}px`;
  view.scrollLeft = w * (e.clientX - r.left) / r.width - view.clientWidth / 2;
  view.scrollTop = img.offsetHeight * (e.clientY - r.top) / r.height - view.clientHeight / 2;
}

let lbDrag = null;
$('#lbImg').addEventListener('load', (e) => e.target.classList.remove('wait'));
$('#lbImg').addEventListener('click', (e) => {
  if (lbDrag?.moved || $('#lb').classList.contains('native')) return;
  lbZoom(!$('#lb').classList.contains('zoom'), e);
});
$('#lbView').addEventListener('pointerdown', (e) => {
  lbDrag = null;
  if (e.pointerType !== 'mouse' || !$('#lb').classList.contains('zoom')) return;
  const v = e.currentTarget;
  lbDrag = { x: e.clientX, y: e.clientY, l: v.scrollLeft, t: v.scrollTop, on: true, moved: false };
  e.preventDefault();
});
window.addEventListener('pointermove', (e) => {
  if (!lbDrag?.on) return;
  const dx = e.clientX - lbDrag.x;
  const dy = e.clientY - lbDrag.y;
  if (Math.hypot(dx, dy) > 4) lbDrag.moved = true;
  $('#lbView').scrollLeft = lbDrag.l - dx;
  $('#lbView').scrollTop = lbDrag.t - dy;
});
window.addEventListener('pointerup', () => { if (lbDrag) lbDrag.on = false; });

document.addEventListener('click', (e) => {
  if (!$('#wxPop').hidden && !e.target.closest('#wxPop,#wxMagic,#timeBtn')) wxOpen(false);
  const t = e.target.closest('button,a');
  if (!t) { if (e.target.id === 'modal' && !$('#dialog').dataset.lock) closeModal(); if (e.target.id === 'lb') actions.lbClose(); return; }
  const d = t.dataset;
  if (d.tab === undefined && d.quiz === undefined && d.ch === undefined) music.sfx('tap');
  if (d.act !== undefined && d.act !== '' && actions[d.act]) { actions[d.act](t); return; }
  if (d.tab !== undefined) { setTab(+d.tab); return; }
  if (d.view) {
    if (d.view === 'list') { setList(!S.listing || true); return; }
    if (S.listing) setList(false);
    if (S.island) closeIsland();
    world?.clearFocus();
    world?.setView(d.view);
    syncView(d.view);
    return;
  }
  if (d.goto) { closeModal(); openIsland(d.goto); return; }
  if (d.open) { openIsland(d.open, { tab: +(d.openTab || 0) }); return; }
  if (d.lb !== undefined) { showLb(+d.lb); return; }
  if (d.toggle !== undefined) {
    const a = t.closest('.act');
    a.classList.toggle('open');
    t.setAttribute('aria-expanded', a.classList.contains('open'));
    return;
  }
  if (d.grade !== undefined) {
    $$('[data-grade]').forEach((b) => b.classList.toggle('on', b === t));
    $('.ilr-list').innerHTML = ilrRows(S.island, S.tab, +d.grade);
    return;
  }
  if (d.ch !== undefined) { chPick(+d.ch); return; }
  if (d.quiz !== undefined) {
    music.sfx(+d.quiz + 1 >= QUIZ.length ? 'chime' : 'correct');
    const tally = JSON.parse($('#dialog').dataset.tally || '{}');
    tally[d.k] = (tally[d.k] || 0) + 1;
    showQuiz(+d.quiz + 1, tally);
  }
});

$('#search').addEventListener('input', (e) => renderList(e.target.value));
document.addEventListener('input', (e) => { if (e.target.id === 'logSearch') { LOG.q = e.target.value; renderLog(); } });
document.addEventListener('change', (e) => { if (e.target.id === 'qrPick') showQr(e.target.value); });

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea')) return;
  if (e.key === 'Escape') {
    if (!$('#wxPop').hidden) wxOpen(false);
    else if ($('#lb').classList.contains('open')) actions.lbClose();
    else if ($('#modal').classList.contains('open')) closeModal();
    else if (S.touring) stopTour(true);
    else if (S.walking) stopStroll(true);
    else if (S.island) closeIsland();
  }
  if ($('#lb').classList.contains('open')) {
    if (e.key === 'ArrowLeft') actions.lbPrev();
    if (e.key === 'ArrowRight') actions.lbNext();
    return;
  }
  if (e.key === ' ' && S.touring) { e.preventDefault(); actions.tourPause($('#tPause')); }
});

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'list') { if (!S.listing) setList(true, false); return; }
  if (S.listing) setList(false, false);
  if (byId[h]) { if (S.island !== h) openIsland(h, { push: false }); } else if (S.island) closeIsland(false);
}
window.addEventListener('popstate', route);

// ───────── 啟動 ─────────
function finishLoading() {
  $('#loader').classList.add('done');
  setTimeout(() => $('#loader').remove(), 900);
}

function paintMusic(on) {
  const b = $('#musicBtn');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  store.set('smes-music', on);
}

async function showVisits() {
  try {
    const v = await countVisit();
    if (!v) return;
    $('#visitLine').hidden = false;
    rollNumber($('#visitTotal'), v.total, calm);
    rollNumber($('#visitToday'), v.today, calm);
    if (v.fresh) toast(`歡迎登島！您是今天第 ${v.today.toLocaleString()} 位旅人`);
  } catch (e) { console.warn('登島人次讀取失敗', e.message); }
}

function paintSfx(on) {
  const b = $('#sfxBtn');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', on);
  store.set('smes-sfx', on);
}

function celebrate(level = 12, score = 0) {
  if (level === 'M') {
    // 第三段是最後一關：整個群島一起開派對，歡呼與號角輪流響
    world.party(9);
    cheerUntil = performance.now() + 7000;
    [0, 900, 1800].forEach((ms) => setTimeout(() => music.sfx(ms === 900 ? 'horn' : 'cheer'), ms));
    setTimeout(() => music.sfx('found'), 1500);
  } else world.hippoFx.celebrate();
  music.sfx('cheer');
  music.sfx('chime');
  if (!S.island) { world.setView('home'); syncView('home'); }
  setTimeout(() => showFinale(level, score), calm ? 0 : 1500);
}

function foundHippo(id, mesh) {
  const h = HIPPOS[id];
  if (S.hippos.has(id)) {
    world.hippoFx.hop(id, 0.55);
    music.sfx('boing');
    toast(`${h.name}：「${h.line}」`);
    return;
  }
  S.hippos.add(id);
  store.set('smes-hippos', [...S.hippos]);
  world.hippoFx.found(id, world.camera);
  music.sfx('found');
  music.sfx('horn');
  flyCount(world.screenOf(mesh));
  setTimeout(setHint, calm ? 0 : 1000);
  showFound(id, S.hippos.size);
  if (S.hippos.size === 12) setTimeout(celebrate, 2600);
  // 其他小河馬還躲著，這裡不跳全體慶祝動作，以免洩漏位置
  if (S.hippos.size === 6) setTimeout(() => { music.sfx('cheer'); showFinale(6); }, 2600);
}

// 手機工具列比螢幕寬：箭頭提示還有更多按鈕，滑動手勢失靈時也點得到
function slideDock(dir) {
  const dock = $('.dock');
  dock.scrollBy({ left: dir * dock.clientWidth * 0.7, behavior: calm ? 'auto' : 'smooth' });
}

function initDock() {
  const dock = $('.dock');
  const paint = () => {
    $('#dockPrev').hidden = dock.scrollLeft < 4;
    $('#dockNext').hidden = dock.scrollLeft > dock.scrollWidth - dock.clientWidth - 4;
  };
  const over = () => dock.scrollWidth > dock.clientWidth + 4;
  dock.addEventListener('scroll', paint, { passive: true });
  window.addEventListener('resize', paint);
  // 按鈕顯示／隱藏（換下一位、瞭望台）會改變總寬度，跟著重算箭頭與拖曳游標
  const ro = new ResizeObserver(() => { paint(); dock.classList.toggle('can-drag', over()); });
  ro.observe(dock);
  [...dock.children].forEach((el) => ro.observe(el));
  // 滑鼠滾輪上下捲，轉成工具列左右捲
  dock.addEventListener('wheel', (e) => {
    if (!over() || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    dock.scrollLeft += e.deltaY;
  }, { passive: false });
  // 滑鼠按住拖曳左右移；拖過頭才算拖曳，並擋掉放開時誤觸的按鈕
  let drag = null;
  dock.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !over()) return;
    drag = { x: e.clientX, left: dock.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    drag.moved = true;
    dock.classList.add('dragging');
    dock.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.moved) {
      const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
      dock.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => dock.removeEventListener('click', stop, true), 0);
    }
    dock.classList.remove('dragging');
    drag = null;
  });
  paint();
}

// 手機的音樂按鈕在工具列最右邊，第一次出聲時告訴訪客怎麼關
function musicTip() {
  if (!matchMedia('(pointer: coarse)').matches || store.get('smes-music-tip', false)) return;
  store.set('smes-music-tip', true);
  toast('背景音樂開始了，下方工具列可以關閉音樂和音效');
}

async function boot() {
  initUpdate();
  sheet.init($('#panel'), isMobile, onSheet);
  initDock();
  paintQuote(); paintClock(); setHint(); paintTime();
  if (!store.get('smes-wx-seen', false)) $('#wxMagic').classList.add('hint'); // 還沒用過天氣魔法的訪客，按鈕會輕輕發亮提示
  setWatch(store.get('smes-watch', true), true);
  music.init({ want: store.get('smes-music', true), sfx: store.get('smes-sfx', true), onChange: paintMusic, onStart: musicTip, onSfx: paintSfx });
  paintMusic(music.want);
  paintSfx(music.sfxOn);
  setInterval(paintClock, 15000);
  setInterval(loadLive, 15 * 60 * 1000);
  startTickers();
  const bar = $('#loaderBar'), text = $('#loaderText');
  const fallback = () => {
    setList(true, false);
    $('#world').style.display = 'none';
    document.querySelector('.dock').hidden = false;
    finishLoading();
    toast('這台裝置無法顯示 3D 畫面，已改用文字清單');
  };
  $('#loaderSkip').addEventListener('click', fallback);
  setTimeout(() => { if ($('#loader')) $('#loaderSkip').hidden = false; }, 9000);
  try {
    world = new World($('#world'), {
      onPick: (id) => openIsland(id),
      onPerson: showSay,
      onHover: (id) => Object.entries(plates).forEach(([k, p]) => p.classList.toggle('hot', k === id)),
      onFrame,
      onHippo: foundHippo,
      onArrow: (key) => {
        if (S.island && (key === 'ArrowLeft' || key === 'ArrowRight')) { step(key === 'ArrowLeft' ? -1 : 1); return true; }
        if (S.touring && (key === 'ArrowLeft' || key === 'ArrowRight')) { actions[key === 'ArrowLeft' ? 'tourPrev' : 'tourNext'](); return true; }
        return false;
      },
      onEnv: (env) => {
        $('#schoolState').textContent = env.schoolState || '';
        music.setMood({ storm: env.storm, night: env.night > 0.5, dusk: env.dusk, rain: env.rain > 0.15, cloud: env.cloud >= 0.6, thunder: env.thunder });
      },
      onSplash: () => music.sfx('splash'),
      onQuality: () => { $('#tiltBtn').classList.remove('on'); $('#tiltBtn').setAttribute('aria-pressed', false); },
      onInteract: () => { if (S.touring && !S.tourPaused) actions.tourPause($('#tPause')); },
    });
    await world.build((p, label) => { bar.style.width = `${Math.round(p * 100)}%`; text.textContent = label; });
    world.hippoFx.restore(S.hippos);
  } catch (e) {
    console.error(e);
    fallback();
    loadLive();
    return;
  }
  window.__world = world;
  buildPlates();
  $('#tiltBtn').classList.toggle('on', world.tilt);
  $('#tiltBtn').setAttribute('aria-pressed', world.tilt);
  let prev = performance.now();
  const tick = (now) => { tourTick(now - prev); prev = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await loadLive();
  showVisits();
  sendCerts();
  world.start();
  updateInset();
  finishLoading();
  if (!calm) {
    const end = world.camera.position.clone(), tgt = world.controls.target.clone();
    world.camera.position.copy(end).multiplyScalar(1.5).add(new THREE.Vector3(0, 60, 0));
    world.flyTo(end, tgt, 2.6);
  }
  route();
  checkHandover();
  window.addEventListener('pointerdown', checkHandover, true);
  window.addEventListener('keydown', checkHandover, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkHandover(); });
  // 第一次來的訪客先看尋寶規則；直接連到某座島的人不打斷
  if (!store.get('smes-mission-seen', false)) setTimeout(() => { if (!S.island && !S.touring && !S.walking && !$('#modal').classList.contains('open')) showMission(); }, calm ? 600 : 2900);
}

boot();
