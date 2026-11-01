# 桃園市石門國小品牌群島

「鱻鯉鰭源，石門活閱」品牌學校方案的 3D 互動網站。以天空之城浮空島為主題，十二座手作微縮風格的島嶼對應方案各章節，並整合即時天氣、空氣品質、石門水庫水位與校園公告。

- 正式網站：https://cagoooo.github.io/smes-island/
- 技術：Vite + Three.js（幾何全部由程式產生，不需外部 3D 模型）
- 內容：`src/data/content.json` 由 `scripts/build-content.py` 從方案 docx 產生；群島結構與文案在 `src/data/site.js`
- 公告：`.github/workflows/update-news.yml` 每 30 分鐘抓取校網公告，寫入 `live-data` 分支

```bash
npm install
npm run dev
```

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5)
