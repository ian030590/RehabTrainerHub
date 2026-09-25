# 眼動訓練的 Tobii Windows 專用程式

此專用程式沿用 `TobiiOculomotor` 的 Stream Engine 呼叫方式。它只開啟 `https://trainerhub.cc/games/oculomotor-training/`（開發時可指定本機同一路徑），並透過 WebView2 將 Tobii Eye Tracker 5 的正規化螢幕座標、有效性及裝置時間戳送進遊戲。沒有實體裝置時會停止，不使用模擬樣本。瀏覽器單獨開啟網站時，可選 WebGazer；Tobii 模式需由此專用程式啟動。

1. 在 Windows 安裝並完成 Tobii Experience 的裝置校正。
2. 將合法取得的 `tobii_stream_engine.dll` 放在本目錄。此 DLL 不納入 Git。
3. 執行 `dotnet run --project apps/rehabtrainerhub/games/oculomotor-training/native/tobii-eye-tracker-host/TobiiEyeTrackerHost.csproj`。本機開發可在命令後加上 `-- http://localhost:3000/games/oculomotor-training/`。
4. 在獨立遊戲設定選擇「Tobii Eye Tracker 5」，開始後依序完成五點驗證。遊戲須在 Tobii 校正的主要螢幕上全螢幕顯示。

WebGazer 使用九點點擊校正、五點驗證；Tobii 沿用 Tobii Experience 校正，再做五點驗證。每點顯示 1400 ms，前 350 ms 為視線轉移，後 1050 ms 取樣。至少三點各取得三筆有效樣本時，以各點注視 X、Y 中位數與刺激中心的距離計算視角誤差。平均誤差為 `E` 度，當次注視閾值為 `max(0.5°, 2E)`；驗證資料不足時採用設定的角分閾值。距離換算為 `d_cm = hypot(Δx_px, Δy_px) / cssPxPerCm`、`θ = 2 atan(d_cm / (2 × viewingDistanceCm))`。WebGazer 超過 3.5° 時會再次校正驗證；Tobii 的通過參考值為 3°。

每筆裝置樣本或 WebGazer 有效預測，依當下 Pixi 目標位置建立同步資料。`gaze_records` 與下載的 UTF-8 BOM CSV 使用同樣的 15 欄：`sample_index, trial_time_ms, device_timestamp_us, delta_t_ms, instant_hz, gaze_valid, gaze_x_px, gaze_y_px, stimulus_x_px, stimulus_y_px, distance_error_px, distance_error_deg, is_within_threshold, phase, direction`。WebGazer 沒有裝置時間戳，該欄為空；無效 Tobii 樣本的注視座標與誤差為空。CSV 表頭另有受試者代碼、來源、螢幕尺寸、換算比例、驗證誤差、閾值與總計欄位。

在標比例為 `in_threshold_ms / valid_gaze_ms × 100%`。超過 100 ms 的斷訊間隔不計入時間；無效樣本與跳視目標跳動後 200 ms 的轉移期不進入分母。結果頁及 Hub 分數欄位記錄閾值、有效注視時間、在標時間與在標比例。舊的九欄 `gaze_samples` 仍保留給既有距離與首次停留統計。平台的當次紀錄只寫入彙總欄位與逐筆筆數；完整逐筆座標另存於私人 R2 `oculomotor-data` bucket 的 CSV；登入者可在進度頁重新下載。訪客請在離開結果頁前下載副本。若雲端儲存失敗，結果頁會顯示重試與立即下載。

Tobii 的公開 [授權說明](https://developer.tobii.com/vr/sdla/) 將儲存眼動資料作分析列為須另取得授權的用途；在確認本專案的授權涵蓋 CSV 與平台紀錄前，不應發布或使用 Tobii 記錄功能。程式碼沒有包含 Tobii DLL，也沒有通過實機驗證。
