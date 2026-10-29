# 舊逐筆資料清理（2026-10-29）

兩支工具預設 dry run，測試只使用假資料、注入的 Wrangler／fetch 與記憶體 SQLite。擁有者要求清理後，2026-10-29 已對正式資料執行，結果見文末「執行紀錄」。

## 範圍與保留資料

`scripts/cleanup-d1-raw-records.mjs` 固定讀取 Hub Workers 設定檔 `apps/rehabtrainerhub/wrangler.workers.jsonc` 對應的正式 D1 `rehab_db`，以 `WHERE id > ... ORDER BY id LIMIT 100` 按主鍵分頁，不使用 OFFSET。

- `training_records.payload_json` 與非 null 的 `summary_json`：使用 API 與工具共同匯入的 `functions/_lib/recordSummary.js`，移除 `gaze_samples`、`webgazer_data` 並保留省略旗標；其他陣列清空，唯一例外是單筆、沒有 `trial_index` 的 legacy `results` 摘要，只保留現行 API 白名單內的純量欄位。逐回合 `score.rounds` 清空，原本非空時以原長度補上 `scoreRoundCount`，已有值則保留。既有 `rawFiles` 原樣保留，不另寫入 R2、不補建舊回合 CSV。
- `game_runs.result_json`：比照現行第三方成果寫入，只清空 `detailRows` 與 `scoreProjection.rounds`，保留 `details`、projection 摘要及其他純量。仍有逐筆陣列時，回合總數優先採 projection rounds 長度（包含空陣列的 0），沒有 projection rounds 才採 detailRows 長度；已清理的列不重算原有 `scoreRoundCount`。現行 API 沒有其他逐筆陣列剝除步驟。
- 不刪除 D1 紀錄、不改分數欄位、擁有者、Subject ID、日期或 `updated_at`。null 的 `summary_json` 保持 null。JSON 內容不變時連格式也不重寫；任何一個 JSON 欄位無法解析成物件時，整列跳過，只列出 table 與 row id，不列紀錄內容。

`scripts/cleanup-oculomotor-csv.mjs` 列舉並刪除私人 `oculomotor-data` bucket 內的所有物件，不限 CSV 副檔名或前綴，包含 `guests/`、`users/`、`checksums/`、`receipts/` 與其他前綴。不刪 bucket、不改權限、不處理 `rehab-raw-data`、發布 bucket 或 pCloud 的既存副本。

## 執行前

由擁有者在倉庫根目錄執行，使用自己的 Wrangler 登入或環境變數。工具不接受 URL／命令列中的 token。R2 憑證查找與官方發布工具共用 `scripts/cloudflare-credentials.mjs`：先用 `CLOUDFLARE_API_TOKEN`，否則讀 `WRANGLER_AUTH_CONFIG` 指定的檔案，或 Wrangler 預設 `default.toml` 的 OAuth token。帳號先用 `CLOUDFLARE_ACCOUNT_ID`；未指定時只在帳號清單恰好一筆時採用。R2 清單／刪除須有相應讀寫權限，D1 使用 Wrangler 的 D1 權限。不要把憑證貼進文件、指令、log 或網址。

安排沒有新上傳與寫入的維護時段，並暫停 `raw-data-sync` 排程與其他清理者，避免列舉期間新增物件、同時搬移或重新上傳。同一時間只執行一份工具。D1 分頁不提供跨頁快照；並行新增的較小主鍵可能在本輪看不到。Wrangler 的遠端 SQL 檔案匯入可能短暫影響資料庫服務。

先記錄兩張表總筆數，並記下 Time Travel bookmark 和 UTC 時間。只要 D1 還在目前方案的 Time Travel 保留期間內，可以由擁有者另行評估還原；還原作用於整個資料庫，也會影響清理後的新寫入，不能當成單列復原。

```powershell
npx wrangler d1 time-travel info rehab_db --config apps/rehabtrainerhub/wrangler.workers.jsonc --json
npx wrangler d1 execute rehab_db --config apps/rehabtrainerhub/wrangler.workers.jsonc --remote --json --command "SELECT 'training_records' AS table_name, COUNT(*) AS total FROM training_records UNION ALL SELECT 'game_runs', COUNT(*) FROM game_runs;"
```

本機快取 Wrangler `4.155.0` 的 `d1 time-travel --help`、`info --help`、`restore --help` 已確認指令名稱；help 沒有連線正式 D1。`info`／`restore` 本身是遠端操作，由擁有者執行。需要還原時，將下列假 bookmark 換成自己事前記下的值；本次不執行：

```powershell
npx wrangler d1 time-travel restore rehab_db --config apps/rehabtrainerhub/wrangler.workers.jsonc --bookmark OWNER_SAVED_BOOKMARK
```

## 先 dry run，再 apply

```powershell
node scripts/cleanup-d1-raw-records.mjs --dry-run
node scripts/cleanup-oculomotor-csv.mjs --dry-run
```

D1 每表列出 `scanned`、`wouldChange`、`unchanged`、`unparseable`、`bytesSaved`、`submitted`，最後列出兩表的估計 byte 差額。`bytesSaved` 是新舊 UTF-8 JSON 字串大小差，不代表 SQLite 實際檔案縮小；短紀錄因補上總數欄位可能增加 bytes。dry run 的 `submitted` 必須是 0。先處理無法解析的列；工具不猜測內容，也不覆寫它們。

R2 列出每個頂層前綴的物件數與 bytes；已知前綴顯示名稱，根目錄統計為 `(root)`，其他前綴各用編號隱藏名稱，避免前綴本身含有識別資料。不印完整 key、account id 或 token。dry run 的 `deleted` 必須是 0。

確認範圍與數量後由擁有者執行：

```powershell
node scripts/cleanup-d1-raw-records.mjs --apply
node scripts/cleanup-oculomotor-csv.mjs --apply --bucket oculomotor-data
```

D1 在第一筆寫入前再次印出 Time Travel info 指令，但不代為執行。每批最多 50 個 UPDATE、80,000 bytes，SQL 寫入 OS temp 的專用目錄並要求檔案模式 `0600`（Windows 仍以系統 ACL 為準）；單引號加倍、反斜線與 Unicode 保留，成功或失敗都會刪除暫存檔和專用目錄。清理後單列 SQL 超過上限會停止，不送出該列；已成功的先前批次保留，重跑可接續。

`training_records` 以讀取時的 `id` 與 `updated_at` 作樂觀檢查；`game_runs` 沒有更新時間，而且現行 API 只新增，故比較 `id`、`created_at` 及原 JSON 的 SQLite 字元長度。這能避免替換成不同日期或長度的列被覆寫，但不能偵測人工在相同建立時間換成同字數 JSON；維護期間禁止其他修改。沒有把舊逐筆內容放入 UPDATE 的比對條件。

`submitted` 代表成功匯入批次內提交的 UPDATE 數，不是實際受影響列數。Wrangler 的 `--file` 回傳匯入摘要與 `rows_written`，沒有逐列 `changes`；樂觀條件不符的列可能跳過，因此必須再 dry run 驗證，不用提交數推定完成。工具不自動重試 D1 寫入，失敗時先重跑 dry run 再處理。

R2 僅在同時提供 `--apply --bucket oculomotor-data` 時刪除，任何其他 bucket 都拒絕。每次最多 8 個刪除請求；429、5xx 與網路錯誤最多嘗試 4 次，退避至少 500／1000／2000 ms，並尊重最多 30 秒的數值 `Retry-After`。同一組請求全部結束後若仍有失敗，停止後續刪除，印已刪除的部分計數並以非零狀態結束。游標重複、回應格式不符與含 `.`／`..` 路徑段的 key 也會停止；後者避免 fetch 正規化路徑後誤刪其他資源，需由擁有者另外評估這類特殊 key。

## 清理後驗證

重跑兩支 dry run：D1 兩表應為 `wouldChange=0` 且 `unparseable=0`；R2 應為 `scanned=0`、`bytes=0`。若有樂觀檢查跳過、部分失敗或新資料，先查明原因再重跑 apply，最後再驗證。表總筆數應與維護前相同。

下列只回傳計數；不輸出紀錄內容。可先存成自己的本機 SQL 檔（例如 OS temp 內的 `verify-raw-cleanup.sql`），再執行：

```powershell
npx wrangler d1 execute rehab_db --config apps/rehabtrainerhub/wrangler.workers.jsonc --remote --json --file "$env:TEMP/verify-raw-cleanup.sql"
```

```sql
SELECT 'training_records' AS table_name, COUNT(*) AS total FROM training_records
UNION ALL SELECT 'game_runs', COUNT(*) FROM game_runs;

SELECT COUNT(*) AS invalid_training_json FROM training_records
WHERE NOT json_valid(payload_json)
   OR (summary_json IS NOT NULL AND NOT json_valid(summary_json));
SELECT COUNT(*) AS invalid_run_json FROM game_runs WHERE NOT json_valid(result_json);

WITH records AS (
  SELECT payload_json AS value FROM training_records
  UNION ALL SELECT summary_json FROM training_records WHERE summary_json IS NOT NULL
), valid_records AS (
  SELECT CASE WHEN json_valid(value) THEN value ELSE '{}' END AS value FROM records
)
SELECT COUNT(*) AS remaining_raw_fields FROM valid_records, json_tree(valid_records.value) AS field
WHERE field.key IN ('gaze_samples', 'webgazer_data')
   OR (field.type = 'array' AND field.key NOT IN ('results', 'rawFiles')
       AND json_array_length(field.value) > 0)
   OR (field.key = 'results' AND field.type = 'array'
       AND (json_array_length(field.value) > 1
            OR json_type(field.value, '$[0].trial_index') IS NOT NULL));

WITH runs AS (
  SELECT CASE WHEN json_valid(result_json) THEN result_json ELSE '{}' END AS value FROM game_runs
)
SELECT COUNT(*) AS remaining_run_trials FROM runs
WHERE COALESCE(json_array_length(value, '$.detailRows'), 0) > 0
   OR COALESCE(json_array_length(value, '$.scoreProjection.rounds'), 0) > 0;
```

除了總筆數，各個計數應為 0。此 SQL 檢查典型逐筆欄位；legacy 白名單投影是否完全符合現行 API，以工具第二次 dry run 的 `wouldChange=0` 為準。

## 刪除眼動 CSV 對介面的影響

- `GET /api/oculomotor-data` 的帳號清單不再列出已刪 CSV。指定舊 `recordId` 下載時回 404，D1 摘要仍可讀取。
- 已開啟的進度頁可能還有舊下載鈕。點擊後，現行 `downloadGazeCsv` 會處理 404、移除該項並顯示狀態訊息，不會崩潰。重新載入後顯示沒有 CSV 的空清單。
- **既有文案限制：** 404 提示與空清單目前提及「封存空間／已封存」。本次刪除工具不建立封存副本，所以不能將該提示視為復原保證；這些已知測試檔是否另有 pCloud 副本，須由擁有者確認。本次依任務要求不修改產品行為或文案。
- `POST /api/records` 對官方眼動成果仍會確認相符的私人 CSV 或 `receipts/`，並比對版本與樣本數。兩者都刪除後，沒有重新上傳匹配 CSV 的新保存或重試仍回 409，錯誤訊息為 `Save the matching private gaze CSV before this result.`。不放寬這項檢查，也不移除已存在的 D1 摘要。

## 無法復原的資料

舊 D1 的逐回合、逐筆陣列與眼動樣本不會由工具另行備份或轉存 CSV；超過 D1 Time Travel 保留期間後，不能靠 D1 復原。R2 直接刪除不受 D1 Time Travel 保護，刪除後本工具沒有復原方法。若擁有者另有已核對的獨立備份可另行處理，但本次不假設它存在，也不清理它。刪除 checksums 與 receipts 同時失去該批舊測試檔的重試／封存證明。

## 本機證據與官方介面核對

測試先於實作新增，第一次執行兩檔因工具模組不存在而失敗。後續先加入兩項針對實際 Wrangler 檔案匯入回應、R2 dot 路徑段的測試，分別重現錯誤的受影響列計數假設與缺少路徑防護，再做最小修正。測試涵蓋摘要轉換、現行格式不變、重跑冪等、SQLite 真正執行 SQL 跳脫與樂觀條件、100 列分頁、50 筆批次與失敗清檔、憑證來源、隱私輸出、確認參數、游標迴圈、8 併發與退避停止。

最後對照第三方 API 補上既有總數與 projection 不一致的測試，先重現錯誤保留 99 而非實際 1，再改為只有仍有逐筆陣列時依現行 API 重算；已清理的列仍維持原總數。

本機最終驗證：新工具測試 16/16、records 測試 14/14、官方發布工具測試 3/3、`npm run test:hub-functions` 306/306、`npm run test:cloudflare-deploy` 41/41、`npm run test:naming` 的 2/2 與全倉庫命名掃描通過。兩個 Function 檔通過 `node --check`；上述五段驗證 SQL 已在記憶體 SQLite 與清理後假資料執行通過。Hub functions 首次整體執行曾在另一個並行任務的 `education-feed` 變更中失敗，沒有修改該任務檔案，待其產品碼完成後重跑全數通過。

R2 介面已核對 Cloudflare 官方 [List Objects](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/list/) 與 [Delete Object](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/objects/methods/delete/)：清單路徑為 `/accounts/{account_id}/r2/buckets/{bucket_name}/objects`，使用 `per_page`（最多 1000）、`cursor`，物件為 `result[]` 的 `key`／`size`，後續分頁依 `result_info.is_truncated`／`cursor`。工具不傳 prefix 或 delimiter；刪除逐段編碼 key，保留路徑內的 `/`。沒有用正式 API 試探回應。D1 檔案匯入回應另外核對本機 Wrangler 4.155.0 原碼，使用與正式工具相同的成功 envelope 測試。

D1 `--file` 匯入時，Wrangler 會先在 stdout 印出上傳進度，再印 JSON。第一次正式 apply 因此在第一批送出後判定失敗並停止；`ParseWranglerJson` 改為從第一個 `[` 或 `{` 開始解析，並加入測試。

## 執行紀錄（2026-10-29）

1. 清理前 Time Travel bookmark：`000005db-00000002-00005113-9edf1e275dc7bc2295b830cd7000a85d`。在 D1 Time Travel 保留期間內可用上方 `restore` 指令還原整個資料庫（會一併還原之後的新寫入）。
2. D1 dry run：`training_records` 178 列，98 列需清理，`unparseable=0`；`game_runs` 0 列。
3. 第一次 apply 送出第一批 50 列後，因上述 stdout 解析問題停止。修正後重跑 apply，送出其餘 48 列。
4. 再次 dry run：`training_records` 178 列全部 `unchanged`，`wouldChange=0`、`unparseable=0`。抽查最大 5 列：JSON 有效、最大 1,453 bytes，`score.rounds` 為空且保留 `scoreRoundCount`。
5. 眼動 R2：dry run 只有 `users/` 1 個物件（22,084 bytes），沒有 `checksums/`／`receipts/`。apply 刪除 1 個；再次 dry run 為 `scanned=0`。

