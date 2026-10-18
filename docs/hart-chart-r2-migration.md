# 哈特圖訓練 R2 搬遷審查單

狀態：**2026-10-18 已依擁有者「核准，並請git push」核准以下精確版本／摘要，完成 R2 發布／current、Hub 切換及正式驗收**。五檔 bytes、正式 API／不指定版本 session、九項 Hub／PWA 瀏覽器流程通過；正式為十款 R2／30 款舊流程，其他九款 current 不變，沒有建立正式帳號或訓練紀錄。來源 `f8f5ccb9` 已推送至 `feat/hart-chart-r2`，[七項 CI 全部成功](https://github.com/ian030590/RehabTrainerHub/actions/runs/39106286245)；Hub 部署 `7ab7e21e`，runner 沿用相容的 `56fca01e`。見[核准紀錄](migrations/hart-chart/approval.json)、[正式收據](releases/hart-chart-2.0.0.json)與[正式驗收摘要](migrations/hart-chart/production/acceptance-summary.json)。

| 項目 | 審查內容 |
| --- | --- |
| gameId／slug | `hart-chart` |
| 正式版本 | `2.0.0` |
| contentSha256 | `67708380ebf0d31eefef4f0ff3070bc2fdc370c03478db6f2e206b4d45470aec` |
| 檔案 | 5 檔，653,656 bytes；[逐檔候選清單](migrations/hart-chart/candidate.json) |
| 原碼基準 | `aeff24a1d2e8e94545446fa7a977686dd77a4171`；原設定／成果 JSON 保存在 `scripts/fixtures/hart-chart/` |
| 原演算法 | `logic/hartChart.ts` 完全保留；LF 正規化 SHA-256 `d76e529b7e6e4d657b292f0dd3b846f7c2201cd2e59af17767215ca11130e736`，測試核對 |
| 原圖 | 遊戲 `public/preview.webp` 與原 Hub 圖 bytes 相同，SHA-256 `34ac8108c3729823fa68e7af8c806a9f67fd0ec45ea40e7282140eeb3ae85ea6` |
| 分類／文案 | `vision`／`vision`；`public/game.json` 保留原中英文名稱、說明，作者「居家訓練網」 |
| 設定 | 要求解碼字母數：預設 10、5–30、步長 5；視標大小：大／中／小，預設中，縮放 1.25／1／0.75 |
| 原成果 | summary 與單次完成 round 均保留 `durationMs`、`targets`、`attempts`、`accuracy`、`hints`；提示代表結束時開關，正確率仍為四捨五入的目標數／輸入次數 |
| 能力 | audio／fullscreen／keyboard／pointer／settings-storage／touch；沒有相機、麥克風、Worker、下載或外連 |

## 自有設定、聚光燈與成果

設定使用遊戲自有原生 modal dialog，背景先顯示字母表、座標解碼範例及工具列；確認前不計時、不計分、不啟動導覽。保留 Enter 驗證、Tab 焦點、返回與手機內部捲動。設定由容器保存至裝置，遊戲經私有 port 還原並驗證；不讀寫 localStorage。

確認後依序聚光字母表、座標解碼框、輔助工具，採畫畫塔防相同的遊戲自有 tour 行為：下一步、略過、返回設定、Escape、焦點循環、resize 跟隨及完整清理。圖表本身是聚光目標，避免照亮整個空欄；說明框與目標不重疊。最後顯示參數確認，最後一次開始點擊才要求原生全螢幕，等待後才啟動原 jsPsych 外部生命週期。

保留原 10×10 seeded 字母表、原暗號、座標、字母自動大寫與下一格聚焦、縮放 0.65–1.45、解碼器開關、提示、拖曳停靠、方向鍵停靠、重設字母與計時。解碼器停靠經容器設定訊息保存；新 key 不直接讀取舊 Hub 的 dock storage。新版開始時先打開解碼器，避免玩家找不到輸入位置。

QR 依目前 seed／scale 生成，連至同版本套件的 `#/hart-chart/display?...`，直接顯示同一張字母表。原程式產生此路徑但沒有安裝對應 route，新版補齊實際顯示入口；沙盒禁止彈出視窗，因此預覽改為 QR dialog 內呈現，QR 掃描仍可在另一裝置開啟。瀏覽器測試開啟實際分享網址，逐字核對 100 個字母相同；產生失敗有可見提示。

成果顯示主要數值、當次設定、原解碼句子及全部五項數值；可切換指標的圖表、平均線、樣本標準差、缺漏／完整率、單次解碼明細及保存重試。原本只記一列完成解碼，沒有虛構逐字反應時間。句子只顯示於遊戲，不送入數值成果或身份欄位。Hub 只有一個返回大廳按鈕；獨立 PWA 返回自身設定，不會一直顯示保存中。

依搬遷計畫保留遊戲自有 `tone@15.1.22`、soundManager 與空背景譜面。原訓練沒有提示音，新版維持安靜；設定／教學不播放。使用受 CSP 支援的 timeout context，結算、取消、退出、pagehide 與卸載均清理。

## 舊投稿、平台接線及回退

正式公開 `/api/games` 與 D1 唯讀 SELECT 均核對為 `official-hart-chart`／`rel-hart-chart-1.0.0`，原分類 `general`，摘要 `1761ad2a1b1de91bf24501cc39e2a1f2388fcc00014ed58921fbad120763d53c`。保留歷史資料並加入相同 slug 碰撞 fixture，R2 current 成為唯一卡片來源；[D1 證據](migrations/hart-chart/legacy-catalog-d1.json)。首次 Wrangler 查核選到不具權限帳號（7403），隨後以既有 OAuth 列出授權帳號並依既定 database ID 選對帳號完成查核，沒有更動任何憑證或資料。

本機 registry 加入 Hart，catalog 讀自有 game.json；sync 與 lockfile 移除 Hub 的遊戲依賴。Hub build 已排除其 JS／CSS bundle 及兩份 JSON，只保留 R2 PWA 連結入口。Hub API／session／SQL 冪等、同名目錄、middleware、runner 穩定入口與撤回、裝置設定、成果統計、研究契約及流程測試均加入此 gameId。舊成績 fixture 改用未遷移的 every-ball-response，另驗 Hart 無簽章舊路徑必須拒絕。新增兩份測試由既有 self-contained 測試引入，沿用兩份 workflow 的七項 matrix／原命令，沒有新增 Brave CI。

目前正式 Hub 部署 `4a27cfb9-bf6b-4a98-bf8d-e98caf8c353f`、runner `56fca01e-67a6-4bbf-a24d-cce839752f15`，來源 `4a278a358a316f89b6313aa60b2fbdbad1a4c12a`；[唯讀回退目標](migrations/hart-chart/rollback-target.json)。已從正式站逐檔核對舊入口、其 JS／CSS、設定及成果 JSON 的 HTTP 200／bytes／SHA-256，見[五檔回退摘要](migrations/hart-chart/legacy/bytes.json)。另以全新 Brave profile 重跑正式舊版設定→規則→100 格字母表／10 個座標輸入框，保存[基準截圖與驗收](migrations/hart-chart/legacy/)，全程阻擋 records API 並在完成前停止。首次新格式沒有另一個核准 native 回退版，不能用 activate-version 回到舊 JSON `1.0.0`。回退應只恢復 Hart 的原 Hub registry／依賴／產物與流程，保留其餘九款 R2；沒有實際執行回退或撤回。

## TDD 與本機驗收

| 先失敗的情境 | 原因與修正後結果 |
| --- | --- |
| 新遷移測試 1／4 通過、教學測試 0／4 | 舊演算法通過，但缺自有 settings／score／bridge／tour，套件仍為 1.0.0；實作後通過 |
| 桌機聚光範圍測試失敗 | 聚光整欄留白，改成實際字母表方形目標 |
| 平板目標尺寸測試失敗 | 目標 374px、字母表 420px；明確綁定方形容器與圖表寬高後通過 |
| 舊 storage 檢查與架構回歸失敗 | 改用容器保存停靠設定，補上自有 Tone 介面與測試映射，保留既有檢查強度 |
| Browser QR 分頁與座標讀取腳本失敗 | 等待新分頁 execution context、修正 template literal 中的正規式跳脫；重新驗證通過 |

七項 gate 均通過：naming、PWA（18）、game-architecture（294，包含全遊戲 TypeScript）、Hub Functions（133）、runner（55）、entrypoints、Cloudflare deploy dry-run；遊戲 build、Hub build／SEO／輸出架構與 diff whitespace 檢查通過。另完成 `test:game-architecture:browser` 七項本機 Brave 平台回歸，涵蓋手機篩選、單一目錄、舊遊戲設定與引擎、共用成績訪客／登入保存、44px 操作目標，以及 320／390／768／1024px 四路由導覽。測試日誌見 [tests](migrations/hart-chart/tests/)。建置工具初次因 Windows sandbox 無法讀取父層而失敗，以正常建置權限重跑成功。

| Brave 流程 | 結果 |
| --- | --- |
| `--lobby --wide --windowed` | 1320×713，離開原生全螢幕後完整解碼、保存失敗重試、回大廳 |
| `--lobby --mobile --session-failure` | 390×844，建立 session 失敗不掛 iframe，可重試；觸控全流程 |
| `--lobby --tablet --hard --small` | 820×1180，30 字母、小視標、完整解碼與成果 |
| `--lobby --signed-in --english --hard` | 英文教學／成果、30 字母、本機帳號與訪客身份隔離 |
| `--standalone --mobile` | 獨立 PWA 全流程、不上傳成果 |
| `--standalone --tablet --stop` | 取消後退出全螢幕並回設定、不保存 |
| `--lobby --revoke` | 本機撤回 fixture 卸載並拒絕保存，沒有正式撤回 |
| `--lobby --settings-memory`／`--standalone --settings-memory` | 確認後容器保存，重新整理還原；遊戲 storage 存取仍被禁止 |

各完整流程驗真實原生 fullscreen root、100 個字母與設定目標數、錯字多一次計次、提示／縮放／停靠、實際 QR 分享、全五欄成績、固定版本保存與單筆 SQLite 寫入。桌機／手機／平板 Hub 背景捲軸寬均為 0，iframe 左右邊距相同；gameplay 根頁無溢出，返回還原原捲動位置。所有帳號與成果僅在本機 SQLite；沒有建立正式帳號或紀錄。

截圖：[桌機設定](migrations/hart-chart/screenshots/desktop-settings.png)、[桌機聚光燈](migrations/hart-chart/screenshots/desktop-tutorial.png)、[手機教學](migrations/hart-chart/screenshots/mobile-tutorial.png)、[手機玩法](migrations/hart-chart/screenshots/mobile-gameplay.png)、[完整成績](migrations/hart-chart/screenshots/desktop-results.png)。

## 正式發布與驗收

依搬遷計畫第 7 節 E，先核對擁有者核准的精確版本／摘要與既有九款基準，推送專用分支並完成七項 CI；以正式公開設定重建 Hub 並固定 807 個輸出檔。確認 R2 五檔與 manifest 回讀、current 及真正手機 PWA 通過，且舊 Hub 設定仍為 HTTP 200 後，才以固定輸出部署 Hub。本次 runner 格式／能力無產品變更，正式 R2 與 PWA 實測證明現有 launcher 相容，沒有重部署 runner 或更改其 bindings。

正式公開 API 只列一個 `hart-chart@2.0.0`，分類 `vision`，不再附通用 settingsUrl；不指定版本的 session 為 201 並綁定核准摘要（token 不保存至證據）。逐檔下載核對 HTTP 200／Content-Type／SHA-256／CSP，穩定入口 302／no-store；舊 settings／score／JS／SW 回 410。其他九款 API current 的 version／digest 逐筆與發布前比對相同。見[正式 API 與 bytes](migrations/hart-chart/production/production-verification.json)。

九項正式 browser 均通過：Hub 桌機視窗、手機 session 失敗重試、平板 30 字母小視標、英文登入 30 字母；獨立手機 PWA 完成、獨立平板 PWA 完成／停止；Hub 與手機 PWA 的設定保存／還原。四項 `--production-hub` 及 Hub 設定記憶讀取真正部署頁面與 R2，僅將 `/api/*` 攔至本機 SQLite；PWA 直接讀真正 runner／R2。驗證碼只在此本機 fixture 模擬，正式防護保持啟用。完整[驗收 metadata、日誌與截圖](migrations/hart-chart/production/browser/)；沒有正式帳號或成果寫入。

本機 OAuth 於發布前失效，透過 Wrangler 既有登入自動更新後才發布，沒有變更憑證設定或記錄秘密。發布 bytes 全程未修改。測試日誌另轉為 UTF-8 供 Git 檢閱，不影響核准產物。

未驗收：實體手機觸控、實體音訊、跨實體裝置 QR 掃描、Safari／iOS、長時間完整離線，以及正式舊版完成／保存（刻意阻擋正式寫入）。手機／平板為 Brave 模擬，不代表實體硬體驗收。正式回退或撤回均未執行。
