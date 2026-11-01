// 群島結構與網站文案：島名、位置、導覽旁白、跨域串聯、榮譽榜、名言、測驗
export const SCHOOL = {
  name: '桃園市龍潭區石門國民小學',
  short: '石門國小',
  en: 'Shih Men Elementary School',
  site: 'https://www.smes.tyc.edu.tw/',
  address: '325006 桃園市龍潭區文化路188號',
  phone: '03-4711752',
  lat: 24.8506,
  lon: 121.2245,
  teacherUrl: 'https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5',
};

const ring = (deg, rx, rz) => [Math.cos((deg * Math.PI) / 180) * rx, Math.sin((deg * Math.PI) / 180) * rz];

const place = (deg, rx, rz, y) => {
  const [x, z] = ring(deg, rx, rz);
  return { x, y, z };
};

export const ISLANDS = [
  { id: 'core', name: '鱻鯉主島', tag: '品牌型塑', color: '#d9432f', seed: 3, r: 18, pos: { x: 0, y: 7, z: 0 }, zoom: 58, kicker: '品牌型塑・百年傳承',
    motto: '承先啟後古韻新風貌，與時俱進閱讀新招牌', tour: '從百年老校出發。「鱻鯉鰭源，石門活閱」由十一份活魚老街的文化而來，世界樹下，是所有閱讀故事的源頭。' },
  { id: 'course', name: '魚游書海島', tag: '課程', color: '#2f8fb0', seed: 11, r: 13.5, pos: place(205, 41, 37, 2), zoom: 46, kicker: '主題一・課程',
    motto: '魚游書海 好閱讀：做好閱讀的根基', tour: '課程島上，一本攤開的大書就是孩子的海。晨讀、讀報、小小說書人與小小書評家，讓閱讀成為每天的習慣。' },
  { id: 'inquiry', name: '無涯學海島', tag: '學程', color: '#6a7fb8', seed: 23, r: 13.5, pos: place(-25, 41, 37, 5), zoom: 46, kicker: '主題二・學程',
    motto: '無涯學海 好探究：合作、跨域的學習與探索', tour: '學程島像一座小型科學村。天文台、創客桌、戲劇舞台與閱讀主播台，孩子在這裡合作探究、跨域展能。' },
  { id: 'walk', name: '石門魚鄉島', tag: '遊程', color: '#4f9a54', seed: 31, r: 14.5, pos: place(35, 41, 38, -1), zoom: 48, kicker: '主題三・遊程',
    motto: '石門魚鄉 趣走讀：多元文本閱讀與地方感', tour: '遊程島是石門的縮影。大壩的水位與真實的石門水庫連線，一到六年級沿著六條路線，從走讀認識家鄉。' },
  { id: 'digital', name: '無邊視界島', tag: '工程', color: '#3aa3a8', seed: 41, r: 13.5, pos: place(145, 41, 38, -2), zoom: 46, kicker: '主題四・工程',
    motto: '無邊視界 E動力：親師生數位學習軟實力', tour: '工程島的訊號塔，把校園場域和雲端平台連在一起。童書之森、石門那些事與 PIRLS 閱讀理解網，都從這裡連線。' },
  { id: 'library', name: '大河馬書房島', tag: 'ILR・多元文本', color: '#d98a2b', seed: 53, r: 12.5, pos: place(92, 66, 62, -7), zoom: 44, kicker: '課程發展・圖書館與多元文本',
    motto: '一到六年級循序漸進的圖書館資訊利用教育', tour: '大河馬書房裡，ILR 課程從一年級到六年級環環相扣，多元文本則走進每一個學習領域。' },
  { id: 'admin', name: '領航燈塔島', tag: '行政運作', color: '#b5563c', seed: 61, r: 11.5, pos: place(250, 72, 58, 10), zoom: 42, kicker: '行政運作',
    motto: '校長領航，定航線闢航道', tour: '燈塔為群島領航。人力、物力、財力三股活水挹注，把學校有限的資源擴大成無限。' },
  { id: 'teacher', name: '共備工坊島', tag: '教學創新', color: '#a2692f', seed: 71, r: 11.5, pos: place(288, 74, 60, 14), zoom: 42, kicker: '教學創新',
    motto: '共讀、共研、共編、共好', tour: '工坊裡的齒輪不停轉動。11 個教師社群與一師一 e，讓老師共讀、共研、共編、共好。' },
  { id: 'results', name: '星光展能島', tag: '學習成效', color: '#d9a21f', seed: 83, r: 12, pos: place(-8, 78, 56, 12), zoom: 42, kicker: '學習成效與多元展能',
    motto: '看見每一個孩子的閱讀力', tour: '星光島記錄孩子的成長：借閱量維持高水準、大河馬閱讀護照、多元展能競賽，也照顧每一位閱讀弱勢的孩子。' },
  { id: 'forest', name: '童書之森島', tag: '環境營造', color: '#5a9b4e', seed: 97, r: 12.5, pos: place(36, 78, 60, -4), zoom: 44, kicker: '環境營造',
    motto: '讓閱讀融入校園生活的各個角落', tour: '森林書屋與快樂農場，是孩子喜歡逗留的地方。漂書櫃和解說牌，把校園每個角落都變成閱讀場域。' },
  { id: 'brand', name: '風信飛艇島', tag: '品牌行銷', color: '#c8553d', seed: 103, r: 11, pos: place(150, 78, 56, 8), zoom: 42, kicker: '品牌行銷',
    motto: '閱讀資源共享共好', tour: '鯉魚飛艇從這裡出航，把石門的閱讀經驗帶向更遠的地方，也帶回社區與家長的聲音。' },
  { id: 'future', name: '曙光未來島', tag: '總結與未來', color: '#e0812a', seed: 113, r: 10.5, pos: place(192, 80, 56, 22), zoom: 42, kicker: '學校總結與未來期望',
    motto: '老校不老，華麗轉身，再現百年風華', tour: '最高的這座島，朝著曙光。站在巨人的肩膀上，鱻鯉鰭源，石門活閱，成就學校閱讀品牌，更成就每一位孩子。' },
];

// 直向手機的排列：兩欄交錯、由上而下
export const TALL = {
  admin: [-26, -108], teacher: [26, -108], future: [-38, -72], results: [38, -72], course: [-26, -36], inquiry: [26, -36], core: [0, 0],
  digital: [-26, 36], walk: [26, 36], brand: [-38, 72], forest: [38, 72], library: [0, 108],
};

export const BRIDGES = [
  ['core', 'course'], ['core', 'inquiry'], ['core', 'walk'], ['core', 'digital'],
  ['walk', 'library'], ['walk', 'forest'], ['inquiry', 'results'], ['inquiry', 'teacher'],
  ['course', 'admin'], ['admin', 'teacher'], ['digital', 'brand'], ['digital', 'library'],
];
export const STEPS = [['course', 'future']];

// 跨域串聯：方案中明確描述的關聯
export const LINKS = [
  { a: 'forest', b: 'digital', text: '童書之森與快樂農場：實體場域連上 e 閱讀網站與解說牌' },
  { a: 'walk', b: 'digital', text: '走讀魚鄉接上「石門那些事」：掃描 QR Code 就能在現場閱讀' },
  { a: 'course', b: 'library', text: '圖書館萬事通的微型活動，銜接 ILR 圖書館利用課程' },
  { a: 'inquiry', b: 'results', text: '專/議題探究與專題寫作，在競賽中展現閱讀探究成果' },
  { a: 'course', b: 'results', text: '小小書評家與大河馬閱讀護照，記錄孩子的閱讀足跡' },
  { a: 'teacher', b: 'digital', text: '一師一 e：每位老師至少學習一種教學 APP' },
  { a: 'teacher', b: 'brand', text: '教師對外分享數位學習與閱讀推動經驗' },
  { a: 'admin', b: 'forest', text: '爭取經費改善閱讀環境，打造大河馬書房與閱讀角' },
  { a: 'forest', b: 'library', text: '耕讀園結合食農教育，帶來多文本閱讀的實踐機會' },
  { a: 'inquiry', b: 'future', text: '科普閱讀與雙語閱讀，是持續深化的近期亮點' },
];

// 點一下島上的老師或學生會說的話
export const PEOPLE_LINES = {
  act: {
    teach: ['大家看這裡，這座島有好多故事喔！', '等一下要把看到的寫進學習單喔！', '誰知道這裡的故事？舉手告訴老師！'],
    listen: ['老師說的這段好有趣！', '我也想來這裡做專題！', '回去我要把這裡寫下來！'],
    read: ['這本書好好看，等我看完這頁！', '噓，看到最精彩的地方了！'],
    ball: ['接好囉！', '換你丟給我！'],
    tag: ['來抓我呀！', '追不到追不到！'],
    jump: ['今天好開心！', '我們再跳一次！'],
    wave: ['哈囉！歡迎來到石門品牌群島！', '要不要跟我們一起逛？'],
  },
  island: {
    core: ['鱻鯉鰭源，石門活閱！', '世界樹下是所有閱讀故事的源頭。'],
    course: ['今天的晨讀時間我最喜歡了！', '我想當小小說書人！'],
    inquiry: ['我要去天文台看看！', '我們這組要一起合作探究。'],
    walk: ['這裡的水位是真的連線資料耶！', '走讀魚鄉，認識我們的家鄉！'],
    digital: ['一師一 e，老師也在學新 APP！', '掃 QR Code 就能閱讀了！'],
    library: ['大河馬書房今天要借哪一本呢？', '我的書單又變長了！'],
    admin: ['燈塔為群島領航！', '校長領航，定航線闢航道。'],
    teacher: ['共讀、共研、共編、共好。', '老師們也在這裡一起備課喔！'],
    results: ['我的大河馬閱讀護照快集滿了！', '看見每一個孩子的閱讀力！'],
    forest: ['快樂農場的菜長大了！', '森林書屋是我最喜歡的角落！'],
    brand: ['鯉魚飛艇要出航了！', '把閱讀分享給更多人！'],
    future: ['老校不老，再現百年風華！', '小心踏石，慢慢跳過來！'],
  },
};

// 榮譽榜：皆取自方案內容，學生姓名已遮蔽
export const HONORS = [
  { k: '磐石', title: '教育部閱讀磐石獎 二度獲獎', sub: '101 年首度榮獲，109 年再次獲獎', island: 'core' },
  { k: '特優', title: '教育部營造空間美學發展特色學校計畫 特優', sub: '104、105 年「鱻活石門」特色課程', island: 'core' },
  { k: '品德', title: '教育部品德特色學校', sub: '108 年獲得肯定', island: 'core' },
  { k: '認證', title: '113 學年度閱讀認證通過 569 人', sub: '初階 342、中階 163、高階 64 人', island: 'results' },
  { k: '專題', title: '112 年桃園市專題寫作 特優', sub: '113 學年再獲桃園市專題寫作優等', island: 'results' },
  { k: '微文', title: '小桃子網路微文比賽 112 年特優 4 人', sub: '112–114 年持續獲獎', island: 'results' },
  { k: '創作', title: '113 年度桃園市兒童文學創作微文比賽', sub: '散文中年級組第 2 名、高年級組第 3 名等 6 人獲獎', island: 'results' },
  { k: '借閱', title: '每人每月平均借閱 2–3 冊', sub: '借閱總冊數維持在 2 萬餘冊', island: 'results' },
  { k: '戲劇', title: '故事戲劇表演競賽 37 組學生參與', sub: '小小說書人活動報名踴躍', island: 'results' },
  { k: '扶助', title: '學習扶助進步率達 50% 以上', sub: '差異化教學，不放棄任何一位孩子', island: 'results' },
  { k: '書庫', title: '龍潭區唯一的愛的書庫', sub: '提供全台學校共讀書箱', island: 'brand' },
];

export const QUOTES = [
  { text: '問渠那得清如許，為有源頭活水來。', by: '朱熹〈觀書有感〉' },
  { text: '讀書破萬卷，下筆如有神。', by: '杜甫〈奉贈韋左丞丈二十二韻〉' },
  { text: '紙上得來終覺淺，絕知此事要躬行。', by: '陸游〈冬夜讀書示子聿〉' },
  { text: '舊書不厭百回讀，熟讀深思子自知。', by: '蘇軾〈送安惇秀才失解西歸〉' },
  { text: '粗繒大布裹生涯，腹有詩書氣自華。', by: '蘇軾〈和董傳留別〉' },
  { text: '不積跬步，無以至千里；不積小流，無以成江海。', by: '《荀子・勸學》' },
  { text: '學而時習之，不亦說乎？', by: '《論語・學而》' },
  { text: '敏而好學，不恥下問。', by: '《論語・公冶長》' },
  { text: '三人行，必有我師焉。', by: '《論語・述而》' },
  { text: '書到用時方恨少，事非經過不知難。', by: '陸游' },
  { text: '業精於勤，荒於嬉；行成於思，毀於隨。', by: '韓愈〈進學解〉' },
  { text: '鱻鯉鰭源，石門活閱。', by: '石門國小品牌方案' },
  { text: '校園，啟動好閱讀；家庭，快樂愛閱讀；社會，共創新閱讀。', by: '石門國小品牌方案' },
  { text: '老校不老，華麗轉身，再現百年風華。', by: '石門國小品牌方案' },
];

export const QUIZ = [
  { q: '下課了，你最想去哪裡？', a: [['圖書館窩著看書', 'course'], ['科學教室動手做實驗', 'inquiry'], ['校園裡找花草和小昆蟲', 'forest'], ['電腦教室研究新工具', 'digital']] },
  { q: '拿到一本新書，你會先？', a: [['從第一頁慢慢讀', 'course'], ['先想書裡的問題和答案', 'inquiry'], ['找書裡提到的地方去看看', 'walk'], ['查查有沒有電子書或影片', 'digital']] },
  { q: '分組報告時，你最想負責？', a: [['上台說故事給大家聽', 'course'], ['蒐集資料、整理重點', 'inquiry'], ['到現場拍照訪問', 'walk'], ['製作簡報和影片', 'digital']] },
  { q: '假日和家人出門，你會選？', a: [['書店或圖書館', 'library'], ['科學展覽館', 'inquiry'], ['石門水庫走走', 'walk'], ['農場種菜', 'forest']] },
  { q: '你希望自己成為什麼樣的人？', a: [['知書達禮，愛閱讀', 'course'], ['探究實作，樂學習', 'inquiry'], ['活力精采，展自信', 'results'], ['關心家鄉，愛土地', 'walk']] },
];

export const QUIZ_RESULT = {
  course: { title: '書海小魚', text: '你喜歡安靜地沉浸在故事裡，書本就是你的海洋。' },
  inquiry: { title: '探究小博士', text: '遇到問題你就想弄懂，喜歡動手試試看。' },
  walk: { title: '走讀小旅人', text: '你用雙腳閱讀世界，家鄉的故事你最清楚。' },
  digital: { title: '數位小領航員', text: '新工具難不倒你，你能帶大家連上更遠的世界。' },
  forest: { title: '森林小園丁', text: '你親近自然，在樹下讀書、在農場學習最開心。' },
  library: { title: '書房小管家', text: '你最懂書放在哪裡，是圖書館的好幫手。' },
  results: { title: '閃亮小明星', text: '你勇於挑戰自己，在舞台上發光發熱。' },
};
