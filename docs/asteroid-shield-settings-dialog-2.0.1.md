# 小行星護盾防衛 2.0.1 設定視窗發布審查

狀態：已取得擁有者精確核准、發布 R2 並通過正式驗收。正式 current 為 `2.0.1`，`2.0.0` 保留且實際檔案雜湊已核對。完整結果見 [正式發布收據](releases/asteroid-shield-2.0.1.json)。

設定改為原生置中 modal 視窗，底層先呈現遊戲說明的星空、飛船、護盾與小行星。確認設定後才啟動教學導覽；返回設定沿用相同場景及設定值。鍵盤焦點留在視窗內，資源載入失敗提示亦顯示於視窗內。保留滑鼠／觸控、原有教學、Pixi、全螢幕、成果與保存重試流程。

## 精確候選

| 項目 | 值 |
| --- | --- |
| 遊戲／版本 | `asteroid-shield@2.0.1` |
| contentSha256 | `18ecaab02f25132616a066bd24ac1de1f6e8d8f999e4e07e9788f8f196c7b1a3` |
| 檔案／容量 | 12 檔／1,215,791 bytes |
| 原預覽圖 SHA-256 | `48580bdf2930ce1af7f9e71a8b3f29f294a7a61a0179e646f15ad61cca457a98` |
| 發布狀態 | 已上傳並回讀核對 R2，current 已切換 `2.0.1` |

逐檔大小、雜湊與驗證摘要見 [候選清單](migrations/asteroid-shield-2.0.1-candidate.json)。公開文案、分類、作者及預覽圖沿用已核准版本。

## 畫面

- [桌機設定視窗](migrations/asteroid-shield-2.0.1/desktop-settings.png)
- [手機設定視窗](migrations/asteroid-shield-2.0.1/mobile-settings.png)
- [英文設定視窗](migrations/asteroid-shield-2.0.1/english-settings.png)
- [載入失敗提示](migrations/asteroid-shield-2.0.1/renderer-error.png)

## 測試先行與驗證

先以實際 Brave 使用者流程確認舊版沒有設定後方的教學場景，測試因「Render the tutorial scene before configuring the game」失敗；再修改 UI。鍵盤往返測試揭露 iframe 焦點會移出視窗，修正 Tab／Shift-Tab 邊界後通過。另先阻斷飛船材質，重現錯誤提示被 modal 遮住，再將提示移入視窗，確認錯誤可見且成果紀錄為零。

以下命令均在最終上述摘要的候選上通過：

```sh
npm --prefix apps/rehabtrainerhub/games/asteroid-shield run build
npm run test:entrypoints
npm run test:game-architecture
npm run test:naming
npm run build:hub
node scripts/publish-official-game.mjs asteroid-shield --dry-run
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby --mobile
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby --english
node scripts/check-r2-game-browser.mjs --game asteroid-shield --standalone --mobile
node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby --renderer-failure
```

架構檢查包含全部遊戲 TypeScript 與 29 項回歸；Hub 建置 39 tasks 通過。瀏覽器使用固定 Hub 輸出副本 `HUB_OUTPUT_ROOT=.tmp/asteroid-hub-ea21aa905a95`，遵循正式 sandbox／CSP。桌機 752×485、手機 390×844、英文與獨立手機 PWA 均完成設定往返、三步教學、真實遊戲、原生全螢幕、完整成果與返回；Hub 流程另驗證保存失敗重試後只寫入一筆。本機 SQLite 承接所有測試成果，沒有建立正式紀錄。

## 發布要求與限制

[R2 搬遷計畫第 7 節步驟 E](r2-game-migration-plan.md) 要求「明確核准精確 version／contentSha256 後才執行發布」。擁有者於 2026-10-09 回覆「核准發佈，並且將設定畫面的UI呈現方式寫入搬遷計畫」，核准本頁精確版本／摘要。再次 dry-run 核對相同 bytes 後，官方 CLI 逐檔上傳／回讀，最後發布 manifest 及切換 current。發布前本機 `index.html` 被同步工具改名為 `index [conflicted 2].html`；核對其原 bytes SHA-256 完全相同後恢復名稱，沒有更改發布清單或任何產品 bytes。

正式 R2 新舊兩版的所有 bytes、runner 的 12 檔 HTTP／Content-Type／CSP、穩定入口 302／no-store、公開目錄唯一 slug／分類／原圖及 versionless session 均通過。瀏覽器另完成：

```sh
node scripts/check-r2-game-browser.mjs --game asteroid-shield --production-hub --lobby
node scripts/check-r2-game-browser.mjs --game asteroid-shield --production-hub --lobby --mobile
node scripts/check-r2-game-browser.mjs --game asteroid-shield --remote --lobby --english
node scripts/check-r2-game-browser.mjs --game asteroid-shield --remote --standalone --mobile
```

正式 Hub 靜態頁與遊戲 bytes 直接讀真實部署，只有 `/api/*` 攔至本機 handler／SQLite；每個 Hub 流程保存失敗重試後一筆，沒有建立正式成果。真實正式 session 僅確認選定 `2.0.1` 與核准摘要，未送出成果，收據不包含 token。既有 Pages 已支援此格式；本次公開遊戲不需等待新版 Hub 才能生效。

尚未驗證實體 Safari／iOS、實際安裝圖示操作與長時間完全離線使用。MediaPipe／相機不在此次範圍。
