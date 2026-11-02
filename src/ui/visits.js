// 登島人次：同一台裝置同一天只算一次，用 Firestore 累計全站與今日人數
// 用 REST 直接呼叫，不必為了一個數字載入整包 Firebase SDK
const KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const PROJECT = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
const API = `https://firestore.googleapis.com/v1/${DOCS}`;
const SEEN = 'smes-island-visit';
const COUNT_MS = 1100;

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

const seen = {
  get() { try { return localStorage.getItem(SEEN); } catch { return null; } },
  set(v) { try { localStorage.setItem(SEEN, v); } catch { /* 無痕模式略過 */ } },
};

async function call(path, body) {
  const res = await fetch(`${API}:${path}?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

const paths = (day) => [`${DOCS}/stats/visits`, `${DOCS}/days/${day}`];
const plusOne = (document) => ({ transform: { document, fieldTransforms: [{ fieldPath: 'total', increment: { integerValue: '1' } }] } });

async function record(day) {
  const { writeResults } = await call('commit', { writes: paths(day).map(plusOne) });
  const [total, count] = writeResults.map((r) => Number(r.transformResults[0].integerValue));
  return { total, today: count, fresh: true };
}

async function read(day) {
  const rows = await call('batchGet', { documents: paths(day) });
  const value = (name) => Number(rows.find((r) => r.found?.name.endsWith(name))?.found.fields.total.integerValue || 0);
  return { total: value('stats/visits'), today: value(day), fresh: false };
}

// 正式站才記錄，本機開發與測試不灌水
export async function countVisit() {
  if (!KEY || !PROJECT) return null;
  const day = today();
  const counted = seen.get() === day || !import.meta.env.PROD || location.hostname === 'localhost';
  if (counted) return read(day);
  const result = await record(day);
  seen.set(day);
  return result;
}

// 數字從 0 跑到實際人數
export function rollNumber(el, value, calm) {
  if (calm) { el.textContent = value.toLocaleString(); return; }
  const start = performance.now();
  const tick = (now) => {
    const u = Math.min(1, (now - start) / COUNT_MS);
    el.textContent = Math.round(value * (1 - (1 - u) ** 3)).toLocaleString();
    if (u < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => { el.textContent = value.toLocaleString(); }, COUNT_MS + 300); // 畫面忙碌或在背景時也要顯示正確數字
}
