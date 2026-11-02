// 新版通知：新版 Service Worker 裝好後提示訪客，按下更新才換版並重新整理
const BUILD = __BUILD_VERSION__;
const CHECK_EVERY = 3 * 60 * 1000;
const CHECK_GAP = 30 * 1000;
const SKIP_KEY = 'smes-island-update-skip';

const memo = {
  get() { try { return sessionStorage.getItem(SKIP_KEY); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(SKIP_KEY, v); } catch { /* 無痕模式略過 */ } },
};

// 版本格式：提交時間-提交雜湊，同一提交重跑部署不會變
const stamp = (b) => String(b).replace(/-[0-9a-f]+$/i, '');

function isNewer(candidate, base) {
  if (candidate === base) return false;
  const a = stamp(candidate), b = stamp(base);
  return a === b ? true : a > b; // 時間較舊是 CDN 殘留的舊檔，不算新版
}

// 舊版 Service Worker 沒回應時回傳 null，寧可多提示也不擋掉真更新
function ask(worker) {
  return new Promise((resolve) => {
    try {
      const ch = new MessageChannel();
      const t = setTimeout(() => resolve(null), 1500);
      ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data || null); };
      worker.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
    } catch { resolve(null); }
  });
}

let reg = null;
let shown = null;
let updating = false;

function card(info) {
  document.querySelector('#updateCard')?.remove();
  const el = document.createElement('aside');
  el.id = 'updateCard';
  el.className = 'update-card card';
  el.setAttribute('role', 'alert');
  el.innerHTML = '<img src="./brand/fish-mascot.webp" alt="" width="46" height="46" /><div class="update-text"><strong>島上有新版本了</strong><p></p></div><div class="update-ctl"><button class="cta koi" data-update="go">立刻更新</button><button data-update="later">稍後再說</button></div>';
  const fresh = info?.notes && info.version !== __APP_VERSION__; // 版號沒變時說明是舊的，改用通用文字
  el.querySelector('p').textContent = fresh ? info.notes : '更新後就能看到最新內容，只要幾秒鐘。';
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-update]')?.dataset.update;
    if (act === 'later') { memo.set(shown); el.remove(); }
    if (act === 'go') {
      const btn = e.target.closest('button');
      btn.disabled = true;
      btn.textContent = '更新中…';
      apply();
    }
  });
  document.body.append(el);
}

// 按下當下才查 waiting，訪客可能放著卡片很久；沒有等待中的版本代表已換好，重新整理就好
function apply() {
  const waiting = reg?.waiting;
  if (!waiting) { location.reload(); return; }
  updating = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => location.reload(), 8000);
}

async function offer(worker) {
  const info = await ask(worker);
  if (info && !isNewer(info.build, BUILD)) return; // 假更新不提示也不動它，動了會讓頁面無預警重整
  const build = info?.build || 'unknown';
  if (build === shown || build === memo.get()) return;
  shown = build;
  card(info);
}

function watch(worker) {
  worker?.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
  });
}

function schedule() {
  let last = 0;
  const check = () => {
    if (document.hidden || Date.now() - last < CHECK_GAP) return;
    last = Date.now();
    reg.update().catch(() => { /* 離線時下次再查 */ });
  };
  setTimeout(check, 5000);
  setInterval(check, CHECK_EVERY);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  window.addEventListener('pageshow', (e) => { if (e.persisted) check(); });
}

export async function initUpdate() {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  if (import.meta.env.DEV) {
    (await sw.getRegistration())?.unregister();
    return;
  }
  let controlled = !!sw.controller;
  try {
    reg = await sw.register('./sw.js', { updateViaCache: 'none' });
  } catch (e) {
    console.warn('Service Worker 註冊失敗', e.message);
    return;
  }
  sw.addEventListener('controllerchange', () => {
    if (updating) { updating = false; location.reload(); return; }
    // 另一個分頁按了更新：這頁還在跑舊版，提示但不打斷
    if (controlled && sw.controller) offer(sw.controller);
    controlled = true;
  });
  if (reg.waiting && sw.controller) offer(reg.waiting);
  watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));
  schedule();
}
