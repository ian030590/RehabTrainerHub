# 蓋伯斑塊玩家文案 2.0.1

2026-10-17 依本對話「核准發佈」發布 `gabor-patching@2.0.1`，R2 current 已切換，正式 API 與瀏覽器驗收完成。收據見 [gabor-patching-2.0.1.json](releases/gabor-patching-2.0.1.json)。

- 精確 `contentSha256`：`af68e6dff786e033e99bc9c311bdb6a3700efd08a6386b1cf268da2d53ee79e3`，五檔／1,157,371 bytes。
- 移除中英文教學與成果的「活動紀錄／非臨床量測」、教學圖樣的內部實作說明及設定只用於當次活動的冗餘文字。操作、計分、設定、完整數值、取消與保存／重試提示保留。
- CSS、目錄宣告與預覽圖 bytes 與 2.0.0 相同。只更新遊戲 JavaScript 與其 HTML 資產引用；package／lockfile 同步為 2.0.1。
- 未重新部署 Hub／runner，未建立正式帳號或訓練紀錄；其餘六款 R2 遊戲與眼動 2.1.1 保持原版本。發布後依「git 推送出去」授權，以 `fix/oculomotor-2.1.1` 專用分支交付原始碼與收據，避免 `main` 的完整 Pages 部署。

## 驗證

既有版本中繼資料測試先改為期待 2.0.1，因 package 仍為 2.0.0 產生預期失敗；同步 package 與 lockfile 後，同一測試通過。文案調整前既有 Gabor 11 項測試通過；調整後完成本機中英文教學／成果截圖檢查、完整手機 PWA 與英文 Hub 流程。發布套件另直接檢查 JavaScript 不包含移除的文字。

發布前七項本機 gate 均通過：`test:naming`、`test:pwa`（18）、`test:game-architecture`（197）、`test:hub-functions`（121）、`test:gamerunner`（49）、`test:entrypoints` 與 `test:cloudflare-deploy`（4）。Gabor build、Publisher dry-run 通過；Hub build 已在上一回合針對相同文案完成，之後只有被 Hub 排除的 R2 遊戲版本中繼資料與測試期待值更新。沒有新增或改變 CI matrix。

首次 runner gate 的 esbuild 被沙盒拒絕讀檔，沙盒外同命令通過；首次唯讀 Cloudflare 預檢回覆 403，以 Wrangler 更新既有登入後重驗通過，未改產品程式碼迴避失敗。

正式驗證直接比對五檔公開 bytes／SHA-256、R2 approved manifest／current／歷史、公開目錄分類與預覽圖、未指定版本 session、穩定 PWA 入口、嚴格沙盒、舊設定 410／no-store，以及兩站部署未變更。

以下每個流程都執行真實 30 秒訓練，涵蓋設定、三目標教學、全螢幕、成果統計／圖表／明細、退出及返回；Hub 流程另驗保存失敗重試與本機單筆保存。正式 Hub／R2 直接讀取；帳號與寫入 API 攔截至本機 SQLite。

| 正式流程 | 參數（共同前綴：`node scripts/check-r2-game-browser.mjs --game gabor-patching`） | 結果 |
| --- | --- | --- |
| 桌機 Hub | `--production-hub --lobby` | 通過 |
| 手機 Hub | `--production-hub --lobby --mobile --medium --session-failure` | 通過；含 session 重試 |
| 英文登入 Hub | `--production-hub --lobby --signed-in --english --hard --sound-on` | 通過；含帳號隔離及實際 WebAudio |
| 手機獨立 PWA | `--remote --standalone --mobile --medium` | 通過；版本 scope 與實際快取檔案正確 |

完整命令、檔案摘要與截圖位於 [驗收摘要](migrations/gabor-patching-player-copy-2.0.1/validation-summary.json) 與 [正式 API／bytes 核對](migrations/gabor-patching-player-copy-2.0.1/production-verification.json)。玩家文案可見 [中文手機成果](migrations/gabor-patching-player-copy-2.0.1/hub-mobile/results.png) 及 [英文教學](migrations/gabor-patching-player-copy-2.0.1/hub-english/tutorial-score.png)。

## 回退與限制

發布前已逐檔回讀核對核准的 `2.0.0` manifest 與五檔 R2 bytes；兩版均保留於官方歷史。需要時以 `node scripts/publish-official-game.mjs gabor-patching --activate-version 2.0.0` 回退 current；本次未實際回退。

手機與觸控使用 Brave 模擬；未驗實體觸控、小喇叭、Safari／iOS 或長時間完整離線訓練。
