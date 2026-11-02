// 小河馬證書領取名單：網站送來班級姓名，寫進這份試算表，校長室在「已領獎」打勾
const LIST = '領取名單';
const STATS = '統計';
const HEAD = ['領取時間', '證書編號', '證書', '班級', '姓名', '已領獎', '領獎時間'];
const TITLES = { 6: '尋寶探險家', 12: '尋寶小達人' };
const CLS = /^[一二三四五六]年[一二三四五六七八九十]+班$/;
const NAME = /^[\p{L}\p{M}·‧．]{1,12}$/u; // 只收文字，試算表公式與符號進不來
const MINUTE_CAP = 60;

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// 和網站 src/ui/cert.js 的編號算法相同，隨手亂送的資料對不上
function serial(level, cls, name, date) {
  const [y, m, d] = date.split('-');
  let h = 2166136261;
  for (const c of `${level}|${cls}|${name}|${date}`) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return `${y - 1911}${m}${d}-${level}-${(h >>> 0).toString(16).slice(-4).toUpperCase().padStart(4, '0')}`;
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = new Date(`${s}T00:00:00+08:00`).getTime();
  return t > 0 && t < Date.now() + 864e5;
}

function setupList(ss) {
  const sh = ss.getSheetByName(LIST) || ss.getSheets()[0].setName(LIST);
  if (sh.getRange(1, 1).getValue() === HEAD[0]) return sh;
  sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#f4e9d3');
  sh.setFrozenRows(1);
  sh.getRange('B:E').setNumberFormat('@');
  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(2, 170);
  sh.setColumnWidth(7, 150);
  // 同一位學生領到兩筆相同證書時標紅，提醒校長室核對
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($E2<>"",COUNTIFS($C:$C,$C2,$D:$D,$D2,$E:$E,$E2)>1)')
    .setBackground('#f8d7d0').setRanges([sh.getRange('A2:G')]).build();
  sh.setConditionalFormatRules([rule]);
  return sh;
}

function setupStats(ss) {
  if (ss.getSheetByName(STATS)) return;
  const sh = ss.insertSheet(STATS);
  const q = `'${LIST}'`;
  sh.getRange('A1:D1').setValues([['項目', '尋寶探險家', '尋寶小達人', '合計']]);
  const rows = [['全校人次', `=COUNTIF(${q}!C:C,B1)`, `=COUNTIF(${q}!C:C,C1)`, '=B2+C2'],
    ['已領獎', `=COUNTIFS(${q}!C:C,B1,${q}!F:F,TRUE)`, `=COUNTIFS(${q}!C:C,C1,${q}!F:F,TRUE)`, '=B3+C3'],
    ['尚未領獎', '=B2-B3', '=C2-C3', '=B4+C4']];
  '一二三四五六'.split('').forEach((g, i) => {
    const r = i + 5;
    rows.push([`${g}年級`, `=COUNTIFS(${q}!D:D,"${g}年*",${q}!C:C,B1)`, `=COUNTIFS(${q}!D:D,"${g}年*",${q}!C:C,C1)`, `=B${r}+C${r}`]);
  });
  sh.getRange(2, 1, rows.length, 4).setFormulas(rows.map((r) => r.map((c) => (String(c).startsWith('=') ? c : `="${c}"`))));
  sh.getRange('F1').setValue('各班人次');
  sh.getRange('F2').setFormula(`=IFERROR(QUERY(${q}!A2:G,"select D, count(E) where E is not null group by D pivot C order by D label D '班級'",0),"尚無資料")`);
  sh.getRange('A1:D1').setFontWeight('bold').setBackground('#f4e9d3');
  sh.getRange('F1').setFontWeight('bold');
  sh.setFrozenRows(1);
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Taipei') ss.setSpreadsheetTimeZone('Asia/Taipei'); // 新試算表預設美國時區，領取時間會差十幾小時
  setupList(ss);
  setupStats(ss);
}

function doGet() {
  setup();
  return json({ ok: true });
}

function overLimit() {
  const cache = CacheService.getScriptCache();
  const key = `m${Math.floor(Date.now() / 6e4)}`;
  const n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n > MINUTE_CAP;
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad' }); }
  const level = Number(d.level);
  const cls = String(d.cls || '');
  const name = String(d.name || '');
  const date = String(d.date || '');
  if (!TITLES[level] || !CLS.test(cls) || !NAME.test(name) || !validDate(date)) return json({ ok: false, error: 'invalid' });
  if (d.code !== serial(level, cls, name, date)) return json({ ok: false, error: 'code' });
  if (overLimit()) return json({ ok: false, error: 'busy' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return json({ ok: false, error: 'busy' });
  try {
    setup();
    const sh = SpreadsheetApp.getActive().getSheetByName(LIST);
    const last = sh.getLastRow();
    if (last > 1) {
      // 編號只有四碼，要連同班級姓名一起比對，才不會把不同的孩子當成重複
      const dup = sh.getRange(2, 2, last - 1, 4).getDisplayValues().some((r) => r[0] === d.code && r[2] === cls && r[3] === name);
      if (dup) return json({ ok: true, dup: true });
    }
    const row = last + 1;
    sh.getRange(row, 1, 1, 5).setValues([[new Date(), d.code, TITLES[level], cls, name]]);
    sh.getRange(row, 1).setNumberFormat('yyyy/MM/dd HH:mm');
    sh.getRange(row, 6).insertCheckboxes();
    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// 校長室打勾時自動記下領獎時間，取消勾選就清掉
function onEdit(e) {
  const r = e.range;
  if (r.getSheet().getName() !== LIST || r.getColumn() !== 6 || r.getRow() < 2 || r.getNumRows() > 1) return;
  const cell = r.getSheet().getRange(r.getRow(), 7);
  if (r.getValue() === true) cell.setValue(new Date()).setNumberFormat('yyyy/MM/dd HH:mm');
  else cell.clearContent();
}
