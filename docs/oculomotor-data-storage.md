# 眼動逐筆座標儲存

Hub 的 `OCULOMOTOR_DATA` R2 binding 指向私人 `oculomotor-data` bucket。Cloudflare R2 bucket 名稱只能使用小寫英文字母、數字與連字號，因此產品所稱 OculomotorData 對應的實際名稱是 `oculomotor-data`。部署 workflow 執行 `scripts/ensure-oculomotor-bucket.mjs`，以既有 `CLOUDFLARE_ACCOUNT_ID` 和 `CLOUDFLARE_API_TOKEN` 確認或建立 bucket；API token 須有 Workers R2 Storage Write 權限。bucket 不開放公開存取、不綁定 usergamerunner。

眼動訓練完成時，遊戲把最多 36,000 筆 15 欄逐筆樣本送到 `/api/oculomotor-data`。Functions 驗證欄位、大小、登入或訪客 Subject ID、同源與寫入頻率，產生 UTF-8 BOM CSV 存入 R2。CSV 含逐筆眼動資料、紀錄識別與訓練模式、路徑、螢幕尺寸、觀看距離、校正及閾值等 metadata；R2 物件 metadata 也保存相同訓練參數，不含總分或彙總成績。相同 metadata 也隨 Hub 分數或獨立 PWA 摘要寫入 D1；所有分數與彙總成績繼續只寫入 D1。Hub 的 D1 分數紀錄與 R2 CSV 使用相同紀錄 ID。登入資料依帳號隔離，只有原帳號持 Bearer session 能列出並下載，進度頁提供入口。訪客資料使用獨立 Subject ID 路徑，沒有公開讀取 API；結果頁仍提供當下下載。

Hub 內嵌遊戲會先完成 R2 寫入，再傳送分數給 Hub，避免 iframe 卸載中斷上傳。R2 失敗時結果頁保留樣本、顯示重試與當下下載；不能把失敗顯示為已儲存。沒有網路或離開失敗中的結果頁時，瀏覽器無法保證雲端留存。R2 CSV 沒有自動刪除期限，日後若需保留期限或刪除程序，須先訂定資料管理政策。

Tobii Eye Tracker 5 的公開授權說明對儲存眼動資料作分析另有條件。啟用或發布 Tobii 資料收集前，應確認本專案取得相應授權；此實作沒有完成 Tobii 實機驗證。
