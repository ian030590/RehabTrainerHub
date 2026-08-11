# Google 搜尋索引驗證

## 網站與 sitemap 範圍

| App | Canonical 網址 | Sitemap |
| --- | --- | --- |
| Rehab Trainer Hub | `https://trainerhub.cc/` | `https://trainerhub.cc/sitemap.xml` |
| MotorTrainer | `https://motor.trainerhub.cc/` | `https://motor.trainerhub.cc/sitemap.xml` |
| VisionTrainer | `https://vision.trainerhub.cc/` | `https://vision.trainerhub.cc/sitemap.xml` |
| BrainTrainer | `https://brain.trainerhub.cc/` | `https://brain.trainerhub.cc/sitemap.xml` |
| MouthTrainer | `https://mouth.trainerhub.cc/` | `https://mouth.trainerhub.cc/sitemap.xml` |

四個 trainer 使用 `HashRouter`。`#` 後方是同一份 HTML 文件的 app 狀態，不是可提交給 Google 的獨立 URL，因此各 trainer sitemap 只列 canonical 根網址。Hub sitemap 只列公開、可索引並回傳靜態 HTML 的 `/`、`/qa/`、`/privacy/`、`/download/`；`/admin/`、`/progress/`、`/train/` 為 `noindex`，不得加入 sitemap。

## Repository 驗證

先建置全部 app，再執行：

```powershell
npm run build
npm run test:seo
```

`test:seo` 會檢查五個輸出目錄中的：

- UTF-8 `robots.txt` 與同 host 的 absolute Sitemap directive。
- XML sitemap namespace、canonical HTTPS URL、重複 URL 與不適用欄位。
- sitemap 中每頁的輸出 HTML、唯一 title/description、self-canonical、index/follow。
- Hub 私有頁 noindex；trainer 自訂 404 無錯誤 canonical。
- Open Graph、Twitter image 與可 `JSON.parse` 的 JSON-LD。
- Hub `WebSite`／`Organization`／`WebApplication` 和四個 trainer `WebApplication` 的一致 `@id` 關聯。

## 部署後 HTTP 驗證

對上表每個 host 驗證：

1. `/robots.txt` 回 `200` 與 `text/plain`，內容不是 SPA HTML。
2. `/sitemap.xml` 回 `200` 與 XML content type，所有 `<loc>` 都是同 host 的 HTTPS canonical URL。
3. sitemap 每個 URL 最終回 `200`、沒有 `noindex`，原始 HTML 只有一個 self-canonical。
4. trainer 的隨機不存在 path 應回真正 `404` 與 noindex 頁，不可回首頁 shell 的 `200`。
5. `*.pages.dev` 若仍可公開存取，HTML canonical 必須指向正式網域；較強的正式環境設定是只將 production `pages.dev` hostname 以 `301` 導向 custom domain。

## Google Search Console 驗收

1. 使用 `trainerhub.cc` Domain property，提交上表五份 sitemap。
2. Sitemaps report 應顯示 `Success`，並確認沒有 fetch 或 parse error。
3. 對五個首頁與 Hub 公開頁執行「網址審查 → 測試實際網址」；確認 `Crawl allowed = Yes`、`Page fetch = Successful`，且 rendered HTML 看得到主要內容、canonical 與 JSON-LD。
4. 使用 [Rich Results Test](https://search.google.com/test/rich-results) 檢查部署後 JSON-LD。沒有真實 rating/review 時，不虛構資料；`WebApplication` 仍可供 Google 理解實體，但不保證取得 Software App rich result。
5. 索引後檢查 Google-selected canonical 是否等於頁面的 declared canonical。

robots、sitemap 與 Live Test 成功代表 Google 技術上可以抓取與解析，不代表 Google 保證收錄。實作依據：[robots.txt](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt)、[sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)、[structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)。
