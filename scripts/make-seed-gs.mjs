// 把網站內建的閱讀挑戰題目寫成 gas/Seed.gs，試算表第一次建立「題庫」分頁時當作起始題目
// 改了 src/data/challenge.js 的內建題後執行：node scripts/make-seed-gs.mjs，再用 clasp 推上去
import { writeFileSync } from 'node:fs';
import { BANK } from '../src/data/challenge.js';
import { ISLANDS } from '../src/data/site.js';

const name = Object.fromEntries(ISLANDS.map((d) => [d.id, d.name]));
const rows = BANK.map(([b, i, q, o, x]) => [b, name[i], q, ...[0, 1, 2, 3].map((k) => o[k] || ''), 'A', x]);
const ids = Object.fromEntries(ISLANDS.map((d) => [d.name, d.id]));

writeFileSync(new URL('../gas/Seed.gs', import.meta.url), `// 由 scripts/make-seed-gs.mjs 從 src/data/challenge.js 產生，不要手改
// 島名對應網站的島嶼代號；題目欄位依序是 年段、島嶼、題目、選項A～D、答案、解說
const ISLAND_IDS = ${JSON.stringify(ids, null, 2)};

const SEED = [
${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}
];
`);
console.log(`寫入 ${rows.length} 題`);
