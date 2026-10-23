# 海鷗飛行（seagull-flight）R2 自包含遊戲紀錄

## 頭部轉動輸入代理 `head-tracking-1.0.0`

2026-10-24 使用者於本對話回答「Approve head proxy (Recommended)」，核准新增只給 `seagull-flight` 使用的頭部轉動輸入代理。

- 只有可信官方 `seagull-flight` release 能宣告 `head-tracking`（`apps/usergamerunner/functions/_lib/release.js`）；Hub 與 runner launcher 只為它載入 `/input/head-tracking-1.0.0/index.js`，並由 `SensorAllowed(state, 'head')` 擋下其他遊戲的 `input-start {input:'head'}`。
- 代理在裝置上執行 MediaPipe 0.10.35 Face Landmarker（與舌頭代理同一份已核對摘要的 `face_landmarker.task` 與 WASM，瀏覽器不讀 CDN），開啟 `outputFacialTransformationMatrixes`，GPU 啟動失敗時改用 CPU。
- `apps/usergamerunner/runtime/headPoseDetector.js` 把臉部轉換矩陣換算成角度，正負號沿用 FlyingMoo：`yaw > 0` 是使用者轉向自己的右邊、`pitch > 0` 是抬頭。每一幀只送 `{ timestamp, videoWidth, videoHeight, face, yaw, pitch, roll }`，角度四捨五入到 0.01 度；找不到臉或矩陣無法讀取時 `face: false`、三個角度為 `null`。臉部點位與影像不離開代理。
- 代理不保存校正樣本，`input-capture` 對此遊戲一律拒絕；中立姿勢由遊戲自己記錄。
- 遊戲 iframe 維持 `sandbox="allow-scripts"`、相機與麥克風禁止、`connect-src 'none'`。相機畫面由容器畫在透明遊戲畫面後方，全螢幕由容器對自己的外框執行；standalone launcher 的 Permissions Policy 只開 `camera=(self)`、`microphone=()`。
- 同意文案：「影像只在此裝置由 MediaPipe 處理。遊戲只收到頭部轉動角度，不會上傳相機影像。」

測試：`apps/usergamerunner/tests/sensorInput.test.mjs`（訊息閘門、角度換算與正負號、只送角度、launcher 權限與 SW 預快取、`_headers`）、`scripts/check-r2-sensor-host.test.mjs`（Hub 同意文案、輸入清單與相機預覽）。
