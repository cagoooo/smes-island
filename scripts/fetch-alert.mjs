// 抓取人事行政總處停班停課公告中的桃園市資訊，輸出 alert.json（由 GitHub Actions 定時執行）
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SITE = 'https://www.dgpa.gov.tw/typh/daily/nds.html';
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

if (process.argv[1]?.endsWith('fetch-alert.mjs')) {
  const res = await fetch(SITE, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; smes-island-alert/1.0)' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`人事總處回應 ${res.status}`);
  const alert = parseAlert(await res.text());
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ updated: new Date().toISOString(), ...alert }, null, 1));
  console.log('桃園市', alert.info || '無停班停課訊息', alert);
}
