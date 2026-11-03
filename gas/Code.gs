// 小河馬證書領取名單：網站送來班級姓名，寫進這份試算表，校長室在「已領獎」打勾
// 「題庫」分頁是第三段島嶼閱讀挑戰的題目，老師直接在試算表新增、修改或停用，網站會自動讀取
const LIST = '領取名單';
const STATS = '統計';
const VIEW = '分類名單';
const BANK = '題庫';
const GUIDE = '出題說明';
const HEAD = ['領取時間', '證書編號', '證書', '班級', '姓名', '已領獎', '領獎時間', '排序'];
const TITLES = { 6: '尋寶探險家', 12: '尋寶小達人', M: '尋河馬達人' };
const BANK_HEAD = ['停用', '年段', '島嶼', '情境（可空白）', '題目', '選項A', '選項B', '選項C', '選項D', '答案', '解說', '出題者'];
const ANY = '不限';
const BANK_TTL = 300;
const NUM = '一二三四五六七八九十';
const CLS = /^[一二三四五六]年[一二三四五六七八九十]班$/;
const ALL = '全部';
const STAMP = 'yyyy/MM/dd HH:mm';

// 國字直接排序會變成一、三、二……，另外存數字排序碼：一年二班 → 102
function clsKey(cls) {
  return (NUM.indexOf(cls[0]) + 1) * 100 + NUM.indexOf(cls[2]) + 1;
}
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
  const head = sh.getRange(1, 1, 1, HEAD.length).getValues()[0];
  if (head[0] !== HEAD[0]) {
    sh.getRange(1, 1, 1, 7).setValues([HEAD.slice(0, 7)]).setFontWeight('bold').setBackground('#f4e9d3');
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
  }
  if (head[7] !== HEAD[7]) upgradeList(ss, sh);
  return sh;
}

// 補上排序碼欄與標題列的篩選鈕，舊名單也一併補齊（只做一次）
function upgradeList(ss, sh) {
  sh.getRange(1, 8).setValue(HEAD[7]).setFontWeight('bold').setBackground('#f4e9d3');
  const last = sh.getLastRow();
  if (last > 1) {
    const cls = sh.getRange(2, 4, last - 1, 1).getDisplayValues();
    sh.getRange(2, 8, last - 1, 1).setValues(cls.map(([c]) => [CLS.test(c) ? clsKey(c) : '']));
  }
  sh.hideColumns(8);
  if (!sh.getFilter()) sh.getRange(1, 1, sh.getMaxRows(), HEAD.length).createFilter();
  const stats = ss.getSheetByName(STATS);
  if (stats) stats.getRange('F2').setFormula(classFormula());
}

// 各班人次照排序碼排，一年一班、一年二班……依序往下
function classFormula() {
  const q = `'${LIST}'`;
  return `=IFERROR(LET(t,QUERY(${q}!A2:H,"select H, D, count(E) where E is not null group by H, D pivot C order by H label H '', D '班級'",0),CHOOSECOLS(t,SEQUENCE(1,COLUMNS(t)-1,2))),"尚無資料")`;
}

// 分類名單：選年級、班級、證書、領獎狀態，名單照班級姓名排好，可直接列印
function certPick(sh) {
  sh.getRange('F2').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([ALL, ...Object.values(TITLES)], true).setAllowInvalid(false).build());
}

function setupView(ss) {
  const old = ss.getSheetByName(VIEW);
  if (old) {
    const rule = old.getRange('F2').getDataValidation();
    if (!rule || !rule.getCriteriaValues()[0].includes(TITLES.M)) certPick(old);
    return;
  }
  const sh = ss.insertSheet(VIEW, 1);
  const q = `'${LIST}'`;
  const pick = (a1, rule) => sh.getRange(a1).setDataValidation(rule.setAllowInvalid(false).build());
  sh.getRange('A1').setValue('在黃色格子選條件，名單會自動更新；要勾「已領獎」請回「領取名單」分頁').setFontWeight('bold');
  sh.getRange('A2:H2').setValues([['年級', ALL, '班級', ALL, '證書', ALL, '領獎', ALL]]);
  pick('B2', SpreadsheetApp.newDataValidation().requireValueInList([ALL, ...'一二三四五六'.split('').map((g) => `${g}年級`)], true));
  pick('D2', SpreadsheetApp.newDataValidation().requireValueInRange(sh.getRange('Z1:Z'), true));
  certPick(sh);
  pick('H2', SpreadsheetApp.newDataValidation().requireValueInList([ALL, '尚未領獎', '已領獎'], true));
  sh.getRangeList(['B2', 'D2', 'F2', 'H2']).setBackground('#fff2a8').setFontWeight('bold');
  sh.getRangeList(['A2', 'C2', 'E2', 'G2']).setHorizontalAlignment('right');
  // 班級選單只列出已經有人領證書的班級，同樣照排序碼排
  sh.getRange('Z1').setValue(ALL);
  sh.getRange('Z2').setFormula(`=IFERROR(CHOOSECOLS(SORT(UNIQUE(FILTER(HSTACK(${q}!D2:D,${q}!H2:H),${q}!D2:D<>"")),2,TRUE),1),"")`);
  sh.hideColumns(26);
  sh.getRange('A3').setFormula('=IF(A5="沒有符合條件的資料","符合條件：0 人","符合條件：共 "&COUNTA(A5:A)&" 人")');
  sh.getRange('A4:G4').setValues([['班級', '姓名', '證書', '已領獎', '領獎時間', '領取時間', '證書編號']])
    .setFontWeight('bold').setBackground('#f4e9d3');
  sh.getRange('A5').setFormula(`=IFERROR(ARRAYFORMULA(LET(d,FILTER(${q}!A2:H,${q}!E2:E<>""),c,INDEX(d,,4),f,INDEX(d,,6),`
    + `ok,(($B$2="${ALL}")+(LEFT(c,1)=LEFT($B$2,1)))*(($D$2="${ALL}")+(c=$D$2))*(($F$2="${ALL}")+(INDEX(d,,3)=$F$2))`
    + `*(($H$2="${ALL}")+($H$2="已領獎")*(f=TRUE)+($H$2="尚未領獎")*(f<>TRUE)),`
    + `s,SORT(FILTER(d,ok>0),8,TRUE,5,TRUE,1,TRUE),`
    + `HSTACK(INDEX(s,,4),INDEX(s,,5),INDEX(s,,3),IF(INDEX(s,,6)=TRUE,"✔",""),INDEX(s,,7),INDEX(s,,1),INDEX(s,,2)))),"沒有符合條件的資料")`);
  sh.getRange('E5:F').setNumberFormat(STAMP);
  sh.getRange('D5:D').setHorizontalAlignment('center');
  sh.setFrozenRows(4);
  [90, 90, 110, 70, 140, 140, 170].forEach((w, i) => sh.setColumnWidth(i + 1, w));
}

// 三種證書各一欄（B～D），E 欄合計；舊版只有兩種證書，第一次執行時整塊重寫
function statsTable(sh) {
  const q = `'${LIST}'`;
  const cols = ['B', 'C', 'D'];
  const sum = (r) => `=${cols.map((c) => `${c}${r}`).join('+')}`;
  const rows = [['全校人次', ...cols.map((c) => `=COUNTIF(${q}!C:C,${c}1)`), sum(2)],
    ['已領獎', ...cols.map((c) => `=COUNTIFS(${q}!C:C,${c}1,${q}!F:F,TRUE)`), sum(3)],
    ['尚未領獎', ...cols.map((c) => `=${c}2-${c}3`), sum(4)]];
  '一二三四五六'.split('').forEach((g, i) => {
    rows.push([`${g}年級`, ...cols.map((c) => `=COUNTIFS(${q}!D:D,"${g}年*",${q}!C:C,${c}1)`), sum(i + 5)]);
  });
  sh.getRange('A1:E10').clearContent();
  sh.getRange('A1:E1').setValues([['項目', TITLES[6], TITLES[12], TITLES.M, '合計']]).setFontWeight('bold').setBackground('#f4e9d3');
  sh.getRange(2, 1, rows.length, 5).setFormulas(rows.map((r) => r.map((c) => (String(c).startsWith('=') ? c : `="${c}"`))));
}

function setupStats(ss) {
  const old = ss.getSheetByName(STATS);
  if (old) {
    if (old.getRange('D1').getValue() !== TITLES.M) statsTable(old);
    return;
  }
  const sh = ss.insertSheet(STATS);
  statsTable(sh);
  sh.getRange('F1').setValue('各班人次');
  sh.getRange('F2').setFormula(classFormula());
  sh.getRange('F1').setFontWeight('bold');
  sh.setFrozenRows(1);
}

// 題庫第一次建立時放入網站內建的題目（gas/Seed.gs），之後都以試算表為準
function setupBank(ss) {
  if (ss.getSheetByName(BANK)) return;
  const sh = ss.insertSheet(BANK);
  sh.getRange(1, 1, 1, BANK_HEAD.length).setValues([BANK_HEAD]).setFontWeight('bold').setBackground('#efe3f4');
  sh.setFrozenRows(1);
  const names = Object.keys(ISLAND_IDS);
  const rows = SEED.map((r) => ['', r[0], r[1], '', r[2], r[3], r[4], r[5], r[6], r[7], r[8], '內建題']);
  sh.getRange(2, 1, rows.length, BANK_HEAD.length).setValues(rows);
  // 停用欄只加勾選框的格式、不寫入值，空白就是使用中，老師往下新增題目時也不會被一整排假勾選擋住
  const max = rows.length + 400;
  const rule = (b) => sh.getRange(2, b.col, max, 1).setDataValidation(b.v.setAllowInvalid(false).build());
  rule({ col: 1, v: SpreadsheetApp.newDataValidation().requireCheckbox() });
  const list = (col, values) => rule({ col, v: SpreadsheetApp.newDataValidation().requireValueInList(values, true) });
  list(2, ['低', '中', '高']);
  list(3, [...names, ANY]);
  list(10, ['A', 'B', 'C', 'D']);
  sh.getRange(2, 2, max, 11).setNumberFormat('@');
  sh.getRange(2, 4, max, 8).setWrap(true);
  [48, 48, 110, 150, 300, 120, 120, 120, 120, 48, 260, 80].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('A1').setNote('打勾就停用這一題，網站不會再出這題；取消勾選就恢復使用');
  sh.getRange('B1').setNote('低：一二年級　中：三四年級　高：五六年級');
  sh.getRange('C1').setNote('這題出在哪一座島的關卡；選「不限」就可以出在任何一座島');
  sh.getRange('J1').setNote('填正確答案是哪一個選項（A、B、C 或 D）。網站會自動打亂選項順序');
  if (!ss.getSheetByName(GUIDE)) setupGuide(ss);
}

function setupGuide(ss) {
  const sh = ss.insertSheet(GUIDE);
  const lines = [
    ['島嶼閱讀挑戰：出題說明'],
    ['第三段「尋河馬達人」：找齊 12 隻小河馬、集滿 12 枚章後，十二座島各出一題，12 題答對 10 題才過關，可到校長室兌換小客人招待券。'],
    ['每一列是一題，直接在「題庫」分頁最下面新增就可以，不用通知誰；網站大約 5～30 分鐘內就會用到新題目。'],
    ['年段：低（一二年級）、中（三四年級）、高（五六年級）。孩子會依自己的年級拿到題目。'],
    ['島嶼：這題出在哪座島的關卡，題目和島的主題相關最好；不知道放哪座島就選「不限」。'],
    ['情境（可空白）：想給題目一段小故事時填，例如「小明到石門水庫走讀，看到……」。'],
    ['選項：至少填 A、B 兩個；是非題可以 A 填「對」、B 填「錯」。答案欄填正確選項的字母。'],
    ['同一座島、同一年段的題目越多，每次挑戰抽到的題目越不一樣，重新挑戰時也比較不會重複。'],
    ['不想用的題目，在「停用」欄打勾就好，不要刪掉整列，之後取消勾選還能再用。'],
    ['格式不完整的題目（例如沒有答案、選項少於兩個）網站會自動略過，不會出給孩子。'],
  ];
  sh.getRange(1, 1, lines.length, 1).setValues(lines).setWrap(true);
  sh.getRange('A1').setFontWeight('bold').setFontSize(14);
  sh.setColumnWidth(1, 760);
}

// 網站讀取題庫：只送出啟用、格式完整的題目；老師改題庫時清掉快取（onEdit）
function bankItems() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('bank');
  if (hit) return JSON.parse(hit);
  const sh = SpreadsheetApp.getActive().getSheetByName(BANK);
  if (!sh || sh.getLastRow() < 2) return [];
  const items = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, BANK_HEAD.length).getDisplayValues().forEach((r) => {
    const [off, b, isle, c, q, ...rest] = r;
    const letters = rest.slice(0, 4);
    const ans = 'ABCD'.indexOf(String(rest[4]).trim().toUpperCase());
    const i = isle === ANY ? '*' : ISLAND_IDS[isle];
    if (off === 'TRUE' || !'低中高'.includes(b) || !b || !i || !q.trim() || ans < 0 || !String(letters[ans]).trim()) return;
    const kept = letters.map((t, k) => [String(t).trim(), k]).filter(([t]) => t);
    if (kept.length < 2) return;
    items.push({ b, i, c: c.trim(), q: q.trim(), o: kept.map(([t]) => t), a: kept.findIndex(([, k]) => k === ans), x: String(rest[5]).trim() });
  });
  const text = JSON.stringify(items);
  if (text.length < 90000) cache.put('bank', text, BANK_TTL);
  return items;
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Taipei') ss.setSpreadsheetTimeZone('Asia/Taipei'); // 新試算表預設美國時區，領取時間會差十幾小時
  setupList(ss);
  setupStats(ss);
  setupView(ss);
  setupBank(ss);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.bank) return json({ ok: true, items: bankItems() });
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
  const level = String(d.level);
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
    sh.getRange(row, 8).setValue(clsKey(cls));
    sh.getRange(row, 1).setNumberFormat(STAMP);
    sh.getRange(row, 6).insertCheckboxes();
    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// 校長室打勾時自動記下領獎時間，取消勾選就清掉；老師改題庫時，讓網站下次讀到新題目
function onEdit(e) {
  const r = e.range;
  if (r.getSheet().getName() === BANK) { CacheService.getScriptCache().remove('bank'); return; }
  if (r.getSheet().getName() !== LIST || r.getColumn() !== 6 || r.getRow() < 2 || r.getNumRows() > 1) return;
  const cell = r.getSheet().getRange(r.getRow(), 7);
  if (r.getValue() === true) cell.setValue(new Date()).setNumberFormat(STAMP);
  else cell.clearContent();
}

// 試算表上方的「小河馬名單」選單：一鍵篩選與排序，篩選後仍可直接打勾
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const grade = ui.createMenu('依年級');
  '一二三四五六'.split('').forEach((g, i) => grade.addItem(`${g}年級`, `grade${i + 1}`));
  ui.createMenu('🦛 小河馬名單')
    .addItem('只看尚未領獎', 'showPending')
    .addItem('只看已領獎', 'showDone')
    .addSubMenu(grade)
    .addSubMenu(ui.createMenu('依證書').addItem(TITLES[6], 'cert6').addItem(TITLES[12], 'cert12').addItem(TITLES.M, 'certM'))
    .addItem('顯示全部（清除篩選）', 'showAll')
    .addSeparator()
    .addItem('依班級排序', 'sortByClass')
    .addItem('依領取時間排序', 'sortByTime')
    .addSeparator()
    .addItem('開啟分類名單', 'openView')
    .addToUi();
}

function listSheet() {
  const ss = SpreadsheetApp.getActive();
  setup();
  const sh = ss.getSheetByName(LIST);
  ss.setActiveSheet(sh);
  return sh;
}

// 各欄條件會疊加，例如先選三年級再選尚未領獎
function setCrit(col, crit, msg) {
  const sh = listSheet();
  const f = sh.getFilter() || sh.getRange(1, 1, sh.getMaxRows(), HEAD.length).createFilter();
  f.setColumnFilterCriteria(col, crit);
  SpreadsheetApp.getActive().toast(`${msg}，要看全部請選「顯示全部」`, '小河馬名單');
}

const textIs = (t) => SpreadsheetApp.newFilterCriteria().whenTextEqualTo(t).build();
const checked = (f) => SpreadsheetApp.newFilterCriteria().whenFormulaSatisfied(f).build();
function byGrade(i) {
  setCrit(4, SpreadsheetApp.newFilterCriteria().whenTextStartsWith(`${NUM[i - 1]}年`).build(), `只顯示${NUM[i - 1]}年級`);
}
function showPending() { setCrit(6, checked('=$F2<>TRUE'), '只顯示尚未領獎'); }
function showDone() { setCrit(6, checked('=$F2=TRUE'), '只顯示已領獎'); }
function cert6() { setCrit(3, textIs(TITLES[6]), `只顯示${TITLES[6]}`); }
function cert12() { setCrit(3, textIs(TITLES[12]), `只顯示${TITLES[12]}`); }
function certM() { setCrit(3, textIs(TITLES.M), `只顯示${TITLES.M}`); }
function grade1() { byGrade(1); }
function grade2() { byGrade(2); }
function grade3() { byGrade(3); }
function grade4() { byGrade(4); }
function grade5() { byGrade(5); }
function grade6() { byGrade(6); }

function showAll() {
  const f = listSheet().getFilter();
  if (f) for (let c = 1; c <= HEAD.length; c++) f.removeColumnFilterCriteria(c);
  SpreadsheetApp.getActive().toast('已顯示全部名單', '小河馬名單');
}

// 有篩選時整張表不能排序，先記下條件、排完再套回去；鎖住避免和網站寫入撞在一起
function sortList(spec, msg) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return SpreadsheetApp.getActive().toast('網站正在寫入，請稍後再試', '小河馬名單');
  try {
    const sh = listSheet();
    const last = sh.getLastRow();
    if (last < 3) return;
    const old = sh.getFilter();
    const crits = [];
    if (old) {
      for (let c = 1; c <= HEAD.length; c++) crits.push(old.getColumnFilterCriteria(c));
      old.remove();
    }
    sh.getRange(2, 1, last - 1, HEAD.length).sort(spec);
    const f = sh.getRange(1, 1, sh.getMaxRows(), HEAD.length).createFilter();
    crits.forEach((c, i) => c && f.setColumnFilterCriteria(i + 1, c));
    SpreadsheetApp.getActive().toast(msg, '小河馬名單');
  } finally {
    lock.releaseLock();
  }
}
function sortByClass() { sortList([{ column: 8, ascending: true }, { column: 5, ascending: true }, { column: 1, ascending: true }], '已依班級、姓名排好'); }
function sortByTime() { sortList([{ column: 1, ascending: true }], '已依領取時間排好'); }

function openView() {
  const ss = SpreadsheetApp.getActive();
  setup();
  ss.setActiveSheet(ss.getSheetByName(VIEW));
}
