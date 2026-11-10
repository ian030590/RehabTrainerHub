# 原始 CSV 定期同步至 pCloud

更新：2026-11-10。EU OAuth `checksumfile` 修正版已部署至 `trainerhubsync`，使用現有 `PCLOUD_ACCESS_TOKEN`，以 pCloud 伺服器回傳的 SHA-256 與檔案大小核對 R2 原始 bytes。產品同步函式的隔離合成資料驗證已通過，正式 R2 下一輪排程尚未觀察，不能宣稱全歷史資料已同步。這是伺服器摘要驗證，並非逐檔下載回讀。寫入欄位、限制與待辦見 [原始資料儲存](raw-data-storage.md)。下方舊版部署與測試結果保留歷史證據，現行狀態以本文件前半部為準。

## 目前部署狀態（2026-11-10）

於 UTC `2026-11-10T07:48:36.226296Z` 部署 checksumfile 修正版，version 為 `6efcde2f-2a2f-4ce0-868a-7d28cbd43474`（100%），deployment 為 `73ab97c0-d124-4a10-aa51-52fc93653a89`。

遠端回讀程式確認使用 checksumfile、OAuth Bearer 與上傳後 file ID 檢查，沒有 getfilelink、WebDAV 或原生 auth。`PCLOUD_API_HOST=eapi.pcloud.com`、`PCLOUD_ROOT_FOLDER=/4_RehabTrainerHubData`、兩個原私人 R2 bindings、`PCLOUD_ACCESS_TOKEN` secret、`17 * * * *` 排程與停用公開入口均與本機一致。只部署同步 Worker，未部署 Hub／runner，未讀取或更改 secret 值，未 push。

正式 R2 未被本次人工測試讀寫，未手動觸發正式 Cron。記錄當下尚未觀察下一輪 UTC `2026-11-10T08:17:00Z` 排程；不得以部署回讀或隔離 probe 宣稱正式積壓與歷史資料已完成同步。現有 Cloudflare token 讀取 persisted logs 回覆 403，排程日誌仍需使用具權限的儀表板或憑證核對。

## 歷史：首次 API 部署（2026-11-10）

依擁有者要求，於 UTC `2026-11-10T04:53:47Z` 部署 `trainerhubsync` 的首個 OAuth API 版本，當時有效 version 為 `4e27c2c7-96d7-4e13-9a02-309facfcf500`（100%）。部署前遠端已有 `PCLOUD_API_HOST` 與 token secret，但程式仍使用 WebDAV，排程仍是每日 `17 19 * * *`；該次一併對齊 API 程式與每小時 `17 * * * *`。

部署後透過 Cloudflare API 回讀確認：`PCLOUD_API_HOST=eapi.pcloud.com`、`PCLOUD_ROOT_FOLDER=/4_RehabTrainerHubData`、`PCLOUD_ACCESS_TOKEN` 為 encrypted secret；兩個原 R2 bindings、compatibility date、observability 及停用公開入口均符合本機。下載遠端程式確認含 API 上傳、同名衝突與配額保護，不再含 WebDAV 參照。未讀取或重設 token 值，未手動觸發 CSV 搬移、建立正式測試物件或部署 Hub／runner。

部署前指定同步與 Worker 設定測試合計 185 項通過，Wrangler dry run 通過。實際 pCloud token 有效性、傳輸與刪除來源的端到端驗收仍待下一輪排程及擁有者核對，不能以設定回讀代替。下方一次性設定保留作為重建與操作指引。

後續實測該版 `getfilelink` 的 CDN 回讀 HTTP 410，回應 `This link was generated for another IP address.`，原因是下載連結的來源 IP 綁定。擁有者改選 EU `checksumfile` 伺服器摘要方案；不再使用 CDN 回讀、getzip、Cookie 或原生 auth token，也不需匯出瀏覽器登入憑證。

獨立 probe 已使用現有 OAuth token 成功呼叫 EU `checksumfile`，假 CSV 包含 Unicode、BOM 與 CRLF，回傳 SHA-256 與大小符合原始 bytes；假檔已清理，未讀寫 R2。該次 probe 證明 API 與現有 token 可用，部署與產品函式驗證另見本文件現行紀錄。checksumfile 的 SHA-256 只在 EU 提供，本方案只接受 `eapi.pcloud.com`；US 不降級為 SHA-1／MD5。[官方 checksumfile 說明](https://docs.pcloud.com/methods/file/checksumfile.html)

## 同步範圍與路徑

獨立 Worker `trainerhubsync` 每小時第 17 分鐘 UTC（臺灣時間每小時 :17）執行。只綁定兩個私人 R2 bucket，沒有 D1、KV、Hub 認證或遊戲發布 bucket；不提供 HTTP 入口。Hub／runner 的既有部署命令不會部署此 Worker，runner 不取得這兩個 bucket。

| R2 來源 | pCloud 目的地（相對於根目錄） |
| --- | --- |
| `rehab-raw-data`：`pending/rounds/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` | `rounds/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |
| `rehab-raw-data`：`pending/<hand\|head\|pose\|tongue>/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` | `<hand\|head\|pose\|tongue>/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |
| `oculomotor-data`：`guests/<subjectId>/<recordId>.csv` | `guest-eye/oculomotor-training/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |
| `oculomotor-data`：`users/<encoded userId>/<recordId>.csv`，僅限有效 Subject ID 與日期 metadata | `eye/oculomotor-training/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |

函式未設定根目錄時預設 `/RehabTrainerHub/raw-data`；目前 Worker 設定沿用 `/4_RehabTrainerHubData`。新眼動日期取 metadata.recordedDate（官方 session issue time 依 Hub `REHAB_TIME_ZONE` 換算的日期，預設 Asia/Taipei），帳號路徑使用 metadata.subjectId，不使用帳號 ID。舊 guests 沒有有效日期 metadata 時取 R2 uploaded 的 UTC 日期；舊 users 缺少有效 Subject ID 或日期 metadata 則跳過。其餘類型沿用來源鍵的日期。CSV 以原始 bytes 傳送，不重新編碼或改寫欄位；既有封存檔與路徑不搬移。

2026-11-06 安全修正：訪客改用獨立的 `guest-eye` 類型，帳號維持 `eye`，即使兩者的 Subject ID、record ID 與日期相同也不會共用目的檔。既有封存檔不搬移、不改寫；舊版已寫在 `eye` 下的訪客檔需另案核對來源，不能自動假設為帳號檔。

`gameId`／`recordId` 只接受小寫英數與單一連字號分隔，最長 128 字元；`subjectId` 必須是本站使用的小寫 UUID v4；日期必須是真實的 ISO 日期。非 `.csv`、不合路徑規則或超過 25 MiB 的物件保留在 R2，記為 `skipped`，不讀取內容上傳。其他 prefix 不處理。

## 驗證及刪除規則

1. 以 R2 `list` 分頁列舉，首次先處理 `pending/`，再處理 `guests/` 與 `users/`；後續從已保存的進度接續，完成三個來源後循環。list 帶 `include: ['customMetadata']`。眼動來源的 Subject ID／日期對應會在 get 與刪除前 head 再檢查。讀取時帶 `onlyIf: { etagMatches }`，核對 etag、大小與 version，並計算原始 bytes 的 SHA-256。
2. 以 EU `POST checksumfile` 的 `path` 查詢目的檔。HTTP 必須為 200，且 JSON `result` 必須為整數；只有初查的 `2002`（缺上層目錄）或 `2009`（缺檔）才視為尚未上傳。`result: 0` 時，核對檔名、檔案型別、file ID、大小及有效 SHA-256；pCloud 的 SHA-256 與本機原始 bytes 計算值、大小都相同才視為已同步。不同則記錄 `conflict`、增加 `failed` 並保留兩端檔案；其他 HTTP、API 或不合法回應均失敗。SHA-256 缺失時不採用 SHA-1／MD5，也不改走下載 API。
3. 需要上傳時，以 `POST createfolderifnotexists` 逐層建立目錄，同一輪快取已確認的目錄。`POST uploadfile` 使用 FormData，先放 `path`、`renameifexists=1`、`nopartial=1`，再放原始 CSV bytes 的檔案欄位。API 的 HTTP 200 不代表成功，還必須有 `result: 0`；回傳 metadata 必須只有一筆且檔名、父目錄 ID、檔案大小及型別符合預期。`renameifexists=1` 避免同名競態覆寫封存檔；若 API 將新檔改名，視為失敗、保留 R2 與遠端副本，由擁有者核對，不自動刪除衝突副本。[uploadfile](https://docs.pcloud.com/methods/file/uploadfile.html)、[createfolderifnotexists](https://docs.pcloud.com/methods/folder/createfolderifnotexists.html)
4. 上傳後再次以 `POST checksumfile({path})` 查詢相同目的路徑，除了 SHA-256 與大小一致，回傳 file ID 及父目錄 ID 還必須對應剛才 uploadfile 的檔案與已確認的目錄。改指向另一個檔案、父目錄不符或驗證階段缺檔均失敗。此檢查採 pCloud 伺服器回傳的 SHA-256，不逐檔下載，也不將 metadata hash 當成 SHA-256。[checksumfile](https://docs.pcloud.com/methods/file/checksumfile.html)
5. 遠端副本驗證相符後，以 R2 `head()` 再查 etag、大小、version 與目標對應，與讀取時相同且未超時才刪除。任何驗證、權限、網路或 HTTP 錯誤都保留 R2 來源，等待下一輪每小時排程或下一次完整列舉循環重試。

帳號眼動 CSV 只在下一輪同步封存前可從進度頁下載，排程正常且無積壓或失敗時約在上傳後一小時內封存（原為等到下一次臺灣時間 03:17），之後進度頁顯示既有的「已封存」提示。

若 uploadfile 已完整寫入但回應中斷，或 R2 刪除失敗，後續重訪同一來源時會先查 checksumfile，相符就不重傳。若遠端摘要或大小不符，會持續記為 `conflict` 並保留 R2；擁有者必須先核對與另存衝突檔，再決定如何恢復，不會自動覆寫。已保存的列舉進度可能讓失敗來源在後續每小時排程推進至下一次完整循環時才重試。

**來源必須保持不可變：** R2 Workers API 的 `delete(key)` 沒有條件式刪除參數；`head()` 與 `delete()` 之間不能形成原子比較刪除。程式會攔下檢查時已變動的物件，但不能保證攔下恰好在兩次呼叫之間發生的覆寫。所有來源寫入端必須用唯一 record key 與 `onlyIf: { etagDoesNotMatch: '*' }` 保護，不可覆寫或刪除後重用相同 key；同步期間也不能用其他工具改寫來源。兩個寫入端均以條件式建立 CSV，並保留 checksums/<CSV 鍵> 的空物件及 SHA-256，避免封存刪除後換 bytes 重用鍵；只有 CSV 寫入完成才建立 receipts/<CSV 鍵>，供成果驗證與追溯。保護物件不在同步 prefix 中，不能與原始 CSV 一起清除。[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)

每小時一輪，每輪合計最多 200 次成功上傳／已相符的封存檔處理，每日 24 輪合計上限為 4,800 檔；每輪另有 2,000 個來源物件的掃描上限，以及約 10 分鐘時間上限，以先到者為準。跳過、來源讀取／檢查失敗及封存衝突不占 200 檔額度。pCloud 請求逐一執行，每個請求最多等待 30 秒，並受本輪剩餘時間限制。連續三次網路／逾時、HTTP 401／403／408／429、5xx、轉址、無效 API 回應或服務層 API 錯誤就提前停止；單檔讀取、metadata／checksum 不符、衝突及其他單檔錯誤不累計此門檻。列舉失敗會停止該來源，本輪仍可嘗試下一個來源。

API JSON 回應限制為 64 KiB，宣告大小或串流讀取超限均取消。API `2008`（配額已滿）與 `2041`（連線中斷）也計入連續服務失敗，避免持續重讀來源並重試上傳。

`RAW_DATA` 的 `sync-state/raw-data-sync.json` 保存目前來源、該頁的 R2 cursor 與最後處理的鍵；頁中途停止時，下一小時略過已處理鍵並接續未處理檔案。此控制物件不屬於同步 prefix，不上傳 pCloud，也不刪除原始資料。掃描滿 2,000 個無效物件後，下輪會往後接續，不會永遠重看開頭；到達來源結尾後，保留的失敗物件會在後續循環再次檢查。進度讀取失敗或內容無效時，本輪在列舉前記為 `progress-read` 失敗；保存失敗記為 `progress-write`，可能使下輪重看舊頁，需由擁有者排查。約 10 分鐘的單輪時間上限低於一小時排程間隔；同步 Worker 應維持單一執行者，不同時手動執行另一輪。

## 擁有者一次性設定

以下命令供擁有者在確認目的帳號及私人目錄後執行；目前部署狀態以上方紀錄為準。

1. 目前擁有者的 OAuth token 已可呼叫 EU checksumfile，不需新增 token 或匯出 Cookie。重建時才需依 [pCloud OAuth 官方流程](https://docs.pcloud.com/methods/oauth_2.0/index.html) 取得目的帳號的 access token。`PCLOUD_API_HOST` 必須為 `eapi.pcloud.com`；本方案不支援 US `api.pcloud.com`，也不接受 scheme、路徑、query、帳密或其他主機。
2. 確認 `PCLOUD_ROOT_FOLDER` 沿用既有私人目錄 `/4_RehabTrainerHubData`，避免切到另一份封存。函式未設定時才用 `/RehabTrainerHub/raw-data`。既有驗證不變：絕對路徑、每段以 ASCII 英數起頭，後續可用英數、空格、底線或連字號，每段最長 128 字元，全路徑最多 1,024 字元；不可有 `..`、百分比編碼、反斜線、空段或尾端 `/`，但 `/` 本身可用。
3. 若新私人 bucket 尚未由寫入端建立，先執行：

   ```sh
   npx wrangler r2 bucket create rehab-raw-data
   ```

   既有 `oculomotor-data` 沿用原 bucket。兩個 bucket 都不可公開，也不可綁定 runner。

4. 目前沿用已設定的 `PCLOUD_ACCESS_TOKEN`，不必重設。以下僅供重建或正式憑證輪替時，透過互動提示輸入 OAuth token，不能把值放在命令參數、URL、repo 或日誌：

   ```sh
   npx wrangler secret put PCLOUD_ACCESS_TOKEN --config workers/raw-data-sync/wrangler.toml
   ```

   token 只放在 EU API 請求的 `Authorization: Bearer ...`，其他參數放 request body；不使用 Cookie／原生 auth token。所有請求均為 `redirect: 'manual'` 並拒絕轉址狀態。缺 token、EU host／root 無效或任一 bucket binding 不完整時，在列舉前記錄 `raw-data-sync refused: configuration` 並拒絕執行；`RAW_DATA` 另需支援 `put` 保存進度。舊 WebDAV 帳密不再由新程式讀取。[HTTP/JSON 協定](https://docs.pcloud.com/protocols/http_json_protocol/)

5. 現行 checksumfile 修正版已部署。以下供後續重建時，在確認來源 key 的不可覆寫保護與本機檢查後，部署獨立 Worker：

   ```sh
   npx wrangler deploy --config workers/raw-data-sync/wrangler.toml
   ```

   `scripts/deploy-cloudflare-workers.mjs` 只部署 `trainerhubgames` 與 `trainerhub`；目前 `.github/workflows/deploy-cloudflare-pages.yml` 透過該腳本部署這兩站，不會部署 `trainerhubsync`。CI 會執行相關測試，不能據此宣稱同步 Worker 已部署。確認它的 Cron 為 `17 * * * *`。

6. 遠端 WebDAV secrets 已移除，目前只有既有 OAuth token 供本方案使用，不需設定 `PCLOUD_AUTH_TOKEN`。若重建舊 WebDAV 版本，必須另行恢復其 URL 與帳密 secrets，不能假設仍存在。

若驗收失敗，保留 R2 原檔並停止宣稱同步完成；回退前確認上一版的憑證與設定。首個 OAuth API 版本已有 CDN IP 綁定造成 410 的實測紀錄，回退至該版不能視為修復下載問題。新舊版沿用相同根目錄、來源鍵及接續進度，不需搬移既有封存；不要同時啟動兩個同步執行者。25 MiB、200 檔及 10 分鐘是本專案限制。

## 擁有者正式驗收

1. 使用不含真人資料的 CSV，例如以下內容（LF、無 BOM），保存原始 bytes 與 SHA-256：

   ```csv
   trial,score
   1,7
   ```

   為此測試產生全新的假 Subject ID UUID v4 與 record ID，經受保護的寫入流程建立符合來源規則的物件，不重用正式 key、不改寫既存物件。
2. 部署後等待下一次 Cron。核對 pCloud 的根目錄與相對路徑，確認 checksumfile 回傳 SHA-256 與大小和原始 CSV 相符、上傳後 file ID／父目錄及 R2 head 檢查均通過；同步 Worker 的 `deleted` 才應增加，該 R2 CSV 才消失，checksums／receipts 保護物件保留。這項自動校驗是伺服器摘要，人工下載另作補充驗證，不能寫成 Worker 已逐檔回讀。
3. 再用新的假物件做失敗情境：暫時設定錯誤 access token，等待排程並確認 `failed` 增加而 R2 原檔保留，再依上方 secret 指令還原正確值。用新的假 key 驗證已有不同 bytes 的目的檔不被覆寫，原 R2 CSV 保留。
4. 確認日誌未出現 token、來源鍵、Subject ID 或 CSV 內容。記錄 EU checksumfile、摘要及大小比對結果，確認沒有 CDN／getzip 請求；目前完整 Worker 的正式來源同步與刪除流程尚未驗收。

## 查核日誌

2026-10-29 起 `wrangler.toml` 開啟 `[observability]`（Workers Logs），每輪日誌會保存，事後可在 Cloudflare 儀表板 Workers & Pages → `trainerhubsync` → Logs 查看，不必在排程時守著即時日誌。保存期間與每日額度依 Cloudflare 方案。即時查看仍可用：

```sh
npx wrangler tail --config workers/raw-data-sync/wrangler.toml
```

結束時記錄 `raw-data-sync summary`，內容為 `{ scanned, uploaded, alreadySynced, deleted, skipped, failed }`。

| 欄位 | 意義 |
| --- | --- |
| `scanned` | 本輪已檢查的來源物件數 |
| `uploaded` | uploadfile 成功且 metadata 相符的次數，後續 checksumfile 仍可能不符 |
| `alreadySynced` | 目的路徑 checksumfile 回傳的 SHA-256 與大小已相符的次數 |
| `deleted` | 驗證完成且 R2 刪除呼叫成功的次數 |
| `skipped` | 不合路徑／副檔名／大小規則而保留的物件數 |
| `failed` | 檔案處理、衝突、列舉、分頁或進度讀寫錯誤次數，可能包含未列入 `scanned` 的錯誤 |

錯誤日誌只包含 bucket binding 名稱、當輪序號、固定處理階段、API 方法與數字 HTTP 狀態／result；不輸出 URL、路徑、token、來源鍵、Subject ID、CSV 內容或回傳錯誤文字。設定錯誤會記錄 `refused: configuration`，不產生成功摘要。檢查 `failed`／`skipped` 及 pCloud 實際檔案，不以 `uploaded` 單獨判定可刪除。

## 帳號眼動 CSV 的歷史限制

新 users 物件具有有效 customMetadata.subjectId 與 recordedDate 時會同步；帳號 ID 只留在原私人 bucket 的來源鍵，不進入 pCloud 路徑。Worker 沒有 D1 binding，也不查詢帳號資料。

**TODO：舊 users 物件缺少有效 Subject ID／日期 metadata 時，會列入 skipped，保留原檔，不上傳、不刪除。** 歷史對應與補登需另案核准，不能宣稱全部歷史眼動資料均已搬離 R2。滑鼠座標與歷史 D1 清理限制見 [原始資料儲存](raw-data-storage.md)。

## 2026-11-10 EU checksumfile 驗證

先加入 EU-only checksumfile 行為測試，舊產品仍走 getfilelink，失敗於 `alreadySynced` 預期 1、實際 0；再修改產品程式。修正後 `rawDataSync.test.mjs` 202／202、`test:hub-functions` 480／480、`test:cloudflare-deploy` 52／52、`test:naming` 2 項及來源靜態檢查均通過，語法檢查與 Wrangler dry run 通過。既有測試入口已納入 root `test:ci`，本次未 push；下方首次 API 版的完整七項 gate 數字屬歷史結果。

另以實際產品 `ProcessRawDataSync` 執行隔離遠端 probe：來源使用 memory buckets，沒有 R2 binding，三個合成 CSV 分別為 Unicode LF、BOM CRLF、空檔。首次執行 `uploaded: 3, deleted: 3, failed: 0`；以相同合成來源重試，`alreadySynced: 3, deleted: 3, uploaded: 0, failed: 0`。其中 deleted 僅為 memory bucket 來源刪除。實際呼叫包括 checksumfile 缺檔 2002 一次、2009 兩次、成功六次及 uploadfile 三次；三個假檔與五個資料夾的八次清理呼叫均為 `result: 0`。這驗證 OAuth API 上傳、伺服器摘要比對、既存檔重試及產品刪除順序，沒有讀寫正式 R2 或手動觸發正式排程。

現行部署與回讀結果見本文件頂部。正式 R2 排程與歷史積壓狀態仍待觀察，不能以合成來源成功代替。

## 歷史：2026-11-10 首次 API 遷移驗證

先改寫 Worker 設定測試，舊設定執行 `node --test --test-name-pattern='raw CSV sync is a separate' scripts/check-cloudflare-workers.test.mjs`：0 通過、1 失敗，原因為缺少 `PCLOUD_API_HOST = "eapi.pcloud.com"`。修改設定後同一命令為 1 通過、0 失敗。設定測試沿用 `test:cloudflare-deploy`，同步替身測試由 `test:hub-functions` 的既有 glob 執行，兩者都由 root `test:ci` 納入；不新增測試入口。

`node --test scripts/check-cloudflare-workers.test.mjs`：22 通過、0 失敗。確認獨立排程只綁兩個私人 CSV bucket、token 沒有放入一般 vars，runner 未取得私人 bucket；`git diff --check` 通過。

同步測試先將 fixture 改為 API host／token，舊產品執行 `uploads exact CSV bytes` 測試失敗於 `Invalid raw data sync configuration`。改用 API 後，`rawDataSync.test.mjs` 共 163 項通過，保留來源路徑、分頁進度、長度／SHA-256、R2 不可變檢查，並新增 HTTP 200 內的 API 錯誤、JSON 及大小限制、下載連結驗證、認證隔離、同名競態與回傳 metadata 不符的回歸。配額／連線失敗的六項測試另先失敗於掃描 `8 !== 3`，修正錯誤分類後全數通過。

root `test:ci` 的七項 gate 均完成驗證：naming（2 項）、PWA（3 項）、game-architecture（1,400 項及 TypeScript）、hub-functions（441 項）、gamerunner（78 項）、entrypoints（各子套件及靜態檢查）、cloudflare-deploy（52 項）通過。初次執行的 WindowsApps Bash 發生 `EACCES`，改以已安裝的 Git Bash `usr/bin` 加入該次命令的 PATH 後，架構 gate 通過；runner 的 esbuild 又因沙箱拒絕讀取上層目錄而失敗，剩餘三項 gate 於沙箱外重新執行通過，沒有修改或略過測試。同步函式及 Worker entry 均通過 `node --check`。`npm run prepare` 已執行，`core.hooksPath` 確認為 `.githooks`；本次未 commit 或 push。

本機替身測試不能代替正式 API token、下載主機及 Cron 驗收；部署與秘密設定仍待擁有者執行。

## 歷史：2026-10-29 WebDAV TDD 與本機驗證

先改寫 WebDAV 替身測試與同步設定測試，尚未改產品程式時執行：

```sh
node --test apps/rehabtrainerhub/functions/_lib/rawDataSync.test.mjs scripts/check-cloudflare-workers.test.mjs
```

結果 40 通過、55 失敗：舊程式只接受 API host／token，拒絕新的 WebDAV 設定；舊 API-only 設定仍被接受；Worker 設定也還沒有 WebDAV URL。另先加入回應本文釋放測試，確認 MKCOL 後未釋放連線使流程無法完成（0 通過、1 失敗），再加上非 GET 回應的取消讀取。測試使用條件式假 R2 與具有資料夾 map 的假 WebDAV，沒有連線 pCloud 或 Cloudflare。

覆蓋三個來源、GET 回讀大小／SHA-256、相符檔不重傳、不同內容覆寫、MKCOL 405 與跨檔／跨頁快取、PUT 成功狀態、HTTP／逾時失敗保留、三次連續失敗停止、編碼路徑與 UTF-8 帳密／CSV、過大 GET 不緩衝、設定拒絕、認證與日誌不洩漏，以及原有 R2 etag／version／metadata、分頁、200 檔與 10 分鐘預算。

交付 gates：

```sh
node --test apps/rehabtrainerhub/functions/_lib/rawDataSync.test.mjs
node --check apps/rehabtrainerhub/functions/_lib/rawDataSync.js
npm run test:hub-functions
npm run test:cloudflare-deploy
npm run test:naming
```

最終結果（2026-10-29）：

| 指令 | 結果 |
| --- | --- |
| `node --test apps/rehabtrainerhub/functions/_lib/rawDataSync.test.mjs` | 84 通過、0 失敗 |
| `node --test apps/rehabtrainerhub/functions/_lib/rawDataSync.test.mjs scripts/check-cloudflare-workers.test.mjs` | 100 通過、0 失敗 |
| `node --check apps/rehabtrainerhub/functions/_lib/rawDataSync.js` | 通過 |
| `node --check workers/raw-data-sync/index.js` | 通過（入口未修改） |
| `npm run test:hub-functions` | 305 通過、0 失敗 |
| `npm run test:cloudflare-deploy` | 39 通過、0 失敗 |
| `npm run test:naming` | 2 通過、0 失敗；來源掃描通過 |

共用工作樹曾出現其他任務的 Blogger 與 D1 清理測試失敗；以上為其後的重跑結果，未修改那些任務的程式或測試。已核對 R2 來源、預算、root／bucket 驗證、條件式讀取、TargetSegments／SameObject 與 head／delete 區段保持不變；本次六個檔案保留 LF，沒有新增 U+2014 或空白差異。已執行狀態與 conflicted 檔搜尋；其他並行修改保留。

正式 secrets、舊 token 移除、獨立 Worker 部署與假 CSV 排程驗收由擁有者執行，本機替身測試不能代替正式驗收。

## 歷史：2026-11-06 WebDAV 安全修正驗證

先新增 11 項回歸測試，產品程式未修改時全部失敗。主要證據：

- `a guest eye upload cannot replace an archived account CSV with the same subject, record and date`：`AssertionError [ERR_ASSERTION]: the archived account bytes must remain unchanged`，實際 `'trial,score\n1,9\n'`，預期 `'trial,score\n1,7\n'`。
- `more than 200 oversized objects cannot block later valid raw and account CSVs`：`AssertionError [ERR_ASSERTION]: valid CSVs after the skipped objects must be archived`，`0 !== 2`；malformed 版本同樣失敗。
- `a persisted listing position lets later runs pass a full run of skipped objects`：`AssertionError [ERR_ASSERTION]: the next run must continue past skipped objects`，`0 !== 1`。

初版修正另驗條件式 PUT 的相同／不同內容競態、完整 PUT 回應中斷後恢復、頁中途超時接續、進度讀寫失敗及服務故障門檻。HTTP 408／429 的停止測試先失敗於 `8 !== 3`，再補入服務層級錯誤。當時 `npm run test:hub-functions` 為 376 通過、0 失敗；兩個指定測試檔合計 114 通過、0 失敗。既有 glob 自動包含新增測試，root `test:ci` 不需改線；`npm run test:naming` 為 2 通過、0 失敗且來源掃描通過。修改的同步函式與測試，以及未修改的眼動 API 與測試均通過 `node --check`。條件式 PUT 與其競態測試已由下述 sec-t5b 追修取代。

搜尋 `games/oculomotor-training`、`app` 與 `packages/ui`：現行 POST 呼叫僅在 `packages/ui/src/saveOculomotorCsv.ts`，由 `app/train/R2GameOverlay.tsx` 使用，固定附 `officialGameVersion` 與 `runSessionToken`；進度頁只 GET。未找到不帶官方 session token 的現行前端上傳呼叫。API 的舊訪客路徑與上傳契約保留相容性，沒有移除。

sec-t5b 追修：pCloud 對 `If-None-Match: *` 的支援未驗證，故移除條件式標頭與 412 特例；先新增 `PUT requests omit the If-None-Match header`，確認修正前失敗於 `'*' !== null`，並將條件式建立競態測試替換為 412 上傳失敗測試。每小時同步維持單一執行者，上傳前 GET 仍拒絕不同內容；GET 與 PUT 之間沒有原子保護，不得同時由其他程式或人工寫入封存目的路徑。

追修後 `rawDataSync.test.mjs` 為 105 通過、0 失敗，`npm run test:hub-functions` 為 376 通過、0 失敗；同步函式與測試均通過 `node --check`。

本次未連線 pCloud／Cloudflare、未部署或搬移既有封存檔。正式 WebDAV 驗收仍由擁有者執行；不同或不完整的既有封存檔需人工核對，不能以自動覆寫恢復。
