// 即時資料：天氣、空氣品質、石門水庫、校園公告，失敗時安靜降級
import { SCHOOL } from '../data/site.js';

const WMO = {
  0: ['晴天', '☀️', 0.02], 1: ['晴時多雲', '🌤️', 0.12], 2: ['多雲', '⛅', 0.3], 3: ['陰天', '☁️', 0.72],
  45: ['起霧', '🌫️', 0.7], 48: ['起霧', '🌫️', 0.7], 51: ['毛毛雨', '🌦️', 0.7], 53: ['毛毛雨', '🌦️', 0.75], 55: ['毛毛雨', '🌦️', 0.8],
  61: ['下雨', '🌧️', 0.85], 63: ['下雨', '🌧️', 0.9], 65: ['大雨', '🌧️', 1], 80: ['陣雨', '🌦️', 0.8], 81: ['陣雨', '🌧️', 0.88], 82: ['強陣雨', '⛈️', 1],
  95: ['雷雨', '⛈️', 1], 96: ['雷雨', '⛈️', 1], 99: ['雷雨', '⛈️', 1],
};
const RAIN = { 51: 0.3, 53: 0.4, 55: 0.5, 61: 0.6, 63: 0.8, 65: 1, 80: 0.6, 81: 0.8, 82: 1, 95: 1, 96: 1, 99: 1 };

const hours = (iso) => { const d = iso.slice(11, 16).split(':'); return +d[0] + +d[1] / 60; };

async function json(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function fetchWeather() {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${SCHOOL.lat}&longitude=${SCHOOL.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=Asia%2FTaipei&forecast_days=1`;
  const d = await json(u);
  const c = d.current, code = c.weather_code;
  const [label, icon, cloud] = WMO[code] || ['多雲', '⛅', 0.3];
  return {
    label, icon, cloud, rain: RAIN[code] || 0, thunder: code >= 95, wind: c.wind_speed_10m, gust: c.wind_gusts_10m,
    temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature), humidity: c.relative_humidity_2m,
    max: Math.round(d.daily.temperature_2m_max[0]), min: Math.round(d.daily.temperature_2m_min[0]), pop: d.daily.precipitation_probability_max[0],
    sunrise: hours(d.daily.sunrise[0]), sunset: hours(d.daily.sunset[0]),
  };
}

// 人事總處的停班停課資料由 GitHub Actions 寫進 live-data；太舊就不採用，免得颱風過了還在警戒
const ALERT_MAX_AGE = 12 * 3600 * 1000;
export async function fetchAlert() {
  const d = await json('https://raw.githubusercontent.com/cagoooo/smes-island/live-data/alert.json');
  return Date.now() - new Date(d.updated).getTime() < ALERT_MAX_AGE ? d : null;
}

// 桃園在陸上颱風警報內、公告停班停課，或陣風達 8 級（62 km/h）又在下雨，就進入颱風應變
// 其他有效的颱風警報只提醒，不改場景：這時學校可能還是好天氣，孩子也照常上課
const STORM_GUST = 62;
const STORM_RAIN = 0.5;
export function stormState(w, alert) {
  if (alert?.closed || alert?.tomorrow) return { kind: alert.typhoon || alert.warning ? 'typhoon' : 'closure', info: alert.info, scene: true };
  if (alert?.warning === 'land') return { kind: 'land', info: alert.headline, name: alert.name, scene: true };
  if (w && w.gust >= STORM_GUST && w.rain >= STORM_RAIN) return { kind: 'gale', gust: w.gust, scene: true };
  if (alert?.warning === 'sea') return { kind: 'sea', info: alert.headline, name: alert.name, scene: false };
  return null;
}

export async function fetchAir() {
  const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SCHOOL.lat}&longitude=${SCHOOL.lon}&current=us_aqi,pm2_5&timezone=Asia%2FTaipei`;
  const d = await json(u);
  const v = Math.round(d.current.us_aqi);
  const level = v <= 50 ? '良好' : v <= 100 ? '普通' : v <= 150 ? '對敏感族群不佳' : '不佳';
  return { aqi: v, pm25: d.current.pm2_5, level };
}

// 石門水庫：滿水位 245 公尺、呆水位 195 公尺
export async function fetchReservoir() {
  const d = await json('https://opendata.wra.gov.tw/api/v2/2be9044c-6e44-4856-aad5-dd108c2e6679?size=2000', 20000);
  const rows = d.filter((x) => x.reservoiridentifier === '10201' && x.waterlevel).sort((a, b) => (a.observationtime < b.observationtime ? 1 : -1));
  if (!rows.length) throw new Error('無石門水庫資料');
  const r = rows[0];
  const level = parseFloat(r.waterlevel);
  const storage = parseFloat(r.effectivewaterstoragecapacity);
  return {
    level, storage, time: r.observationtime,
    inflow: parseFloat(r.inflowdischarge) || 0, outflow: parseFloat(r.totaloutflow) || 0,
    ratio: Math.max(0, Math.min(1, (level - 195) / 50)),
  };
}

export async function fetchNews() {
  const base = import.meta.env.BASE_URL || './';
  const urls = ['https://raw.githubusercontent.com/cagoooo/smes-island/live-data/news.json', `${base}data/news.json`];
  for (const u of urls) {
    try {
      const d = await json(u);
      if (d.items?.length) return d;
    } catch { /* 換下一個來源 */ }
  }
  return { items: [], updated: null };
}

export const fmtDate = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.month} 月 ${p.day} 日`, week: p.weekday, time: `${p.hour}:${p.minute}` };
};
