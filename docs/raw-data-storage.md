# 當次摘要與私人 CSV 儲存

2026-10-29，Task D。本次只修改本機程式、設定與測試；沒有建立正式 bucket、設定 secrets、發布遊戲、部署、commit 或 push。排程啟用方式見 [pCloud 同步文件](raw-data-pcloud-sync.md)。

## 新寫入的資料

`training_records.payload_json` 與 `summary_json` 保存相同的摘要紀錄。官方成果保留 `score.summary`、設定、版本、伺服器日期，`score.rounds` 固定為 `[]`，另有原始 `scoreRoundCount` 與小型 `rawFiles` 清單（kind、key、rows、sha256）。CSV 必須先成功寫入 R2，才能新增 D1 訓練紀錄；儲存失敗回覆 503，同鍵不同內容回覆 409。帳號 Subject ID 由伺服器解析，訪客使用裝置的 UUID v4。

官方 session 的簽署 issue time 依 `REHAB_TIME_ZONE`（預設 Asia/Taipei）換算為日期，用於 training date、路徑與 metadata；重送不使用當下日期。重複成果比較去除 rounds 的分數、設定及 rounds CSV 的 SHA-256，成功重送回覆 duplicate，不能改寫原成果。CSV 在 D1 寫入失敗後可能暫時沒有對應紀錄，仍可同步與以原 session 重試。

舊版視覺 API 的 gaze_samples、webgazer_data 不再寫入新 D1 紀錄；保留數量與省略標記。其他舊版原始陣列清空；`results` 的單一摘要只保留明列的摘要欄位，多筆 trial collection 不保存。沒有已簽署官方 session 的舊版逐次資料不另外匯出。`includeRounds=1`、`includeGazeSamples=1` 保持可用，讀取實際儲存的內容；歷史紀錄仍可有原始列。

第三方 `game_runs.result_json` 先照原規則驗證並投影 score.json，然後清空 `detailRows` 與 `scoreProjection.rounds`，保留摘要、其他原有純量及 `scoreRoundCount`。**本次採擁有者允許的較小範圍：第三方逐次列不保存，也不匯出 R2。** 管理端與匿名分析只有讀取與集合統計，沒有另一條原始紀錄寫入路徑。

## Bucket 與路徑

Hub 的 Workers 與 Pages 參考設定均新增 `RAW_DATA = rehab-raw-data`。runner 仍只有遊戲發布 bucket；部署測試禁止綁定兩個私人 CSV bucket。既有 CI 命令 `node scripts/ensure-oculomotor-bucket.mjs` 現在依序確認 `oculomotor-data`、`rehab-raw-data`；兩份 workflow 的 gate 與命令未變更。沒有公開 bucket 或新的公開下載 API。

| 類型 | R2 CSV 鍵 |
| --- | --- |
| 官方逐次列 | `pending/rounds/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |
| Hub 手部、姿勢、舌頭、頭部輸入 | `pending/<hand\|pose\|tongue\|head>/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |
| 訪客眼動（沿用） | `guests/<subjectId>/<recordId>.csv`，位於 oculomotor-data |
| 帳號眼動（沿用） | `users/<encoded userId>/<recordId>.csv`，位於 oculomotor-data |

RAW_DATA 的 metadata 為 kind、gameId、version、recordId、subjectId、recordedDate、rows、sha256；座標另有 truncated。數字 metadata 以字串保存。眼動新寫入增加 subjectId、recordedDate、sha256，原版本、樣本數與校正 metadata 保留。

每個 CSV 的 bucket 另保留兩個空物件，內有相同摘要 metadata，沒有原始座標或逐次列：

- `checksums/<CSV 鍵>`：先保留 SHA-256；即使 CSV 寫入失敗或同步後已刪除，不同內容也不能重用該鍵。
- `receipts/<CSV 鍵>`：CSV 確實寫入後才建立。成果 API 以它追溯已封存的座標，也用它驗證已封存眼動 CSV 的版本與樣本數。只有 checksum 保留成功、CSV 失敗時，不能據此新增眼動成果。

三種物件都使用 `onlyIf: { etagDoesNotMatch: '*' }`；既存內容需核對 SHA-256，眼動版本／樣本數檢查亦保留。同步 Worker 不列舉 checksums 或 receipts；這些小型識別／摘要 metadata 不隨 CSV 刪除。相同 bytes 的重試可以重新建立 CSV；不同 bytes 回覆 409。不得手動刪除保護物件後重用 record ID。

相同 bytes 重新建立 CSV 時沿用首次 checksum 內的 metadata，包含 recordedDate；未帶官方 session 的舊眼動上傳也不會因跨日重試改變封存日期。

## CSV 欄位與上限

逐次 CSV 使用 LF、無 BOM。首欄 `round_index` 從 1 起，後續為各列首次出現的 metric key，依順序聯集。數字使用十進位文字，null 或缺少欄位留空，不會讀取繼承屬性。官方原有上限仍為 4,000 列、每列 12 個 numeric/null 欄位、score JSON 450 KiB。

座標 CSV 使用 LF、無 BOM，首欄均為 `t_ms`，各類型從第一個 frame 起算毫秒。欄名精確由 `packages/ui/src/rawCoordinateRecorder.js` 的固定清單定義：

| kind | 後續欄位（依序） |
| --- | --- |
| hand | 每個 h=0,1 依序為 `hand_<h>_present`，接著 p=0..20 的 `hand_<h>_<p>_x`、`_y`、`_z` |
| pose | 上述兩組 hand 欄位；`pose_present`；依序 left_hip、right_hip、left_knee、right_knee 各自的 `_x`、`_y`、`_z` |
| tongue | `mouth_x,mouth_y,direction,confidence` |
| head | `yaw,pitch,roll,face_found` |

presence 與 face_found 為 0/1。tongue direction 為 Rest=0、Tongue_Left=-1、Tongue_Right=1；未知值留空。無效或缺少數值留空。hand proxy 目前只傳所選的一隻手，因此保存在 hand_0，hand_1 空白且 presence=0；不推測左右手身分。pose 的四個點依 proxy 的 MediaPipe 23、24、25、26 順序。影像尺寸、校正樣本、影像、音訊、身分及任意文字都不進入座標 CSV。

容器每類最多 30 列／秒、36,000 列及 20 MiB（包含 header），超限停止增加並標記 truncated。重新載入、關閉或卸載會清空錄製與已上傳狀態；成果重試保留已成功上傳的種類。錄製只包在已審核代理的輸出端，依可信 session 的 capabilities 與既有 SensorAllowed 判斷；不接受遊戲自訂座標。麥克風維持不錄製。

`POST /api/raw-data` 僅允許 hand、pose、tongue、head。使用與眼動上傳相同的帳號／官方 token／Subject ID 驗證，回查核准 release 的 capability，保留 origin、Turnstile 與速率限制。成果存檔時也只查詢該 release 宣告的座標類型，沒有相機或感測輸入的遊戲不讀 R2 座標收據。body 為 text/csv，串流與 Content-Length 均限制 25 MiB；header 必須逐欄相同，每個 cell 只能是有限數字或空白，時間從 0 起且符合取樣間隔。限制列與 cell 分割數，避免大量換行分隔造成額外記憶體用量。

## 眼動封存與進度頁

新眼動物件以 metadata 的 Subject ID 與固定日期轉成 `eye/oculomotor-training/<subjectId>/<date>/<recordId>.csv`，pCloud 路徑不包含帳號 ID。同步 list 帶 customMetadata，在 get 與刪除前 head 再檢查對應。舊 users 物件沒有有效 subjectId／recordedDate 時保留、不上傳、不刪除；舊 guests 物件沒有日期 metadata 時沿用 uploaded 的 UTC 日期。

同步驗證完成後 R2 CSV 被刪除，下載 API 對不存在的檔案回覆 404。進度頁移除該檔下載按鈕，雙語說明同步檔案已封存、當次摘要仍保留；空白、載入、下載中及錯誤狀態均保留。404 不提供 pCloud 連結，也不讓 Subject ID 成為查詢授權。

## 後續與人工驗收

- **TODO：滑鼠／pointer 座標只存在各遊戲沙盒內，需要逐款新版本與精確發布核准；本次不擷取。** 獨立 runner/PWA 的座標錄製亦不在此次 Hub 容器範圍。
- **歷史 D1 資料未遷移、未刪除。** 舊 payload_json、game_runs、管理端匯出仍可能包含逐次資料；清理需擁有者另外核准與驗證。
- 舊帳號眼動 CSV 缺少 metadata 的對應與補登需另案處理；不能宣稱所有歷史眼動均已同步。
- 擁有者需部署 Hub 寫入端、建立私人 bucket，並依同步文件設定 pCloud secrets、確認區域／目錄與部署獨立排程 Worker。不得在同步 Worker 啟用前宣稱正式排程已運作。
- 正式驗收用不含真人資料的 session：確認 D1 只有摘要、CSV metadata／bytes 與 pCloud 路徑相符；確認摘要校驗通過後 CSV 才刪除；同 record ID 更改 bytes 必須 409；中斷上傳與錯誤權杖不能造成原始檔遺失；封存後成果重試成功且下載 404 有說明。
- 瀏覽器人工驗收仍需桌機／360px 手機、鍵盤 Tab／Escape、相機同意／取消、實體代理輸入與進度頁下載；本機 hook harness 不等同實體相機或真實 pCloud 驗證。

## 測試紀錄

先執行失敗測試：逐次資料未寫 R2、R2 故障仍回 201、摘要缺少 count；錄製器與上傳器缺檔；眼動 metadata 缺 subjectId／date；CI 缺 RAW_DATA。同步新測試初次 40 通過、9 失敗；第三方摘要新測試初次 9 通過、1 失敗。後續補出封存後重用、未完成 CSV 收據、原型欄名與舊版單列座標的失敗，再做最小修正。

完整 gate 與最終數量在交付回報中列出，原始日誌位於本機 `.tmp/task-d/`（不追蹤）。目前測試使用真正 SQLite migrations、條件式假 R2、stub pCloud，以及執行實際 TSX／訊息驗證／錄製器／上傳器的 hook harness。未連線正式 bucket 或 pCloud。

| 最終命令 | 結果 |
| --- | --- |
| `npm run test:hub-functions` | 210 通過，0 失敗（含時區設定與座標類型篩選回歸測試） |
| `npm run test:entrypoints` | 各 node:test 子集合計 147 通過，0 失敗；其餘入口、i18n 與樣式檢查通過 |
| `npm run test:cloudflare-deploy` | 25 通過，0 失敗；Pages 本機 dry-run 檢查通過 |
| `npm run test:gamerunner` | 78 通過，0 失敗 |
| `npm run test:naming` | 2 通過，0 失敗；來源命名掃描通過 |
| `npm run test:game-architecture` | TypeScript 通過；1,211 通過，0 失敗 |
| `npm run build:hub` | 通過；內建架構與 SEO 輸出檢查通過 |

以下七個命令均通過：

```sh
node --check apps/rehabtrainerhub/functions/_lib/officialGames.js
node --check apps/rehabtrainerhub/functions/_lib/rawData.js
node --check apps/rehabtrainerhub/functions/_lib/rawDataSync.js
node --check apps/rehabtrainerhub/functions/api/raw-data.js
node --check apps/rehabtrainerhub/functions/api/records.js
node --check apps/rehabtrainerhub/functions/api/oculomotor-data.js
node --check apps/rehabtrainerhub/functions/api/game-runs.js
```

runner 首輪 4 項 esbuild bundling 檢查被本機 sandbox 的祖先目錄存取限制擋下，允許本機測試程序讀取後 78/78 通過；沒有修改測試的 bundling 檢查。既有帳號眼動替身補上真正的條件式 R2 行為與新 record ID；全螢幕測試補上新增清理參照，仍驗證先退出全螢幕再關閉。

antislop 檢查紀錄：

- Hard gate PASS：新增程式與文案不含 U+2014；既有 sandbox、token、capability、身分驗證與錯誤路徑皆有回歸測試。資料顯示有空白、載入與錯誤狀態，404 下載控制會移除。
- Purpose PASS：沿用既有對話框與進度清單，新增說明直接交代座標保存與檔案封存；錄製範圍以代理欄位與核准能力決定。
- Liveliness PASS：依 DESIGN.md 沿用安靜、易讀的介面，ENERGY 1／RHYTHM 1／MOTION 1。
- Craft PASS：實際 TSX 操作 harness 10/10、指定 gates 與 production build 通過。保留 mixed CRLF/LF，`git -c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol diff --check` 通過；最終狀態與 conflicted 搜尋未見衝突副本。實體裝置與瀏覽器版面人工項目另列於上方。

## Task D 檔案清單

以下只列本次修改；共用工作樹先前的其他修改保留。

| 範圍 | 檔案（相對於 repo） |
| --- | --- |
| 後端 helper | `apps/rehabtrainerhub/functions/_lib/officialGames.js`、`rawData.js`、`rawDataSync.js` |
| 後端路由 | `apps/rehabtrainerhub/functions/api/records.js`、`raw-data.js`、`oculomotor-data.js`、`game-runs.js` |
| 後端 helper 測試 | `apps/rehabtrainerhub/functions/_lib/rawData.test.mjs`、`rawDataSync.test.mjs`、`rawDataTestFixtures.mjs` |
| 後端路由測試 | `apps/rehabtrainerhub/functions/api/raw-data.test.mjs`、`records.raw-data.test.mjs`、`records.security.test.mjs`、`oculomotor-data.test.mjs`、`official-game-sessions.test.mjs`、`game-run-sessions.test.mjs`、`game-submissions.native.test.mjs`、`account-subjects.migration.test.mjs` |
| Hub | `apps/rehabtrainerhub/app/train/R2GameOverlay.tsx`、`app/progress/ProgressDashboard.tsx`、`app/privacy/PrivacyContent.tsx`、`app/i18n/en.ts`、`app/i18n/zh-TW.ts` |
| 錄製與上傳 | `packages/ui/src/rawCoordinateRecorder.js`、`rawCoordinateRecorder.d.ts`、`rawCoordinateRecorder.test.mjs`、`saveRawCoordinateCsv.ts`、`saveRawCoordinateCsv.test.mjs` |
| Binding | `apps/rehabtrainerhub/wrangler.workers.jsonc`、`wrangler.toml` |
| 部署檢查 | `scripts/workers-apps.mjs`、`check-cloudflare-workers.test.mjs`、`check-cloudflare-pages-deploy.mjs`、`ensure-oculomotor-bucket.mjs`、`ensure-oculomotor-bucket.test.mjs` |
| UI／回歸檢查 | `scripts/check-raw-data-ui.test.mjs`、`check-raw-data-overlay.test.mjs`、`check-r2-game-fullscreen.test.mjs`、`check-r2-sensor-host.test.mjs`、`package.json` |
| 文件 | `docs/raw-data-storage.md`、`docs/raw-data-pcloud-sync.md` |
