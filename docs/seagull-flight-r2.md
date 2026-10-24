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

## 遊戲候選實作，2026-10-24

候選來源版本為 `seagull-flight@1.0.0`，已建置並通過自動化驗證，尚未發布。監督代理已完成遊戲、Hub 與 runner 建置、七項 CI gate、五種 Hub 與 standalone 鍵盤流程及截圖檢查；剩餘項目為下方人工驗收清單。本次只在 `main` 修改工作樹；沒有 commit、push、部署、正式帳號或正式紀錄。既有代理 commit 仍為 `3d9f22a0`。

contentSha256：6ea8bd539a640995c35256415d689d88a2696c46ea48ff70854a4cbe621abfb7

bridge 還原後已重新建置；dry run 執行兩次，均驗證 `seagull-flight@1.0.0`、6 個檔案與上方相同摘要。目前沒有正式發布收據。

### 玩法與畫面

- 眼睛注視海鷗背上的十字；相對中立位置，向上與向下各超過設定角度，先上後下或先下後上，都算一次完整點頭。每次點頭只拍一次翅膀，短暫上升後重新滑翔。
- 左右轉頭對應海鷗水平位置，轉至設定角度即到邊緣；超過設定角度仍停在邊緣。頭部角度先扣掉中立位置，再經 One Euro filter 平滑。
- 左右圓環交替，第一個方向隨機。所需轉頭幅度為設定範圍的 30% 到 100%；以平均 65%、標準差 14% 的常態分布抽樣，超出上下界重新抽取，因此中距離最常見，最近與最遠距離較少。
- 3 秒倒數不扣活動時間、不改高度；正式飛行後，不拍翅會越降越快。海面為高度 0，碰到海面立即停止該局的邏輯，顯示約 1.2 秒水花後結算。活動時間到則正常結算。
- 頭部模式先在視窗內取得容器相機同意，模型就緒後回到確認面板。第二次開始點擊才請求容器全螢幕，再以 2 秒穩定讀值取得中立位置；至少 20 筆，角度離散門檻為 2.5 度，15 秒未完成可重試。
- 250 ms 未收到新頭部影格或找不到臉，時鐘、位置和高度都凍結；遺失追蹤會清除半次點頭，避免恢復追蹤時誤算拍翅。初始化、校正或遊玩按 Escape，以及停止、容器 configure、pagehide，均停止輸入與音訊，不保存部分紀錄。
- 鍵盤模式不啟用相機，也不校正。Space / ArrowUp 拍翅，ArrowLeft / ArrowRight 滑翔；另有向左、拍翅、向右按鈕及 pointer capture／取消清理。
- Three.js 自有平面海浪、天空與霧、低多邊形雲和岩石、圓環與浮標、兩節翅膀及水花。海鷗依水平速度傾斜，背上十字保持正立；命中圓環變白。顯示比例上限為 2；降低動態效果時停用裝飾海浪與雲移動。直向手機視角以整條可到達航道與圓環外緣計算，避免最外側圓環被裁掉。
- 校正時畫布隱藏，容器相機只顯示在透明相機區域；遊玩期間預覽為 `null`，完整顯示不透明 3D 場景。影像不進入遊戲。
- 音效依穿環／錯過／時間到／落海播放；沿用遊戲自有 Tone runtime，背景曲仍為 `null`。jsPsych 以 `vision:seagull-flight` 的 external runtime adapter 記錄開始、完成、取消與卸載。

設計方向為「低多邊形日光海面，平靜」，ENERGY 2 / RHYTHM 1 / MOTION 2。拍翅、滑翔與海浪構成飛行動態，降低動態效果時停止裝飾海浪與雲移動。藍海與橘環表達航道與目標；白色海鷗與固定十字表達注視位置；不透明 HUD 確保數字易讀；使用系統字型與既有設定面板間距，維持各語言及容器的一致操作。陰影只用於前景面板與教學遮罩。

### 設定

| 鍵 | 意義 | 預設 | 範圍／間距 |
| --- | --- | --- | --- |
| `inputMode` | 操作方式 | `head` | `head` / `keyboard` |
| `durationSec` | 活動時間 | 180 秒 | 60 到 600 秒，每 30 秒 |
| `turnRangeDeg` | 左右轉頭角度 | 20 度 | 10 到 45 度，每 5 度 |
| `nodRangeDeg` | 上下各自所需角度 | 10 度 | 5 到 25 度，每 1 度 |
| `glideSec` | 不拍翅從頂端降至海面的時間 | 10 秒 | 4 到 20 秒，每 1 秒 |
| `ringIntervalSec` | 圓環間隔 | 4.5 秒 | 3 到 8 秒，每 0.5 秒 |

設定由遊戲驗證，經私有通道請容器記住。遊戲不讀寫裝置儲存、不載入影像模型、不要求裝置權限、不連線，也不依賴平台或其他遊戲程式碼。capabilities 固定為 `audio, fullscreen, head-tracking, keyboard, pointer, settings-storage, touch`。

### 當次紀錄

主要數值為穿過圓環、錯過圓環、穿環比例、拍翅次數、是否落海、最大轉頭角度與最大點頭角度，另保留實際飛行秒數和完整設定。鍵盤模式的最大角度為 `null`，無圓環時比例為 `null`；介面顯示「無」或 `N/A`。

逐環數值欄位維持傳送順序 `ring, passed, side, headAngle, offset, altitude`；分析選項與表格呈現順序為：

| 欄位 | 意義 |
| --- | --- |
| `passed` | 是否穿過，0／1；預設分析指標 |
| `headAngle` | 到達該環所需轉頭角度，度；鍵盤模式仍保留目標角度 |
| `offset` | 與環心的距離，為環半徑的百分比 |
| `side` | 0 為左，1 為右 |
| `altitude` | 通過該環時的高度百分比 |
| `ring` | 從 1 開始的圓環序號 |

分析提供有效筆數、平均、中位數、樣本標準差、範圍、缺漏值、趨勢圖及每頁 50 筆的表格。成果只經既有私有 port 傳送，Hub 失敗可重試，獨立入口只顯示當次紀錄。

### 新增與調整檔案

遊戲內新增 `labels.ts`、`SeagullIcon.tsx`、`rules/SeagullTutorial.tsx`、`ScoreAnalysis.tsx`、`scene.ts`、`SeagullFlightGame.tsx`、`game.css`、`main.tsx`、`index.html`、`vite.config.ts`、`package.json`、`public/game.json`、`public/preview.webp`、`public/THIRD-PARTY-NOTICES.txt`。沿用先前已完成的設定、邏輯、計分、i18n 和 runtime。`results.css` 的重試按鈕改用強邊框。

共享登記為 `games/catalog.ts`、`games/moduleFlowManifest.ts`、`packages/ui/src/officialGameReleases.json` 與 lockfile。測試更新 `check-r2-game-ui`、`check-r2-game-results`、`check-r2-settings-memory`、`check-r2-game-audio`、`check-game-research-contract`、`check-antislop`、`check-game-directory-architecture`、`check-training-module-flow`、`check-self-contained-game`、`check-embedded-training-message`、`check-built-game-architecture` 與 Hub middleware 測試。專用測試以 Unicode escape 檢查 em dash，並補上無 referrer 時的可信來源／parent source 驗證；網路掃描只允許 bridge 來源比對那一行固定常數，其他 URL、網路 API 與 Worker 禁令保留。

另新增 `scripts/check-seagull-flight-runtime.test.mjs`、`scripts/seagull-flight-browser.mjs`、`scripts/seagull-flight-preview.mjs`，並調整共享腳本 `scripts/check-r2-game-browser.mjs`，接入鍵盤流程及視覺分類、處理 target 停止的競態。預覽產生器直接載入同一份 Three.js 場景；監督代理已產生 640 × 360、4,824 bytes 的真實 WebP 預覽圖，並檢視 `.tmp/seagull-preview.png`，確認天空、低多邊形海面、雲、岩石、橘色圓環與浮標、白色海鷗和深色注視十字均已呈現。

### TDD 與執行證據

最初專用測試 17/19 通過，缺主元件與套件檔案。補齊後，額外測試曾重現連按開始啟動兩次、360 × 800 的最外圓環落到畫面外，以及待全螢幕期間相機錯誤沒有回到設定；修正後這些 runtime 測試全部通過。

本次先補來源回退與相機探針的回歸測試，24/26 通過；兩項失敗分別為空 referrer 無法初始化，以及尚無直接相機呼叫探針。還原來源回退、加入探針與限縮到該常數的 URL 掃描例外後，26/26 通過。

第 5 輪前，Hub `--lobby` 五次有三次失敗。原因一是 Hub service worker `/sw.js` 在 harness 完成啟用前已停止，回傳 `Session with given id not found`；共享 harness 現在把它與既有 `Inspected target navigated or closed` 視為同一類 target 消失，只忽略這兩種訊息，其他錯誤仍記錄。原因二是教學卸除時點擊開始，修正為兩次開始前都等待確認面板存在、教學與遮罩消失且主要按鈕可用。修正後最終六種瀏覽器流程均通過，遊戲來源自 bridge 還原後未再變動。

2026-10-24 監督代理在沙盒外完成最終建置、七項 CI gate、六種瀏覽器流程與兩次 dry run，並回報截圖檢查結果。本環境亦完成 26/26 專用 Node 測試、兩個 harness 的語法檢查與文件差異檢查；預覽圖、Hub 與 runner 建置結果沿用先前已通過的紀錄。

| 命令 | 結果 |
| --- | --- |
| `npm --prefix apps/rehabtrainerhub/games/seagull-flight run build` | 通過，bridge 還原後重新建置 |
| `node scripts/seagull-flight-preview.mjs` | 通過，真實 640 × 360 WebP，4,824 bytes |
| `node --test scripts/check-seagull-flight-game.test.mjs scripts/check-seagull-flight-runtime.test.mjs` | 26/26 |
| `npm run test:naming` | 2/2 |
| `npm run test:pwa` | 3/3 |
| `npm run test:game-architecture` | 1205/1205 |
| `npm run test:hub-functions` | 120/120 |
| `npm run test:gamerunner` | 78/78 |
| `npm run test:entrypoints` | 全部通過，各組 38、5、15、9、6、10、29 |
| `npm run test:cloudflare-deploy` | 19/19，僅測試，不部署 |
| `npm run build:hub` | 通過，51 個遊戲目錄；R2 遊戲只保留入口 shell |
| `npm run build:gamerunner` | 通過 |
| `node scripts/check-r2-game-browser.mjs --game seagull-flight --lobby` | 通過，752 px |
| `node scripts/check-r2-game-browser.mjs --game seagull-flight --lobby --mobile` | 通過，390 px |
| `node scripts/check-r2-game-browser.mjs --game seagull-flight --lobby --tablet` | 通過，820 px |
| `node scripts/check-r2-game-browser.mjs --game seagull-flight --lobby --signed-in --english` | 通過 |
| `node scripts/check-r2-game-browser.mjs --game seagull-flight --standalone` | 通過，0 次 getUserMedia 呼叫且相機同意面板未曾出現 |
| `node scripts/check-r2-game-browser.mjs --game seagull-flight --lobby --session-failure` | 通過 |
| `node scripts/publish-official-game.mjs seagull-flight --dry-run` | 兩次通過且摘要一致；1.0.0、6 個檔案，摘要見上方 |
| `node --check scripts/check-r2-game-browser.mjs scripts/seagull-flight-browser.mjs` | 語法通過 |
| `node --check scripts/seagull-flight-browser.mjs` | 個別語法檢查通過 |
| `git diff --check -- docs/seagull-flight-r2.md` | 通過 |

使用需求指定的 `C:/Users/ian/.claude/skills/antislop-human/contrast-check.py` 檢查：正文 `#202a32`／白底 14.60:1，次要文字 `#52616b`／白底 6.40:1、淺灰底 `#f5f7f8` 5.96:1，白字／主色 `#005eb8` 6.38:1，標題 `#172d3b`／白底 14.24:1，錯誤 `#a12620`／白底 7.46:1，警告 `#713d06`／`#fff5dd` 8.16:1；皆通過一般文字 4.5:1。控制邊框 `#74828b`／白底 3.96:1，通過非文字 3:1。

最終五種 Hub 與 standalone 流程均完成鍵盤設定、四步聚光燈教學、Escape 不保存、3D 飛行、拍翅與滑翔、60 秒結果及返回；Hub 另驗證保存失敗重試。監督代理檢視滑翔、教學與成果截圖，確認畫面與版面符合設計。

standalone 原本在「鍵盤模式不得請求頭部代理 URL」的 assertion 失敗；實際請求包含代理腳本、模型與 SIMD／非 SIMD 兩套 WASM，來自 launcher 與 service worker 預快取，不能據此判定相機啟用。Hub 保留原 URL assertion，standalone 排除這個 URL 假設；兩種模式都在頂層容器包裝 `getUserMedia` 計數，並以 MutationObserver 記住同意面板是否曾出現，完整鍵盤局結束時必須為 0 次呼叫且從未顯示同意面板。其他 assertion 與 runner 均未更動；最終 standalone 流程已通過上述直接檢查。

### 尚待人工驗收

目前 harness 只驅動鍵盤與畫面按鈕，沒有頭部角度 fixture。真人頭部動作、相機允許／拒絕／中斷、失去臉部追蹤時的凍結、降低動態效果，以及實體觸控仍待人工驗收；不把鍵盤流程或單元測試當作這些項目的完成證據。

相機人工步驟：選頭部模式，確認後完成教學；第一次按啟用相機時仍在視窗內，拒絕後須顯示對應原因且沒有紀錄。再次允許後第二次開始才進全螢幕，保持中立姿勢 2 秒開始；移動頭部或遮臉應重置校正進度，15 秒不穩定可重試。遊玩時遮臉須凍結時鐘與高度，恢復後不補算半次點頭；停止或 Escape 應關閉相機並不保存。靜止不點頭應落海結算，持續點頭則可維持高度至活動時間到。另用裝置的降低動態效果設定確認裝飾海浪與雲停止。

### 擁有者後續發布順序

以下順序只供擁有者執行，本次代理沒有執行任何發布或推送。

1. 將既有代理 commit `3d9f22a0` 推送到 `main`，等待 runner／Hub 相容版本部署成功；此時不要提交或推送本工作樹的新遊戲 registry。
2. 本文件上方的 `version: 1.0.0`／`contentSha256` 即待擁有者核准的候選，共 6 個檔案。確認人工驗收項目後，由擁有者核准該組精確 version／contentSha256。
3. 擁有者核准該組精確 version／contentSha256 後，發布前立即執行 `npm --prefix apps/rehabtrainerhub/games/seagull-flight run build`，再執行 `node scripts/publish-official-game.mjs seagull-flight --dry-run`，確認輸出與上方摘要一致；此機器的檔案同步工具可能改名建置輸出。確認一致後，擁有者親自執行 `node scripts/publish-official-game.mjs seagull-flight`。核對上傳／回讀、current、session、公開 bytes 與正式 Hub／獨立入口；同一遊戲不能同時發布或回退。
4. 完成發布與正式驗收後，才由擁有者 commit 並 push 遊戲、registry、catalog、lockfile、測試和本紀錄。
