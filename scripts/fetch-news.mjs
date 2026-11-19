// 抓取石門國小官網首頁公告，輸出 news.json（由 GitHub Actions 定時執行）
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SITE = 'https://www.smes.tyc.edu.tw/';
const out = process.argv[2] || 'public/data/news.json';

const clean = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// 校網偶爾短暫連不上（2026-11-19 15:35 連線逾時），隔一下重試；三次都失敗就保留上一份公告，不讓排程變紅燈寄錯誤信
const TRIES = 3;
let html = '';
for (let i = 1; i <= TRIES; i++) {
  try {
    const res = await fetch(SITE, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; smes-island-news/1.0)' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`官網回應 ${res.status}`);
    html = await res.text();
    break;
  } catch (err) {
    const why = err.cause?.code || err.message;
    if (i === TRIES) {
      console.log(`::warning::官網連續 ${TRIES} 次連不上（${why}），這次先保留上一份公告`);
      process.exit(0);
    }
    console.log(`第 ${i} 次連不上官網（${why}），${i * 20} 秒後再試`);
    await new Promise((ok) => setTimeout(ok, i * 20000));
  }
}

const items = new Map();
for (const [, row] of html.matchAll(/<tr aria-labelledby="header_date[^>]*>([\s\S]*?)<\/tr>/g)) {
  const date = row.match(/<time datetime="([\d-]+)"/)?.[1];
  const tag = row.match(/class="my-badge[^>]*>([^<]+)</)?.[1]?.trim() || '';
  const link = row.match(/<a href="([^"]*content_id=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
  const by = row.match(/headers="header_info"[^>]*>([\s\S]*?)<\/td>/)?.[1];
  if (!date || !link) continue;
  const url = link[1].replace(/&amp;/g, '&');
  const id = url.match(/content_id=(\d+)/)[1];
  if (!items.has(id)) items.set(id, { date, tag, title: clean(link[2]), url, by: by ? clean(by) : '' });
}
const list = [...items.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 30);
if (!list.length) throw new Error('沒有解析到公告，官網版面可能改了');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ updated: new Date().toISOString(), items: list }, null, 1));
console.log(`公告 ${list.length} 筆，最新：${list[0].date} ${list[0].title}`);
