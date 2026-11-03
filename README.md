# 桃園市石門國小品牌群島

「鱻鯉鰭源，石門活閱」品牌學校方案的 3D 互動網站。以天空之城浮空島為主題，十二座手作微縮風格的島嶼對應方案各章節，並整合即時天氣、空氣品質、石門水庫水位與校園公告。

- 正式網站：https://cagoooo.github.io/smes-island/
- 技術：Vite + Three.js（幾何全部由程式產生，不需外部 3D 模型）
- 內容：`src/data/content.json` 由 `scripts/build-content.py` 從方案 docx 產生；群島結構與文案在 `src/data/site.js`
- 公告：`.github/workflows/update-news.yml` 於台灣時間 07:03～19:53 排定每 10 分鐘抓取校網公告，寫入 `live-data` 分支；GitHub 排程常延遲數小時或被略過，實際更新頻率以 Actions 紀錄為準。學校電腦另有 Windows 工作排程「石門品牌群島公告同步」，開機時於 07:05～20:05 每 30 分鐘觸發一次（`%USERPROFILE%\.smes-island`），急用時可手動執行
- 人物：`src/world/people.js` 控制老師與學生的隊伍和活動，下雨與入夜會換成撐傘、踩水窪、手電筒、觀星、營火，工具列時間鈕的「雨天」可預覽；`src/world/nav.js` 在載入時由島嶼幾何算出可走地面，改動島上擺設不用另外維護路線
- 登島人次：`src/ui/visits.js` 透過 Firestore 累計，專案 `smes-brand-island`（個人帳號 cagooo@gmail.com），規則在 `firestore.rules`，只允許讀取與加 1；金鑰放 `.env` 與 GitHub Secrets
- 魚：`src/world/life.js` 控制天空的雲魚與小魚群，`src/world/rain-fish.js` 控制島上水池的魚、雨圈與水花，下雨時動作都會變得更活潑
- 小河馬：`src/world/hippo-fx.js` 負責場景特效，`src/ui/hippo.js` 負責卡片、圖鑑與集滿慶祝，名字與台詞在 `src/data/site.js` 的 `HIPPOS`
- 尋寶證書與閱讀挑戰：找到 6 隻「尋寶探險家」、12 隻「尋寶小達人」；第三段「尋河馬達人」要集滿 12 枚章，再通過十二座島各一題的閱讀挑戰（12 題答對 10 題，`src/ui/challenge.js`），到校長室兌換小客人招待券。題目以學校試算表的「題庫」分頁為準（老師可自行新增、停用，說明在「出題說明」分頁），網站透過 `gas/Code.gs` 讀取，連不上時用 `src/data/challenge.js` 的內建題；改內建題後執行 `node scripts/make-seed-gs.mjs` 更新 `gas/Seed.gs`
- 聲音：`src/ui/sound.js` 依天氣與日夜切換配樂與環境音，互動音效用 Web Audio 播放；音檔都在 `public/audio/`，來自 [Pixabay](https://pixabay.com/)，採 Pixabay Content License
  - 配樂：白天 The Wind Awakening Memories of the Forest、夜晚 The Floating Garden of Stars (Dreamy Edit)（CHAse9602，上架者標示為 AI 生成）；陰天 Warm Acoustic（AtlasAudio）；雨天 A rainy day（Tomomi_Kato）；黃昏 Sundowners（MonkeyBandito，Pixabay）；颱風環境音 Strong Wind And Thunder Loop（Fletchpike，Pixabay）。
  - 環境音：Gentle Rain 07（DRAGON-STUDIO）、Night cricket ambience、birds in the morning（freesound_community）
  - 音效：floraphonic、Universfield、DRAGON-STUDIO、paulseling、chrisiex1、Soumages、49053354、freesound_community
- 版本：改版時更新 `package.json` 的 `version` 與 `releaseNotes`（通知卡片的說明）。`vite.config.js` 以提交時間加雜湊產生版本並寫入 `sw.js`，Service Worker 裝好新版後由 `src/ui/update.js` 提示訪客更新

```bash
npm install
npm run dev
```

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5)

<!-- akai-edu-tools:backlink -->

---

## 🔗 阿凱老師教育工具集

這個專案是[阿凱老師教育工具集](https://cagoooo.github.io/Akai/)的 **#134 桃園市石門國小品牌群島**，由桃園市龍潭區石門國民小學阿凱老師開發。

- 工具介紹頁：[https://cagoooo.github.io/Akai/tool/134/](https://cagoooo.github.io/Akai/tool/134/)
- 線上使用：[https://cagoooo.github.io/smes-island/](https://cagoooo.github.io/smes-island/)
- 教學情境文章：[https://cagoooo.github.io/Akai/blog/smes-island-134-reading-brand-sky-city/](https://cagoooo.github.io/Akai/blog/smes-island-134-reading-brand-sky-city/)
- 全部工具（上百個教育工具與原始碼）：[https://cagoooo.github.io/Akai/](https://cagoooo.github.io/Akai/)

想改造成自己的版本？到上面的教學情境文章，按左下角「複製 AI 開發提示詞」，貼給 ChatGPT、Claude、Gemini 等 AI 助手，就能參考這份原始碼開始規劃。
