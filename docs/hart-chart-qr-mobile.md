# 哈特圖 QR 字表手機直立修正

2026-11-13：手機開啟 QR code 的 `#/hart-chart/display?...` 字表頁時，右側文字超出畫面。

## 原因與修正

手機媒體查詢的 `.hart-chart-grid { width: auto; height: 100%; }` 蓋過字表專用寬度，搭配正方形比例與 Grid 的自動最小尺寸，讓字表依畫面高度擴張。`html`、`body`、`#root` 的既有 `overflow: hidden` 使超出的欄位無法看到。

修正前，Brave 模擬 320 × 568 手機，字表為 552 × 552，從 x=8 延伸到 x=560，右側五欄超出螢幕。新增回歸測試先因文字超出可見範圍而失敗。

`game.css` 新增僅作用於 QR 字表的 `.hart-display .hart-chart-grid-only`：寬度取容器寬度與動態畫面高度扣除上下留白的較小值，高度由正方形比例決定，並移除會壓扁桌機字表的舊高度上限。修正後同尺寸字表為 304 × 304，完整置中顯示十欄。

## 回歸驗證

`scripts/hart-chart-browser.mjs` 從實際 QR 對話框取得網址，在新頁面測量每個字元的 DOM Range 與格子位置，確認 100 字全部位於螢幕與字表內、沒有橫向捲動、字表維持正方形，且改變尺寸與倍率後字表內容相同。

- 畫面尺寸：320 × 568、360 × 800、390 × 844、430 × 932、844 × 390、820 × 1180、1320 × 713。
- 字體倍率：0.65、0.9、1.25、1.45。
- 英文字母與中文字各 28 組，共 56 組；同時走完原有設定、三步教學、全螢幕、提示、解碼、輸入法與成果流程。
- 截圖輸出：`.tmp/hart-chart-validation/qr-display/`。

本機執行方式：

```powershell
npm --prefix apps/rehabtrainerhub/games/hart-chart run build
npm run build:gamerunner
node scripts/check-r2-game-browser.mjs --game hart-chart --standalone --mobile
node scripts/check-r2-game-browser.mjs --game hart-chart --standalone --mobile --chinese
node --test scripts/check-hart-chart-migration.test.mjs scripts/check-hart-chart-tutorial.test.mjs
```

需要安裝 Brave，或以 `BRAVE_BIN` 指定其執行檔。瀏覽器測試已接入 `npm run test:uiux-browser`，由 `.githooks/pre-push` 執行並在失敗時阻擋推送；缺少 Brave 的 Linux CI 不執行。既有哈特圖 Node 測試由 `test:ci` → `test:game-architecture` → `check-self-contained-game.test.mjs` 載入。

實際結果：

- `npm run test:game-architecture`：TypeScript 通過，1,400／1,400 項測試通過。
- `npm run test:uiux-browser`：Hub 建置、12 項原有 Hub 瀏覽器檢查、遊戲與 runner 建置、中英文完整流程及 56 組 QR 尺寸／倍率檢查全部通過。
- 哈特圖兩份 Node 測試獨立執行：18／18 項通過。
- 修改檔案的 `git diff --check` 通過。

首輪完整檢查曾遇到 Windows 選用 WSL 的 `bash.exe` 及 Hub 暫存輸出 `pages-manifest.json` 缺失；前者改以本機既有 Git Bash 執行，後者完整重建後通過。沒有停用或略過測試。

## 人工驗收與限制

1. 電腦開始哈特圖訓練，開啟 QR code，以手機掃描。
2. 手機保持直立，確認每列十字及最右欄完整可見。
3. 旋轉至橫向再轉回直立，確認仍為相同字表且沒有裁切。
4. 分別以英文字母、中文字及不同字體倍率重做。

自動驗收使用本機 Brave 的裝置尺寸模擬；尚未驗證實體手機、Safari 或 iOS。此變更尚未發布至正式 R2。
