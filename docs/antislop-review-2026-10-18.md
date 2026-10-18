# Hub 與遊戲文案／UI／程式碼 antislop 檢查（2026-10-18 候選）

狀態：**Hub 與未遷移遊戲的修改已推送 `main`；十款 R2 遊戲新版本尚未發布**，等擁有者核准第 5 節的精確 version／contentSha256。

擁有者要求用 antislop 規則檢查整個 Hub 與遊戲的文案、UI 與程式碼，並用 code-modernization 的等價比對確認輸入與輸出一致。擁有者選擇：作業中套用規則（DURING）；antislop 指引區塊加在 `CLAUDE.md` 結尾；R2 遊戲「全修，10 款升版」（焦點外框、缺值顯示、設定欄位邊框對比），只做 dry-run；完成後 commit 並 push 到 `main`。

## 1. 修改內容

### 文案

- 缺值不再顯示 em dash：中文顯示「無」，英文顯示 `N/A`，並且不再在缺值後面接單位（例如原本「— ms」改為「無」）。範圍：九款 R2 遊戲 `ScoreAnalysis.tsx`、駕駛 `DrivingResults.tsx`、蓋伯與閱讀的成果摘要、共用 `TrainingScore.tsx`（未遷移遊戲成果頁）、`ExpFactoryGame.tsx`（「無 / N/A」）、管理後台（`AdminDashboard`、`GameReleaseManager`）。
- 進度頁載入中原本顯示「—」加「天」，改為「載入中」／`Loading`，載入時不顯示單位（新增 i18n key `loadingValue`）。
- 原始碼的 em dash 全部移除（不含 vendored 檔）：帳號選單 aria-label 改為「名稱 (帳號選單)」；開發者文件一句拆成兩句；駕駛英文暫停訊息改用分號；`globals.css` 註解改冒號。
- 審核說明原寫「檢查 18 種危險 API」，實際 `blockedSourcePatterns`（`functions/_lib/gamePackages.js`）有 25 條且含 HTML／CSS 規則，改為列出規則類別，避免數字再過時（README 同步）。
- 英文專業背景原寫「Board-Certified Occupational Therapist」，改為 `AGENTS.md` 允許的資格說法（通過職能治療師考試並領有證書）。
- 網站導覽文案改用介面上實際的導覽與分類名稱（中文分類「動作活動／口腔活動／認知活動／視覺活動」，英文「Education」），刪去「快速」「隨時」等填充詞；英文 kicker「How it works」改「User guide」。

### UI

- 26 款遊戲 `rules.css` 移除 52 行 `outline: none;`；17 款補上 training-panel 導覽按鈕 `:focus-visible` 3px 外框（其餘 9 款原本已有）。
- 哈特圖：解碼拖曳把手與代碼輸入框原本只有淡色邊框變化，改為 3px `:focus-visible` 外框。
- 表單控制邊框對比：Hub `--border-strong` 由 `#aeb6bd`（白底 2.05:1）改 `#7d868e`（白底 3.70:1、`#f6f7f9` 底 3.45:1）；Hub 搜尋框原本無邊框，改用 `--border-strong`，placeholder 改 `--text-muted`；26 款 `rules.css` 的 `--border-strong` 備援值同步；十款 R2 遊戲的設定輸入框、成果頁指標下拉選單、眼動設定與方向按鈕改用 `--border-strong`。
- 手勢對戰的手勢提示圖示中，彎曲手指原本也使用 `--border-strong`；為保留它與藍色伸直手指的對比（3.09:1），改用新的 `--cue-folded: #aeb6bd`，外觀不變。

### 程式碼註解

`three-driving-rehab.ts` 的全大寫分隔註解改為一般句子或刪除，刪掉兩則只重述程式碼的註解；`pixi-moving-card.ts` 一則註解改寫；`sync-games.mjs` 拿掉步驟編號。只動註解，語法樹比對證明程式碼未變（第 3 節）。

### 保留不改（有理由）

- `driving-rehab`、`reading-training` 的 jsPsych 舞台 `:focus { outline: none; }`：與 jsPsych 官方 `jspsych.css` 相同，舞台是接收按鍵的容器，不是控制項，內部按鈕保有焦點外框。
- `.module-card` 的 `outline: none`：卡片本身不可聚焦，`:focus-within` 另有 3px 外框。
- `--border`（白底 1.42:1）：只用於分隔線與卡片邊，表單控制已改用 `--border-strong`。
- `packages/ui` 的 `.input`（2px `#C2C6D4`，1.54:1）：只被 `EditableSettingRow`、`UserSelector` 使用，兩者有匯出但沒有任何 app 匯入，不影響現有畫面。
- 未遷移遊戲 i18n 中的 `"btn.edit": "✎ Edit"`：目前沒有程式使用這個 key，留待日後清理。
- 依 `DESIGN.md` 保留：設定 modal 背景模糊、載入點脈動、training-config 大寫標籤、pill 按鈕、功能性漸層。
- 缺少欄位的成果列（`missing-keys` 輸入）在圖表 SVG 產生 `NaN` 座標：舊版行為相同，正式資料經 schema 驗證不會出現，本次不改。

## 2. TDD

- 新增 `scripts/check-antislop.test.mjs`（加入 `test:entrypoints`，`AGENTS.md` CI 節已補說明）。在 HEAD `50ab25a7` 的快照上 6／6 失敗；修改後 6／6 通過。哈特圖代碼輸入框的焦點斷言另外先跑出失敗（`.hart-code-input has no focus-visible rule`），修正後通過。
- `scripts/check-r2-game-results.test.mjs` 改為期待「無」／`N/A`：快照上 9 項失敗、20 項通過；修改後 29／29。
- 版本釘選：七份 migration test、`check-r2-settings-controls`、`check-r2-settings-memory` 改為新版本；fixture 內的模擬版本號刻意不動。

## 3. 輸入／輸出等價比對（code-modernization）

以 HEAD `50ab25a7` 的 `git archive` 快照為舊版、工作樹為新版，對同一批輸入產生輸出，再用 code-modernization 的 `compare.py` 逐 byte 比對。

| 範圍 | 案例 | 輸入 |
| --- | --- | --- |
| 九款 R2 `ScoreAnalysis` | 198 | 每款 11 組（一般、0／缺值、全缺值、空、單筆、51 筆分頁、小數／負數／大數、標籤超出範圍、缺欄位、全欄位缺值、交錯缺值）× 中英文；每組含預設指標、下一頁、切換指標三個畫面；駕駛與閱讀含逐題細節，移動卡片含 trial 目標 |
| 駕駛 `DrivingResults` | 8 | 4 組摘要（完整、全缺值、路線 id／逾時、無路線）× 中英文 |
| 共用 `TrainingScore` | 54 | flanker（折線）、connect4（長條）、含合計欄的定義 × 6 組資料 × 中英文與三種儲存狀態；每組逐一切換所有指標；圖表元件以樁替換並印出收到的資料 |
| 程式碼結構 | 9 | 去除註解後的 TypeScript 語法樹。只改註解的三個檔不遮罩；只改顯示文字的六個檔只遮罩字串內容 |

結果：**269／269 相同，PROVEN**，`compare.py` 自我檢查通過。

- 遮罩只有兩種，都屬於已核准的變更：缺值占位（舊「—」或「—–—」，以及後面的單位或 %），以及六個顯示文字檔的字串內容（逐一列在第 1 節）。另外逐一列出所有原始差異，確認全部都是缺值占位；語法樹差異只在字串，非字串節點為 0。
- 反向驗證（canary）：把哈特圖中位數改成平均數，4 個案例被抓到；把 `HubNavigation` 的 `displayName` 改成 `email`、駕駛輪胎轉速常數 2.7 改 2.8，兩個語法樹案例被抓到；把 `TrainingScore` 的樣本標準差分母改成 n，27 個案例被抓到。三次 `compare.py` 都回傳失敗。
- 沒放進比對的顯示變更：`GaborPatchingGame`、`ReadingTrainingGame` 的成果摘要（大型遊戲元件，無法在伺服器端渲染）。人工檢查差異：有值時文字相同（「12.5 s」），缺值時由「— s」改「無」／`N/A`；在 Brave 驗收時檢查成果頁（第 4 節）。
- 資料路徑未改：成績計算（`score.ts`／`scoreStatistics.ts`）、設定 schema 與驗證、bridge／MessageChannel、Hub API 與 D1 都不在這次的差異內。

## 4. 驗證

- 七項 CI gate：naming 2、pwa 18、game-architecture 296、hub-functions 133、gamerunner 55、entrypoints 112、cloudflare-deploy 4，全部通過。
- `npm run build:hub`（31 個 task）與 `npm run test:seo` 通過。
- 焦點探測（Brave headless，載入各遊戲實際 CSS 後按 Tab）：26 款有 training-panel 的遊戲，Start 與 Back 都顯示實線外框（6.38–7.41:1）；修改前 connect4 等 17 款沒有。14 款 ExpFactory 遊戲的焦點樣式依賴執行時注入的主題變數，補上變數後也是實線外框（5.77:1）。
- 對比：Hub 文字與 `--primary`、`--focus`、`--border-strong` 都達標；Hub 與 26 款遊戲主色上的白字 6.31–7.41:1。
- 掃描：em dash 由 49 處降為 0；comment 掃描只剩 Next.js 自動產生的 `next-env.d.ts`。
- 本機 Brave（只寫本機 SQLite）：十款 R2 遊戲 `node scripts/check-r2-game-browser.mjs --game <gameId> --lobby` 全部通過（設定、教學聚光、實際遊玩、成果、保存失敗與重試、回到大廳；哈特圖包含實際解碼輸入）。
- 共用成果檢查 `scripts/r2-game-results-browser.mjs` 新增斷言：成果頁文字不得出現 em dash、`undefined`、`NaN`。加入後重跑蓋伯 `--lobby`、閱讀 `--signed-in --english`、哈特圖 `--mobile`、移動卡片 `--english`、畫畫塔防 `--mobile`，全部通過。蓋伯實際一局有 2 個缺值，成果頁「設定活動時間」顯示「30 s」。
- Hub 靜態輸出在 390／820／1366px：大廳與進度頁沒有水平捲動；搜尋框邊框為 `#7d868e`，聚焦時顯示 3px 外框。
- `scripts/check-game-architecture-browser.test.mjs`（未遷移遊戲設定表單、共用成績圖表、Hub 導覽與 44px 目標）：整檔 6／7 通過；失敗的設定表單項目是本機同步工具把 18 款舊遊戲輸出的 `index.html`、`sw.js` 改名為 `[conflicted]`，造成 404。把輸出複製到固定位置並還原檔名、以 `HUB_OUTPUT_ROOT` 指向後重跑：第一次 lights-out 等待送出按鈕逾時，再跑一次通過，程式未改。此測試不在 CI。

## 5. R2 候選版本（尚未發布）

| 遊戲 | 版本 | 檔案 | bytes | contentSha256 |
| --- | --- | --- | --- | --- |
| 小行星護盾防衛 | `2.0.11` | 12 | 1,774,409 | `2fe0c1e70a69924bd1feca6d30341a956a8a7f4113b435f58758b1932c74c7e6` |
| 畫畫塔防 | `2.0.8` | 6 | 5,851,411 | `cb7c76624c2029b62303fdda9dc9b0b34032d8a61e2e8432f0fb82e6cf41cebf` |
| 駕駛注意力模擬練習 | `2.0.2` | 8 | 10,045,606 | `ce11ccde2d798e3f309a34b8e4b7852e8866ff45d8283f3ced40d70a7e48bd46` |
| 蓋伯斑塊練習 | `2.0.3` | 5 | 1,158,175 | `ddaf7dce2e68cf219d47523f9df73e5d93bfa9eeee9333067077fd4cd0e6828d` |
| 手勢指令對戰 | `2.0.6` | 5 | 1,139,294 | `589f91f2d8589ecab4c9c884345c70df8fcde00610a0faca700eab88f170ea37` |
| 哈特圖訓練 | `2.0.2` | 5 | 651,959 | `757498015e358c4d337feec08d6f7d099aa052c9f1286541f360eff1dc0051df` |
| 手部目標追蹤練習 | `2.0.4` | 5 | 615,334 | `9991b8d2f583a48e167d27084f1c7caf117348a5a9654b45672b821a54e0b1e5` |
| 移動卡片訓練 | `2.0.4` | 5 | 1,171,028 | `53c01e6f33109f2de4e8795a5848f0f51af1046400efa9512d344bf5d6bef0aa` |
| 眼動練習 | `2.1.3` | 11 | 771,230 | `5002743bf6ca64cc68e3530ad4ba0a9999091b335eed69b36e1ec1568430357d` |
| 閱讀訓練（RSVP） | `2.0.2` | 5 | 1,205,946 | `84f5ca2dc5520ca10b7f82e1c6c39673ecddec2e70127b1cee385fcfa053df09` |

每款由 `npm --prefix apps/rehabtrainerhub/games/<gameId> run build` 建置，再以 `node scripts/publish-official-game.mjs <gameId> --dry-run` 驗證。正式發布須擁有者核准上表精確值，逐款執行（同一款不可平行），發布後在 `docs/releases/` 補收據。這批版本不需要新的 Hub／runner 能力，現行正式 Hub 與 runner 即可載入。
