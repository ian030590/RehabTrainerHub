# 原始 CSV 定期同步至 pCloud

日期：2026-10-24；2026-10-29 隨 Task D 補上帳號眼動 metadata 對應與寫入端契約。尚未建立正式 bucket、設定權杖、部署或存取擁有者的 pCloud。寫入欄位、限制與待辦見 [原始資料儲存](raw-data-storage.md)。

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

1. 以 R2 `list` 分頁列舉，每次先處理 `pending/`，再處理 `guests/` 與 `users/`；list 帶 include: ['customMetadata']。眼動來源的 Subject ID／日期對應會在 get 與刪除前 head 再檢查。讀取時帶列舉所得的 etag 條件，核對 etag、大小與 version，並計算 bytes 的 SHA-1 與 SHA-256。
2. 先用 pCloud `checksumfile` 查目的路徑。大小及 SHA-1 相同，且回應含 SHA-256 時也相同，視為前次已同步；不再上傳。
3. 目的檔不存在或內容不同時，從 pCloud 根 folder id `0` 逐層呼叫 `createfolderifnotexists`，同一輪快取 folder id。以 `multipart/form-data` 上傳，依序放 `folderid`、`nopartial=1` 與檔案；不設定 `renameifexists`，因此重試沿用同一路徑。
4. 核對上傳回傳的 file id、檔名及大小，再依該 file id 呼叫 `checksumfile`。大小與 SHA-1 必須完全相同；若有 SHA-256 也必須相同。HTTP 成功仍須檢查 JSON `result: 0`。查路徑時只有 `2002`（父資料夾不存在）、`2005`（資料夾不存在）與 `2009`（檔案不存在）會進入建立／上傳流程；其他錯誤碼記為失敗並保留 R2 原檔。
5. 確認目的檔相符後，以 R2 `head()` 再查 etag、大小與 version，與讀取時相同且未超時才刪除。任何檢查失敗、權限／網路／API 錯誤都保留 R2 來源，等待後續排程。

若上傳後程式中斷，下一輪可由相同目的路徑找回已同步檔。若刪除失敗，下一輪亦先比對目的檔，不必重複上傳。pCloud 同名檔覆寫會保留舊 revision；相同內容的重送只更新修改時間。依據：[上傳 API](https://docs.pcloud.com/methods/file/uploadfile.html)、[摘要 API](https://docs.pcloud.com/methods/file/checksumfile.html)、[建立資料夾 API](https://docs.pcloud.com/methods/folder/createfolderifnotexists.html)。

**來源必須保持不可變：** R2 Workers API 的 `delete(key)` 沒有條件式刪除參數；`head()` 與 `delete()` 之間不能形成原子比較刪除。程式會攔下檢查時已變動的物件，但不能保證攔下恰好在兩次呼叫之間發生的覆寫。所有來源寫入端必須用唯一 record key 與 `onlyIf: { etagDoesNotMatch: '*' }` 保護，不可覆寫或刪除後重用相同 key；同步期間也不能用其他工具改寫來源。兩個寫入端均以條件式建立 CSV，並保留 checksums/<CSV 鍵> 的空物件及 SHA-256，避免封存刪除後換 bytes 重用鍵；只有 CSV 寫入完成才建立 receipts/<CSV 鍵>，供成果驗證與追溯。保護物件不在同步 prefix 中，不能與原始 CSV 一起清除。[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)

每輪合計最多掃描 200 個物件，或約 10 分鐘，以先到者為準；跳過的物件也占掃描額度。pCloud 請求逐一執行，每個請求最多等待 30 秒，並受本輪剩餘時間限制。連續三次處理失敗就提前停止，不在同一輪密集重試；5xxx 錯誤也留待後續排程。列舉失敗會停止該 bucket，本輪仍可嘗試下一個 bucket。

沒有跨輪持久化游標。若前段一直累積不合法物件，或每天新增量超過額度，後段檔案可能持續延後。擁有者應查明 `skipped` 原因並另行保存／整理這些物件，再視實際流量調整排程與額度，不能直接把未驗證物件當作已同步刪除。

## 擁有者一次性設定

以下命令由擁有者在確認目的帳號及目錄後執行。本次未執行任何遠端命令。

1. 在 [pCloud My Apps](https://docs.pcloud.com/my_apps/) 註冊應用程式，依 [OAuth 2.0 文件](https://docs.pcloud.com/methods/oauth_2.0/) 完成帳號授權並取得 access token。不要把 token 放進 repo、工單、命令參數或日誌；請在 CLI 的 secret 輸入提示中貼上。
2. 確認帳號區域，修改 `workers/raw-data-sync/wrangler.toml` 的 `[vars]`：美國 `PCLOUD_API_HOST = "api.pcloud.com"`，歐洲 `PCLOUD_API_HOST = "eapi.pcloud.com"`。只能填這兩個純 hostname，不接受網址、其他主機或缺值。
3. 確認 `PCLOUD_ROOT_FOLDER` 為擁有者指定的私人目錄。必須是絕對路徑，不可有 `..`、百分比編碼、反斜線、空白路徑段或尾端 `/`；`/` 本身可用。每段以 ASCII 英數起頭，後續可用英數、空格、底線或連字號，最長 128 字元，全路徑最多 1,024 字元。程式會逐層建立缺少的父目錄。
4. 若新的私人 bucket 尚未由寫入端工作建立，執行一次：

   ```sh
   npx wrangler r2 bucket create rehab-raw-data
   ```

   既有 `oculomotor-data` 沿用原 bucket。兩個 bucket 均不可開公開存取，也不可綁定到 runner。

5. 設定 server-only secret，依提示輸入 token：

   ```sh
   npx wrangler secret put PCLOUD_ACCESS_TOKEN --config workers/raw-data-sync/wrangler.toml
   ```

   token 僅透過 `Authorization: Bearer <token>` 傳給固定區域主機，請求 URL 不含 token，亦拒絕跟隨 HTTP 轉址。缺少 token、host／root 無效或缺少任一 bucket binding 時，整輪在列舉前拒絕執行。

6. 確認新寫入端的 key 不可覆寫保護後，部署：

   ```sh
   npx wrangler deploy --config workers/raw-data-sync/wrangler.toml
   ```

   確認 Cloudflare Cron 為 `17 19 * * *`。擁有者可先以不含真人資料的 CSV 在下一次排程驗收：pCloud 檔名／原始 bytes 相符，R2 來源才消失；再以錯誤 token 或目的目錄權限驗證來源保留。真實帳號與跨區 API 尚未在本次驗證。

## 查核日誌

在排程執行前開啟 Cloudflare Worker 的即時日誌，或使用：

```sh
npx wrangler tail --config workers/raw-data-sync/wrangler.toml
```

結束時記錄 `raw-data-sync summary`，內容為 `{ scanned, uploaded, alreadySynced, deleted, skipped, failed }`。

| 欄位 | 意義 |
| --- | --- |
| `scanned` | 本輪已檢查的來源物件數 |
| `uploaded` | 上傳回傳有效 file id、檔名及大小的次數，後續摘要仍可能不符 |
| `alreadySynced` | 目的路徑原有檔案的摘要及大小已相符的次數 |
| `deleted` | 驗證完成且 R2 刪除呼叫成功的次數 |
| `skipped` | 不合路徑／副檔名／大小規則而保留的物件數 |
| `failed` | 檔案處理、列舉或分頁錯誤次數，可能包含未列入 `scanned` 的列舉錯誤 |

錯誤日誌只包含 bucket binding 名稱、當輪序號、固定處理階段，以及 pCloud 的數字 HTTP／result 狀態；不輸出來源鍵、Subject ID、CSV 內容、回傳錯誤文字或 token。設定錯誤會記錄 `refused: configuration`，不產生成功摘要。檢查 `failed`／`skipped` 及 pCloud 實際檔案，不以 `uploaded` 單獨判定可刪除。

## 帳號眼動 CSV 的歷史限制

新 users 物件具有有效 customMetadata.subjectId 與 recordedDate 時會同步；帳號 ID 只留在原私人 bucket 的來源鍵，不進入 pCloud 路徑。Worker 沒有 D1 binding，也不查詢帳號資料。

**TODO：舊 users 物件缺少有效 Subject ID／日期 metadata 時，會列入 skipped，保留原檔，不上傳、不刪除。** 歷史對應與補登需另案核准，不能宣稱全部歷史眼動資料均已搬離 R2。滑鼠座標與歷史 D1 清理限制見 [原始資料儲存](raw-data-storage.md)。

## TDD 與本機驗證

先加入同步行為測試及 worker 隔離設定測試，再執行：

```sh
node --test apps/rehabtrainerhub/functions/_lib/rawDataSync.test.mjs scripts/check-cloudflare-workers.test.mjs
```

初次結果 15 通過、2 失敗：同步測試因缺少 `rawDataSync.js` 而無法載入，部署測試因缺少 `workers/raw-data-sync/wrangler.toml` 失敗。建立產品程式後相同命令 48/48 通過；補上換行路徑／設定的邊界測試後，同步測試 34/34 通過。測試使用具 etag／version 的假 R2 bucket 與 stub fetch，涵蓋上傳、已有相符檔、摘要／大小／EU SHA-256 不符、API 錯誤、設定拒絕、權杖不洩漏、路徑驗證、逐層資料夾快取、分頁／額度／超時、連續失敗停止，以及來源變動時保留。

補上刪除失敗後跨輪恢復、最後驗證的 HTTP／JSON／result 錯誤後，相同針對性命令最終 54/54 通過（同步 38 項、Workers 16 項）。交付 gate 結果：

| 指令 | 本次結果 |
| --- | --- |
| `npm run test:hub-functions` | 與 Subject ID、原始資料儲存整合後 210/210 通過，含 `2002`／`2005`／`2009` 缺資料回歸測試 |
| `npm run test:cloudflare-deploy` | 20/20 通過，含本機 dry-run 與 API 替身檢查，未呼叫正式 wrangler |
| `npm run test:naming` | 2/2 通過，來源命名掃描通過 |
| `node --check apps/rehabtrainerhub/functions/_lib/rawDataSync.js` | 通過 |
| `node --check workers/raw-data-sync/index.js` | 通過 |

本次沒有放寬既有測試。已執行 `git status --short` 與排除 `node_modules` 的 `conflicted` 檔案搜尋；沒有 Task E 建立的衝突副本，既有及其他工作的產物未變動。Task E 檔案無 U+2014，既有部署測試只有 17 行新增，沒有整檔換行重寫。

正式 pCloud OAuth、真實 bucket 與排程驗收仍由擁有者執行，不以替身測試代替正式驗收。
