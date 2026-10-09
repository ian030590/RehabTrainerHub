# R2 遊戲成績頁

三款遊戲的成績頁參考移動卡片訓練的資訊層次，加入主要統計、可切換指標的逐回合趨勢、平均參考線、平均數／中位數／樣本標準差／範圍、資料完整率及逐回合明細。圖表與表格共用每頁 50 筆的分頁；切換指標回到第一頁。桌機保留三欄主要統計，600 px 以下窄視窗使用直列大字與放大的圖表標記，長表格在自己的區域內橫向捲動；手勢對戰沿用既有橫向手機流程。

設定、教學、引擎、成果、重試保存及返回 UI 仍由每款遊戲自己的 R2 套件呈現。沒有加入平台／跨遊戲依賴、圖表套件、外部資源或 Hub 成績頁。Hub 的固定版本 session、私有 MessageChannel、原數值成果 schema、嚴格 sandbox 與 runner CSP 沿用既有流程。手勢對戰仍在結算停止相機與模型。

| 遊戲 | 主要統計 | 圖表／逐回合單位 |
| --- | --- | --- |
| 畫畫塔防 | 擊敗敵人／生成數、剩餘耐久、活動時間 | 每個敵人的生成至結局時間及擊敗數值（1／0），保留原目標形狀 |
| 小行星護盾防衛 | 分數、剩餘耐久、攔截／生成數 | 每個物件結局的時間、傷害、耐久、速度級別與累積分數；保留物件類型、結局、生成時間及操作方式 |
| 手勢指令對戰 | 成功施放、中斷維持次數、活動時間 | 每次成功施放的相似度、活動累計時間及對手耐久；保留施放／指定手勢與五種手勢彙總 |

手勢彙總與逐次施放原本一起存於成果 rounds；圖表只讀 kind=1 的施放，避免把 kind=0 的五種手勢彙總混作回合。畫畫塔防與手勢對戰以遊戲自己的 BuildGameScore 同時供呈現與私有 port 保存使用，保留原欄位及數值。小行星護盾沿用原 BuildGameScore。沒有另創反應時間或虛構得分；護盾分數明確標示為累積分數，施放時間明確標示為活動累計時間。

## 精確版本與發布狀態

以下版本與完整 contentSha256 於 2026-10-09 經擁有者回覆「核准並且將這個成績結算頁面的要求寫在遷移計畫中」核准，已依序發布並切換 R2 current。成績頁要求已加入[遷移計畫](r2-game-migration-plan.md)第 7 節步驟 B／D 與第 11 節逐遊戲審查單。

| 遊戲 | 發布版本 | contentSha256 | 已核對回退版 |
| --- | --- | --- | --- |
| drawing-defense | 2.0.4 | `5b5ac8c06e408293743112ea364dee1488b6fe0f9cb5d98c166ff1733b0adb8c` | 2.0.3 |
| asteroid-shield | 2.0.3 | `9d62f9eec8e0e98d5fdbfd02a67c9373cde5606fc649e47f2209f70a0d428f55` | 2.0.2 |
| gesture-battler | 2.0.1 | `e3cbd84ec1aa31dcdd7a6456a95e4528889f6734dab373c871c6d3e6563134e4` | 2.0.0 |

完整檔案清單、核准、正式 API／瀏覽器驗收與回退證據見正式收據：[drawing-defense-2.0.4](releases/drawing-defense-2.0.4.json)、[asteroid-shield-2.0.3](releases/asteroid-shield-2.0.3.json)、[gesture-battler-2.0.1](releases/gesture-battler-2.0.1.json)。[原候選登記](migrations/r2-game-results-candidate.json)保留核准的精確摘要及完成狀態。既有版本保留，不覆寫 R2 檔案；平台已相容，本次沒有重部署 Hub 或 runner。

## 測試先行與回歸

新增測試的首次執行為 11 項失敗：畫畫塔防／手勢對戰缺少成績分析元件及共用成果投影，小行星護盾缺少圖表／明細共同分頁、明細區與累積分數分析。產品實作後 11 項全通過，包含雙語、0／null 區別、空資料、單筆樣本標準差、缺漏折線斷點、51 筆分頁、切換指標歸零及手勢彙總隔離。

- `npm run test:game-architecture`：全部遊戲 TypeScript、原架構／自包含／Publisher 測試與 11 項新增成績測試（53 項）通過。
- `npm run test:entrypoints`：入口、設定／完成／返回、i18n、成果 schema 與平台通訊回歸通過。
- `npm run test:naming`：通過。
- 三款遊戲各自的 `npm --prefix apps/rehabtrainerhub/games/{gameId} run build`：通過。
- `npm run build:hub`：38 個 workspace 成功，37 款舊遊戲被打包，三款 R2 遊戲維持入口連結；產物架構與 SEO 檢查通過。
- 三款 `node scripts/publish-official-game.mjs {gameId} --dry-run`：檔案、資源引用、目錄宣告、預覽圖與摘要驗證通過；未連線 R2。

以下本機 Brave 流程通過，均使用目前表列精確候選的 dist。每個模式都核對主要統計、圖表切換、逐回合表格、無頁面水平溢出及原返回入口。Hub 模式核對保存失敗／重試／單筆 SQLite 紀錄，獨立 PWA 模式核對無帳號寫入及版本快取。

| 遊戲 | 通過模式 |
| --- | --- |
| drawing-defense | `--lobby`、`--lobby --mobile`、`--standalone` |
| asteroid-shield | `--lobby --english`、`--lobby --mobile`、`--standalone`；原桌機中文版完整流程亦通過 |
| gesture-battler | `--lobby --english --directed`、`--lobby --mobile`、`--standalone`；原桌機中文版完整流程亦通過 |

可重現命令：先各自 build 遊戲，再設定 `HUB_OUTPUT_ROOT` 指向固定 Hub output，執行 `node scripts/check-r2-game-browser.mjs --game {gameId} {mode}`。最後幾個大廳模式使用 `.tmp/r2-results-hub-output/`，副本來自既有 `.tmp/gesture-hub-output/`；三款 Hub 入口核對只含導向 R2 的 index.html。直接讀可變 out 的首次英文測試因根 index.html 缺檔而逾時，改用固定副本後通過；未將缺檔視為遊戲產品失敗。

本機流程使用真實 runner Functions／CSP、私有通訊與 SQLite；不建立正式紀錄。手勢來源為既有圖片串流，驗證實際 MediaPipe 推論、校正、對戰及結算清理，不宣稱完成實體相機或 Safari／iOS 硬體驗收。

## 正式發布與驗收

三款發布前再比對核准摘要；本機 `index.html` 曾被同步工具改為 conflicted 名稱，按既有逐檔 SHA-256 確認相同內容後恢復原檔名並備份，沒有改動發布 bytes。既有 OAuth 到期由 Wrangler 更新；未公開憑證。Publisher 上傳並回讀所有檔案，最後發布 manifest、切換 current 與回讀官方歷史。

正式站直接驗證三款 `/api/games` 的唯一 slug、分類／雙語資料／同版本預覽圖與摘要；每個套件檔案 HTTP 200、Content-Type、實際 SHA-256 及嚴格 CSP；穩定入口 302／no-store、版本化 PWA manifest／SW scope、Hub 相容入口與舊子資產 410／no-store。不指定版本的正式 session API 均回覆 201 及當版摘要，token 不輸出或寫入收據，沒有提交正式成果。各款回退版本仍 approved、在官方歷史中，且 manifest 與所有公開檔案 SHA-256 通過核對，沒有實際回退。

三款使用 `node scripts/check-r2-game-browser.mjs --game {gameId}` 通過 `--remote --lobby`、`--production-hub --lobby`、`--production-hub --lobby --mobile` 與 `--remote --standalone`。小行星護盾另通過正式 Hub `--lobby --english`，手勢對戰另通過 `--lobby --english --directed`；兩者同時帶 `--production-hub`。

正式 Hub 模式讀取真實部署靜態頁與新版 R2，僅將 `/api/*` 攔到本機測試 API／SQLite，驗證自有設定／教學／真實玩法／主要統計／圖表切換／完整明細／首次保存失敗與重試／單筆入庫／返回大廳。這些 fixture 不代替上段正式 API 直接核對。獨立 PWA 保留原返回入口，沒有帳號紀錄寫入；手勢結算與退出均清理相機及模型。

Brave 桌機與手機觸控模擬通過；本版沒有另外跑平板尺寸，後續遷移須依新增審查單提供該證據。實體裝置、Safari／iOS、長時間離線與真人相機仍未驗收。

| 遊戲 | 正式桌機主要統計 | 正式桌機圖表 | 正式桌機逐回合 | 正式手機圖表 |
| --- | --- | --- | --- | --- |
| 畫畫塔防 | [畫面](migrations/r2-game-results-ui/production/drawing-defense/desktop-results.png) | [畫面](migrations/r2-game-results-ui/production/drawing-defense/desktop-results-analysis.png) | [畫面](migrations/r2-game-results-ui/production/drawing-defense/desktop-results-details.png) | [畫面](migrations/r2-game-results-ui/production/drawing-defense/mobile-results-analysis.png) |
| 小行星護盾防衛 | [畫面](migrations/r2-game-results-ui/production/asteroid-shield/desktop-results.png) | [畫面](migrations/r2-game-results-ui/production/asteroid-shield/desktop-results-analysis.png) | [畫面](migrations/r2-game-results-ui/production/asteroid-shield/desktop-results-details.png) | [畫面](migrations/r2-game-results-ui/production/asteroid-shield/mobile-results-analysis.png) |
| 手勢指令對戰 | [畫面](migrations/r2-game-results-ui/production/gesture-battler/desktop-results.png) | [畫面](migrations/r2-game-results-ui/production/gesture-battler/desktop-results-analysis.png) | [畫面](migrations/r2-game-results-ui/production/gesture-battler/desktop-results-details.png) | [畫面](migrations/r2-game-results-ui/production/gesture-battler/mobile-results-analysis.png) |

## 截圖

畫面為本機真實遊戲流程的數值，不是設計 mock。畫畫塔防使用短時間測試，因此少量回合；手勢對戰手機畫面維持既有橫向模式。

| 遊戲 | 桌機主要統計 | 桌機圖表 | 桌機逐回合 | 手機圖表 |
| --- | --- | --- | --- | --- |
| 畫畫塔防 | [查看](migrations/r2-game-results-ui/drawing-defense/desktop-results.png) | [查看](migrations/r2-game-results-ui/drawing-defense/desktop-results-analysis.png) | [查看](migrations/r2-game-results-ui/drawing-defense/desktop-results-details.png) | [查看](migrations/r2-game-results-ui/drawing-defense/mobile-results-analysis.png) |
| 小行星護盾防衛 | [查看](migrations/r2-game-results-ui/asteroid-shield/desktop-results.png) | [查看](migrations/r2-game-results-ui/asteroid-shield/desktop-results-analysis.png) | [查看](migrations/r2-game-results-ui/asteroid-shield/desktop-results-details.png) | [查看](migrations/r2-game-results-ui/asteroid-shield/mobile-results-analysis.png) |
| 手勢指令對戰 | [查看](migrations/r2-game-results-ui/gesture-battler/desktop-results.png) | [查看](migrations/r2-game-results-ui/gesture-battler/desktop-results-analysis.png) | [查看](migrations/r2-game-results-ui/gesture-battler/desktop-results-details.png) | [查看](migrations/r2-game-results-ui/gesture-battler/mobile-results-analysis.png) |
