# UFOV（周邊視野訓練）R2 搬遷審查單

狀態：**發布候選，待擁有者核准**。`ufov` 寫成 R2 自包含套件 `2.0.0`（自有設定、聚光燈教學、成果與 i18n），成果檔案改由容器代為下載。Hub／runner 的 `result-files` 支援已在 `1ea4c6c1` 提交，必須先推送部署，再發布遊戲，最後推送本次登記。

範圍：擁有者要求依 `docs/r2-game-migration-plan.md` 搬遷剩餘遊戲並提供聚光燈說明；UFOV 原本因成果下載暫留舊流程（見 `docs/sixteen-games-r2-migration.md`），擁有者回答「UFOV做法跟眼動練習的眼動資料下載一樣」。

## 對照

| 項目 | 舊流程 | R2 套件 |
| --- | --- | --- |
| 名稱 | 周邊視野訓練／Peripheral Visual Field Training | 不變 |
| 分類 | brain／attention | 不變 |
| 設定 | `settings.json` 經 Hub `GameSettingsForm` | 遊戲自有原生 dialog；欄位、預設值與範圍與舊 `settings.json` 相同（`scripts/fixtures/ufov-legacy.json`） |
| 執行 | `PeripheralAttentionPage.tsx` 內的 jsPsych plugin | `logic/ufovRun.ts`，仍由 jsPsych lifecycle 包住，canvas 繪製沿用原 `runtime/peripheralAttentionCanvas.ts` |
| 成果 | Hub `JsonTrainingOverlay` 與舊 `score.json` | 遊戲自有成果頁；summary／rounds 欄位名稱沿用舊 `score.json` |
| 下載 | 遊戲在同源 iframe 內直接下載 | 遊戲把檔案交給容器，按下載時由 Hub 或獨立 PWA 啟動頁下載 |

## 沿用的規則

- 三個活動：活動 1 只看中央車輛；活動 2 另選外圈汽車方向；活動 3 外圈汽車混在三角形之間。手機與平板只提供活動 1（同舊版）。
- 正式模式的階梯：從 500 ms 開始，答對縮短 50 ms，答錯拉長 3 倍步距，反轉後步距變為 0.75 倍（不小於一個影格）；上限 500 ms；自適應最多 60 題，或依設定固定題數。練習模式 5 題、每題 250 ms，作答後顯示對錯。
- 注視框 1000 ms、雜訊遮罩 500 ms；每題在注視框期間重新量測螢幕更新率，依影格數呈現。畫面掉格的題目不計分，連續兩次自動重出，第三次暫停並請使用者重新檢查畫面（同舊版）。
- 只能勾選的外圈方向會出現汽車，至少要勾一個。

## 行為差異

這些差異都有測試覆蓋，發布前請擁有者確認。

- **設定**：用遊戲自有 dialog，Enter 確認、Escape 返回；「結束方式」只在正式模式出現，「題數」只在固定題數時出現；螢幕尺寸與距離若讓外圈超出畫面，會說明外圈改畫在畫面邊緣內。手機與平板會說明只提供活動 1。
- **聚光燈教學**：確認設定後依活動依序照亮中央方框、外圈汽車（活動 2／3）、車輛選項、方向選項（活動 2／3）與進度／停止列，最後一次「開始訓練」才進入全螢幕。寬螢幕的教學場景把作答選項放在刺激畫面旁邊；說明框放得下時放在目標旁邊，避免被擠成需要捲動的小框。
- **作答畫面**：車輛選項保留圖示，並加上看得到的「汽車／卡車」文字（原本只有圖示與螢幕報讀標籤）；方向改為 3×3 方向鍵（箭頭加方位名稱），取代原本放射狀的方向盤；兩個畫面都有題目文字。每個答案只對應它被問到的那一題，延遲的點擊不會答到下一題。
- **顏色**：刺激與背景改用 `--ufov-stimulus`／`--ufov-field` CSS 變數（預設白與黑，與舊版相同），對比度設定仍以刺激色與背景色換算。
- **成果頁**：主要數值為呈現時間門檻、答對時最短的呈現時間（練習模式為固定的 250 ms）與答對題數，顯示到整數毫秒（保存的數值保留兩位小數）；活動 2／3 另列各方向的出現次數、答對、比例與平均時間；當次設定、可切換指標的逐題圖表與明細、保存狀態與重試。
- **下載**：三個檔案改為固定英文欄位，供容器逐格檢查：
  - `ufov-YYYYMMDD-HHMMSS-trials.csv`：每題一列，21 欄（取代舊「原始分數」CSV）。
  - `ufov-YYYYMMDD-HHMMSS-summary.csv`：`metric,value,unit`，當次統計與各方向結果（取代舊「統計成績」CSV）。
  - `ufov-YYYYMMDD-HHMMSS-trajectory.json`：每題的滑鼠軌跡 `[t,x,y]`。

  舊 CSV 的受試者代號、測驗日期／時間欄位與嵌在 CSV 裡的軌跡 JSON 都拿掉：容器規則不允許身份欄位，日期與時間改由檔名表示，軌跡只放在 JSON。CSV 有 UTF-8 BOM，試算表可直接開啟。舊版兩個 CSV 共用一個按鈕；現在三個檔案各有一個按鈕。
- **文案**：拿掉「評估」「測驗」「Subtest」等字樣，改用「活動」「練習」「當次紀錄」。

## 測試與驗證

- `scripts/check-ufov-game.test.mjs`（由 `check-self-contained-game.test.mjs` 引入）：設定與舊 `settings.json` 一致、範圍驗證、階梯與影格換算、成果欄位、三個檔案通過容器檢查且不含身份或公式、檔案先於成果送出、套件自包含、各活動的聚光燈目標。
- `timing/peripheralAttentionTiming.test.mjs` 改為檢查新的 run 與成果檔，同步、重試、暫停與取消的契約不變。
- 共用測試同步加入 UFOV：UI、成果、設定記憶、音效、antislop、研究契約、目錄架構、middleware 410、training flow。
- `scripts/ufov-r2-browser.mjs` 為 Brave 實際操作流程：設定 18 個欄位、全部聚光燈（說明框不得需要捲動）、10 題正式模式真實點擊作答（第 4 題故意選錯車、第 8 題故意選錯方向）、成果、三個下載檔的內容（作答紀錄、階梯方向、BOM、軌跡）與保存生命週期。為了能刻意答對答錯，測試把遊戲 iframe 的 `Math.random` 固定為 0.1，中央固定是汽車、外圈固定在第一個勾選的方向。手機與平板的檢查在遊戲 iframe 開始執行前打開觸控模擬，所以會照真實裝置只跑活動 1。通過的組合：大廳桌機（訪客、登入英文）、大廳手機英文、大廳平板、獨立入口桌機與手機、大廳桌機與獨立入口手機按「停止」不保存。
- 瀏覽器檢查抓到並已修正：視窗矮時教學場景的外圈與方向鍵超出畫面（寬螢幕改為左右排列）；說明框被擠在目標上方而需要捲動（UFOV 的 `runtime/tour.ts` 改為先放在目標旁邊）；成果的 409.99 ms 改顯示整數；手機上「400 ms」斷行。
- 舊流程的本機瀏覽器範例（`npm run test:game-architecture:browser`）改用仍未遷移的遊戲：設定表單與 Hub overlay 用有球必應，全螢幕用舌頭動作訓練，獨立入口的規則／返回設定流程用有球必應。有球必應需要相機，`check-browser-route-smoke.mjs` 新增 `--fakeMedia true` 使用 Brave 的假相機，overlay 與獨立入口兩項都加上；7 項全部通過。
- 七項 CI gate、`npm run test:training-flow` 與 `npm run test:seo` 在最後一次修改後通過；Hub 與 runner 重新建置通過。

## 其他紀錄

- 有球必應按「開始訓練」後回到設定，是相機檢查失敗後的既有行為：共用的 `useMediaPermissionPreflight` 在無相機或拒絕權限時要求 Hub 回到設定。原本遊戲內設定畫面會顯示相機錯誤與「重新要求權限」，2026-09-09 設定改由 Hub 表單呈現後，`errorMessage` 仍會計算但不再顯示，使用者看不到原因。擁有者要求一併處理後，返回設定的訊息改為帶固定清單中的原因，Hub 與獨立入口的設定表單以自己的文案顯示（見 `AGENTS.md`「舊流程返回設定的原因」）；`check-game-architecture-browser.test.mjs` 以假相機加拒絕權限，驗證 Hub（中文）與獨立入口（英文）都顯示提示。
- 同步工具會把 `dist/index.html` 改名為 `[conflicted]`；建置、瀏覽器測試與發布前都先修復再重新建置。

## 發布候選

5 個檔案（`index.html`、`game.json`、`preview.webp`、JS、CSS）。兩次重新建置的 digest 相同；發布工具會先重新建置，比對與下表一致才上傳並切換 current。

| gameId | version | contentSha256 | bytes |
| --- | --- | --- | --- |
| `ufov` | `2.0.0` | `f0947fd84713c42e5ff58aeb81a69a5c36df7dd68fbeadb7204be256b9ad3cf5` | 628854 |

順序（擁有者執行）：

1. 推送 `1ea4c6c1` 以前的提交（含 `result-files` 的 Hub／runner 支援），等部署完成：`git push origin 1ea4c6c1:main`。
2. 發布：`node .tmp/brain-tools/publish-approved.mjs .tmp/brain-tools/batch22-candidates.txt`（同一份清單另含 21 款腦力練習的停止鈕邊框修正版）。
3. 正式 runner 驗證通過後，推送本次 UFOV 登記：`git push origin main`。
