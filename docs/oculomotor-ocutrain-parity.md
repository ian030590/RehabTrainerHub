# 眼動練習與 OcuTrain 對齊

狀態（2026-10-17）：`oculomotor-training@2.1.0` 已依擁有者「核准發佈」完成相容 runner／Hub 先部署、R2 發布及 current 切換、正式 API／逐檔 bytes／五個 Hub／PWA 瀏覽器流程驗收。正式仍為六款 R2／34 款舊流程，蓋伯候選沒有發布或切換；見[正式收據](releases/oculomotor-training-2.1.0.json)。

擁有者核准並實際發布的版本為 `2.1.0`，11 檔，`contentSha256: a90903994c2a89b24ec9482e005874d54abbb09ce2f9720b37216a705259b7b9`。發布前再次核對相同摘要，逐檔上傳／回讀後才切換 current；`2.0.1` 保留為已核對回退版。

## 對照來源與實作

來源固定為 [OcuTrain commit 6676f24523a5bc857a7c28f68c520a45bfb8d167](https://github.com/ian030590/OcuTrain/tree/6676f24523a5bc857a7c28f68c520a45bfb8d167) 的 `wwwroot/app.js`。遊戲的 `public/reference/experiment.js` 直接沿用原函式；`scripts/fixtures/ocutrain-reference.json` 記錄來源及 22 段未修改函式的 SHA-256，測試實際解析產品檔並核對逐字內容，涵蓋幾何、角度誤差、計分階段、TFF、四種刺激迴圈與序列。

- WebGazer 有效閾值為 `max(設定角分 / 60 + 2°, 同來源驗證動態閾值)`；動態閾值為 `max(0.5°, 平均驗證誤差 × 2)`，不重複加上追蹤誤差。不同來源的驗證結果不沿用。
- 目標大小為 1–600 角分、閾值為 10–600 角分，步長皆為 1；滑桿與數字輸入同步顯示角分及角度。其餘參數恢復原版正數數字輸入，僅顯示所選模組使用的欄位。評估模式不使用總時間。
- 九宮格對應實際方位；中央 ALL 在八方向與四正向間切換，單一方向不能取消成零方向。模組切換保留各自參數。
- 追視連續去程與回程皆顯示目標並計分，排除中央十字；凝視只計邊緣停留；跳視保留 200 ms Accuracy 排除窗。
- 原版五點驗證每點先等 350 ms，再收集 1050 ms；每點至少三筆樣本且至少三個有效點，否則沒有可繼續按鈕、不產生虛構誤差或門檻。保留重校正、手動繼續及通過後三秒倒數。
- 以推論開始時間對齊當時的顯示影格，拒絕重複／倒序時間戳；排除缺口，按有效計分時間加權。沒有有效計分時間時 Accuracy 為缺測。
- 跳視直接採原版 TFF：先偵測眼動，再找角速度不超過 30°/s、持續至少 100 ms、至少三筆有效樣本的首次注視；無效或超過 100 ms 缺口會中斷。使用注視開始時間，不要求命中目標，與 200 ms Accuracy 窗無關。
- 完整下載 CSV 沿用原版 25 欄，包含來源時間、影格、計分權重、速度、注視及 TFF；成績頁呈現 TFF 平均值、偵測數／總數與逐目標明細。

原授權隨套件放在 `public/reference/LICENSE-OcuTrain.txt`。目前 HEAD 原先刪除了 `OculomotorTrainingGame.tsx`，此次從前一提交恢復必要入口，再接上上述設定與原實驗。

## 架構必要差異

1. 網頁只支援 WebGazer／Off，沒有 Windows Tauri／Tobii 原生橋接。影像與模型留在可信輸入代理，遊戲維持 opaque iframe、禁止相機及外連；校正只經私有 port 傳數值。
2. React 管理設定、既有四目標教學與結果頁，原設定互動對應至 JSX／React state；遊戲內的 jsPsych 保留原刺激與數值流程。新增取消／卸載清理，防止返回設定後舊驗證倒數或 renderer 繼續執行。
3. 輸入與遊戲在不同文件，代理 `eye-tracking-1.1.0` 以 `performance.timeOrigin + 推論開始時間` 傳送同一個 timestamp 欄位，遊戲換回自己的 performance clock；每筆私有 frame 只回報一次。使用新版本路徑避免一年 immutable 快取沿用舊時間語意。`1.0.0` 入口保留原相對時間語意；固定 WebGazer／模型 bytes 與既有四欄輸入契約不變。
4. 身份、保存及下載由 Hub／runner 負責，不採原桌面 Subject ID、檔案系統、期限檢查、網路時間、Pipe 或 Discord 上傳。私人 bucket 沿用既有 15 欄逐筆契約，新增允許原版 `return` 階段；完整 25 欄檔案經下載橋樑提供。平台數值成果上限為 12 個欄位，加入 TFF 平均值及偵測數，總數與逐目標資訊顯示於遊戲結果及完整 CSV。
5. 保留平台邊界：單次最多 36,000 筆、逐筆時間最多 20 分鐘、CSV 最多 8 MiB、config 數值最多 1e9；因此總時間上限為 1200 秒。橋樑新增精確的 25 欄下載格式，仍拒絕任意欄位、公式與非數值內容，繼續支援舊 15 欄檔案。

本次先部署相容 runner 及 Hub（新代理、25 欄下載、`return` 保存），核對正式資產與來源後才發布已核准的 `2.1.0`。runner 為 [19b61771](https://19b61771.trainerhub-user-games.pages.dev)，Hub 為 [b4cf91d0](https://b4cf91d0.rehabtrainerhub.pages.dev)。遊戲與平台原始碼沒有新增 Git commit 或 push。

因目前工作樹含尚未核准的蓋伯 registry，正式平台使用 `.tmp/ocutrain-platform-20261017` 隔離副本：從原正式 `51018eed98339cc14a9d58278e11f79db043ecd6` 加入已審閱的眼動改動，保留六款 registry、舊 Gabor JSON／引擎與 34 個舊 bundle，另重跑七項 gate。Turbopack 只在副本擴大依賴解析根目錄以支援共用的已安裝外部套件；各本機 workspace 仍解析至隔離副本。正式 Hub 十二個 client 資產、新代理十檔及舊 Gabor 設定 bytes 均與該輸出相符。本機完整候選工作樹仍不可直接部署，直到蓋伯完成自己的精確核准與 R2 發布。

## TDD 與本機驗證

測試先失敗：原閾值缺少 2° 容許值、驗證覆蓋使用者設定、半徑換算不同、追視缺少連續回程、凝視計入移動、來源時間遺失、缺少 TFF、零資料被當作有效驗證；另重現設定邊界不同、跨文件 clock 不同、完整 CSV／`return` 被舊契約拒絕，以及取消後三秒倒數未清除。上述行為修正後通過。

`scripts/oculomotor-reference.test.mjs` 由既有 `check-oculomotor-migration.test.mjs` 引入；兩份 workflow 仍使用原七項 matrix 與相同 root 命令，沒有增加 Brave CI 工作。代理版本的路由、相機政策、精確 launcher URL、離線資產及推論開始時間由既有 `test:gamerunner` 驗證。

本機 gate：`test:naming`、`test:pwa`、`test:game-architecture`、`test:hub-functions`、`test:gamerunner`、`test:entrypoints`、`test:cloudflare-deploy`。另建置眼動遊戲、Hub 與 runner。

上述七項 gate 通過；其中架構 185 項、Hub Functions 121 項、runner 49 項。眼動專項含 14 項原版對齊／生命週期測試；22 段函式摘要皆相符。三個建置與只做本機驗證的 publisher dry-run 通過。最後參數確認與成果摘要亦只列所選模組的欄位，Off 模式不沿用 TFF 或驗證數值。

正式相容副本的七項 gate 亦通過，其中架構 162 項、Hub Functions 117 項、runner 48 項；差異是排除尚未核准的 Gabor 遷移及其測試。Hub build 為 35 個任務，輸出驗證確認六款 R2 不攜帶 bundle、34 款舊流程仍在。這些是本機驗證與手動 Pages 部署，沒有宣稱新增 GitHub CI run。

Brave 完整流程：

```powershell
node scripts/check-r2-game-browser.mjs --game oculomotor-training --lobby --activity pursuit
node scripts/check-r2-game-browser.mjs --game oculomotor-training --lobby --gaze --activity pursuit
node scripts/check-r2-game-browser.mjs --game oculomotor-training --standalone --gaze --mobile --activity saccade
node scripts/check-r2-game-browser.mjs --game oculomotor-training --lobby --tablet --activity fixation
node scripts/check-r2-game-browser.mjs --game oculomotor-training --lobby --signed-in --english --gaze --activity vor
```

包含閾值數字／滑桿雙向同步、中央方向操作、模組設定保留、教學往返、全螢幕、實際 WebGazer／校正／驗證、結果、完整 CSV、保存重試、身份隔離與 PWA 固定模型離線讀取。證據留在 `.tmp/oculomotor-validation/`；所有訓練資料只寫本機 SQLite。相機來源為已核對人像圖片串流；未驗真人、實體相機／尺量準確度、實體觸控或 Safari／iOS，不能視為硬體精度驗收。

## 正式驗收與回退

[正式 API 核對](migrations/oculomotor-ocutrain-parity/production-verification.json)確認目錄中眼動只有一筆、`vision/vision`、`presentation: game`、無舊設定 URL，current 與 stateless session 均為核准 `2.1.0`／上述摘要。十一個公開套件檔案、相機禁止與嚴格 CSP、穩定 PWA 302／no-store、固定版本 scope 與新版代理均通過；session token／recordId／測試 Subject ID 不寫入證據。

[五個正式瀏覽器流程](migrations/oculomotor-ocutrain-parity/validation-summary.json)均使用真正部署的 Hub／R2，只有 Hub `/api/*` 保存導向本機 SQLite：

| 流程 | 訓練與驗證 |
| --- | --- |
| 桌機 Hub | WebGazer 追視、設定／校正／成果／保存重試 |
| 平板 Hub | 無眼動凝視、設定保留、全螢幕及缺測成果 |
| 英文登入 Hub | WebGazer VOR、相機與帳號身份隔離 |
| 手機獨立 PWA | WebGazer 跳視、TFF／完整 CSV、固定模型離線讀取 |
| 手機 Hub | WebGazer 凝視、session 失敗及相機拒絕後重試、CSV／摘要保存 |

代表設定、驗證與成果畫面及 UTF-8 日誌位於 [production/](migrations/oculomotor-ocutrain-parity/production/)。未建立正式測試帳號或訓練紀錄；相機／觸控／Safari／iOS 的未驗限制沿用上節。

回退版 `2.0.1`／`95204cb2199f9bce1036cb9b6c63dad40736627b98094065c6c8cb2b95a2a616` 已於發布前核對 approved manifest 與十檔 R2 bytes，發布後再核對全部公開 bytes；沒有執行回退。需要回退時執行 `node scripts/publish-official-game.mjs oculomotor-training --activate-version 2.0.1`，保留所有不可變版本與相容平台。
