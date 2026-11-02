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
- 聲音：`src/ui/sound.js` 依天氣與日夜切換配樂與環境音，互動音效用 Web Audio 播放；音檔都在 `public/audio/`，來自 [Pixabay](https://pixabay.com/)，採 Pixabay Content License
  - 配樂：白天 The Wind Awakening Memories of the Forest、夜晚 The Floating Garden of Stars (Dreamy Edit)（CHAse9602，上架者標示為 AI 生成）；陰天 Warm Acoustic（AtlasAudio）；雨天 A rainy day（Tomomi_Kato）
  - 環境音：Gentle Rain 07（DRAGON-STUDIO）、Night cricket ambience、birds in the morning（freesound_community）
  - 音效：floraphonic、Universfield、DRAGON-STUDIO、paulseling、chrisiex1、Soumages、49053354、freesound_community
- 版本：改版時更新 `package.json` 的 `version` 與 `releaseNotes`（通知卡片的說明）。`vite.config.js` 以提交時間加雜湊產生版本並寫入 `sw.js`，Service Worker 裝好新版後由 `src/ui/update.js` 提示訪客更新

```bash
npm install
npm run dev
```

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5)
