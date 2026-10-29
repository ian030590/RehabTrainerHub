# 原始 CSV 定期同步至 pCloud

日期：2026-10-29，Task G。pCloud 改用 EU WebDAV，不需註冊 API 應用程式。本次只有本機修改與替身測試，未建立正式 bucket、設定 secrets、部署或存取擁有者的 pCloud。寫入欄位、限制與待辦見 [原始資料儲存](raw-data-storage.md)。

## 同步範圍與路徑

獨立 Worker `rehab-raw-data-sync` 每天 19:17 UTC（臺灣隔天 03:17）執行。只綁定兩個私人 R2 bucket，沒有 D1、KV、Hub 認證或遊戲發布 bucket；不提供 HTTP 入口。Hub／runner 的既有部署命令不會部署此 Worker，runner 不取得這兩個 bucket。

| R2 來源 | pCloud 目的地（相對於根目錄） |
| --- | --- |
| `rehab-raw-data`：`pending/rounds/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` | `rounds/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |
| `rehab-raw-data`：`pending/<hand\|head\|pose\|tongue>/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` | `<hand\|head\|pose\|tongue>/<gameId>/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |
| `oculomotor-data`：`guests/<subjectId>/<recordId>.csv` | `eye/oculomotor-training/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |
| `oculomotor-data`：`users/<encoded userId>/<recordId>.csv`，僅限有效 Subject ID 與日期 metadata | `eye/oculomotor-training/<subjectId>/<YYYY-MM-DD>/<recordId>.csv` |

根目錄預設 `/RehabTrainerHub/raw-data`。新眼動日期取 metadata.recordedDate（官方 session issue time 依 Hub `REHAB_TIME_ZONE` 換算的日期，預設 Asia/Taipei），帳號路徑使用 metadata.subjectId，不使用帳號 ID。舊 guests 沒有有效日期 metadata 時取 R2 uploaded 的 UTC 日期；舊 users 缺少有效 Subject ID 或日期 metadata 則跳過。其餘類型沿用來源鍵的日期。CSV 以原始 bytes 傳送，不重新編碼或改寫欄位。

`gameId`／`recordId` 只接受小寫英數與單一連字號分隔，最長 128 字元；`subjectId` 必須是本站使用的小寫 UUID v4；日期必須是真實的 ISO 日期。非 `.csv`、不合路徑規則或超過 25 MiB 的物件保留在 R2，記為 `skipped`，不讀取內容上傳。其他 prefix 不處理。

## 驗證及刪除規則

1. 以 R2 `list` 分頁列舉，每次先處理 `pending/`，再處理 `guests/` 與 `users/`；list 帶 `include: ['customMetadata']`。眼動來源的 Subject ID／日期對應會在 get 與刪除前 head 再檢查。讀取時帶 `onlyIf: { etagMatches }`，核對 etag、大小與 version，並計算原始 bytes 的 SHA-256。
2. 以 WebDAV `GET` 讀取目的檔。404 表示尚未上傳；200 且 bytes 長度與 SHA-256 均相同，視為已同步，不重傳。200 但內容不同則覆寫；宣告 `Content-Length` 超過 25 MiB 時不緩衝內容，直接進入覆寫流程。未宣告長度時也只讀取至來源大小上限，超過即停止。其他 HTTP 狀態視為該檔失敗。
3. 需要上傳時，從指定根目錄開始逐層 `MKCOL`，201 表示已建立，405 表示已存在；其他狀態失敗。同一輪快取已確認的目錄。以 `PUT` 傳送原始 bytes，`Content-Type: text/csv; charset=utf-8`，只接受 200／201／204。目的 URL 由固定端點及逐段 `encodeURIComponent` 的根目錄與來源對應路徑組成，目錄中的空格成為 `%20`。
4. 上傳後再次 `GET` 相同目的檔；只有 200、bytes 長度相同且 SHA-256 相同才算驗證完成。這是下載回讀比對，不依賴 pCloud API checksum 或回傳 metadata，也不計算 SHA-1。
5. 遠端副本驗證相符後，以 R2 `head()` 再查 etag、大小、version 與目標對應，與讀取時相同且未超時才刪除。任何驗證、權限、網路或 HTTP 錯誤都保留 R2 來源，等待後續排程。

若上傳後程式中斷，下一輪會由相同目的路徑找回已同步檔。若 R2 刪除失敗，下一輪先 GET 回讀比對，已相同就不重傳。不同內容以 PUT 覆寫相同路徑；這裡不保證遠端版本保留行為。

**來源必須保持不可變：** R2 Workers API 的 `delete(key)` 沒有條件式刪除參數；`head()` 與 `delete()` 之間不能形成原子比較刪除。程式會攔下檢查時已變動的物件，但不能保證攔下恰好在兩次呼叫之間發生的覆寫。所有來源寫入端必須用唯一 record key 與 `onlyIf: { etagDoesNotMatch: '*' }` 保護，不可覆寫或刪除後重用相同 key；同步期間也不能用其他工具改寫來源。兩個寫入端均以條件式建立 CSV，並保留 checksums/<CSV 鍵> 的空物件及 SHA-256，避免封存刪除後換 bytes 重用鍵；只有 CSV 寫入完成才建立 receipts/<CSV 鍵>，供成果驗證與追溯。保護物件不在同步 prefix 中，不能與原始 CSV 一起清除。[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)

每輪合計最多掃描 200 個物件，或約 10 分鐘，以先到者為準；跳過的物件也占掃描額度。pCloud 請求逐一執行，每個請求最多等待 30 秒，並受本輪剩餘時間限制。連續三次處理失敗就提前停止，不在同一輪密集重試；HTTP 5xx 錯誤也留待後續排程。列舉失敗會停止該 bucket，本輪仍可嘗試下一個 bucket。

沒有跨輪持久化游標。若前段一直累積不合法物件，或每天新增量超過額度，後段檔案可能持續延後。擁有者應查明 `skipped` 原因並另行保存／整理這些物件，再視實際流量調整排程與額度，不能直接把未驗證物件當作已同步刪除。

## 擁有者一次性設定

以下命令由擁有者在確認目的帳號及私人目錄後執行。本次未執行任何遠端命令。

1. 確認 `workers/raw-data-sync/wrangler.toml` 的 `[vars]` 使用 EU 設定 `PCLOUD_WEBDAV_URL = "https://ewebdav.pcloud.com"`。程式只接受這個端點與美國 `https://webdav.pcloud.com` 的精確值，不接受尾端 `/`、其他路徑、query、帳密或其他主機。
2. 確認 `PCLOUD_ROOT_FOLDER` 為指定私人目錄，預設 `/RehabTrainerHub/raw-data`。既有驗證不變：絕對路徑、每段以 ASCII 英數起頭，後續可用英數、空格、底線或連字號，每段最長 128 字元，全路徑最多 1,024 字元；不可有 `..`、百分比編碼、反斜線、空段或尾端 `/`，但 `/` 本身可用。
3. 若新私人 bucket 尚未由寫入端建立，先執行：

   ```sh
   npx wrangler r2 bucket create rehab-raw-data
   ```

   既有 `oculomotor-data` 沿用原 bucket。兩個 bucket 都不可公開，也不可綁定 runner。

4. 透過互動提示輸入 pCloud 登入 email 與密碼，不能把值放在命令參數、URL、repo 或日誌：

   ```sh
   npx wrangler secret put PCLOUD_WEBDAV_USERNAME --config workers/raw-data-sync/wrangler.toml
   npx wrangler secret put PCLOUD_WEBDAV_PASSWORD --config workers/raw-data-sync/wrangler.toml
   ```

   username 必須為非空的可列印字串，不能有 `:` 或控制字元；password 必須非空且不能有控制字元。認證只放在 `Authorization: Basic base64(utf8(username + ':' + password))`，所有請求均為 `redirect: 'error'`，不跟隨轉址。缺憑證、端點／root 無效或任一 bucket binding 不完整時，在列舉前記錄 `raw-data-sync refused: configuration` 並拒絕執行。

5. 若先前設定過 API token，刪除舊 secret；程式不再讀取它：

   ```sh
   npx wrangler secret delete PCLOUD_ACCESS_TOKEN --config workers/raw-data-sync/wrangler.toml
   ```

6. 確認來源 key 的不可覆寫保護後，手動部署獨立 Worker：

   ```sh
   npx wrangler deploy --config workers/raw-data-sync/wrangler.toml
   ```

   `scripts/deploy-cloudflare-workers.mjs` 只部署 `trainerhubgames` 與 `trainerhub`；目前 `.github/workflows/deploy-cloudflare-pages.yml` 透過該腳本部署這兩站，不會部署 `rehab-raw-data-sync`。CI 會執行相關測試，不能據此宣稱同步 Worker 已部署。確認它的 Cron 為 `17 19 * * *`。

[pCloud 官方 WebDAV 說明](https://help.pcloud.com/article/connect-to-pcloud-using-webdav-and-rsync)（2026-10-29 查閱）列出 EU／US 端點及登入 email／密碼。該頁說明 WebDAV 適合較小的傳輸，長時間的大型或頻繁備份可能中斷；本專案的 25 MiB 與每輪 200 檔是自身限制。本文不推定帳號方案或未實測的登入行為。

## 擁有者正式驗收

1. 使用不含真人資料的 CSV，例如以下內容（LF、無 BOM），保存原始 bytes 與 SHA-256：

   ```csv
   trial,score
   1,7
   ```

   為此測試產生全新的假 Subject ID UUID v4 與 record ID，經受保護的寫入流程建立符合來源規則的物件，不重用正式 key、不改寫既存物件。
2. 等待下一次 Cron。核對 pCloud 的根目錄與相對路徑，下載目的 CSV，比對 byte 長度及 SHA-256；同步 Worker 的 `deleted` 應增加，該 R2 CSV 才消失，checksums／receipts 保護物件保留。
3. 再用新的假物件做失敗情境：暫時設定錯誤 WebDAV 密碼，等待排程並確認 `failed` 增加而 R2 原檔保留，再依上方 secret 指令還原正確值。
4. 確認日誌未出現登入 email、密碼、來源鍵、Subject ID 或 CSV 內容。真實 pCloud 帳號、正式 bucket 與排程尚未在本次驗收。

## 查核日誌

在排程執行前開啟 Cloudflare Worker 的即時日誌，或使用：

```sh
npx wrangler tail --config workers/raw-data-sync/wrangler.toml
```

結束時記錄 `raw-data-sync summary`，內容為 `{ scanned, uploaded, alreadySynced, deleted, skipped, failed }`。

| 欄位 | 意義 |
| --- | --- |
| `scanned` | 本輪已檢查的來源物件數 |
| `uploaded` | PUT 回傳 200／201／204 的次數，後續 GET 回讀仍可能不符 |
| `alreadySynced` | 目的路徑 GET 回讀的 SHA-256 與 byte 長度已相符的次數 |
| `deleted` | 驗證完成且 R2 刪除呼叫成功的次數 |
| `skipped` | 不合路徑／副檔名／大小規則而保留的物件數 |
| `failed` | 檔案處理、列舉或分頁錯誤次數，可能包含未列入 `scanned` 的列舉錯誤 |

錯誤日誌只包含 bucket binding 名稱、當輪序號、固定處理階段，以及 WebDAV 方法名稱與數字 HTTP 狀態（例如 `raw-data-sync webdav PUT http=507`）；不輸出 URL、路徑、登入 email、密碼、來源鍵、Subject ID、CSV 內容或回傳錯誤文字。設定錯誤會記錄 `refused: configuration`，不產生成功摘要。檢查 `failed`／`skipped` 及 pCloud 實際檔案，不以 `uploaded` 單獨判定可刪除。

## 帳號眼動 CSV 的歷史限制

新 users 物件具有有效 customMetadata.subjectId 與 recordedDate 時會同步；帳號 ID 只留在原私人 bucket 的來源鍵，不進入 pCloud 路徑。Worker 沒有 D1 binding，也不查詢帳號資料。

**TODO：舊 users 物件缺少有效 Subject ID／日期 metadata 時，會列入 skipped，保留原檔，不上傳、不刪除。** 歷史對應與補登需另案核准，不能宣稱全部歷史眼動資料均已搬離 R2。滑鼠座標與歷史 D1 清理限制見 [原始資料儲存](raw-data-storage.md)。

## TDD 與本機驗證

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
