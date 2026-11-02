# 由方案 docx 抽出的 plan.md 與 media 產生 src/data/content.json 與 public/images
# 用法：python scripts/build-content.py <plan.md> <media 資料夾> <emf 轉檔資料夾> [高解析原圖資料夾]
# 文字一律依行號取自方案原文，避免人工重打走樣；學生姓名在此以遮蔽版圖說覆寫。
# 高解析原圖資料夾放 <圖號>.src，有檔案就取代 Word 裡的同一張圖；之後拿到校刊、剪報原檔照此方式補上。
import json, os, re, sys
import cv2
import numpy as np
from PIL import Image, ImageFilter

PLAN, MEDIA, EMF = sys.argv[1:4]
HI = sys.argv[4] if len(sys.argv) > 4 else ''
# 報導、校刊、作文這類以文字為主的圖，銳化加重；其餘照片維持自然
DOCS = set('32 72 73 74 75 76 77 125 126 127 130 132 134 136 140 141 184 212 213 214 215'.split())
# 校刊與學習單上的學生姓名（圖片比例座標），圖變清楚後要模糊處理，和文字圖說的遮蔽原則一致
MASK = {
    '75': [(.70, .085, .79, .125)],
    '77': [(.83, .79, .89, .94)],
    '125': [(.735, .301, .80, .321), (.735, .502, .80, .522), (.735, .819, .80, .839)],
    '126': [(.262, .349, .335, .369), (.262, .613, .335, .633), (.262, .875, .335, .895)],
    '127': [(.258, .337, .34, .355), (.258, .634, .34, .652), (.258, .912, .34, .930)],
    '212': [(.68, .15, .88, .205)],
    '213': [(.68, .15, .88, .205)],
    '214': [(.395, .125, .56, .19)],
    '215': [(.40, .125, .58, .19)],
}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, 'public', 'images')
THUMB_DIR = os.path.join(IMG_DIR, 't')
os.makedirs(THUMB_DIR, exist_ok=True)

LINES = [''] + open(PLAN, encoding='utf-8').read().split('\n')
IMG_RE = re.compile(r'\[\[IMG:media/image(\d+)\.\w+\]\]')
used, sizes = {}, {}


def L(n, strip=None):
    t = IMG_RE.sub('', LINES[n]).strip()
    t = re.sub(r'^## \[heading 1\]\s*', '', t)
    if strip:
        t = t.replace(strip, '')
    t = re.sub(r'\s*\t\s*', ' ', t).replace(' 。', '。').replace(' ，', '，')
    t = t.replace('運 用', '運用')
    return t.strip()


def table(n):
    assert LINES[n] == '<TABLE>', (n, LINES[n])
    rows, i = [], n + 1
    while LINES[i] != '</TABLE>':
        rows.append([c.strip() for c in LINES[i].strip()[1:-1].split(' | ')])
        i += 1
    return rows


def imgs(cell):
    return IMG_RE.findall(cell)


def text(cell):
    return re.sub(r'\s+/\s+', '\n', IMG_RE.sub('', cell)).strip(' /\n')


def I(n, cap='', link=''):
    n = str(n)
    used[n] = True
    return {'id': n, 'cap': cap, 'link': link} if link else {'id': n, 'cap': cap}


def P(*ns):
    return [{'t': 'p', 'text': L(n)} for n in ns]


def H(s):
    return {'t': 'h', 'text': s}


def photos(items):
    return {'t': 'photos', 'items': items}


def caption_table(n):
    # 上排照片、下排圖說，可重複多組
    rows = table(n)
    out = []
    for i in range(0, len(rows) - 1, 2):
        for a, b in zip(rows[i], rows[i + 1]):
            ids = imgs(a)
            for k, id_ in enumerate(ids):
                out.append(I(id_, text(b)))
    return out


def stacked_table(n):
    # 同一格內圖片＋文字
    rows = table(n)
    out = []
    for r in rows:
        for c in r:
            for id_ in imgs(c):
                out.append(I(id_, text(c)))
    return out


def merged_photo_table(n):
    # 第一列第一格塞了四張照片、第二列才是四格圖說
    rows = table(n)
    ids = imgs(rows[0][0])
    return [I(i, c) for i, c in zip(ids, rows[1])]


def collage(n, caps, band):
    # EMF 拼貼圖切成四張獨立照片
    src = Image.open(os.path.join(EMF, f'image{n}.png')).convert('RGB')
    w, h = src.size
    top = int(h * band)
    out = []
    for k in range(4):
        box = (int(w * k / 4) + 4, 0, int(w * (k + 1) / 4) - 4, top)
        im = src.crop(box)
        px = im.convert('L').point(lambda v: 255 if v < 244 else 0)
        bbox = px.getbbox()
        if bbox:
            im = im.crop(bbox)
        id_ = f'{n}{"abcd"[k]}'
        save(im, id_)
        out.append({'id': id_, 'cap': caps[k]})
    return out


def enlarge(im, id_):
    # Word 裡的圖多半被壓得很小。反覆投影：放大後縮回去和原圖比對，只補差值，
    # 邊緣變俐落又不會畫出原圖沒有的筆畫，不用 AI 超解析以免改動文字與孩子的臉。
    scale = min(4, 1600 // max(im.size))
    if scale < 2:
        return im
    doc = id_ in DOCS
    rgb = np.asarray(im.convert('RGB'))
    # 照片先去掉 Word 壓縮的方塊雜點，否則補邊時會被放大成鋸齒；文字圖要保留筆畫，不去雜點
    lr = np.float32(rgb if doc else cv2.fastNlMeansDenoisingColored(rgb, None, 3, 5, 5, 15))
    h, w = lr.shape[:2]
    size = (w * scale, h * scale)
    hr = cv2.resize(lr, size, interpolation=cv2.INTER_LANCZOS4)
    for _ in range(6 if doc else 2):
        hr += cv2.resize(lr - cv2.resize(hr, (w, h), interpolation=cv2.INTER_AREA), size, interpolation=cv2.INTER_CUBIC)
    hr += (.5 if doc else .2) * (hr - cv2.GaussianBlur(hr, (0, 0), scale * .6))
    out = Image.fromarray(np.clip(hr, 0, 255).astype(np.uint8))
    if im.mode == 'RGBA':
        out.putalpha(im.getchannel('A').resize(size, Image.LANCZOS))
    return out


def mask_names(im, id_):
    w, h = im.size
    for x0, y0, x1, y1 in MASK.get(id_, []):
        box = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
        im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(h * .012)), box)
    return im


def save(im, id_):
    has_alpha = im.mode in ('RGBA', 'LA', 'P')
    src_w = im.size[0]
    im = mask_names(enlarge(im.convert('RGBA' if has_alpha else 'RGB'), id_), id_)
    big = im.copy()
    big.thumbnail((2000, 2000), Image.LANCZOS)
    big.save(os.path.join(IMG_DIR, f'{id_}.webp'), quality=86, method=5)
    t = im.copy()
    t.thumbnail((560, 560), Image.LANCZOS)
    t.save(os.path.join(THUMB_DIR, f'{id_}.webp'), quality=70, method=5)
    # 第三個數字是放大倍率，看大圖時用來限制照片的顯示尺寸；文字圖要讀得到字，不限制
    sizes[id_] = [big.size[0], big.size[1], 1 if id_ in DOCS else round(im.size[0] / src_w)]


# ───────── 主島：品牌型塑 ─────────
timeline = [
    {'stage': '茁壯期', 'years': '99–101', 'goal': '閱讀奠基・持續進行', 'color': '#e98a15',
     'items': ['99 桃園縣閱讀績優學校', '101 教育部閱讀磐石學校']},
    {'stage': '翻轉期', 'years': '102–104', 'goal': '空間改善・數位導入', 'color': '#5a5bd6',
     'items': ['102 InnoSchool 創新經營學校', '103 教育部圖書館改善計畫，成立桃園縣愛的書庫',
               '104 Smart School 智慧教室', '104 教育部營造空間美學特色學校']},
    {'stage': '整合期', 'years': '105–106', 'goal': '課程整合・教師增能', 'color': '#b14fd6',
     'items': ['105 教育部營造空間美學發展特色學校', '105 全校電子白板智慧教室',
               '105–106 前進智慧教室上課、落實鱻魚特色課程、落實跨領域在地課程', '106 114 線客庄遊學學校聯盟']},
    {'stage': '邁步期', 'years': '107–109', 'goal': '數位學習・跨域展能', 'color': '#e8622a',
     'items': ['109 教育部閱讀磐石學校', '109 品德特色學校', '鱻活石門客庄遊學學校',
               '「水與文化」社區走讀', '議題探究、專題製作', '「一師一e」教學活化']},
    {'stage': '深化厚實期', 'years': '110–114', 'goal': '智慧閱讀・深化學習', 'color': '#2f9e6e',
     'items': ['114 品德特色學校', '「一師一e」教學活化', '「水與文化」社區走讀', '議題探究、專題製作',
               '落實數位閱讀、行動學習', '推動雙語閱讀', '快樂農場耕讀園', '「童書之森・石小」科普閱讀區']},
]
goals = [
    {'k': '短期目標', 'c': '#e8a91f', 'text': '內涵是透過導讀、說故事以及提供大量優質適性讀本，來提升學生的閱讀興趣，並讓他們能夠享受閱讀帶來的樂趣。', 'sub': '樂在閱讀是基礎：學生能寫作、分享'},
    {'k': '中期目標', 'c': '#d0867f', 'text': '內涵是培養學生質量兼備的閱讀能力，透過閱讀策略教學，使孩子們能夠讀懂內容、具備批判思考能力，並能建構自我價值與自信心。', 'sub': '閱讀理解是應用：透過閱讀敘說品牌故事'},
    {'k': '長期目標', 'c': '#4d7eb8', 'text': '內涵是讓學生能夠掌握資訊並學習遷移，達成跨域展能，並將所學轉化至生活運用與實踐，進而擁有自主學習及終身學習的能力。', 'sub': '閱讀素養是實踐：打造熱愛閱讀的幸福校園'},
]
core = {
    'tabs': [
        {'label': '品牌故事', 'blocks': [
            {'t': 'lead', 'text': L(2)}, *P(3, 4, 5),
            {'t': 'stats', 'items': [
                {'n': '2', 'u': '度', 'label': '教育部閱讀磐石獎（101、109 年）'},
                {'n': '58,000', 'u': '冊', 'label': '目前館藏書籍'},
                {'n': '270', 'u': '台', 'label': '平板電腦'},
                {'n': '4', 'u': '大主題', 'label': '課程・學程・遊程・工程'}]},
        ]},
        {'label': '形塑品牌', 'blocks': [H(L(7)), *P(8, 9)]},
        {'label': '發展歷程', 'blocks': [H(L(10)), *P(11), {'t': 'timeline', 'items': timeline},
                                     {'t': 'fig', 'item': I(3, '自 101 年閱讀磐石學校起閱讀教育推動發展歷程')}]},
        {'label': '理念目標', 'blocks': [
            H('閱讀推動緣起：強調數位學習，跨域整合'), *P(48),
            H('閱讀推動理念'), *P(50),
            H('閱讀推動短中長期程目標'), {'t': 'goals', 'items': goals},
        ]},
        {'label': '四程架構', 'blocks': [
            H('依據理念規劃實踐的閱讀架構'),
            {'t': 'themes', 'items': [
                {'id': 'course', 'k': '課程', 'name': '魚游書海 好閱讀', 'text': '做好閱讀的根基。'},
                {'id': 'inquiry', 'k': '學程', 'name': '無涯學海 好探究', 'text': '合作、跨域的學習與探索。'},
                {'id': 'walk', 'k': '遊程', 'name': '石門魚鄉 趣走讀', 'text': '多元文本閱讀、閱讀理解、行動閱讀與地方感。'},
                {'id': 'digital', 'k': '工程', 'name': '無邊視界 E動力', 'text': '親師生數位/行動學習軟實力工程的建立。'}]},
            {'t': 'list', 'items': [L(62), L(63), L(64)]},
            *P(65),
            {'t': 'fig', 'item': I(19, '「鱻鯉鰭源，石門活閱」方案架構')},
            {'t': 'fig', 'item': I(23, '四大主題教學活動總覽')},
        ]},
    ],
}

# ───────── 四程島 ─────────
def activities(n, skip_head=True):
    rows = table(n)[1:] if skip_head else table(n)
    out = []
    for r in rows:
        title = re.sub(r'^\d+\.\s*', '', text(r[0]))
        pics = [I(i, title) for c in r[3:] for i in imgs(c)]
        pics = [p for p in pics if p['id'] not in ('29', '49', '6', '40')]
        out.append({'title': title, 'meaning': text(r[1]), 'how': text(r[2]), 'photos': pics})
    return out


course = {'tabs': [
    {'label': '島嶼介紹', 'blocks': [*P(71), {'t': 'fig', 'item': I(25, '主題一：五大閱讀行動')}]},
    {'label': '五大行動', 'blocks': [{'t': 'activities', 'labels': ['實施內涵', '實施方式'], 'items': activities(73)}]},
]}
inquiry = {'tabs': [
    {'label': '島嶼介紹', 'blocks': [*P(83), {'t': 'fig', 'item': I(37, '主題二：十大探究行動')}]},
    {'label': '十大行動', 'blocks': [{'t': 'activities', 'labels': ['實施內涵', '實施方式'], 'items': activities(85)}]},
]}

w = table(105)
pairs = [(0, 1), (2, 3), (4, 5)]
faces = [w[0][1], w[0][2], w[0][3]]
routes = []
for col in range(6):
    i = col + 1
    routes.append({
        'face': faces[col // 2],
        'title': text(w[1][i]).replace('\n', ''),
        'grade': text(w[2][i]),
        'feature': text(w[3][i]),
        'texts': text(w[5][i]),
        'how': text(w[6][i]).replace('\n', ''),
        'strategy': text(w[8][i]).split('\n'),
        'check': text(w[9][i]).replace('\n', '、'),
        'photos': [I(p, text(w[1][i]).replace('\n', '')) for row in (7, 10) for p in imgs(w[row][i])],
    })
walk_photos = collage(58, ['解說清水坑水圳文化', '介紹大圳的歷史與功用', '三坑老街永福宮解說', '解說大平老街老屋風情'], .80) + \
    collage(81, ['走讀前學生製作海報', '走與讀，還有合作學習', '三坑老街黑白洗解說', '三坑老街開庄伯公解說'], .84)
walk = {'tabs': [
    {'label': '島嶼介紹', 'blocks': [
        H('走讀魚鄉'), {'t': 'p', 'text': L(100).replace('走讀魚鄉：', '')},
        H('走讀解說'), {'t': 'p', 'text': L(101).replace('走讀解說：', '')},
        {'t': 'steps', 'items': [
            {'k': '從走（覺）', 'text': '連結在地自然與文史特色。'},
            {'k': '到讀（知）', 'text': '透過多元文本與策略，深化學習。'},
            {'k': '能行動（行與思）', 'text': '學生分組解說，培養口語表達與自信。'}]},
        {'t': 'fig', 'item': I(57, '走讀路線、歷程與閱讀策略架構')},
    ]},
    {'label': '六條路線', 'blocks': [
        {'t': 'p', 'text': '走讀策略：地方文化采風 → 地方文化閱讀寫作 → 地方文化專題探究；從走（覺），到讀（知），能行動（行與思）。'},
        {'t': 'routes', 'items': routes}]},
    {'label': '水庫即時', 'blocks': [{'t': 'live-reservoir'}]},
    {'label': '走讀相簿', 'blocks': [photos(walk_photos)]},
]}

digital = {'tabs': [
    {'label': '島嶼介紹', 'blocks': [*P(121), {'t': 'fig', 'item': I(82, '主題四：十一項數位與場域工程')}]},
    {'label': '十一項工程', 'blocks': [{'t': 'activities', 'labels': ['說明', '使用場域'], 'items': activities(123)}]},
]}

# ───────── 大河馬書房：ILR 與多元文本 ─────────
ilr = table(142)
grades = ['一年級', '二年級', '三年級', '四年級', '五年級', '六年級']
ilr_rows, facet = [], ''
fix = {'I': 'I 資訊素養', 'L': 'L 圖書館利用', 'R': 'R 閱讀素養'}
for r in ilr[1:]:
    if len(r) < 9:
        continue
    if r[0].strip():
        facet = fix[text(r[0])[0]]
    ilr_rows.append({'facet': facet, 'no': r[1], 'topic': r[2], 'cells': r[3:9]})
camps = [
    ['多元閱讀營', '涵蓋各類書籍、素材的深度導讀與討論。', '培養廣泛閱讀興趣與理解分析能力。'],
    ['科普魔法閱讀營', '結合自然領域各類型生活科學理論，進行科普書籍閱讀融合魔術原理及心理學技巧，搭配數學魔術進行思維邏輯整合舞台表演。', '提升科學素養，將科普文章與魔術藝文表演領域結合，訓練邏輯思維能力與肢體語言表達。'],
    ['多文本主題人物走讀', '以特定主題人物為核心，深度閱讀相關文本、歷史資料，並進行實地考察。', '訓練跨文本比較能力、培養批判性思考，並加深對在地文化和歷史的連結。'],
    ['說書人桌遊讀寫營', '透過熱門的說書人桌遊機制，結合閱讀與寫作練習。', '強化敘事技巧、口語表達、創意寫作和團隊合作能力。'],
    ['品學堂科普閱讀營', '引用近年來未來少年科普書籍專業且系統化的科普閱讀教材，結合 PaGamO 品學堂閱讀素養題組測驗合作對付魔王模式或是分開對戰模式，進行深度閱讀素養學習。', '系統化地建立學生各領域的科學知識體系，並培養紙本閱讀以及數位閱讀雙素養的日常習慣。'],
]
library = {'tabs': [
    {'label': 'ILR 課程', 'blocks': [
        H('圖書館資訊利用教育 ILR 課程之規劃及執行'),
        {'t': 'p', 'text': L(139) + L(140)},
        {'t': 'ilr', 'grades': grades, 'rows': ilr_rows}]},
    {'label': '多元文本', 'blocks': [
        {'t': 'p', 'text': L(156).split('：', 1)[1]},
        H(re.sub(r'^\d\.', '', L(158))), *P(159),
        {'t': 'table', 'head': ['營隊主題', '核心活動內容', '學習效益'], 'rows': camps},
        photos(collage(98, ['營隊活動提供不同閱讀體驗', '結合桌遊等有趣的課程設計', '數位/行動學習融入營隊活動', '學生接觸多元的文本'], .82)),
    ]},
    {'label': '融入各領域', 'blocks': [
        H(re.sub(r'^\d\.', '', L(160))), *P(161),
        {'t': 'domains', 'items': [
            {'k': '國語文', 'text': L(162).split('國語文課，', 1)[1]},
            {'k': '英語', 'text': L(163).split('英語課堂中，', 1)[1]},
            {'k': '數學', 'text': L(164).split('數學領域，', 1)[1]},
            {'k': '社會', 'text': L(165).split('社會領域', 1)[1].strip()},
            {'k': '自然', 'text': L(166).split('自然領域，', 1)[1]}]},
        photos(caption_table(168)),
    ]},
    {'label': '鱻活石門', 'blocks': [H('多元文本閱讀策略融入「鱻活石門」特色課程'), photos(caption_table(175) + caption_table(181))]},
]}

# ───────── 領航燈塔：行政運作 ─────────
budget = [['圖書館牆壁防水', '15,120'], ['圖書館塑膠地板', '13,692'], ['圖書館牆壁剝落', '16,800'], ['圖書館油漆修補', '15,000'],
          ['冷氣安裝 3 台（含電箱）', '180,000'], ['牆壁防水工程', '50,000'], ['燈具更換', '71,379'], ['合計', '361,991']]
admin = {'tabs': [
    {'label': '整合資源', 'blocks': [H(L(13)), *P(14),
        {'t': 'stats', 'items': [
            {'n': '58,000', 'u': '冊', 'label': '目前館藏書籍約'},
            {'n': '22', 'u': '萬/年', 'label': '申請補助款圖書採購約'},
            {'n': '18,000', 'u': '元/年', 'label': '學校自籌圖書採購約'},
            {'n': '270', 'u': '台', 'label': '平板電腦'}]}]},
    {'label': '人力支援', 'blocks': [H('人力支援部分：閱推的重要協力者'), {'t': 'list', 'items': [re.sub(r'^\d\.', '', L(n)) for n in (16, 17, 18, 19)]},
                               photos(caption_table(21) + stacked_table(27))]},
    {'label': '物力支援', 'blocks': [H('物力支援部分：閱讀設施設備的建置'), {'t': 'list', 'items': [re.sub(r'^\d\.', '', L(n)) for n in (37, 38, 39)]},
                               photos(stacked_table(33))]},
    {'label': '財力支援', 'blocks': [H('財力支援部分：閱讀環境軟體硬體改善'), {'t': 'list', 'items': [re.sub(r'^\d\.', '', L(n)) for n in (41, 42)]},
                               H('113–114 年圖書館修繕經費'), {'t': 'table', 'head': ['項目', '經費（元）'], 'rows': budget, 'total': True}]},
    {'label': '組織分工', 'blocks': [H('閱讀推動之組織架構與人員分工合作之內容'), *P(44), {'t': 'fig', 'item': I(18, '行政運作架構：整合學校內外部資源，建立完善閱讀推動組織')}]},
]}

# ───────── 共備工坊：教學創新 ─────────
pd = [
    {'k': '閱讀素養與 PIRLS 深耕', 'items': ['2025/10/29 PIRLS 題組生成與課堂互動', '2024/4/17 國語文素養導向之數位教學工作坊', '2024/2/23 《教出雙閱讀素養》專書導讀讀書會', '2023/12/20 跨文本閱讀策略研習']},
    {'k': 'AI 應用與數位科技融入', 'items': ['2025/10/8 行動學習 GO 超快閃研習！', '2025/3/19 資訊教育教師增能研習', '2024/11/27 運算思維互動題組推廣課程', '2024/5/29 專題講座：淺談數位影像', '2024/5/8 主題探究與 AI 生成課程設計', '2023/12/20 活用 AI 生成技術提升教學效率', '2023/11/8 專題講座（ClassSwift 在平板互動教學的運用）']},
    {'k': '素養導向課程設計與評量', 'items': ['2024/9/9 《圖解力教學》專書導讀讀書會', '2024/8/28 多元學習課程設計研習', '2024/8/27 素養導向設計與評量研習', '2024/5/29 素養導向課程設計與評量工作坊', '2023/10/25 主題探究課程分享研習', '2023/8/25 素養導向課程設計與評量（一師一 E 有效融入教學設計研習）']},
]
teacher = {'tabs': [
    {'label': '專業成長', 'blocks': [
        H('教師閱讀專業成長方面'),
        {'t': 'chips', 'label': '成長師資群', 'items': ['清大學習與科技學系教授', '國家教育研究院講師', '輔導團講師', '社區讀書會、導覽解說講師', '資訊組-凱揚老師', '閱讀推動教師']},
        {'t': 'list', 'items': [re.sub(r'^\d\.', '', L(n)) for n in (196, 197, 198, 199, 200)]},
        photos(collage(114, ['教師自組讀書會', '校長帶領備觀議公開授課', '結合閱讀教育進行備觀議課', '素養導向命題研習提升專業'], .82)),
    ]},
    {'label': '教學社群', 'blocks': [
        H('辦理閱讀教學社群方面'), *P(202),
        {'t': 'list', 'items': [re.sub(r'^\d\.', '', L(n)) for n in (203, 204)]},
        {'t': 'stats', 'items': [{'n': '11', 'u': '群', 'label': '目前成立社群'}, {'n': '107', 'u': '年起', 'label': '教學共備、觀、議，公開授課'}]},
        photos(collage(115, ['社群專書閱讀分享', '教師資訊素養研習以利提升閱推成效', '社群閱讀教案設計，發表與經驗分享', '社群成果分享共學共好'], .72)),
    ]},
    {'label': '全員增能', 'blocks': [
        H('重視所有閱讀推動人員的閱讀專業發展'),
        {'t': 'p', 'text': L(207) + L(208) + L(209) + L(210)},
        {'t': 'fig', 'item': I(116, '閱推教師、其他教師、圖書志工、家長與社區共同增能')},
    ]},
    {'label': '回饋精進', 'blocks': [
        H(re.sub(r'^二、', '', L(211))), *P(212, 213), photos(caption_table(215)),
    ]},
    {'label': '研習足跡', 'blocks': [
        H('教師專業成長歷程：研習豐碩成果（2023–2025）'), {'t': 'columns', 'items': pd},
        {'t': 'fig', 'item': I(191, '教師專業成長歷程黑板')},
    ]},
]}

# ───────── 星光展能：學習成效 ─────────
borrow = {'title': '近年圖書借閱量', 'unit': '本', 'labels': ['111', '112', '113', '114（1–10月）'], 'values': [21704, 22957, 21938, 17918],
          'head': ['年度', '總借閱量（本）', '年平均借閱量（本）', '月平均借閱量（本）'],
          'rows': [['111', '21,704', '26.3', '2.2'], ['112', '22,957', '27.7', '2.3'], ['113', '21,938', '26.5', '2.2'], ['114（1–10月）', '17,918', '22.5', '2.3']]}
cert = {'title': '大河馬閱讀認證通過情形', 'unit': '人', 'labels': ['111', '112', '113'], 'values': [520, 520, 569],
        'head': ['學年度', '初階', '中階', '高階', '小計'],
        'rows': [['111', '346', '115', '59', '520'], ['112', '303', '169', '48', '520'], ['113', '342', '163', '64', '569']]}
peach = [['112', '特優', '4'], ['112', '優選', '4'], ['113', '優選', '3'], ['114', '佳作', '2'], ['114', '入選', '3']]
micro = [['吳OO', '散文高年級組第 3 名'], ['蔡OO', '散文中年級組第 2 名'], ['王OO', '散文高年級組佳作'], ['羅OO', '散文高年級組佳作'], ['余OO', '散文中年級組佳作'], ['林OO', '散文中年級組佳作']]
paper_caps = ['國語日報投稿入選作品', '國語日報投稿入選作品', '國語日報投稿入選作品', '國語日報投稿入選作品']
paper_rows = table(234)
paper = []
for cell, cap in zip(paper_rows[0], paper_caps):
    for i in imgs(cell):
        paper.append(I(i, cap))
badges = [I(145, '幸福閱讀'), I(146, '飛閱書海'), I(147, '書海閱讀'), I(148, '幸福閱讀'), I(157, '高階閱讀認證章')]
results = {'tabs': [
    {'label': '閱讀力', 'blocks': [
        H(L(222).replace('一、', '')), *P(223),
        {'t': 'fig', 'item': I(123, '閱讀能力及閱讀興趣之提升')},
        {'t': 'p', 'text': L(224)}, {'t': 'chart', 'data': borrow},
        {'t': 'p', 'text': L(225)}, {'t': 'p', 'text': L(226)}, photos(caption_table(228)),
    ]},
    {'label': '展能競賽', 'blocks': [
        {'t': 'p', 'text': L(239)},
        H('參加桃園市小桃子網路微文比賽'), {'t': 'table', 'head': ['年度', '獎項', '人數'], 'rows': peach},
        H('113 年度桃園市兒童文學創作微文比賽獲獎'), {'t': 'table', 'head': ['姓名', '獎項'], 'rows': micro},
        photos(caption_table(242) + paper + collage(156, ['小小說書人戲劇比賽參與踴躍', '大河馬認證護照兼顧閱讀的質與量', '客家藝文競賽屢獲全國賽佳績', '專題寫作競賽成績優異展現閱讀探究成果'], .72)),
    ]},
    {'label': '閱讀認證', 'blocks': [
        {'t': 'p', 'text': L(240)},
        {'t': 'p', 'text': '113 學年度閱讀認證通過人數初階 342 人、中階 163 人、高階 64 人，共計 569 人。'},
        {'t': 'chart', 'data': cert},
        {'t': 'p', 'text': L(247)},
        H('閱讀認證與標章'), {'t': 'badges', 'items': badges},
    ]},
    {'label': '弱勢扶助', 'blocks': [
        H('學生閱讀個別差異之輔導及協助'), *P(250),
        {'t': 'cards', 'items': [{'k': L(n).split(')', 1)[1], 'text': L(n + 1)} for n in (251, 253, 255, 257)]},
        photos(caption_table(260)),
    ]},
    {'label': '議題探究', 'blocks': [H('學生運用閱讀能力進行重大議題之探究活動'), *P(266, 267), photos(caption_table(269) + caption_table(275))]},
]}

# ───────── 童書之森：環境營造 ─────────
forest = {'tabs': [
    {'label': '閱讀基地', 'blocks': [
        {'t': 'p', 'text': L(281) + L(282) + L(283)},
        H('建立閱讀基地'), {'t': 'p', 'text': L(285, '童書之森童書之森快樂農場快樂農場').replace('圖書館與閱讀場所：', '') + L(286)},
        {'t': 'fig', 'item': I(171, '建立閱讀基地：大河馬書房、愛的書庫、班級閱讀角、閱讀公佈欄、雲端 e 閱讀')},
        photos(caption_table(289)),
    ]},
    {'label': '課間閱讀', 'blocks': [
        {'t': 'p', 'text': L(287).replace('二、課間閱讀場域：', '')},
        {'t': 'cards', 'items': [
            {'k': '「閱讀石光」漂書櫃', 'text': '在一樓中廊設置漂書櫃，讓早到校等待教室開門，或是放學後等待家長的學生，可以利用這些零碎的等待時間進行閱讀，避免嬉鬧或滑手機。'},
            {'k': '穿堂大河馬書刊櫃', 'text': '方便來校等候的家長可以隨手取閱書籍。'},
            {'k': '數位e閱讀', 'text': '「石門那些事」自導式解說牌提供e化閱讀文本，讓學生可以即時連結到數位閱讀內容，體驗不同的閱讀樂趣。'}]},
    ]},
    {'label': '課後假日', 'blocks': [
        {'t': 'p', 'text': L(298).replace('三、課後與假日的閱讀場域：', '')},
        photos(caption_table(302 - 1) + collage(176, ['假日，圖書館值班老師、志工說故事', '孩子們課間在林間小屋取書悅讀，陽光綠蔭好風景', '閱讀班級共讀書後，老師帶領學生塗鴉牆書畫心得感想。', '塗鴉牆是班級閱讀心得以彩繪故事方式呈現。'], .74)),
    ]},
    {'label': '數位環境', 'blocks': [
        H('資源整合提供學生數位閱讀學習環境'),
        {'t': 'p', 'text': L(307)},
        {'t': 'list', 'items': ['Smart School 智慧教室課程', '電腦教室課程', '班級智慧教室課程', 'e閱讀行動學習課程', '多元閱讀營隊課程']},
        photos(collage(183, ['創客達人提升學生資訊素養', '課程結合在地化議題', '藉由數位科技培養探索能力', '透過 Hyread 雲端資料共學'], .82)),
        {'t': 'p', 'text': L(309)},
    ]},
]}

# ───────── 風信飛艇：品牌行銷 ─────────
brand = {'tabs': [
    {'label': '多元行銷', 'blocks': [H(L(311).replace('一、', '')), *P(312), {'t': 'fig', 'item': I(184, '台灣公益時報報導：童書之森', 'https://www.facebook.com/share/p/1CcGRcCKTZ/')}]},
    {'label': '資源共享', 'blocks': [
        H('閱讀資源共享共好'),
        {'t': 'list', 'items': [re.sub(r'^\(.\)', '', L(n)) for n in (314, 316, 317, 318)]},
        photos(collage(186, ['黃凱揚老師至國教院分享生成式 AI 在閱讀教育上的運用。', '賴韻竹老師於水美國小分享---課文本位閱讀理解策略。', '林芸靚老師跨校分享專題寫作經驗，共學共好。', '圖書館臉書圖文並茂，宣傳圖書館閱讀活動。'], .72) + caption_table(321 - 1)),
    ]},
    {'label': '傾聽回饋', 'blocks': [H(L(325).replace('三、', '')), *P(326)]},
]}

# ───────── 曙光未來：總結與未來 ─────────
future = {'tabs': [
    {'label': '近期亮點', 'blocks': [
        *P(328),
        H('精進教師教學軟實力'), {'t': 'p', 'text': L(330).split('：', 1)[1]},
        H('提升學生行動/數位閱讀能力'), {'t': 'p', 'text': L(331).split('：', 1)[1]}, photos(caption_table(333)),
        H('科普閱讀'), {'t': 'p', 'text': L(338).split('：', 1)[1]}, photos(caption_table(340) + caption_table(346)),
        H('雙語閱讀'), {'t': 'p', 'text': L(351).split('：', 1)[1]}, photos(merged_photo_table(353)),
        H('設置快樂農場-耕讀園'), {'t': 'p', 'text': L(358).split('：', 1)[1]}, photos(merged_photo_table(360) + caption_table(366)),
    ]},
    {'label': '未來目標', 'blocks': [
        H('學校未來持續發展品牌學校之目標'), *P(372),
        {'t': 'cards', 'items': [
            {'k': '深化與擴展閱讀活動', 'text': L(373).split('：', 1)[1]},
            {'k': '整合智慧互動教學與在地特色課程', 'text': L(374).split('：', 1)[1]}]},
    ]},
    {'label': '閱讀的力量', 'blocks': [
        H('看見閱讀的力量：從作品產出到幸福時尚的蛻變'),
        {'t': 'cards', 'items': [
            {'k': '【產出作品】課程檢驗，看見思考的軌跡', 'text': L(377).split('：', 1)[1]},
            {'k': '【行銷故事】同儕引領，讓閱讀成為日常習慣', 'text': L(378).split('：', 1)[1]},
            {'k': '【升級幸福】空間與科技，讓閱讀蔚為時尚', 'text': L(379).split('：', 1)[1]}]},
        *P(380),
        photos([I(216, '閱讀的力量：學生作品'), I(218, '樂讀・耕讀・悅讀'), I(221, '童書之森師生合影')]),
    ]},
]}

islands = dict(core=core, course=course, inquiry=inquiry, walk=walk, digital=digital, library=library,
               admin=admin, teacher=teacher, results=results, forest=forest, brand=brand, future=future)

for n in list(used):
    if n in sizes:
        continue
    cand = [f for f in os.listdir(MEDIA) if re.fullmatch(rf'image{n}\.(png|jpeg|jpg)', f)]
    path = os.path.join(MEDIA, cand[0]) if cand else os.path.join(EMF, f'image{n}.png')
    hi = os.path.join(HI, f'{n}.src')
    save(Image.open(hi if HI and os.path.exists(hi) else path), n)

out = {'islands': islands, 'sizes': sizes}
dest = os.path.join(ROOT, 'src', 'data', 'content.json')
os.makedirs(os.path.dirname(dest), exist_ok=True)
json.dump(out, open(dest, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=0)
print('islands', len(islands), 'images', len(sizes), 'chars', sum(len(json.dumps(v, ensure_ascii=False)) for v in islands.values()))
