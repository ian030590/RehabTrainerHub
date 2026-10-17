# 閱讀訓練（RSVP）R2 搬遷

狀態：**2026-10-17 已依擁有者「核准並發布到 R2」發布 `2.0.0` 至 R2 並切換 current；Hub 尚未切換**。R2 回讀、穩定入口、五檔公開 bytes 與真實 R2 的 Brave 流程通過，見[正式收據](releases/reading-training-2.0.0.json)。未部署 Hub／runner、未推送 `main`、未建立正式紀錄；正式 Hub 仍走舊 `1.0.0` JSON 流程（`/api/games` 仍列舊投稿、`settings.json` 200），正式數量仍為七款完成切換。候選 registry 已登記八款，Hub build 只剩 32 款舊 bundle，因此**在核准版本與 current 可讀之前，不得把這個分支部署到正式 Hub**（否則舊入口會 410、新入口尚無 current）。

| 項目 | 值 |
| --- | --- |
| gameId／slug | `reading-training` |
| 候選版本 | `2.0.0`（舊 JSON 套件版本為 `1.0.0`，不加入官方新格式歷史） |
| contentSha256 | `2876f30409adf5f5c31e400431256b2737a977e8fb1d098a56123393941fe6b0` |
| 檔案 | 5 檔、1,204,453 bytes，逐檔清單見 [candidate.json](migrations/reading-training/candidate.json) |
| 原碼基準 | `663091e812076b0e8fd20401b281efab6e092541`；原設定／成績契約凍結於 [legacy fixture](../scripts/fixtures/reading-training-legacy.json) |
| 分類 | 原 catalog `vision/vision`，未改；雙語名稱／描述原文保留；作者「居家訓練網」 |
| 原圖 | 原 `assets/training-modules/reading-training.webp` bytes，SHA-256 `a4e3de855637556467ae4c7c1b5a1d2f5479c2fc09e3f9cce0c23d534ed38cb4` |

## 保留的行為

| 項目 | 內容 |
| --- | --- |
| 設定 | 文章 0–3（0＝隨機）、呈現速度 60–600 步長 20（預設 240 片段／分）、每批片段 100–500% 步長 100、文字對比 20–100% 步長 10；預設與舊 `settings.json` 相同 |
| 換算 | `wps = 速度/60`、每批 `= crowding/100`、插件對比參數 `-log10(對比/100)`，灰階 `round((1−c)×200)` |
| 材料 | 中英各三篇原故事 JSON，依檔名排序編號；改為靜態 import（不再依賴 `import.meta.glob`），bytes 未改 |
| 呈現 | 白底、倒數 3／2／1 各 1 秒，片段在中央逐批呈現，顯示時間 `批量/wps` 秒；字級依可視寬度縮放，保留 visualViewport 置中 |
| 題目 | 最多 10 題隨機抽題、四選一 jsPsych `html-button-response`；`correct`／`response_text` 判定不變 |
| 成果 | 與舊 `score.json` 相同欄位：summary `questions/correct/presentationMs/wordCount/configuredWpm/presented/finished/passage/language`；每題 `question/correct/responseMs/choice/expectedChoice/options` |

刻意差異（需在核准時知悉）：

- 舊插件在 Escape 時把呈現標記為未完成並續答題目，但舊 Hub `useTrainingAbort` 先攔截 Escape 並中止，該分支實際不可達。新版 Escape／「停止訓練」一律中止且不保存；`finished` 正常完成時為 1。
- 舊版離開全螢幕即中止活動；新版與其他 R2 遊戲一致，離開全螢幕後以視窗模式繼續（canvas 仍填滿可視區），停止仍需按鈕或 Escape。
- 舊成績頁顯示的「WPS／Crowding」小數改為與設定同單位（片段／分、%）。原本會下載 CSV 的 `exportCsv.ts` 並未被呼叫，已移除；沙盒本來也禁止下載。
- 舊遊戲沒有任何提示音，新版沿用無提示音；依規範加入遊戲自有 Tone 15.1.22 介面與空的背景譜面，沒有新增聲音開關。

## 新的自有流程與聚光燈

- 設定為前景原生 dialog，背景預先呈現教學場景：上方速度／每批／對比資訊、中央依當下設定（批量與對比灰階）顯示的範例片段、下方範例理解題。確認前不啟動教學、計時或計分。
- 確認設定後才開始**三步聚光燈**（與畫畫塔防／蓋伯相同的遊戲自有 tour）：中央文字 → 速度與每批片段 → 理解題。遮罩與外框跟隨目標及 resize；下一步、略過、返回設定、Tab 焦點循環、Escape 略過；返回設定保留所有值並清除遮罩。說明框不遮住目標（Brave 驗證）。
- 教學後顯示 `training-config training-confirmation` 確認參數，最後的「開始訓練」才請求全螢幕並等待結果後啟動。
- 成績頁：主要成果（答對題數、文字呈現時間含倒數、已呈現片段）、當次設定（含本次文章、是否完整呈現）、作答時間／對錯可切換的圖表與描述統計、逐題明細（題目、作答與正確選項文字），50 筆分頁；保存狀態、重試與唯一返回按鈕。
- 遊戲移除 `@rehab-trainer/ui`、OfficialGameShell、兩份 JSON 與 Hub router／storage／CSS；設定、i18n、教學、Pixi 管理、音訊、結果、私有 bridge 均由本遊戲持有，無跨遊戲 import。

## 平台變更（僅本機候選）

- `officialGameReleases.json` 加入 `reading-training`（名稱／origin，不含版本）；`catalog.ts` 讀遊戲自有 `game.json`；`sync:games` 與 lockfile 移除 Hub 依賴。
- 測試：新增 `check-reading-training-migration.test.mjs`、`check-reading-training-tutorial.test.mjs` 至 `test:game-architecture`；UI／結果／全螢幕／音訊／研究契約／訓練流程、Hub API／SQL session／目錄合併／middleware、runner 穩定入口加入此 gameId。兩份 workflow 沿用七項 matrix 與相同命令。
- 既有測試以 reading-training 代表「未遷移 JSON 遊戲」的兩處改用 `driving-rehab`：Brave 共用成績頁（`check-game-architecture-browser.test.mjs`）與 records 舊 Hub 成績保存；另新增斷言「已遷移的 reading-training 不能經未簽章舊路徑保存」（400）。沒有放寬任何檢查。
- 本機 Brave fixture：`scripts/reading-training-browser.mjs`，經 `node scripts/check-r2-game-browser.mjs --game reading-training …` 執行。

## TDD 紀錄

| 先失敗情境 | 原因 → 修正 |
| --- | --- |
| 新增兩份測試 0／11 | 缺自有 settings／score／timeline／bridge／tour 模組，仍引用共用 UI → 自包含實作後 11／11 |
| 共用測試 10 項失敗 | UI／結果／全螢幕、目錄 API、Hub catalog、middleware 尚未支援此 gameId → registry 與遊戲 UI 補齊後通過 |
| `records.security` 400 | 舊 Hub 成績 fixture 用 reading-training；遷移後正確地要求官方 session → fixture 改未遷移遊戲並新增拒絕斷言 |
| Brave：英文說明較長蓋住中央文字 | 短視窗上下皆放不下 → 本遊戲 tour 先改用較大一側並在框內捲動；新增單元測試 |
| `test:i18n` | 每款遊戲須有 `i18n/zh.ts`／`en.ts` → 拆成雙語檔 |
| Brave：說明框蓋住中央文字 | 752×485 視窗中文字與範例題過低／過高，tour 只能置中 → 文字上移、範例選項寬螢幕單列，三個目標皆不被遮住 |
| Brave：題目畫面偏左裁切 | jsPsych `css_classes` 加在內層 `.jspsych-content`，選擇器寫錯 → 修正並加入置中／不被停止鈕遮住的斷言 |

## 本機驗證

七項 gate：`test:naming`、`test:pwa`（18）、`test:game-architecture`（221）、`test:hub-functions`（125）、`test:gamerunner`（50）、`test:entrypoints`、`test:cloudflare-deploy` 通過；另 `tsc`、遊戲 build、`build:hub`（32 款舊 bundle；reading-training 只留導向入口與相容原圖）、`test:seo`、Publisher dry-run 通過。

Brave（真實 RSVP 與 10 題，保存只寫本機 SQLite）十項全通過，含 `--remote --lobby`、`--remote --standalone --mobile` 讀正式 R2：見 [validation-summary.json](migrations/reading-training/validation-summary.json)。截圖在 `.tmp/reading-training-validation/`（未提交）。

## 待辦

1. ~~核准並發布 R2~~（已完成）。
2. 部署此分支的 registry／Hub 排除變更（需擁有者同意部署；`main` push 會自動部署整個 Pages）。
3. 依第 7 節 F：正式 `/api/games`、session、五檔公開 bytes、穩定入口 302，及 `--production-hub` 桌機／手機／平板／英文登入、`--remote --standalone` 驗收，寫入 `docs/releases/reading-training-2.0.0.json`。

回退：首次遷移沒有新格式回退版；若需回退，恢復舊 Hub registry／依賴／`settings.json`／`score.json` 的已驗證部署（基準 `663091e`），不能用 `--activate-version`。尚未驗證：Safari／iOS、長時間離線、真人閱讀行為。
