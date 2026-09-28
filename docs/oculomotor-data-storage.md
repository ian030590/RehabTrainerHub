# 眼動逐筆座標儲存

新版眼動練習沿用 `TobiiOculomotor/wwwroot` 的 jsPsych、WebGazer、九點校正、五點驗證、刺激程序與 15 欄 CSV 格式。WebGazer 需要 HTTPS 或 localhost 的攝影機授權；Hub 與遊戲 iframe 均須委派 `camera` 權限。網頁無法直接使用原專案的 Windows DLL／WebView2 Tobii 橋接，因此網頁版僅提供 WebGazer 或不記錄眼動。

每次有 WebGazer 逐筆樣本的活動結束時，遊戲先將 15 欄逐筆資料與螢幕尺寸、觀看距離、刺激、驗證誤差及當次門檻等 metadata 送至 `/api/oculomotor-data`。Functions 驗證資料後組成 UTF-8 BOM CSV，存入私人 `oculomotor-data` R2 bucket；Hub 的 D1 成績與 R2 CSV 使用同一個紀錄 ID。確認 R2 寫入成功後才把成績送給 Hub，避免 iframe 卸載中斷上傳。若寫入失敗，結果頁顯示錯誤與重試。實驗仍會自動下載原參考格式的 CSV 到瀏覽器，供當次保留；瀏覽器無法直接寫入原生專案的 `Data/` 目錄。不使用眼動追蹤時不產生 R2 逐筆檔案，眼動成績指標保持缺測值。

舊版眼動訓練已儲存的 CSV 仍保存在同一 bucket，登入者可透過原有 `/api/oculomotor-data` 與進度頁讀取自己帳號下的紀錄。API 不接受 Tobii 來源的新上傳。bucket 不開放公開存取，也不綁定 usergamerunner。
