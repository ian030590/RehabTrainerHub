# Google 搜尋索引驗證

## Canonical 與 sitemap

唯一公開可索引網站是 `https://trainerhub.cc/`，唯一 sitemap 是
`https://trainerhub.cc/sitemap.xml`。Hub sitemap 僅列公開且有實質靜態內容的頁面；
`/admin/`、`/progress/`、`/train/` 與 `/games/*` 不加入 sitemap；退役的
`/runtimes/*` 也不得重新發布或加入 sitemap。

`motor.trainerhub.cc`、`vision.trainerhub.cc`、`brain.trainerhub.cc`、
`mouth.trainerhub.cc` 已退役，任何 path 都應 301 到 `https://trainerhub.cc/`，
不得再提供 sitemap、canonical 或可索引 HTML。

## 驗證

```powershell
npm run build:hub
npm run test:seo
```

部署後確認：

- Hub `/robots.txt` 與 `/sitemap.xml` 回 200，內容不是 HTML 錯誤頁。
- sitemap 每個 URL 回 200，只有一個 self-canonical 且沒有 `noindex`。
- 首頁原始 HTML 含繁體中文 title、H1、description、Open Graph 與可解析 JSON-LD。
- 四個退役 hostname 的任意路徑回 301，`Location` 為 `https://trainerhub.cc/`。
- Search Console 的 `trainerhub.cc` Domain property 只提交 Hub sitemap；移除四個舊 sitemap。

robots、sitemap 與 Live Test 成功只代表可抓取，不代表 Google 保證收錄。
