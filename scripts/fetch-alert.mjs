// 抓取人事行政總處的桃園市停班停課資訊與氣象署颱風警報，輸出 alert.json（由 GitHub Actions 定時執行）
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SITE = 'https://www.dgpa.gov.tw/typh/daily/nds.html';
const CWA = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0034-001';
const out = process.argv[2] || '/tmp/alert.json';

const clean = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function parseAlert(html) {
  if (!/id="Table"/i.test(html)) throw new Error('停班停課頁版面可能改了');
  const body = html.slice(html.search(/<TBODY/i));
  const rows = [...body.matchAll(/<TR[^>]*>([\s\S]*?)<\/TR>/gi)].map((m) => [...m[1].matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/gi)].map((c) => clean(c[1])));
  const row = rows.find((r) => r.length > 1 && r[0].includes('桃園市'));
  const info = row ? row.slice(1).join(' ') : '';
  return {
    info,
    closed: /今天[^。]*停止(上班|上課)/.test(info),
    tomorrow: /明天[^。]*停止(上班|上課)/.test(info),
    typhoon: /颱風/.test(clean(html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ''))),
  };
}

// 走訪氣象署回傳的每個文字欄位，格式小改也抓得到；陸上警報要涵蓋桃園才算影響學校
export function parseTyphoon(records) {
  const texts = [];
  let name = '';
  const walk = (v, key = '') => {
    if (typeof v === 'string') {
      texts.push(v);
      if (/cwaTyphoonName/i.test(key)) name ||= v;
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, k);
    }
  };
  walk(records);
  const heads = texts.filter((t) => /颱風.*警報/.test(t) && t.length < 60 && !/解除/.test(t));
  if (!heads.length) return { warning: null, name: '', headline: '' };
  const land = heads.some((t) => /陸上/.test(t)) && texts.some((t) => /桃園/.test(t));
  return { warning: land ? 'land' : 'sea', name, headline: heads[0] };
}

async function fetchTyphoon(key) {
  const res = await fetch(`${CWA}?Authorization=${encodeURIComponent(key)}&format=JSON&expires=true`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`氣象署回應 ${res.status}`); // 訊息不含網址，避免授權碼進紀錄
  const d = await res.json();
  console.log('氣象署回應', d.success, '欄位', Object.keys(d.records || {}).join(',') || '無');
  return parseTyphoon(d.records);
}

if (process.argv[1]?.endsWith('fetch-alert.mjs')) {
  const res = await fetch(SITE, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; smes-island-alert/1.0)' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`人事總處回應 ${res.status}`);
  const alert = parseAlert(await res.text());
  const key = process.env.CWA_API_KEY;
  if (key) {
    try {
      Object.assign(alert, await fetchTyphoon(key));
    } catch (e) {
      console.log('颱風警報暫時無法取得', e.name === 'Error' ? e.message : e.name);
    }
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ updated: new Date().toISOString(), ...alert }, null, 1));
  console.log('桃園市', alert.info || '無停班停課訊息', alert);
}
