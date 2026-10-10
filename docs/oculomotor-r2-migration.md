# 眼動練習 R2 遷移與發布驗收

更新：2026-10-11。**`oculomotor-training@2.0.0` 已精確核准、發布 R2、完成七項 CI／兩站部署及正式 API／桌機／手機／平板／英文登入／獨立 PWA 驗收。** 正式六款 R2／34 款舊流程；[正式收據](releases/oculomotor-training-2.0.0.json)保留逐檔摘要、核准、順序修正、部署及驗收證據。

已核准版本為 `oculomotor-training@2.0.0`，10 個發布檔案，`contentSha256`：

```text
5148ebabb7a60d2f2f56094e97d3c45b4402d7968588dccecd3b42ed043374af
```

逐檔 sizes／SHA-256、原公開資料、固定輸入資產與驗證指令見 [candidate.json](migrations/oculomotor-training/candidate.json)。擁有者已在本對話回答「核准眼動輸入代理方案」；**當版精確版本／摘要與正式發布已以「核准並git push」核准，發布及正式驗收已完成**。Publisher dry-run manifest 的 `status=approved` 是擬發布格式，不代表已有擁有者批准。

## 原流程與保留範圍

原始碼基準：`7238a7fcca3db849e8c8a24c736039b003e32fa2`。原 Hub `/games/oculomotor-training/` 使用同源 shell、`settings.json`／`score.json` 與直接相機。正式公開目錄另有同 slug 歷史 `1.0.0` 投稿；本機大廳測試刻意提供該碰撞，確認固定官方入口不被舊設定 shell 覆蓋。正式舊部署與資產已只讀核對，見 [rollback-baseline.json](migrations/oculomotor-training/rollback-baseline.json)。

- 原 trainer／分類為視覺 `vision`，原圖保留為套件 `preview.webp`，SHA-256 `82ac52eda37b58ef50ac78629bc8e9f1184ccfcdfccb5915d40f726f6899f091`。自有 `game.json` 提供繁中／英文名稱、描述、作者與分類；公開文案只描述活動，不宣稱醫療效度。
- **25 項原設定完整保留**：可視寬高／觀看距離、WebGazer／不記錄、四活動、評估／可預測／隨機節奏、三種目標、視角與門檻、四活動秒數、追視速度、跳視停留、凝視保持、中央辨識換字間隔與八方向。舊 JSON fixture 位於 `scripts/fixtures/oculomotor-legacy.json`，測試逐欄比對 label、預設、選項、min／max／step。
- 原 jsPsych／刺激引擎保留：中央辨識、平滑追視、跳視與凝視、原速度／節奏／方向；九點每點兩次校正、五點驗證、350ms 安定與1050ms 取樣、3.5° 參考、`max(0.5°, 2×驗證誤差)` 動態門檻、跳視 200ms latency。無眼動模式不開相機，眼動欄位為缺測；Esc 結束當次活動並保留原實際時長，外層「停止練習」取消並不保存。
- 原 jsPsych vendor bytes 不改：SHA-256 `0ec03e513351fd0f2b59a192fea85aafe6ef1b21e0e2648f5ded475acdcc418c`。原 WebGazer／TensorFlow／FaceMesh／BlazeFace vendor 移到 runner 的 `runtime/WEBGAZER-SOURCE.txt`，SHA-256 `6210f977f5d146b40cfe82f0b845113171441ffbcb7aabdb2d65717507957081`；`.gitattributes` 保護原 vendor bytes。
- 原 15 欄數值 CSV、參考格式的 metadata／header 與 `SUBJ_…_gaze_record.csv` 下載保留。CSV 不經一般 window message、不包含身份或影像，Hub 使用自己的固定身份決定私人 bucket key。

| 成果 key | 原數值來源 |
| --- | --- |
| durationMs | actual_duration_ms |
| targets | completed_targets |
| accuracy | accuracy_rate |
| validSec | valid_sec |
| onTargetSec | in_threshold_sec |
| blinkSec | blink_sec |
| samples | gaze_sample_count |
| thresholdDeg | threshold_deg |
| validationErrorDeg | validation_error_deg |
| refreshHz | estimated_refresh_hz |

每次保留一筆完整活動，沒有捏造逐目標回合。零值與缺測分開；一筆觀測的樣本標準差顯示缺測。結果提供三項主要成果、全部設定、十指標切換／圖表／描述統計、完整十欄明細、實際眼動來源與結束原因、保存重試及 CSV 下載。單次結果只顯示來源對應的返回按鈕。

## 已核准輸入代理與安全邊界

2026-10-10 擁有者明確核准眼動輸入代理方案。這是新增的受控官方能力，不沿用遊戲直接取得相機。

1. 只有可信官方 `oculomotor-training` 核准 release 可宣告 `eye-tracking`，第三方拒絕此能力。Hub／獨立 PWA 在明確同意後才載入固定第一方 `/input/eye-tracking-1.0.0/preview.html` 取得相機。
2. 原固定 WebGazer 在可信輸入文件執行，模型／權重由 runner 的第一方版本化路徑供應，不讀 CDN、不傳送或保存影像。Build 核對原 vendor 摘要並只轉接第一方模型 URL、容器已同意的 stream、手動校正與本機開發 HTTPS 判斷；原模型與回歸演算法不替換。四份模型 sizes／摘要見 `scripts/eye-tracking-assets.manifest.json`，實際輸入部署 bytes 記於候選檔。
3. 遊戲仍為 `sandbox="allow-scripts"`、camera 禁止、`connect-src 'none'`，沒有 WebGazer 模型、Hub UI／auth／身份套件。需要模型執行的 CSP 例外只存在可信輸入文件；PWA launcher 與 game package 不取得 `unsafe-eval`。
4. 指定 iframe 的私有 MessageChannel 核對 source／origin、nonce、遞增 sequence、精確欄位與範圍。傳給遊戲的只有時間、正規化 x／y（或 null）及臉部就緒旗標，校正點反向轉換到模型座標。新推論會清除前一張臉部狀態，遊戲拒絕過期座標。
5. 完成、停止、取消、返回、卸載、拒絕、斷線與撤回清理 stream、模型、RAF、port／文件及全螢幕；晚到的相機／模型初始化不能重啟已取消活動。拒絕相機不會自動改成不記錄，使用者可重試或返回設定自己選擇。
6. 遊戲送出經驗證的數值 CSV；Hub 以原 session 的 recordId／version／token／Subject ID／帳號上傳私人 `oculomotor-data`，成功後才保存摘要。後端再次核對 release、身份、CSV version／樣本數；CSV 遺失或不符回覆409，R2 暫時故障503。401 不降級成訪客，帳號切換拒絕保存。
7. CSV 失敗與摘要失敗分別可重試，使用同一 session；摘要重試不重複上傳已保存 CSV。獨立 PWA 不使用 Hub 身份或入庫，只保留本機結果與由可信容器下載 CSV。

## 設定、聚光燈與全螢幕

遊戲載入即在背景呈現原目標／方向／校正／結束場景，前景自有設定視窗維持同一入口。確認設定後四步聚光燈依序標示目標、選定方向、相機與校正、Esc 結束；雙語內容依四活動變化。亮區跟隨實際 bounds、resize／scroll 更新，教學支援下一步／略過／返回／Escape、焦點循環與還原。PWA 安裝按鈕不遮住校正標籤。

設定／教學／最終參數確認保持視窗。使用眼動時先同意並初始化相機，最後一次「開始練習」點擊才進入遊戲根節點全螢幕，等待尺寸穩定後交給原引擎校正／活動。完成或返回前退出全螢幕，Hub 關閉後恢復大廳捲動。表單、確認與結算的基準字級／700以上字重／語意標籤／按鈕保持一致；長設定與十欄明細各自在自己的區域捲動。

## TDD 與本機驗證

所有新增功能先加入可執行需求測試並確認失敗，再實作。主要 RED → GREEN：

| 失敗原因 | 修正與驗證 |
| --- | --- |
| 仍用共用 shell／JSON、缺少私有眼動與自有四目標說明 | 自有 entry／設定／tour／results，原設定與數值 fixture、可執行 tour DOM 測試通過 |
| 未核對私人 CSV 就保存眼動摘要，收到201 | 先驗同身份 CSV version／count，缺漏與不符409、R2 故障503；六款官方 session／SQL 回歸通過 |
| 輸入取消後晚到 controller／模型仍可能啟動 | generation 清理，同意／拒絕／晚到／斷線與可選手部輸入回歸通過 |
| 新推論可能留下前一張臉部就緒狀態 | 每次推論重置，實際 FaceMesh 新鮮私有影格與無臉測試通過；瀏覽器查驗私有影格而非推論期間的暫態旗標 |
| 結果繼承參考 CSS 白字、無眼動沿用前次驗證誤差 | 參考樣式限定實驗區、無眼動驗證數值為null；實際 computed style 與原引擎回歸通過 |
| 公開中文資料變成問號、PWA 安裝按鈕遮住聚光燈校正目標 | 精確文案與實際遮擋失敗測試先重現，再修正 metadata／教學排版並重建摘要 |
| Pages 輸入路徑未經 Functions，HTML 轉址後遺失相機政策 | 新增精確路由及轉址行為 RED，限制兩個精確 preview 網址；runner47／build與正式10資產標頭驗證通過 |
| 舊設定瀏覽器 fixture 仍啟動已遷移眼動、舊 smoke 工具引用失效 | 改用未遷移 UFOV 保留原檢查，眼動改走 R2 工具；Brave Windows／macOS 尋址契約維持 |

七項現有 gate 全數通過：`test:naming`、`test:pwa`、`test:game-architecture`（107）、`test:hub-functions`（117）、`test:gamerunner`（47）、`test:entrypoints`、`test:cloudflare-deploy`。兩份 workflow 維持相同七 matrix／root 命令，不新增 Linux 無法執行的 Brave gate。Hub build／TypeScript／建置產物檢查通過，六款 R2 只保留導向入口、34 舊遊戲維持 bundle／JSON；runner build 與官方 dry-run 通過。

本機 Brave 使用 `node scripts/check-r2-game-browser.mjs --game oculomotor-training`，嚴格 sandbox／實際 CSP、原版模型與引擎。需要 Hub output 時可用 `HUB_OUTPUT_ROOT` 指向驗證過的固定輸出副本；本次工作區同步曾重命名建置入口，還原檔名後重新核對 bytes／built gate，未放寬檢查。模型使用固定摘要的 TensorFlow 官方測試人像形成 canvas stream，並另驗可信文件原生 camera permission 成功、遊戲 camera 禁止。

| 情境 | 已驗行為 |
| --- | --- |
| Hub 桌機／手機／820×1180平板，四 `--activity` | 25項設定保留／Enter／返回、四聚光燈／焦點／bounds、原目標刺激、完整成果與保存重試 |
| `--lobby --gaze --signed-in --english --wide --activity vor` | 英文登入、中央辨識、原模型／九點兩次／五點驗證、CSV先失敗再摘要失敗、帳號身份隔離 |
| `--lobby --gaze --camera-denied --mobile --activity pursuit` | 拒絕顯示與再次同意、原追視、完整成果、兩次保存重試、返回還原捲動 |
| `--standalone --gaze --mobile --activity saccade`，`--standalone --gaze --tablet --activity fixation` | 原跳視／凝視、版本 scope、全固定輸入資產預快取、真正 offline fetch 模型與原引擎、原15欄CSV下載 |
| `--camera-disconnect`、`--stop`、`--revoke`、`--revoke-playing`、`--session-failure` | 斷線／停止／撤回不入庫、相機清理／退出全螢幕、固定版本啟動失敗可重試 |
| 舊平台／手部回歸 | `test:game-architecture:browser` 五項通過；手勢手機獨立 PWA 真實 MediaPipe／校正／活動／保存與相機清理通過 |

代表截圖見 [candidate/](migrations/oculomotor-training/candidate/)。保存與登入只使用本機 API／SQLite，不建立正式測試帳號或紀錄。本機候選／模擬相機不代表正式站已驗收。

## 發布順序、回退與第11節審查

1. 擁有者審查候選原始碼、逐檔摘要、隔離流程及公開資料，明確核准上述精確 version／contentSha256 與發布部署。
2. 先部署相容 runner，直接驗第一方固定 WebGazer／全部模型 bytes／安全標頭及原手部回歸。
3. 使用現有已驗 `dist/` 執行官方 CLI，上傳逐檔核對／回讀、最後寫 manifest／current；同版本不同內容禁止覆寫，發布與回退不得平行。
4. R2 核准版本可用後才切換正式 Hub registry／依賴／CSV新契約。依既有 CI／Pages 流程部署，再直接核對真正 `/api/games` 分類／原圖／唯一slug、固定版本 session、Hub舊子資產410以及兩站真正瀏覽器流程。
5. 正式驗收與 `docs/releases/oculomotor-training-2.0.0.json` 收據完成後，才將正式數量改為六款／34款並標記遷移完成。

原正式 Hub deployment 為 [0527277d](https://0527277d.rehabtrainerhub.pages.dev)，完整ID `0527277d-f663-4e92-8596-cc5ee981c919`；runner 為 [f622830c](https://f622830c.trainerhub-user-games.pages.dev)，完整ID `f622830c-ab00-4277-a1e9-0733b2e60a0a`，來源短commit皆為 `bf87f3c`。舊眼動根入口／設定／成果／原圖均200，SHA記於回退基準；沒有實際執行回退。首次自包含版無另一個核准回退版，不能用 `--activate-version 1.0.0` 切回舊投稿或 JSON shell。若正式驗收失敗，恢復上述 Hub deployment；重建則從基準還原眼動／registry／依賴／lockfile／JSON並重新測試，保留私人歷史與R2不可變檔案，相容runner可保留。

| 第11節欄位 | 狀態 |
| --- | --- |
| 原分類／原圖／原功能 | 已盤點並逐項測試，原部署／歷史slug已只讀核對 |
| 獨立性／安全／自有UI／聚光燈／結果／保存 | 本機實作與嚴格sandbox／CSP／行為測試通過 |
| 大廳完整流程／手機平板／PWA／平台回歸 | 本機及正式站通過，保存 API 僅導向本機 SQLite |
| 輸入例外 | 擁有者已明確核准 |
| 當版精確核准／R2公開／部署／正式收據 | 擁有者已回答「核准並git push」核准精確候選；R2發布／七項CI／兩站部署／正式API及瀏覽器／收據完成 |
| 回退／硬體限制 | 只讀舊部署驗證完成；首次新格式無另一回退版 |

尚未驗真人／實體相機的眼動精度、實體觸控／尺量校正、Safari／iOS、長時間完整斷網、真人 Turnstile 或正式保存。人工驗收：量測可視螢幕與觀看距離，真人同意相機後依九點校正、五點驗證重校與四活動完整秒數操作，刻意遮臉／拔相機／切帳號／離線再恢復，確認缺測、CSV／摘要數量、身份、重試及停止清理。這些未測項目不能宣稱已完成或具有臨床效度。

## 發布進度與順序修正

核准的 `2.0.0`／上述摘要已於 2026-10-10T23:13:06.530Z 完成 R2 上傳／回讀與 current 切換，遊戲 bytes 不變。初次 runner 的正式標頭檢查失敗後仍執行了發布，順序有誤；正式 Hub 保持原部署。已先以 RED 測試修正 `_routes.json` 和 Pages `preview.html` → `preview` 轉址政策，部署 [6d3ddbde](https://6d3ddbde.trainerhub-user-games.pages.dev)，正式十份固定輸入 bytes／相機／CSP 核對通過。跨站瀏覽器另重現轉址清除 referrer，已將兩個精確 preview 網址的來源政策限定為 `strict-origin-when-cross-origin`，保留原 parent source／origin 驗證；單一 PWA 手機正式流程已通過。之後才切換 Hub。逐檔及順序紀錄見 [正式收據](releases/oculomotor-training-2.0.0.json)與[相容 runner 核對](migrations/oculomotor-training/compatible-runner-verification.json)；已完成正式 Hub／API／瀏覽器驗收並登記第六款完成。

## 正式部署與驗收結果

[CI 38094804766](https://github.com/ian030590/RehabTrainerHub/actions/runs/38094804766) 的七項驗證與部署全部成功，來源 `8bb3a1e9b89fa79d86ffeeee2e59635f96f43842`。Hub deployment `8778d598-914c-4ba2-822c-0c08f89fa01b`，runner deployment `31556b2e-9b61-41f3-9de7-ceddaa0e06f5`。正式公開目錄只有一個眼動 slug，`vision` 分類／原圖摘要正確；不指定版本 session 固定核准 `2.0.0`／上述摘要；十個 R2 檔案、嚴格 sandbox／CSP、穩定 PWA current302／no-store與 Hub 舊 JSON／JS／SW／manifest410／no-store均通過，[直接正式 API 核對](migrations/oculomotor-training/production-api-verification.json)。

真正部署的 Hub 完成桌機追視、手機跳視與拒絕／重新同意及 session 重試、平板無眼動凝視、英文登入中央辨識；獨立 PWA 桌機英文／手機／平板均完成實際固定模型、聚光燈、校正／驗證、原活動、數值成果、來源對應返回及原CSV下載／離線固定資產核對。CSV與摘要重試／身份隔離只寫本機SQLite，沒有建立正式測試帳號或訓練紀錄。代表畫面見 [production/](migrations/oculomotor-training/production/)。真人／實體硬體、Safari／iOS 與正式保存限制仍依上節，未宣稱臨床效度。
