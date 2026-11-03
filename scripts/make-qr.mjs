// 產生全站與 12 座島的 QR Code（SVG），網址改了重跑一次：node scripts/make-qr.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';
import { ISLANDS } from '../src/data/site.js';

const SITE = 'https://cagoooo.github.io/smes-island/';
const OUT = 'public/qr';

mkdirSync(OUT, { recursive: true });
const targets = [['site', SITE], ...ISLANDS.map((d) => [d.id, `${SITE}#/${d.id}`])];
for (const [id, url] of targets) {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#1f2a37', light: '#ffffff' } });
  writeFileSync(`${OUT}/${id}.svg`, svg);
}
console.log(`已產生 ${targets.length} 張 QR Code`);
