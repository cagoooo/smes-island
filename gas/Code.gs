// 小河馬證書領取名單：網站送來班級姓名，寫進這份試算表，校長室在「已領獎」打勾
// 「題庫」分頁是第三段島嶼閱讀挑戰的題目，老師直接在試算表新增、修改或停用，網站會自動讀取
const LIST = '領取名單';
const STATS = '統計';
const VIEW = '分類名單';
const BANK = '題庫';
const GUIDE = '出題說明';
const OVERVIEW = '題庫總覽';
const CHECK = '檢查';
const DUP = '重複紀錄';
const ROSTER = '全校名冊';
const OK = '✔ 會出題';
const HEAD = ['領取時間', '證書編號', '證書', '班級', '姓名', '已領獎', '領獎時間', '排序', '名冊比對'];
const TITLES = { 6: '尋寶探險家', 12: '尋寶小達人', M: '尋河馬達人' };
const BANK_HEAD = ['停用', '年段', '島嶼', '情境（可空白）', '題目', '選項A', '選項B', '選項C', '選項D', '答案', '解說', '出題者'];
const ANY = '不限';
const BANK_TTL = 300;
const NUM = '一二三四五六七八九十';
const CLS = /^[一二三四五六]年[一二三四五六七八九十]班$/;
const ALL = '全部';
const STAMP = 'yyyy/MM/dd HH:mm';
// 題庫總覽列給出題老師參考的方向，整理自品牌方案各島內容與網站內建題
const THEMES = {
  鱻鯉主島: '品牌故事、學校願景、閱讀磐石獎、活魚老街',
  魚游書海島: '晨讀、讀報、小小說書人與書評家、語文常識',
  無涯學海島: '雙語閱讀、專題探究、閱讀主播台、自然科學',
  石門魚鄉島: '六條走讀路線、石門水庫、客家老街、水資源',
  無邊視界島: '石門那些事、平板與數位平台、網路安全',
  大河馬書房島: 'ILR 圖書館課、圖書分類、工具書、閱讀營隊',
  領航燈塔島: '志工與資源、愛的書庫、圖書經費、方位與航海',
  共備工坊島: '教師社群、一師一 e、公開授課、合作與齒輪',
  星光展能島: '大河馬閱讀護照、借閱量、校刊、天文',
  童書之森島: '童書之森、漂書櫃、快樂農場、植物與昆蟲',
  風信飛艇島: '品牌行銷、親職活動、資源共享、天氣',
  曙光未來島: '未來目標、科普與雙語、成語、時間與能源',
};
const LIST_TAB = '#c9a46a';
const BANK_TAB = '#9b6bb3';

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
  if (head[8] !== HEAD[8]) addCheckColumn(sh);
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

// 補上「名冊比對」欄；篩選範圍跟著放寬到這一欄，原本的篩選條件保留
function addCheckColumn(sh) {
  sh.getRange(1, 9).setValue(HEAD[8]).setFontWeight('bold').setBackground('#f4e9d3')
    .setNote('網站寫入時拿「全校名冊」比對：姓名差一個字、或班級選錯時自動更正，括號裡是學生原本填的；查無的請導師確認');
  sh.setColumnWidth(9, 230);
  const old = sh.getFilter();
  const crits = [];
  if (old) {
    for (let c = 1; c <= 8; c++) crits.push(old.getColumnFilterCriteria(c));
    old.remove();
  }
  const f = sh.getRange(1, 1, sh.getMaxRows(), HEAD.length).createFilter();
  crits.forEach((c, i) => c && f.setColumnFilterCriteria(i + 1, c));
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

// 名單裡同一位孩子可能有好幾筆（舊版隔天重玩會再記一次），另外算不重複的人數給校長室備獎
const PEOPLE = '領證人數（不重複）';
function peopleRows(sh) {
  const q = `'${LIST}'`;
  const uniq = (c) => `=IFERROR(COUNTUNIQUE(FILTER(${q}!D2:D&"|"&${q}!E2:E,${q}!C2:C=${c}1,${q}!E2:E<>"")),0)`;
  sh.getRange('A12:E13').setFormulas([
    [`="${PEOPLE}"`, ...['B', 'C', 'D'].map(uniq), '=B12+C12+D12'],
    ['="重複的筆數"', '=B2-B12', '=C2-C12', '=D2-D12', '=B13+C13+D13'],
  ]);
  sh.getRange('A12:E12').setFontWeight('bold').setBackground('#e7f1e1');
  sh.getRange('A13').setNote('同一位孩子同一種證書出現兩次以上的筆數；領取名單裡會標成紅色');
}

function setupStats(ss) {
  const old = ss.getSheetByName(STATS);
  if (old) {
    if (old.getRange('D1').getValue() !== TITLES.M) statsTable(old);
    if (old.getRange('A12').getValue() !== PEOPLE) peopleRows(old);
    return;
  }
  const sh = ss.insertSheet(STATS);
  statsTable(sh);
  peopleRows(sh);
  sh.getRange('F1').setValue('各班人次');
  sh.getRange('F2').setFormula(classFormula());
  sh.getRange('F1').setFontWeight('bold');
  sh.setFrozenRows(1);
}

// 題庫第一次建立時放入網站內建的題目（gas/Seed.gs），之後都以試算表為準
function setupBank(ss) {
  let sh = ss.getSheetByName(BANK);
  if (!sh) {
    sh = ss.insertSheet(BANK);
    sh.getRange(1, 1, 1, BANK_HEAD.length).setValues([BANK_HEAD]);
    sh.setFrozenRows(1);
    const rows = SEED.map((r) => ['', r[0], r[1], '', r[2], r[3], r[4], r[5], r[6], r[7], r[8], '內建題']);
    sh.getRange(2, 1, rows.length, BANK_HEAD.length).setValues(rows);
    [48, 48, 110, 150, 300, 120, 120, 120, 120, 48, 260, 80].forEach((w, i) => sh.setColumnWidth(i + 1, w));
    sh.getRange('A1').setNote('打勾就停用這一題，網站不會再出這題；取消勾選就恢復使用');
    sh.getRange('B1').setNote('低：一二年級　中：三四年級　高：五六年級');
    sh.getRange('C1').setNote('這題出在哪一座島的關卡；選「不限」就可以出在任何一座島');
    sh.getRange('J1').setNote('填正確答案是哪一個選項（A、B、C 或 D）。網站會自動打亂選項順序');
  }
  if (sh.getRange(1, 13).getValue() !== CHECK) {
    upgradeBank(sh);
    setupGuide(ss);
  }
}

// 檢查欄：照網站讀題的規則逐列判斷，老師寫完就知道這題會不會出給孩子
function checkFormula() {
  const isles = [...Object.keys(ISLAND_IDS), ANY].map((n) => `"${n}"`).join(';');
  return `={"${CHECK}";MAP(A2:A,B2:B,C2:C,E2:E,F2:F,G2:G,H2:H,I2:I,J2:J,LAMBDA(off,band,isle,ques,opa,opb,opc,opd,ans,`
    + `LET(cnt,(TRIM(opa)<>"")+(TRIM(opb)<>"")+(TRIM(opc)<>"")+(TRIM(opd)<>""),pos,MATCH(UPPER(TRIM(ans)),{"A";"B";"C";"D"},0),`
    + `IF(LEN(band&isle&ques&opa&opb&ans)=0,"",IF(off=TRUE,"停用",`
    + `IF(ISNA(MATCH(band,{"低";"中";"高"},0)),"⚠ 年段請選 低、中、高",`
    + `IF(ISNA(MATCH(isle,{${isles}},0)),"⚠ 請選島嶼",`
    + `IF(TRIM(ques)="","⚠ 缺題目",IF(cnt<2,"⚠ 選項至少要兩個",IF(ISNA(pos),"⚠ 答案請填 A～D",`
    + `IF(TRIM(CHOOSE(pos,opa,opb,opc,opd))="","⚠ 答案指到空白選項","${OK}")))))))))))}`;
}

// 下拉選單、格式延伸到整欄，加上檢查欄、篩選鈕與顏色；舊題庫也一併補齊（只做一次）
function upgradeBank(sh) {
  const max = sh.getMaxRows() - 1;
  const col = (c) => sh.getRange(2, c, max, 1);
  const pick = (c, rule) => col(c).setDataValidation(rule.setAllowInvalid(false).build());
  // 停用欄只加勾選框的格式、不寫入值，空白就是使用中
  pick(1, SpreadsheetApp.newDataValidation().requireCheckbox());
  pick(2, SpreadsheetApp.newDataValidation().requireValueInList(['低', '中', '高'], true));
  pick(3, SpreadsheetApp.newDataValidation().requireValueInList([...Object.keys(ISLAND_IDS), ANY], true));
  pick(10, SpreadsheetApp.newDataValidation().requireValueInList(['A', 'B', 'C', 'D'], true));
  sh.getRange(2, 2, max, 11).setNumberFormat('@');
  sh.getRange(2, 4, max, 8).setWrap(true);
  sh.getRange(2, 1, max, 13).setVerticalAlignment('top');
  sh.getRange(2, 10, max, 1).setHorizontalAlignment('center');
  sh.getRange(1, 13).setFormula(checkFormula());
  sh.getRange('M1').setNote('自動檢查，不用填。「⚠」開頭的題目網站會略過，照提示補好就會出題');
  sh.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#efe3f4').setVerticalAlignment('middle');
  sh.setColumnWidth(13, 160);
  sh.setFrozenColumns(3);
  if (!sh.getFilter()) sh.getRange(1, 1, sh.getMaxRows(), 13).createFilter();
  const all = sh.getRange(2, 1, max, 13);
  const band = sh.getRange(2, 2, max, 1);
  const when = (f, range) => SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(f).setRanges([range]);
  sh.setConditionalFormatRules([
    when('=$A2=TRUE', all).setFontColor('#9a9a9a').setStrikethrough(true).setBackground('#f1f1f1').build(),
    when('=LEFT($M2,1)="⚠"', all).setBackground('#fbe0da').build(),
    when('=$B2="低"', band).setBackground('#e2f1dc').build(),
    when('=$B2="中"', band).setBackground('#dde9f7').build(),
    when('=$B2="高"', band).setBackground('#fbe5cf').build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('✔').setFontColor('#2e7d32').setRanges([sh.getRange(2, 13, max, 1)]).build(),
  ]);
}

function setupGuide(ss) {
  const sh = ss.getSheetByName(GUIDE) || ss.insertSheet(GUIDE);
  const lines = [
    ['島嶼閱讀挑戰：出題說明'],
    ['第三段「尋河馬達人」：找齊 12 隻小河馬、集滿 12 枚章後，十二座島各出一題，12 題答對 10 題才過關，可到校長室兌換小客人招待券。'],
    ['① 先看「題庫總覽」：哪座島、哪個年段的題目還少，一眼就看得到（紅色 0 題、黃色 1～2 題），各島的出題方向也列在那裡。每格建議至少 3 題。'],
    ['② 到「題庫」分頁，接在最後一題的下一列往下填，一列一題，不用通知誰；網站大約 5～30 分鐘內就會用到新題目。'],
    ['　年段：低（一二年級）、中（三四年級）、高（五六年級）。孩子會依自己的年級拿到題目。'],
    ['　島嶼：這題出在哪座島的關卡，題目和島的主題相關最好；不知道放哪座島就選「不限」。'],
    ['　情境（可空白）：想給題目一段小故事時填，例如「小明到石門水庫走讀，看到……」。'],
    ['　選項：至少填 A、B 兩個；是非題可以 A 填「對」、B 填「錯」。答案欄填正確選項的字母，網站會自動打亂選項順序。'],
    ['③ 寫完看最右邊的「檢查」欄：出現「✔ 會出題」就完成了；「⚠」開頭的代表網站會略過這題，照提示補好就好。'],
    ['找題目：題庫第一列有篩選鈕，可以只看某座島、某個年段，或在「檢查」欄只看有「⚠」的題目。'],
    ['不想用的題目，在「停用」欄打勾就好，不要刪掉整列，之後取消勾選還能再用。'],
    ['「領取名單」「分類名單」「統計」三個分頁是校長室發獎用的，只有資訊組能修改。'],
  ];
  sh.clear();
  sh.getRange(1, 1, lines.length, 1).setValues(lines).setWrap(true).setVerticalAlignment('middle');
  sh.getRange('A1').setFontWeight('bold').setFontSize(14);
  sh.getRangeList(['A3', 'A4', 'A9']).setFontWeight('bold');
  sh.setColumnWidth(1, 760);
  sh.setRowHeights(2, lines.length - 1, 30);
}

// 題庫總覽：每座島、每個年段目前會出的題目數，讓出題老師知道哪裡還缺題
function setupOverview(ss) {
  const old = ss.getSheetByName(OVERVIEW);
  if (old && old.getFrozenRows() === 4) return false; // 最後一步才凍結標題列，沒凍結代表上次沒做完，整頁重做
  const sh = old ? old.clear() : ss.insertSheet(OVERVIEW);
  const q = `'${BANK}'`;
  const names = [...Object.keys(ISLAND_IDS), ANY];
  const rows = names.map((n, i) => {
    const r = i + 5;
    return [n, THEMES[n] || '任何一座島都可以出的題目，某座島題目不夠時拿來補',
      ...['低', '中', '高'].map((b) => `=COUNTIFS(${q}!$C:$C,$A${r},${q}!$B:$B,"${b}",${q}!$M:$M,"${OK}")`), `=SUM(C${r}:E${r})`];
  });
  const end = names.length + 4;
  const total = end + 1;
  rows.push(['合計', '', ...['C', 'D', 'E', 'F'].map((c) => `=SUM(${c}5:${c}${end})`)]);
  sh.getRange('A1').setValue('題庫總覽：每座島、每個年段目前會出的題目數（自動計算，不用填）').setFontWeight('bold').setFontSize(13);
  sh.getRange('A2').setValue('每格建議至少 3 題，重新挑戰時比較不會抽到一樣的題目。紅色是 0 題、黃色是 1～2 題；某格不夠時，網站會先用「不限」的題目補上。');
  sh.getRange('A4:F4').setValues([['島嶼', '出題方向（參考）', '低（一二年級）', '中（三四年級）', '高（五六年級）', '合計']])
    .setFontWeight('bold').setBackground('#efe3f4');
  sh.getRange(5, 1, rows.length, 6).setValues(rows);
  sh.getRange(total, 1, 1, 6).setFontWeight('bold').setBackground('#f6f0f8');
  sh.getRange(total + 2, 1, 2, 3).setValues([
    ['停用的題目', '', `=COUNTIF(${q}!M:M,"停用")`],
    ['要修正的題目（⚠）', '到「題庫」分頁，在「檢查」欄篩選就找得到', `=COUNTIF(${q}!M:M,"⚠*")`],
  ]);
  sh.getRange(4, 3, total - 3, 4).setHorizontalAlignment('center');
  sh.getRange(total + 2, 3, 2, 1).setHorizontalAlignment('center');
  const cells = sh.getRange(5, 3, names.length, 3);
  const rule = () => SpreadsheetApp.newConditionalFormatRule().setRanges([cells]);
  sh.setConditionalFormatRules([
    rule().whenNumberEqualTo(0).setBackground('#f6c9c0').build(),
    rule().whenNumberBetween(1, 2).setBackground('#fff0a8').build(),
    rule().whenNumberGreaterThanOrEqualTo(3).setBackground('#d9eed4').build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#fbe0da').setBold(true).setRanges([sh.getRange(total + 3, 3)]).build(),
  ]);
  [120, 330, 110, 110, 110, 70].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setFrozenRows(4);
  return true;
}

// 分頁照用途排好、上色：前三個是校長室發獎用，後三個是出題用
function arrangeTabs(ss) {
  [[LIST, LIST_TAB], [VIEW, LIST_TAB], [STATS, LIST_TAB], [GUIDE, BANK_TAB], [OVERVIEW, BANK_TAB], [BANK, BANK_TAB]].forEach(([name, color], i) => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.setTabColor(color);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  ss.setActiveSheet(ss.getSheetByName(LIST));
}

// 名單和統計是發獎資料，只有試算表擁有者（資訊組）能改；已領獎、領獎時間兩欄留著，之後校長室加入編輯也能打勾
// 題庫標題列改到時跳出提醒，避免欄位被打亂
function guard(ss) {
  [[LIST, ['F2:G']], [VIEW, ['B2', 'D2', 'F2', 'H2']], [STATS, []]].forEach(([name, open]) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) return;
    const p = sh.protect().setDescription('發獎資料，只有資訊組能修改');
    if (open.length) p.setUnprotectedRanges(open.map((a) => sh.getRange(a)));
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
  });
  const bank = ss.getSheetByName(BANK);
  if (bank && !bank.getProtections(SpreadsheetApp.ProtectionType.RANGE).length) {
    bank.getRange(1, 1, 1, 13).protect().setDescription('題庫標題列，改了網站會讀不到題目').setWarningOnly(true);
  }
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
  // 總覽、分頁排序與保護只是方便使用，出錯也不能擋住網站寫入名單
  try {
    if (setupOverview(ss) || !ss.getSheetByName(OVERVIEW).getTabColor()) arrangeTabs(ss);
    guard(ss);
  } catch (err) {
    console.error(err);
  }
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
    // 先拿全校名冊更正打錯的字，名單和重複比對都用更正後的班級姓名；名冊內容不回傳給網站
    const last = sh.getLastRow();
    const recent = last > 1 ? sh.getRange(2, 1, last - 1, 4).getValues().map((r) => [r[0], r[3]]) : [];
    const fix = matchRoster(cls, name, rosterMap(), busyClasses(recent, new Date()));
    if (last > 1) {
      // 同一位孩子同一種證書只記一筆：電腦教室常換電腦、隔天重玩又領一次，回傳第一次的編號讓網站改用原本的日期
      const same = sh.getRange(2, 2, last - 1, 4).getDisplayValues().find((r) => r[1] === TITLES[level] && r[2] === fix.cls && r[3] === fix.name);
      if (same) return json({ ok: true, dup: true, code: same[0] });
    }
    const row = last + 1;
    sh.getRange(row, 1, 1, 5).setValues([[new Date(), d.code, TITLES[level], fix.cls, fix.name]]);
    sh.getRange(row, 8, 1, 2).setValues([[clsKey(fix.cls), fix.note]]);
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
  if (r.getSheet().getName() === ROSTER) { CacheService.getScriptCache().remove('roster'); return; }
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
    .addItem('把重複的紀錄移到「重複紀錄」', 'moveDuplicates')
    .addItem('拿全校名冊檢查全部姓名', 'checkAllNames')
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

// 同一位孩子同一張證書記了兩次以上時，留下第一筆，其他移到「重複紀錄」分頁（不刪除），校長室打勾才不會看到兩行
// 舊版（2026-11-04 中午以前）隔天重玩會再記一次；之後網站已改成只記一筆，這裡處理留下來的舊資料
function archiveDuplicates() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('名單正在寫入，請稍後再試');
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(LIST);
    const last = sh.getLastRow();
    if (last < 3) return 0;
    const values = sh.getRange(2, 1, last - 1, 7).getValues();
    const shown = sh.getRange(2, 1, last - 1, 7).getDisplayValues();
    // 每組留下一筆：有人已經打勾領獎就留那一筆，否則留最早的
    const groups = {};
    shown.forEach((r, i) => {
      if (!r[4]) return;
      const k = `${r[2]}|${r[3]}|${r[4]}`;
      (groups[k] = groups[k] || []).push(i);
    });
    const moved = [];
    Object.values(groups).forEach((g) => {
      if (g.length < 2) return;
      const done = g.find((i) => values[i][5] === true);
      const keep = done === undefined ? g[0] : done;
      g.forEach((i) => i !== keep && moved.push({ row: i + 2, v: values[i], d: shown[i], keep: shown[keep][1] }));
    });
    moved.sort((a, b) => a.row - b.row);
    if (!moved.length) return 0;
    let dup = ss.getSheetByName(DUP);
    if (!dup) {
      dup = ss.insertSheet(DUP, 3);
      dup.getRange(1, 1, 1, 9).setValues([['領取時間', '證書編號', '證書', '班級', '姓名', '已領獎', '領獎時間', '名單裡保留的證書編號', '移出時間']])
        .setFontWeight('bold').setBackground('#f4e9d3');
      dup.getRange('A1').setNote('同一位孩子同一張證書重複的紀錄，從「領取名單」移過來保存；發獎請看「領取名單」裡保留的那一筆');
      dup.setFrozenRows(1);
      dup.getRange('B:E').setNumberFormat('@');
      dup.getRange('H:H').setNumberFormat('@');
      [150, 170, 110, 90, 90, 70, 150, 190, 150].forEach((w, i) => dup.setColumnWidth(i + 1, w));
      dup.setTabColor(LIST_TAB);
      const p = dup.protect().setDescription('發獎資料，只有資訊組能修改');
      p.removeEditors(p.getEditors());
      if (p.canDomainEdit()) p.setDomainEdit(false);
    }
    const now = new Date();
    const start = dup.getLastRow() + 1;
    dup.getRange(start, 1, moved.length, 9).setValues(moved.map((m) => [m.v[0], m.d[1], m.d[2], m.d[3], m.d[4], m.v[5] === true ? '✔' : '', m.v[6] || '', m.keep, now]));
    dup.getRange(start, 1, moved.length, 1).setNumberFormat(STAMP);
    dup.getRange(start, 7, moved.length, 1).setNumberFormat(STAMP);
    dup.getRange(start, 9, moved.length, 1).setNumberFormat(STAMP);
    moved.slice().reverse().forEach((m) => sh.deleteRow(m.row));
    return moved.length;
  } finally {
    lock.releaseLock();
  }
}

function moveDuplicates() {
  const n = archiveDuplicates();
  SpreadsheetApp.getActive().toast(n ? `移出 ${n} 筆重複紀錄，存在「${DUP}」分頁` : '名單裡沒有重複的紀錄', '小河馬名單', 6);
}

// ── 全校名冊比對 ──
// 「全校名冊」分頁兩欄：班級（六年一班）、姓名。資料來自學務系統「學生資料概況」，只放班級和姓名，
// 不放生日、身分證字號；分頁隱藏並鎖住，只有資訊組能改。名冊只存在學校帳號的試算表，不進 GitHub
function rosterMap() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('roster');
  if (hit) return JSON.parse(hit);
  const sh = SpreadsheetApp.getActive().getSheetByName(ROSTER);
  const map = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(([c, n]) => {
      const name = n.replace(/\s/g, '');
      if (CLS.test(c) && name) (map[c] = map[c] || []).push(name);
    });
  }
  try { cache.put('roster', JSON.stringify(map), 21600); } catch (err) { console.error(err); }
  return map;
}

// 兩個名字只差一個字（打錯、少打或多打一個字）
function oneOff(a, b) {
  const x = [...a];
  const y = [...b];
  if (Math.abs(x.length - y.length) > 1 || Math.min(x.length, y.length) < 2) return false;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  let j = 0;
  while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j++;
  return Math.max(x.length, y.length) - i - j === 1;
}

// 同一個字的不同寫法（異體字、日文字形），平板選字常跳出左邊那個；比對時當成同一個字，寫回名單一律用名冊的寫法
const VARIANT = {
  兪: '俞', 暁: '曉', 峯: '峰', 啓: '啟', 衞: '衛', 姸: '妍', 恒: '恆', 羣: '群', 綉: '繡',
  呉: '吳', 黄: '黃', 曽: '曾', 静: '靜', 凉: '涼', 裏: '裡', 爲: '為', 眞: '真', 敎: '教',
  甯: '寧', 晧: '皓', 頴: '穎', 濵: '濱', 徳: '德', 淸: '清', 靑: '青',
};
function norm(s) {
  return [...s].map((c) => VARIANT[c] || c).join('');
}

// 學生送出前後一小時內有在領證書的班級＝那時正在電腦教室上課的班；rows 是 [時間, 班級]
const SESSION_MS = 60 * 60 * 1000;
function busyClasses(rows, t) {
  const s = new Set();
  rows.forEach(([at, c]) => { if (at instanceof Date && Math.abs(at - t) <= SESSION_MS) s.add(c); });
  return s;
}

// 回傳更正後的班級姓名與比對結果；只有「唯一一個」可能的對象才自動改，其餘標出來給導師確認
// busy（可省略）：當時正在上課的班級，用來判斷「選錯班又打錯一個字」
function matchRoster(cls, name, map, busy) {
  const all = Object.keys(map);
  if (!all.length) return { cls, name, note: '' };
  if ((map[cls] || []).includes(name)) return { cls, name, note: '✔ 相符' };
  const key = norm(name);
  const uniq = (a) => [...new Set(a)];
  const fixName = (n) => ({ cls, name: n, note: `已更正姓名（原填：${name}）` });
  const fixBoth = (c, n) => ({ cls: c, name: n, note: n === name ? `已更正班級（原填：${cls}）` : `已更正班級與姓名（原填：${cls} ${name}）` });
  const many = { cls, name, note: '⚠ 名冊有好幾個可能的對象，請導師確認' };
  // 1. 同班、只是字的寫法不同（兪／俞）
  const same = uniq((map[cls] || []).filter((n) => norm(n) === key));
  if (same.length === 1) return fixName(same[0]);
  // 2. 同班差一個字，或別班有同一個名字（選錯班）
  const near = uniq((map[cls] || []).filter((n) => oneOff(key, norm(n))));
  const elsewhere = [];
  all.forEach((c) => { if (c !== cls) uniq(map[c].filter((n) => norm(n) === key)).forEach((n) => elsewhere.push([c, n])); });
  // 同班有相近的名字、別班又有同一個名字，猜不出是打錯字還是選錯班，交給導師
  if (near.length + elsewhere.length > 1) return many;
  if (near.length === 1) return fixName(near[0]);
  if (elsewhere.length === 1) return fixBoth(elsewhere[0][0], elsewhere[0][1]);
  // 3. 選錯班又打錯一個字：只找同年級、當時正在上課的班；全部只有一個可能才改
  if (busy && busy.size) {
    const both = [];
    all.forEach((c) => {
      if (c === cls || c[0] !== cls[0] || !busy.has(c)) return;
      uniq(map[c].filter((n) => oneOff(key, norm(n)))).forEach((n) => both.push([c, n]));
    });
    if (both.length > 1) return many;
    if (both.length === 1) return fixBoth(both[0][0], both[0][1]);
  }
  return { cls, name, note: '⚠ 名冊查無，請導師確認' };
}

// 換新名冊：rows 是 [班級, 姓名]，整張換掉
function importRoster(rows) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(ROSTER);
  if (!sh) {
    sh = ss.insertSheet(ROSTER);
    const p = sh.protect().setDescription('全校名冊，只有資訊組能修改');
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
    sh.setTabColor(LIST_TAB);
  }
  sh.clear();
  sh.getRange(1, 1, 1, 2).setValues([['班級', '姓名']]).setFontWeight('bold').setBackground('#f4e9d3');
  sh.getRange('A1').setNote('拿來比對領取名單的全校名冊（只有班級、姓名）。換學期或有轉學生時整張換新；改動這張表後網站馬上改用新名冊');
  sh.setFrozenRows(1);
  sh.getRange('A:B').setNumberFormat('@');
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.hideSheet();
  CacheService.getScriptCache().remove('roster');
  return rows.length;
}

// 名單裡還沒比對過的列全部比對一次（已更正過的不再動），更正後變重複的再移到「重複紀錄」
function reconcileList() {
  const map = rosterMap();
  if (!Object.keys(map).length) throw new Error('還沒有全校名冊');
  const ss = SpreadsheetApp.getActive();
  setup();
  const out = { checked: 0, ok: 0, fixed: [], missing: [] };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('名單正在寫入，請稍後再試');
  try {
    const sh = ss.getSheetByName(LIST);
    const last = sh.getLastRow();
    if (last < 2) return out;
    const rows = sh.getRange(2, 4, last - 1, 6).getDisplayValues(); // D 班級 … I 名冊比對
    const times = sh.getRange(2, 1, last - 1, 1).getValues().map((r, i) => [r[0], rows[i][0]]);
    const de = [];
    const hi = [];
    rows.forEach((r, i) => {
      const [cls, name, , , key, note] = r;
      if (!name || note.startsWith('已更正')) { de.push([cls, name]); hi.push([key, note]); return; }
      const at = times[i][0];
      const f = matchRoster(cls, name, map, at instanceof Date ? busyClasses(times, at) : null);
      out.checked++;
      if (f.note === '✔ 相符') out.ok++;
      else if (f.note.startsWith('已更正')) out.fixed.push(`${cls} ${name} → ${f.cls} ${f.name}`);
      else out.missing.push(`${cls} ${name}（${f.note}）`);
      de.push([f.cls, f.name]);
      hi.push([CLS.test(f.cls) ? clsKey(f.cls) : key, f.note]);
    });
    sh.getRange(2, 4, rows.length, 2).setValues(de);
    sh.getRange(2, 8, rows.length, 2).setValues(hi);
  } finally {
    lock.releaseLock();
  }
  out.moved = archiveDuplicates();
  return out;
}

function checkAllNames() {
  const r = reconcileList();
  SpreadsheetApp.getActive().toast(`檢查 ${r.checked} 筆：相符 ${r.ok}、自動更正 ${r.fixed.length}、名冊查無 ${r.missing.length}（請看「名冊比對」欄）；移出重複 ${r.moved} 筆`, '小河馬名單', 10);
}
