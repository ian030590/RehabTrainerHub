# 倉庫指引

## 測試先行與最小實作（TDD）

- 所有功能開發與重構，先寫可執行、能反映使用者行為的測試，確認測試因尚未實作的需求而失敗，再修改產品程式碼。
- 只寫足以讓測試通過的產品程式碼；通過後才在測試保護下整理重複與命名，避免預先建立未使用的抽象或額外功能。
- UI 重構先以測試鎖定既有功能、導航、設定、訓練啟動與完成流程；新增行動版或平板版互動時，先加入對應測試。不得為了讓測試通過而刪除既有功能或放寬安全檢查。
- 每次提交附上測試的失敗原因、修正後結果及相關回歸驗證；若無法自動化測試，先記錄可重現的人工驗收步驟與限制。

## 專案結構與模組組織

2026-10-18 antislop 批次後，十款 R2 current 為 `asteroid-shield@2.0.11`、`drawing-defense@2.0.8`、`driving-rehab@2.0.2`、`gabor-patching@2.0.3`、`gesture-battler@2.0.6`、`hart-chart@2.0.2`、`motor-cortex-rehab@2.0.4`、`moving-card@2.0.4`、`oculomotor-training@2.1.3`、`reading-training@2.0.2`。擁有者以「R2核准全部發佈」核准精確 version／contentSha256；先推送 `e418196e` 並部署 Hub／runner，再逐款發布並驗證正式 bytes、current、session 與正式 Hub 流程。見 `docs/antislop-review-2026-10-18.md` 與 `docs/releases/<gameId>-<version>.json`；以下各段的 current 描述為當時狀態。

21 款腦力練習（`stop-signal`、`sart`、`hex-schulte`、`n-back`、`stroop`、`schulte-grid`、`reaction-time`、`digit-span`、`go-nogo`、`continuous-performance`、`flanker`、`spatial-span`、`simon-task`、`number-letter`、`card-sorting`、`tower-of-london`、`attentional-blink`、`time-perception`、`attention-network-task`、`divided-attention`、`pattern-memory`）依擁有者要求參考 ADHD Focus Pro 訓練頁的模組種類重寫為 R2 自包含套件：既有 11 款升為 `2.0.0`，新的 10 款為 `1.0.0`。2026-10-22 擁有者核准文件所列 21 組精確 version／contentSha256 並親自執行發布，current 即該版本；先發布、正式 runner 驗證通過後才推送 registry／catalog。各款紀錄見 `docs/releases/<gameId>-<version>.json`。差異與驗證見 `docs/brain-training-r2-rewrite.md`。

16 款點擊與鍵盤遊戲（`tic-tac-toe`、`connect4`、`hex`、`dots-and-boxes`、`lights-out`、`sliding-puzzle`、`maze`、`sudoku`、`memory-match`、`simon-says`、`whack-a-mole`、`minesweeper`、`antisaccade`、`keep-track`、`letter-memory`、`plus-minus`）已寫成 R2 自包含套件 `2.0.0`：自有設定、聚光燈教學與成果，Pixi／canvas 盤面改為 DOM，四款 ExpFactory 作業改為原生作答。2026-10-23 擁有者核准文件所列 16 組精確 version／contentSha256 並親自執行發布，current 即該版本；先發布、正式 runner 驗證通過後才推送 registry／catalog。各款紀錄見 `docs/releases/<gameId>-2.0.0.json`。舌頭動作訓練與有球必應的 R2 候選見 `docs/tongue-catch-r2-migration.md` 與 `docs/every-ball-response-r2-migration.md`。差異與驗證見 `docs/sixteen-games-r2-migration.md`。
UFOV（周邊視野訓練）另寫成 R2 自包含套件 `2.0.0`，三個成果檔案經 `result-files` 由容器代為下載；Hub／runner 支援先部署，再發布遊戲，最後推送 registry／catalog。2026-10-23 擁有者執行發布，與 21 款腦力練習的教學停止鈕邊框修正版（patch 版，見 `docs/tutorial-stop-border-releases.md`）一起完成正式驗收，current 即各該版本。差異、發布過程與驗證見 `docs/ufov-r2-migration.md` 與 `docs/releases/ufov-2.0.0.json`。

駕駛注意力模擬練習目前 current 為 `driving-rehab@2.1.1` 車流修正版，2026-10-19 依「核准發佈」發布精確八檔／`contentSha256: 1a25dbd5882557ffd9a145436048d7b205208f523540502e5a35c47d138091ec`（1,282,872 bytes）：閃車時擦到或與順向車重疊不再卡死（等玩家的車不擋玩家開走、已重疊可往分開方向移動、順向車不開進玩家車身、黑畫面拉回時清空拉回點），背景車改在視線外前方重生、接近終點不再補車，取代對向車瞬移到終點前 6 m 的舊做法；計分與紀錄欄位不變。來源 `9e8c7413`；自動模式不讓代理發布，由擁有者親自執行發布指令。七項 gate、本機三項與正式 Hub 桌機／手機及獨立 PWA 手機流程、正式 session／公開八檔 bytes／穩定入口 302 通過；未建正式帳號或紀錄。`2.1.0` 為回退版（`--activate-version 2.1.0`），未實際回退。見 `docs/releases/driving-rehab-2.1.1.json` 與 `docs/driving-rehab-r2-migration.md`。以下為 2.1.0 紀錄：`driving-rehab@2.1.0` 像素駕駛室版，2026-10-19 依「核准發佈，遊戲手把模式暫緩」發布精確八檔／`contentSha256: af1ce685bc96b6ad3c4116472aac9b743e787cc3e103189e87fdafac72852548`（1,281,420 bytes）。場景改為 javascript-racer 式 2D 像素投影，移除 three.js／GLB／`vehicle-data.js`；臺灣左駕第一人稱駕駛室含方向盤、速度表、A 柱及三面可看到後方來車的後視鏡；計分、10 個 summary 欄位、逆向事件與反應時間判定不變，精靈圖全部 CC0（`games/driving-rehab/sprites/SOURCES.md`）。capabilities 不變，未另部署 Hub／runner；來源 `91efe09a` 已推至 `main`。七項 gate、本機八項與正式 Hub 桌機／手機及獨立 PWA 手機流程、正式 session／公開八檔 bytes／穩定入口 302 通過；未建正式帳號或紀錄。`2.0.2` 為回退版（`--activate-version 2.0.2`），未實際回退；`2.0.3` 只做過 dry run，未發布。遊戲手把模式由擁有者暫緩。見 `docs/releases/driving-rehab-2.1.0.json` 與 `docs/driving-rehab-r2-migration.md`。

哈特圖目前 current 為 `hart-chart@2.0.4`，2026-10-19 由擁有者在確認精確 version／摘要後親自執行發布指令，發布精確五檔／`contentSha256: 751ea298b25c523cb9d0519f604de377e09d3c841039a2c3351154a74dcfde09`（659,003 bytes）。依擁有者要求做三項修改：座標改為［欄,列］（第一個數字往右數欄、第二個往下數列，螢幕報讀先念欄；字母表、座標資料與固定 SHA 的 `logic/hartChart.ts` 不變）；Decoder 每個詞是不換行的群組、詞間保留空格，格子依最長的詞縮小（下限 28px，`logic/decoderLayout.ts` 產生 `100cqi` 算式），左右停靠放不下時解碼欄加寬（最多 55%）；設定新增「解碼文字」`characterSet: 'english' | 'chinese'`（預設英文字母、與介面語言無關、存入成果 config），中文模式用 `logic/hartChineseChart.ts` 的 13 句繁中日常句子（按詞分組）與可重現的 100 格字表，以輸入法打字、`compositionend` 後判斷，Safari 重送與取消組字不重複計次，QR 第二螢幕帶 `characters=chinese`。五項數值成果不變。TDD 先失敗於缺 `characterSet`／中文模組／教學仍為［列,欄］；`test:game-architecture` 322/322、本機 13 項與正式 Hub 及 PWA 流程（含 CDP 真實組字事件與每次 Decoder 斷行量測）、正式 session／catalog／公開五檔 bytes／穩定入口 302 通過；未建正式帳號或紀錄。來源 `fd835611`（deploy run 39273146102 成功）。`2.0.3` 為回退版（`--activate-version 2.0.3`），未實際回退。見 `docs/releases/hart-chart-2.0.4.json` 與 `docs/hart-chart-decoder-text.md`。以下為 2.0.3 紀錄：哈特圖 `hart-chart@2.0.3` 確認面板修正版，2026-10-19 由擁有者在確認精確 version／摘要後親自執行發布指令，發布精確五檔／`contentSha256: 97a3ad4a9d576ebaf3e0a354905bfaa17a12f5fe5fb43c5c6e2a25e27c25146d`（651,974 bytes）。自 `2.0.1` 起教學直接使用 inert 的實際訓練畫面（`.hart-page`，z-index 1000），但最終確認面板的 `.hart-tutorial-ready { z-index: 1200 }` 被後載入 `rules.css` 同權重的 `.training-panel { z-index: 900 }` 覆蓋，面板畫在訓練畫面下方：玩家只看到點不動的訓練畫面，點擊穿過 inert 層落到看不見的面板，無法開始訓練也不會進入全螢幕（Windows Brave 回報，其他遊戲正常）。改為 `.training-panel.hart-tutorial-ready`；玩法、設定、計分與五項數值不變。舊 Brave fixture 以座標點擊開始鈕，hit test 會略過 inert 元素而點到隱藏按鈕，因此先前驗收沒抓到；共用 `CheckConfirmationPresentation` 現在暫時解除 inert 檢查確認按鈕確實畫在最上層，`check-hart-chart-tutorial.test.mjs` 另以 CSS cascade 檢查圖層順序（CI）。兩者在修正前均失敗（900 對 1000；正式 2.0.2 兩顆按鈕被遮住），閱讀訓練正式版通過共用檢查。來源 `bf91b961`（push 因測試腳本變更重新部署未改動的 Hub／runner，run 39263592500 成功）；`test:game-architecture` 317/317、本機六項與正式 Hub 桌機／手機／英文登入及獨立 PWA 手機流程、正式 session／catalog／公開五檔 bytes／穩定入口 302 通過；未建正式帳號或紀錄。`2.0.2` 為回退版（`--activate-version 2.0.2`，同樣有此問題；`2.0.0` 之前沒有），未實際回退。見 `docs/releases/hart-chart-2.0.3.json` 與 `docs/hart-chart-tutorial-parity.md`。以下為 2.0.1 紀錄：哈特圖 `hart-chart@2.0.1` 教學對齊版，已於 2026-10-18 依「核准發佈」發布精確五檔／`contentSha256: d604b2e25963b90ed8d6ad2e39d230b2d87dad8f3204ae44d30c2301a4884366`。聚光燈直接使用實際字母表、完整解碼器與工具列，開始後保留教學字母／座標；教學 inert、playing 輸入檢查與原計時／五項數值成果保留。七項本機 gate、正式 API／session／公開 bytes 與九項 Hub／PWA 流程通過，未部署 Hub／runner、未建正式帳號或紀錄，也未新增 Git commit／push。`2.0.0` 五檔私人／公開 bytes 已核對為回退版，未實際回退。驗收期間駕駛由另一工作流程獨立發布 `2.0.1`，其發布收據／current／manifest 已核對，另外八款不變；哈特圖 publisher 未寫入其他遊戲。見 `docs/hart-chart-tutorial-parity.md`、`docs/releases/hart-chart-2.0.1.json`；下列 `2.0.0` 為首次遷移歷史。

哈特圖訓練 `hart-chart@2.0.0` 已於 2026-10-18 依「核准，並請git push」核准精確五檔／`contentSha256: 67708380ebf0d31eefef4f0ff3070bc2fdc370c03478db6f2e206b4d45470aec`，完成 R2 發布／回讀／current 後才部署 Hub。保留原設定、字母表／座標解碼／提示／停靠／縮放／QR 及五項數值成果，採自有設定／成績與三步聚光燈；沙盒／CSP 不變。七項 CI、正式 API／session／五檔 bytes 與九項 Hub／PWA 流程通過，沒有正式帳號或訓練紀錄。正式現為十款 R2／30 款舊流程，其他九款 current 不變；來源 `f8f5ccb9` 已推至 `feat/hart-chart-r2`，Hub `7ab7e21e`、runner 沿用 `56fca01e`。收據、首次 native 回退基準與硬體限制見 `docs/hart-chart-r2-migration.md`、`docs/releases/hart-chart-2.0.0.json`。下列九款／31 款為哈特圖之前的歷史狀態，現況以本段與最新收據為準。

駕駛注意力模擬練習當時 current 為 `driving-rehab@2.0.1` 設定面板樣式修正版，已於 2026-10-18 依「核准發佈」並於對話中確認精確摘要，發布八檔／`contentSha256: d2b1d8e8d40cb4535a4a16f99f2b1bb262531e13eb81975c120a4e25362a89f9`。設定改用與其他 R2 遊戲相同的 `training-setting` 卡片與下拉選單（難度、畫面品質、操作裝置；未偵測裝置保留但停用），移除覆蓋卡片樣式的自訂單選格；設定值、驗證、玩法、計分、成果與 capabilities 不變，故未部署 Hub／runner。`test:game-architecture`、本機桌機／平板、publisher 回讀、公開八檔 bytes、穩定入口 302 及正式 `--production-hub --lobby`／`--remote --standalone --mobile` 流程通過；未建正式帳號或紀錄，未 commit／push。`2.0.0` 為回退版（`--activate-version 2.0.0`），未實際回退。見 `docs/releases/driving-rehab-2.0.1.json`；下段為首次遷移歷史。

駕駛注意力模擬練習 `driving-rehab@2.0.0` 已於 2026-10-18 依「核准並git push」核准精確八檔／`contentSha256: a0b5dda08b2d1c4a48830619dedcf8fa360a83ea3e7da24a60ab1ad69b5dd863`，完成相容 runner 先部署、R2 發布／current、Hub 切換及正式驗收。保留原四項設定、Three.js／模型／地圖／控制與方向盤校正、原數值成果，採自有設定／成績及三步聚光燈；gamepad 權限僅依核准 capability 傳遞，嚴格 sandbox／CSP 不變。七項 CI、正式 API／session／八檔 bytes、Hub 桌機／手機／平板／英文／虛擬方向盤及 PWA／設定保存共九項流程通過；未建正式帳號或紀錄。正式現為九款 R2／31 款舊流程，其他八款 current 不變。來源 `4a278a3` 推至 `feat/driving-rehab-r2`；runner `56fca01e`、Hub `4a27cfb9`。收據、首次 native 回退與硬體限制見 `docs/driving-rehab-r2-migration.md`、`docs/releases/driving-rehab-2.0.0.json`。

閱讀訓練（RSVP）`reading-training@2.0.0` 已於 2026-10-17 依「核准並發布到 R2」發布 R2 並切換 current（`contentSha256: 2876f30409adf5f5c31e400431256b2737a977e8fb1d098a56123393941fe6b0`，5 檔，收據 `docs/releases/reading-training-2.0.0.json`）；同日推送 `c329c5b` 至 `main`、部署 Hub 並完成正式驗收（舊 JSON 410、`/api/games` 一筆 2.0.0、session 綁定 2.0.0），已完成搬遷。自有設定、三步聚光燈（中央文字→速度與每批片段→理解題）、原 RSVP／jsPsych／Pixi、原數值成績欄位與私有 bridge 已完成；正式為八款 R2、32 款舊 bundle。見 `docs/reading-training-r2-migration.md`。

蓋伯斑塊目前 current 為 `2.0.1` 玩家文案版（2026-10-17），依「核准發佈」發布精確五檔／`contentSha256: af68e6dff786e033e99bc9c311bdb6a3700efd08a6386b1cf268da2d53ee79e3`。移除中英文教學／成果的活動紀錄、非臨床量測、內部圖樣實作與冗餘設定說明；玩法、計分、完整成果與保存提示保留。七項本機 gate、正式 API／session／公開 bytes 與桌機／手機／英文登入／手機 PWA 四個完整流程通過；未部署 Hub／runner、未建正式紀錄，其他六款版本不變。後續依「git 推送出去」以 `fix/oculomotor-2.1.1` 專用分支交付，避免 `main` 的完整 Pages 部署。`2.0.0` 五檔已回讀核對為回退版，未實際回退；見 `docs/gabor-patching-player-copy-2.0.1.md` 與 `docs/releases/gabor-patching-2.0.1.json`。

眼動練習目前 current 為 `2.1.1`，已於 2026-10-17 依「核准新的版本並git push到遠端」核准精確 11 檔／`contentSha256: 53c908e960adf358286c58d0b14d61ef62aebe441e7224373ed894337924ada3`，發布 R2 並完成正式 API／session／公開 bytes／六個 Hub／PWA 流程；未部署 Hub／runner，未建正式訓練紀錄，`2.1.0` 已核對回退。保留寬高獨立換算，比例填錯會變形，同倍率填錯仍圓但尺寸錯誤，全部 22 段原碼摘要保留。3:2 測試重現可見區 1440×960、隔離 `screen` 卻回報 1280×800，故全螢幕採實際顯示區；開始校正前重取穩定尺寸，校正途中變動仍失效。補齊即時狀態／置中／中英驗證／Accuracy 與 TFF 優先成果。七項 gate、八個本機及六個正式瀏覽器流程、15 欄私人 R2／25 欄下載差異、既有 238 筆 CSV metadata 與硬體限制見 `docs/oculomotor-display-feedback-2.1.1.md`、`docs/releases/oculomotor-training-2.1.1.json`；尚未實測使用者筆電或讀取私人座標內容。Git 交付使用 `fix/oculomotor-2.1.1` 專用分支，避免 `main` 的完整 Pages 部署。

歷史：2026-10-17 正式為八款 R2／32 款舊流程（閱讀訓練 2026-10-17 加入）；蓋伯當時另行核准、發布及驗收。先前 `main@9ae0561` 自動部署已提前帶入 Gabor registry，造成眼動 `2.1.1` 發布時 Gabor 舊資產 410、新 current 尚缺的狀態；本次核准 R2 發布後，既有 Hub 已可啟動蓋伯，舊 `settings.json` 維持預期的 410。未重部署或回退平台，眼動 current 仍 `2.1.1`。以下各版本「六款／34 款」為當時歷史數量，目前狀態以本文開頭及各版最新正式收據為準。

眼動練習 `2.1.0` 已於 2026-10-17 依擁有者「核准發佈」完成 OcuTrain `6676f24523a5bc857a7c28f68c520a45bfb8d167` 對齊版的精確核准、相容 runner／Hub 先部署、R2 發布及 current 切換。22 段原碼摘要、七項 gate、正式 API／11 檔 bytes、桌機／平板／英文登入／手機 Hub 與手機 PWA 五流程通過；`2.0.1` 十檔已核對回退，無正式訓練紀錄。新代理 `eye-tracking-1.1.0` 傳跨文件推論開始時間，保留 `1.0.0` 相容入口。正式平台使用隔離的六款 registry／34 舊 bundle（含舊 Gabor），沒有發布蓋伯候選，也沒有新增 Git commit／push；不可直接部署含蓋伯候選的完整工作樹。版本摘要、部署、來源差異、私有 CSV 契約與硬體限制見 `docs/oculomotor-ocutrain-parity.md` 及 `docs/releases/oculomotor-training-2.1.0.json`。

蓋伯斑塊練習 `gabor-patching@2.0.0` 已於 2026-10-17 依「也核准gabor-patching，請同步幫我上傳」核准既有精確摘要 `fe2dfb2d0edba20f2706a9aa638c8a1fc1daffd2531fe1c74a925049b2a2429a`，五檔／1,157,718 bytes 發布 R2／切換 current，正式 API／不指定版本 session／公開 bytes／桌機手機平板英文登入與手機 PWA 五個完整 30 秒流程均通過，另驗正式 PWA 停止與本機 fixture 撤回。七項 CI、遊戲／Hub build 通過；正式七款／33 款，無產品程式改動、平台部署或正式紀錄。原設定／演算法／計分／原圖、自有設定、三目標教學、完整數值與私有 bridge 保留。正式模式的 fixture 撤回命令曾逾時，原因與本機重驗均保留，未操作正式撤回。首次 native 無另一核准回退版，已重驗歷史 Hub 三個舊檔 bytes，只能針對 Gabor 還原並保留其他六款及眼動修正。審查、TDD、核准、CI、驗收與限制見 `docs/gabor-patching-r2-migration.md`、`docs/releases/gabor-patching-2.0.0.json`；實體觸控／小喇叭、Safari／iOS 與長時間完整離線未驗。

npm workspace / Turborepo monorepo；目前只有兩個 app，App 程式碼位於 `apps/`：

- `apps/rehabtrainerhub`：Next.js Hub + Cloudflare Pages Functions（主平台、大廳、內建訓練 runtime、API、審核後台、開發者入口）。
- `apps/usergamerunner`：獨立遊戲隔離執行環境（Cloudflare Pages + Functions），從 R2 讀取核准版本，提供套件資產、安全標頭、版本化 runtime 與 PWA launcher；支援官方原生遊戲與第三方 HTML/ZIP 遊戲。
- 手部目標追蹤練習 `motor-cortex-rehab@2.0.0` 已核准精確 version／contentSha256、先部署相容手部代理、發布 R2，再切換正式 Hub；七項 CI／兩站部署與正式 API／桌機／手機／英文登入右手／獨立 PWA 手機及平板左手均驗收通過，見 `docs/motor-cortex-rehab-r2-migration.md` 與 `docs/releases/motor-cortex-rehab-2.0.0.json`。正式完成 6 款，Hub build 排除它們並保留 34 款舊遊戲。感測器使用實際 MediaPipe 圖片串流，未驗真人／實體相機或 Safari／iOS；首次遷移無另一個核准新格式回退版，保留原 Hub deployment／commit 還原舊流程。
- 小行星護盾防衛 `2.0.0` 已完成首次遷移；設定視窗版 `2.0.1` 已核准、發布並驗收。玩法版 `2.0.2` 重現底部寬幅飛船、水平護盾、差異落速與動畫，已核准精確摘要、發布 R2 並通過正式 API／桌機／觸控／獨立 PWA 驗收，見 `docs/asteroid-shield-gameplay-2.0.2.md` 與 `docs/releases/asteroid-shield-2.0.2.json`；`2.0.1` 保留為當版已核對回退版。後續設定 UI 採遊戲自有前景視窗與預先呈現的教學背景，遵循搬遷計畫第 7 節步驟 B。正式已有 6 款自包含遊戲，正式 Hub build 排除它們、保留 34 款舊遊戲；後續遷移同樣必須等正式驗收與收據完成，不能只以 R2 公開或本機登記作為完成證據。成績頁新版 current 為畫畫塔防 `2.0.4`、小行星護盾 `2.0.3` 與手勢對戰 `2.0.2`（含設定／教學版面更新）；精確核准、正式 API／桌機／手機／獨立 PWA 驗收與回退見 `docs/r2-game-results-ui.md` 及 `docs/releases/` 對應正式收據。
- 移動卡片訓練 `moving-card@2.0.0` 已核准精確摘要並完成相容 runner 先部署／R2 回讀／Hub 切換、七項 CI／兩站部署與正式 API／桌機／手機／平板／英文登入／獨立 PWA 驗收。保留原參數、校正、jsPsych／Pixi 三難度、原圖及數值成果，採自有設定、三目標聚光燈與完整成績；詳見 `docs/moving-card-r2-migration.md` 與 `docs/releases/moving-card-2.0.0.json`。正式六款完成、34 款舊流程；首次新格式無另一核准回退版，原 Hub deployment／commit 保留。Safari／iOS、實體觸控與尺量校正尚未驗收。
- 移動卡片視覺搜尋版 `2.0.1` 已核准精確摘要、發布 R2 並切換 current；三種名稱為方形排列、圓形散亂、圓形散亂旋轉，教學與正式 Pixi 使用遊戲自有同一套圖卡 geometry／旋轉與原校正字級，縮放後聚光燈同步更新。七項本機 gate、遊戲／Hub 建置、正式 API／逐檔公開 bytes 與 Hub／獨立 PWA 的手機／桌機三種排列共 12 個流程均通過；只寫本機 SQLite，未建立正式帳號或紀錄，未重新部署平台。`2.0.0` 已核對為回退版；見 `docs/moving-card-visual-search-2.0.1.md` 與 `docs/releases/moving-card-2.0.1.json`。手機為 Brave 模擬，Safari／iOS、實體觸控、尺量校正與長時間完整離線訓練尚未驗收。
- 眼動練習 `oculomotor-training@2.0.0` 已精確核准、發布 R2、完成相容 runner 修正／Hub 切換、七項 CI／兩站部署與正式 API／桌機／手機／平板／英文登入／獨立 PWA 驗收。保留25項原設定、四種原刺激／校正驗證、四目標聚光燈、十項數值成果與原CSV；正式六款完成／34款舊流程。逐檔核准、Pages轉址政策／發布順序修正、驗收與回退見 `docs/oculomotor-r2-migration.md` 與 `docs/releases/oculomotor-training-2.0.0.json`。感測器為實際原模型的已核對人像串流，未驗真人／實體相機精度、Safari／iOS；首次新格式無另一核准回退版，保留原Hub deployment／commit。
- `apps/rehabtrainerhub/games/{gameId}/`：目前有 50 個正式遊戲 workspace，擁有各自的 Vite entry、runtime、規則與 i18n。正式站上最後 2 個舊流程遊戲（舌頭動作訓練、有球必應）仍依賴 `@rehab-trainer/ui` 的既有 `OfficialGameShell`、樣式、語言 provider 與設定橋樑，維持 `settings.json`／`score.json` 流程；兩款的 R2 `2.0.0` 候選已在工作樹寫成自包含套件，須核准精確 version／contentSha256 並發布後才推送其 registry，在那之前不能宣稱所有遊戲已完全獨立。推送後 Hub 的舊流程程式（`TrainingOverlay` 的 JSON 分支、`JsonTrainingOverlay`、`OfficialGameShell`）沒有使用者，移除須另行處理。**新遊戲與 R2 遷移完成的遊戲嚴禁引入共用 UI 或跨遊戲程式碼；既有共用依賴不得擴張。** 登記於 `packages/ui/src/officialGameReleases.json` 的 R2 遊戲自行呈現設定、教學與成績，僅透過私有 MessageChannel 傳送成果，由 Hub 驗證後入庫。已遷移畫畫塔防、小行星護盾防衛、手勢指令對戰、手部目標追蹤練習、移動卡片訓練、眼動練習、蓋伯斑塊練習、閱讀訓練、哈特圖、駕駛注意力模擬練習，21 款腦力練習（11 款舊 ExpFactory／參考遊戲重寫與 10 款新遊戲，見 `docs/brain-training-r2-rewrite.md`），16 款點擊與鍵盤遊戲（見 `docs/sixteen-games-r2-migration.md`）、UFOV（見 `docs/ufov-r2-migration.md`），候選為有球必應與舌頭動作訓練，詳見 `docs/r2-game-migration-plan.md`。
  **新增遊戲與 Workspace 同步：** 加入 `apps/rehabtrainerhub/games/catalog.ts` 後執行 `npm run sync:games`；有 workspace／依賴異動時更新 lockfile。sync 依 registry 將未遷移遊戲加入 Hub 依賴樹，將 R2 遊戲排除。其舊模板仍會為缺少設定檔的遊戲產生共用 UI 依賴及 alias，並不驗證遊戲是否獨立；新遊戲與 R2 遊戲須先提供自有 `package.json`、Vite entry 及依賴，不能靠 sync 取得符合新架構的套件。

Hub 的共用 UI、client auth、layout、storage、訊息協定位於 `packages/ui/src`；登入／session、授權及資料庫寫入位於 `apps/rehabtrainerhub/functions/`。`packages/game-settings` 提供 Hub 與 runner 使用的 JSON schema／validation，不是遊戲開發 SDK。R2 遊戲不得依賴這些平台套件。
第三方遊戲通訊橋樑由 `apps/usergamerunner/runtime/` 維護；本倉庫不提供開發者 SDK 套件。
靜態資產：各 app `public/`，通常 `public/assets/`。
D1 migrations：`apps/rehabtrainerhub/migrations/`。
Cloudflare bindings 以各 app 的 `wrangler.toml` 為準：Hub 有 `REHAB_DB` D1、`ARTICLE_CACHE` KV（已停用，僅保留舊文章快取資料）與下列四個 R2 bucket；runner 只有 `GAME_RELEASE_BUCKET`，沒有 D1／KV 或 auth bindings。
R2 Buckets：`rehab-storage`（靜態素材）、`oculomotor-data`（私人眼動逐筆 CSV，含新版 WebGazer 上傳與舊版歷史紀錄）、`rehab-game-quarantine`（待審上傳暫存）、`rehab-game-releases`（已核准不可變發布）。新版眼動練習另由瀏覽器下載原參考格式的 CSV。
舊本機 `.dist-releases/` 已刪除並由 Git 忽略。發布讀取遊戲 workspace 的 `dist/`，暫存收據位於 `.tmp/official-game-releases/`，正式收據保留在 `docs/releases/`。

## 建置、測試與開發指令

- `npm run dev`：Turbo 啟動宣告 `dev` script 的 workspace；目前只有 Hub。
- `npm run dev:hub`：啟動 Hub。
- `npm run build`：執行測試 gate，再由 `scripts/build-apps.mjs` 先建置全部遊戲 workspace、後建置兩個 app；不會自動發布 R2。
- `npm run build:cloudflare`：執行本機完整 gate，並建置 Cloudflare Pages 輸出；已在 CI 驗證時使用 `build:cloudflare:only`。
  Pages build 僅建置未遷移遊戲（兩款候選登記後為 0 個）與兩個 app，排除 registry 登記的 R2 遊戲；R2 遊戲另行建置與發布。
- `npm run build:hub`：Turbo 建置 Hub 及其未遷移遊戲依賴（兩款候選登記後沒有），產生 `apps/rehabtrainerhub/out/`；畫畫塔防、小行星護盾防衛、手勢指令對戰、手部目標追蹤練習、移動卡片訓練、眼動練習、蓋伯斑塊練習、閱讀訓練、哈特圖、駕駛注意力模擬練習、21 款腦力練習、16 款點擊與鍵盤遊戲、UFOV，以及登記後的有球必應與舌頭動作訓練只留下導向 R2 PWA 的入口，不攜帶遊戲 bundle／JSON。
- `npm run build:gamerunner`：建置隔離站的靜態 runtime 到 `apps/usergamerunner/dist/`；遊戲版本仍由 Functions 從 R2 讀取。
- `npm --prefix apps/rehabtrainerhub/games/drawing-defense run build`：單獨建置 R2 遊戲到其 `dist/`。發布腳本讀取既有輸出，不會先建置。
- `npm run publish:game -- drawing-defense`：版本取自遊戲 package.json；檢查並發布至 R2。同版本不同內容禁止覆寫；逐檔比對、上傳並回讀 SHA-256，最後發布 release manifest，再更新 `official-games/{gameId}/current.json`。此官方 CLI 採每遊戲單一發布者，沒有第三方審核 API 的 Lease 鎖；同遊戲的發布與回退不可平行執行。
- `node scripts/publish-official-game.mjs drawing-defense --activate-version 2.0.1`：核對官方歷史、approved manifest 與實際檔案後回退 current；保留所有發布版本，不部署 Hub。首次建立官方歷史只使用 `docs/releases/` 已追蹤收據的雜湊，不能掃描共用 releases prefix 當作官方來源。
- `node scripts/publish-official-game.mjs drawing-defense --dry-run`：只做本機套件驗證與暫存收據，不連線 R2。直接呼叫腳本可避免本機 npm 未轉交 `--dry-run` 參數而意外執行發布流程。
- `npm run test:hub-functions`：驗證 Hub 後端 API 與安全防護測試。
- `npm run deploy:game-review-worker`：部署 `workers/game-review-issues` 的 GitHub Issue Cron Worker。先套用 `0014_game_review_issues.sql`、設定 GitHub App 的四項 server-only secrets；此命令不部署 Pages、不搬遊戲、不核准發布。Hub 另需 `GAME_RELEASE_OWNER_USER_ID`，未設定時審核操作回覆 503。詳見 `docs/hub-game-review-rollout.md`。
- `npm run test:gamerunner`：驗證 usergamerunner 路由、沙盒、SW 與安全標頭測試。
- Workers 部署（見 `docs/workers-migration-report.md`）：`npm run build:workers` 把兩個 app 的 `functions/` 編譯到 `apps/*/.worker/`，供 `wrangler.workers.jsonc`（Worker `trainerhub`／`trainerhubgames`）使用，需先建置 app。`node scripts/deploy-cloudflare-workers.mjs --dry-run` 只列出指令；缺少 Hub routes，或 runner origin 與 registry 不一致時拒絕部署。`npm run test:workers-local` 以本機 workerd 檢查 27 項與 Pages 相同的 HTTP 行為（可用 `HUB_OUTPUT_ROOT`／`RUNNER_OUTPUT_ROOT`），不進 Linux CI。兩個 Pages 專案已於 2026-10-19 刪除；`wrangler.toml` 留作 binding 對照，Pages 部署腳本只在 `CLOUDFLARE_DEPLOY_TARGET=pages` 時執行，並會重新建立專案。
- `npm run test:game-platform`：驗證遊戲套件掃描器與平台通訊橋樑。
- `npm --prefix apps/rehabtrainerhub run preview`：預覽 Hub 的 `out/`；runner 與現有遊戲 workspace 未宣告 `preview` script。

高風險 trainer 變更完成前執行 `npm run test:entrypoints`：entrypoint、routing、entrypoint 引入的共用 layout/UI，或可能把 Pixi、jsPsych、Three.js、MediaPipe、TensorFlow、Vosk 帶入 entry bundle、造成白畫面的變更。此 gate 包含 Subject ID helper、training flow、assessment jsPsych lifecycle 與 i18n dictionary parity 檢查。

修改 Asteroid Shield、全螢幕流程或 Pixi 尺寸後，至少執行 `npm run test:entrypoints` 與 `npm run build:hub`，驗證設定/rules 流程、原生全螢幕目標、全視窗 canvas。

九款 R2 遊戲的全螢幕啟動／退出回歸由 `scripts/check-r2-game-fullscreen.test.mjs` 經既有 self-contained 測試納入 `test:game-architecture`，不新增 CI matrix。設定與教學保持視窗；手部目標追蹤先啟用相機，準備後以最後一次「開始訓練」點擊進入全螢幕；手勢對戰在相機就緒後的第一次校正點擊進入全螢幕（含手機）。九款返回 Hub／獨立入口前退出全螢幕，Hub 關閉、卸載與撤回亦清理並還原大廳捲動。驗證與發布限制見 `docs/r2-game-fullscreen-lifecycle.md`、Gabor 與駕駛正式收據。

六款 R2 遊戲的音訊使用各遊戲自有 `tone@15.1.22`／soundManager 與 `music.ts`，直接接受 Tonejs/Midi 的秒數／力度 JSON，支援波形／白噪音、多軌和弦及循環；`@tonejs/midi` 僅作 root 開發時轉檔。譜面編入 bundle，不用外連、Worker 或錄音取樣；只在 gameplay 播放，取消／完成／退出／卸載清理。`scripts/check-r2-game-audio.test.mjs` 經 self-contained 測試納入既有 `test:game-architecture`，沿用七項 CI matrix／原命令，browser 音訊驗證留在本機 Brave。六款已於 2026-10-12 精確核准、發布及驗收：畫畫塔防 2.0.6、小行星 2.0.5、手勢 2.0.4、手部 2.0.2、移動卡片 2.0.2、眼動 2.0.1。七項本機 gate、正式 API／current session／43 檔 bytes 與桌機 Hub／手機 Hub／手機獨立 PWA 共 18 流程均通過，無平台部署、無正式訓練紀錄；回退／收據見 `docs/r2-game-tone-audio.md`、`docs/releases/` 與搬遷計畫第 7 節。歌曲預設仍為空；相機使用圖片串流，Safari／iOS 與實體相機／音訊輸出未驗收。

小行星護盾四軌音樂 `2.0.6` 已於 2026-10-13 精確核准、發布 R2 並切換 current：主旋律／合聲 square、打擊 white-noise、bass triangle 並提高一個八度，保留原 JSON、48 秒循環與聲音開關；同時處理過期／重複打擊節拍。34 項音訊／142 項架構測試、七項本機 gate、Hub build 與正式 API／session／12 檔公開 bytes、桌機 Hub／手機 Hub／手機獨立 PWA 三流程均通過，僅寫本機 SQLite；2.0.5 已核對為回退版。其餘五款背景歌曲仍為空。收據與驗收見 `docs/asteroid-shield-music-2.0.6.md`、`docs/releases/asteroid-shield-2.0.6.json`；實體音訊輸出與 Safari／iOS 尚未驗收。

小行星護盾教學／HUD 版 `2.0.7`（2026-10-13）已依擁有者預先授權完成修正後直接發布 R2，教學四種物件移至上方、聚光燈與面板互不遮擋，教學／玩法使用完整透明護盾，左上綠色生命條及倒數直接來自 game loop。12 項小行星／143 項架構測試、七項本機 gate、Hub build、小視窗／手機／平板及正式 API／session／12 檔公開 bytes、桌機 Hub／手機 Hub／手機獨立 PWA 均通過；四軌音樂沿用 2.0.6，僅寫本機 SQLite，2.0.6 已核對為回退版。見 `docs/asteroid-shield-hud-2.0.7.md` 及正式收據；Brave 手機／平板為模擬，實體觸控／音訊輸出與 Safari／iOS 未驗收。

小行星護盾音效版 `2.0.8`（2026-10-13）已依使用者完成後直接發布授權加入新隕石一次性的下降白噪音呼嘯，受擊／失敗改用 -9 dB 中頻方波警示；四軌／成功／勝利沿用，完整混音經 -3 dB Limiter，短時間重複受擊合併，靜音／設定／卸載清理。37 項音訊、13 項小行星、147 項架構測試、七項 gate、Hub build、真實 Tone PCM／48 秒循環及正式 API／12 檔 bytes／三個 Hub/PWA 流程通過，2.0.7 已核對回退。500–3000 Hz 模擬頻段警示比舊版約高 30 dB，樣本未削波；預聽與收據見 `docs/asteroid-shield-effects-2.0.8.md`。沒有正式紀錄；實體小喇叭試聽、觸控及 Safari/iOS 未驗收，不能把模擬量測當作硬體驗收。

小行星目前 current 為 `2.0.9` 音量平衡／直接輸出版，沿用同一音效任務的發布授權完成使用者修正：正向 sine -15 dB、負向 square -17 dB，移除額外 Limiter/output；四軌與呼嘯保留。重複成功合併、結束清理未完成提示，實際最響 100 ms 的正／負提示差距均在 3 dB 內，原生壓縮器 0、同時播放樣本未削波。38 項音訊／148 項架構、七項 gate、Hub build、六款真實音訊／48 秒循環及正式 API／12 檔 bytes／三個 Hub/PWA 流程均通過，2.0.8 已核對回退；預聽與收據見 `docs/asteroid-shield-audio-balance-2.0.9.md`。沒有正式紀錄，未做實體小喇叭試聽、CPU 百分比基準及 Safari/iOS 驗收。

驗證使用 Node.js 內建 `node:test`、assert 檢查腳本、TypeScript、針對性 build 與本機 Brave smoke；依變更範圍選用對應 gate。Hub API、runner、遊戲流程、assessment lifecycle 與 i18n 分別有 `test:hub-functions`、`test:gamerunner`、`test:training-flow`、`test:assessment-lifecycle`、`test:i18n`。

## CI/CD 維護

- 駕駛搬遷將 `check-driving-rehab-migration.test.mjs`、`check-driving-rehab-tutorial.test.mjs` 納入既有 `test:game-architecture`；保留原 26 項 `test:driving-rehab` 核心測試，新增設定／原數值欄位、原模型與地圖 bytes、8 MiB 單檔限制、貼圖載入、啟動取消、私有 bridge、聚光燈與雙語驗證。共用 UI／結果／全螢幕／音訊／設定保存／研究契約、Hub API／SQL／目錄／middleware 及 runner 穩定入口加入此 gameId；兩份 workflow 沿用七項 matrix 與原 root 命令，workflow 自身仍觸發驗證。原本以 driving-rehab 代表未遷移遊戲的共用成績 Brave fixture 改用 `every-ball-response`，records 舊路徑 fixture 改用 `hart-chart`。本機 `npm run test:driving-rehab-browser` 現在轉交 R2 harness；亦可用 `node scripts/check-r2-game-browser.mjs --game driving-rehab --lobby`，搭配 `--wide --windowed --renderer-failure`、`--mobile --medium --session-failure`、`--tablet --medium --hard`、`--signed-in --english --hard --low`、`--wheel --low --stop`、`--revoke`、`--settings-memory` 或 `--standalone --mobile`／`--standalone --tablet --low --stop`。觸控需在父頁及隔離 iframe 啟用 CDP touch emulation；方向盤只用虛擬裝置校正／斷線驗證，不代表實體硬體驗收。只寫本機 SQLite，不新增 Brave CI。 已核准發布並完成正式九項 Hub／PWA 驗收，見正式收據；Linux 文字原碼／JSON 摘要統一 CRLF→LF，二進位與發布 bytes 不做正規化。

- 閱讀訓練候選新增 `check-reading-training-migration.test.mjs` 與 `check-reading-training-tutorial.test.mjs` 至既有 `test:game-architecture`；共用 UI／結果／全螢幕／音訊／研究契約、Hub API／SQL／目錄／middleware 與 runner 穩定入口加入此 gameId。原本以 reading-training 代表未遷移 JSON 遊戲的 Brave 共用成績測試與 records 舊路徑 fixture 改用 `driving-rehab`。本機 Brave：`node scripts/check-r2-game-browser.mjs --game reading-training --lobby`（另 `--wide --windowed`、`--mobile --session-failure`、`--tablet`、`--signed-in --english --renderer-failure`、`--standalone --mobile`、`--standalone --tablet --stop`、`--revoke`），不加入 Linux CI。

- OcuTrain 對齊的 `scripts/oculomotor-reference.test.mjs` 經既有眼動遷移測試引入 `test:game-architecture`，涵蓋全部 22 段原碼摘要、尺寸比例正確／單軸錯誤變形／同倍率錯誤大小、3:2 與等比例縮放、全螢幕實際尺寸／視窗整屏資料／跨比例校正失效、閾值／半徑、追視回程、凝視階段、TFF、來源時間、零資料驗證、取消倒數、設定、完整 CSV、即時偵測、雙語與成果排序。新版輸入代理及兩版相機路由／PWA 由 `test:gamerunner` 覆蓋；兩份 workflow 沿用原七項 matrix 與相同 root 命令，不新增 Brave CI。詳細 RED／GREEN 與本機流程見 `docs/oculomotor-ocutrain-parity.md` 及 `docs/oculomotor-display-feedback-2.1.1.md`。

- 蓋伯新增 `check-gabor-patching-migration.test.mjs` 與 `check-gabor-patching-tutorial.test.mjs` 至既有 `test:game-architecture`；驗證原設定／難度／計分、完整明細、取消／晚到 renderer、240 Hz 長紀錄、原圖、私有 bridge 與三目標聚光燈。既有 UI／結果／全螢幕／音訊測試加入此 gameId，Hub API／SQL／目錄／middleware 與 runner 穩定入口亦有回歸。兩份 workflow 沿用七項 matrix 與同一 root 命令，workflow 本身仍觸發驗證。本機 Brave 使用 `node scripts/check-r2-game-browser.mjs --game gabor-patching --lobby`，另驗 `--wide --windowed`、`--mobile --medium --session-failure`、`--tablet --hard`、`--signed-in --english --hard --sound-on --renderer-failure`、`--revoke`、`--standalone --mobile --medium` 及 `--standalone --tablet --hard --stop`；只寫本機 SQLite，不加入 Linux CI。`2.0.0` 已依相同摘要完成正式 Hub 四流程／PWA 完成與停止；撤回旗標只作用本機 fixture，不與正式模式合用。

- `npm run test:naming` 先執行命名檢查器回歸測試，再掃描原始碼；明確排除 `.dist-releases` 等建置產物，仍檢查原始碼的函式、參數與變數命名。兩份 workflow 的 `naming` matrix 均使用此命令。
- `npm run test:pwa` 包含 `test:pwa-navigation`，以本機 HTTP 308 轉址及實際產生的 Service Worker 驗證內嵌頁面預快取、離線導航與舊快取清理；兩份 workflow 的 `pwa` matrix 均執行此命令，不依賴 Brave。

- `.github/workflows/ci.yml` 在 PR 與非 `main` push 的應用程式、package、script、worker、lockfile、Turbo 或 workflow 變更時執行；純文件變更不得啟動 CI。
- `.github/workflows/deploy-cloudflare-pages.yml` 在 `main` 的既有應用程式／package／script／worker／workflow 觸發範圍執行 matrix 驗證。`deployment_scope` 另判斷 Pages 是否需部署：只有已遷移 R2 遊戲內容、遊戲 package.json 版本號及對應 lockfile 版本中繼資料變更時跳過部署；平台、依賴與未遷移遊戲變更仍部署。手動執行或無法確認差異時保守部署；workflow 自身仍在觸發範圍。新增 gate 時加入兩份 workflow 的 matrix，並維持相同命令。Issue Worker 目前另外部署，Pages workflow 不會自動部署它。
- CI/CD 乾淨安裝使用 `npm ci --workspaces --include-workspace-root`；Hub 的內建遊戲相容 build 需要 root 的 Vite 與訓練 runtime dependencies，不得省略 workspace root。
- `test:game-platform` 由兩份 workflow 的 `test:entrypoints` matrix 間接執行，涵蓋遊戲通訊橋樑、訊息協定與設定 schema；SDK workspace 已移除。兩份 workflow 維持相同的 `test:entrypoints` 命令。
- Hub 單一四路由導覽與 `aria-current` 契約由 `scripts/check-hub-navigation.test.mjs` 驗證，包含於兩份 workflow 共用的 `test:entrypoints` 命令；手機導覽與平板無水平溢出另以本機 Brave browser smoke 驗證。
- `scripts/check-antislop.test.mjs` 納入 `test:entrypoints`：原始碼（不含 vendored 檔）不得有 em dash，缺值顯示「無」／`N/A`；每款遊戲 `rules.css` 的 training-panel 導覽按鈕，以及哈特圖解碼拖曳把手與代碼輸入框，保留 3px `:focus-visible` 外框；Hub 與 R2 表單控制邊框用 ≥3:1 的 `--border-strong`；Hub 文案的掃描規則數與職能治療師資格須與程式碼及本檔一致；網站導覽列出的導覽／分類名稱須與實際介面相同。兩份 workflow 維持相同 `test:entrypoints` 命令。
- Hub 統一遊戲目錄與單一啟動入口由 `apps/rehabtrainerhub/app/hubGames.test.mjs` 納入 `test:entrypoints`；Issue 工作、版本雜湊、指定擁有者核准及實際 SQL 投稿／保存由 `test:hub-functions` 覆蓋。`test:cloudflare-deploy` 驗證 owner 設定只同步到 Hub，不傳到 runner build 或部署 subprocess。
- `npm run test:game-architecture` 檢查全部遊戲 TypeScript、逐遊戲依賴與 i18n、未遷移遊戲的 JSON／統一 config UI，以及 R2 遊戲的自有設定／成績、無共用依賴、私有通訊和實際 bytes 雜湊驗證（`scripts/check-self-contained-game.test.mjs`）；`scripts/check-game-catalog-metadata.test.mjs` 另檢查遊戲自有預覽圖與分類宣告。發布工具測試另驗證上傳失敗不切換 current、不可變檔案與歷史回退。確認舊 `.dist-releases/` 已移除且由 Git 忽略，正式發布收據仍可追蹤。CI 與部署 workflow 維持同名 matrix 與相同命令。Hub build 另驗證已遷移遊戲不得攜帶 bundle／JSON，且不得恢復 `/runtimes/*`。
- 同一 `test:game-architecture` gate 新增 `scripts/check-asteroid-shield-migration.test.mjs`，驗證小行星護盾原設定／邊界、完整數值成果、原預覽圖、統計與私有 port。兩份 workflow 維持既有 `game-architecture` matrix／相同 root 命令，沒有新增需 Brave 的 CI 項目；workflow 自身路徑仍觸發驗證。
- Hub `_middleware.js` 在 Pages 資產讀取前將 registry 已遷移遊戲的子資產回覆 410／no-store，阻擋刪除後仍保留的舊快取；根入口與 `index.html` 保留 R2 連結。`_middleware.test.mjs` 納入既有 `test:hub-functions` glob，驗證舊 JSON／JS／SW／manifest 阻擋及未遷移遊戲、預覽圖、API、退役網域 redirect 回歸；兩份 workflow 維持相同七項 matrix。
- 畫畫塔防 R2 本機 Brave 測試為 `node scripts/check-r2-game-browser.mjs`，另執行 `--mobile`、`--revoke`、`--session-failure`；發布後執行 `--remote` 與 `--remote --standalone`。平台部署後另以 `--production-hub` 讀正式 Hub 與 R2，僅攔截 Hub `/api/*` 至本機，驗證真正部署的開始前固定版本流程。不加入沒有 Brave 的 Linux CI matrix。所有模式的資料庫寫入只在本機測試 SQLite，不建立正式紀錄。
  `--lobby` 與 `--lobby --mobile` 另驗證實際公開目錄 API、同名舊版碰撞、上肢分類、R2 預覽圖及從大廳開始的完整流程；可用 `HUB_OUTPUT_ROOT` 指向固定的 Hub 輸出副本。
- 小行星護盾專用 Brave 流程使用 `node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby`；另跑 `--lobby --mobile`、`--lobby --signed-in`、`--lobby --session-failure`、`--lobby --revoke`、`--standalone` 與 `--standalone --mobile`。它執行真實 30 秒滑鼠／觸控 gameplay、三目標教學、設定往返／Enter、全螢幕、成果指標切換、保存重試／身份隔離及版本 scope 快取；`--signed-in` 只建立本機 SQLite 測試帳號。核准發布後再跑 `--remote --lobby`、`--remote --standalone`、`--production-hub --lobby` 與手機正式站模式，並直接讀正式 API／圖片；本機 fixture 不代表正式 API 已驗收。
- `npm run test:webgazer` 驗證原固定 WebGazer/jsPsych bytes、九點兩次校正、五點驗證、原設定／成果 fixture 與自有 settings／score 數值；包含於 `test:entrypoints`。網頁版沒有原生 Tobii 橋接。
- `npm run test:webgazer-browser` 以 R2 Brave 工具驗證 Hub 無眼動、Hub 眼動與手機獨立 PWA 眼動三流程。遊戲維持 opaque iframe、camera 禁止，可信輸入文件才有相機權限；實際原版模型使用已核對人像圖片串流，不代表真人／實體相機精度驗收。另以 `--activity vor|pursuit|saccade|fixation`、`--tablet`、`--signed-in --english`、`--camera-denied`、`--camera-disconnect`、`--stop`、`--revoke-playing` 驗證四模式、同意／斷線、CSV／摘要重試、身份隔離與清理；PWA 另驗固定模型／引擎實際離線讀取。只寫本機 SQLite，此項不加入 Linux CI matrix。
- `npm run build:cloudflare` 保留給本機完整 gate + build。CI/CD 已完成驗證時，部署 job 使用 `npm run build:cloudflare:only`，不可再序列重跑同一批測試。
- `npm run test:cloudflare-deploy` 包含私人眼動 R2 bucket 建立流程的冪等性與失敗情境，以及 R2 遊戲變更／版本 metadata 的 Pages 部署判斷測試；兩份 workflow 維持相同的 `cloudflare-deploy` matrix 命令。`test:gamerunner` 包含官方 current 入口、歷史雜湊與撤回驗證，並保留第三方 bridge 測試。
- `test:cloudflare-deploy` 另含 `scripts/check-cloudflare-workers.test.mjs`：Workers 設定的 D1／KV／R2 必須與 Pages `wrangler.toml` 相同、runner 只綁 release bucket 且沒有 vars／secrets、資產順序對應 Pages（Hub `run_worker_first: true`，runner 對應 `_routes.json`）、Hub secrets 為執行期 allowlist、部署順序為 migrations → runner → Hub，以及缺少 Hub routes 時拒絕部署。部署 workflow 預設在 `main` 執行 `scripts/deploy-cloudflare-workers.mjs`；只有 repo variable `CLOUDFLARE_DEPLOY_TARGET=pages` 時改跑 Pages 步驟，兩者不會同時執行。沒有新增 matrix 項目。
- 部署 job 先以 Cloudflare API 確認或建立私人 `oculomotor-data` R2 bucket，再部署含 `OCULOMOTOR_DATA` binding 的 Hub；bucket 不設定公開網域，也不綁定 usergamerunner。
- 兩份 workflow 的驗證 matrix 均為 `naming`、`pwa`、`game-architecture`、`hub-functions`、`gamerunner`、`trainer-entrypoints`、`cloudflare-deploy`；`test:entrypoints` 的內含 gate 以 root `package.json` 為準。
- `npm run test:seo` 同時驗證衛教文章連結的伺服器渲染與實際 HTML SEO 輸出，目前沒有獨立 CI matrix，也未列入 root build gate。Hub build 末尾會執行 `check-seo-output.mjs`，因此部署 build 有 HTML SEO 輸出檢查，PR 驗證 matrix 不會執行完整 `test:seo`；SEO 變更仍須本機另行驗證。
- 變更 workflow 觸發範圍、測試命令或 build gate 時，必須同步更新本節，並確認 workflow 自身路徑仍會觸發驗證。
- 手部目標追蹤遷移將 `check-motor-cortex-migration.test.mjs`、`check-motor-cortex-tutorial.test.mjs` 與 `check-motor-cortex-bridge.test.mjs` 納入既有 `test:game-architecture`；保留原引擎／參數邊界、五目標聚光燈、私有輸入、數值成果與原預覽圖驗證。兩份 workflow 維持上述七項 matrix、同一 root 命令及 workflow 自身觸發範圍；不新增 Brave CI 項目。`test:gamerunner` 驗證相容的空 input-start 與可選 `{hand: any|left|right}`、明確同意、只輸出 21 點 xyz 及取消／斷線清理。
- 移動卡片訓練 `2.0.0` 已核准、發布並完成正式驗收，正式六款／34 款舊流程；證據見遷移紀錄與正式收據。`check-moving-card-migration.test.mjs` 與 `check-moving-card-tutorial.test.mjs` 納入既有 `test:game-architecture`，驗證原設定／校正、三難度完整 40 選項、錯選重試／計時、取消／renderer 清理、三目標聚光燈及私有成果；既有結果／UI／全螢幕測試亦加入此遊戲。兩份 workflow 維持七項 matrix、相同 root 命令及 workflow 自身觸發範圍。本機 Brave 使用 `node scripts/check-r2-game-browser.mjs --game moving-card --lobby`，另驗桌機 `--wide --windowed`、`--tablet`、`--mobile --session-failure`、`--signed-in --english --hard --renderer-failure`、`--revoke` 及三尺寸 `--standalone`；只寫本機 SQLite。`test:gamerunner` 新增原生自包含 PWA 的單一 `lang=zh|en`、package 語言與離線快取回歸，持續拒絕重複／未知／混合 embed 參數。已完成相容 runner 先部署、精確版本發布、Hub 切換與正式驗收；詳見 `docs/moving-card-r2-migration.md`。

眼動遷移的 `check-oculomotor-migration.test.mjs` 與 `check-oculomotor-tutorial.test.mjs` 納入既有 `test:game-architecture`；`test:gamerunner` 驗眼動能力只限可信官方 slug、輸入同意／競態／斷線、私有座標／校正與離線資產；`test:hub-functions` 驗固定官方 session、私人 CSV 先存／摘要後存、數量與版本一致、重試與身份隔離。既有舊設定 Brave fixture 改用尚未遷移的 UFOV，保留原表單／全螢幕／引擎檢查；UFOV 遷移後改用有球必應（設定表單與獨立入口，後者以 `--fakeMedia true` 提供假相機）與舌頭動作訓練（全螢幕）。兩份 workflow 維持七項 matrix 與相同 root 命令；workflow 本身仍觸發驗證，不新增 Brave CI 項目。

## 程式風格與命名規範

### Training panel 長期規範

- 所有遊戲的 `training-panel` 必須使用明確語意標籤：主標題使用 `<h2>`、分段標題使用 `<h3>`、標籤與說明使用 `<p>`，有順序的規則使用 `<ol><li>`；不得以無語意的 `<div>` 或 `<span>` 取代。
- `training-panel` 內的文字字重至少為 `700`，字體大小以對應設定表單的基準放大 `1.15` 倍，並維持可讀的行高與鍵盤操作。
- R2 遊戲的參數設定 form、最終參數確認 div（含 `training-panel gesture-tutorial-ready`）與成績結算須維持一致 UI，div class 描述內容或用途；依 `docs/r2-game-migration-plan.md` 第 7 節「設定、最終參數確認與結算 UI 一致性」實作。`check-r2-game-ui.test.mjs` 由既有 self-contained 測試引入，沿用 `test:game-architecture` 與七項 CI matrix；各款的本機 Brave 流程驗證 computed style、值保留、開始／返回及保存，`--tablet` 另驗 820×1180。UI／CSS 仍由每個遊戲各自擁有。

使用 TypeScript、React functional components、既有模式。Hub 共用行為放 `packages/ui`；遊戲專屬 runtime、規則、i18n 與樣式留在各遊戲。優先 CSS variables/theme tokens，禁止硬編碼顏色。2 spaces；components／classes／types 使用 PascalCase，變數與參數使用 camelCase。命名 gate 要求具名 `function` 宣告使用 PascalCase；`use*`、`onRequest*` 與 Next.js framework functions 依 `scripts/check-identifier-names.mjs` 例外處理，函式值可使用 camelCase 或 PascalCase；檔名明確對應功能。

## 共享邏輯優先

Hub 的共用邏輯、UI、樣式、auth、settings、routing helper、footer/navbar 放 `packages/ui/src` 或共用 helper；Hub app 組合共用元件，不分叉版本。

遊戲隔離的目標是：**每個遊戲擁有完整設定、教學、game loop、renderer、i18n 與成績 UI，不引入 `packages/ui` 或任何跨遊戲共用元件**。正式 registry 登記的 48 款遊戲（畫畫塔防等 10 款、21 款腦力練習、16 款點擊與鍵盤遊戲與 UFOV）達到 R2 自包含格式；最後 2 個舊遊戲（舌頭動作訓練、有球必應）在正式站仍使用共用 shell，工作樹中的 R2 `2.0.0` 候選登記後即為 50 款，全部官方遊戲都不再使用共用 shell。

| 流程 | 設定／結果 UI | Hub 入庫方式 |
| --- | --- | --- |
| 未遷移官方遊戲 | 遊戲提供 `settings.json`／`score.json`；Hub 使用 `GameSettingsForm`／`TrainingScore`，獨立入口沿用 `OfficialGameShell` | `/api/records` → `training_records` |
| R2 官方遊戲 | 遊戲自己呈現，不建立兩份 JSON；Hub 使用 `R2GameOverlay` | `/api/official-game-sessions` 簽署 token，再經 `/api/records` → `training_records` |
| 開發者上傳遊戲 | `PackageGameOverlay`／runner launcher 使用上傳契約與版本化 bridge，維持第三方既有設定／成績格式 | `/api/game-run-sessions` 建立一次性 token，再經 `/api/game-runs` → `game_runs` |

R2 官方遊戲的 `rehab-trainer.game-score/v1` 為數值傳輸／入庫格式，並非 UI 描述檔；以 `docs/r2-game-migration-plan.md` 為準。Hub 僅提供 container、身份隔離、私有通訊、保存與 exit。禁止將已遷移遊戲 bundle 或共用 UI 依賴重新加入 Hub 依賴樹／output。

`officialGameReleases.json` 只登記遊戲名稱、可信 origin 與遷移資格，不包含 current version。Hub 在 iframe 載入前請求 `/api/official-game-sessions`，由後端讀取 R2 官方 current／雜湊歷史與 approved manifest，回傳固定的 version、contentSha256、recordId 與 token。保存重試沿用該工作階段；current 切換不影響仍核准的舊版，撤回或雜湊不符時拒絕保存，R2 故障回覆 503。相容舊 Hub 可指定官方歷史版本；第三方上傳不得使用已登記的官方 slug，已提交的歷史投稿亦不得透過第三方審核 API 發布或撤回官方 slug。穩定 PWA 入口 `/games/{gameId}/` 以不可快取 302 選擇 current，已安裝的版本化 PWA 仍固定原版本。

R2 遊戲與 Hub 分屬不同 origin。成果僅走交給指定 iframe window 的私有 MessageChannel；遊戲核對 init 的 parent source／origin，Hub 核對 nonce、game/version、sequence 與成果 schema，不接受一般 window message 的成果。獨立 PWA 只在新格式 release 明確宣告 fullscreen capability 時委派全螢幕，仍保持 `sandbox="allow-scripts"`。

**設定值保存在本裝置（2026-10-17）：** 每款 R2 遊戲開啟時使用本裝置上次確認的設定，沒有或無效才用預設值。遊戲是不透明 origin、不能用 `localStorage`，也不得因此放寬沙盒；宣告 `settings-storage` 的官方版本由容器（Hub 或 runner 獨立 PWA 啟動頁）以 `trainerhub.game-settings/v1:<gameId>` 存在自己的 `localStorage`，經私有 port 的 `init.settings` 交回，遊戲確認設定後送 `settings` 訊息（與成果 config 相同限制）。遊戲以自身驗證還原。第三方投稿遊戲由 Hub 記住 `GameSettingsForm` 上次送出的值（`trainerhub.package-settings/v1:<slug>`，以該遊戲 `settings.json` 重新驗證）；未遷移官方遊戲不改動。不開放通用鍵值儲存。細節見 `docs/r2-game-migration-plan.md` 第 5 節。

**成果檔案下載（2026-10-23）：** 擁有者回答「UFOV做法跟眼動練習的眼動資料下載一樣」。僅可信官方 `ufov` 可宣告 `result-files`：遊戲送出成果前經私有 port 以 `result-file` 交給容器最多三個固定檔名的 CSV／JSON，容器依 `packages/ui/src/resultFiles.js` 檢查固定欄位、只含數字或固定字詞、無身份欄位、≤4 MiB；成果送出後只接受 `result-file-download`，由 Hub 或獨立 PWA 啟動頁以 Blob 下載。iframe 不加 `allow-downloads`，檔案不上傳、不進 D1／R2，關閉或回到設定即丟棄。細節見 `docs/r2-game-migration-plan.md` 第 5 節。

Hub 禁止複製／分叉遊戲的 defaults、validation、rules 或 runtime。現行未遷移流程依 catalog 的 `settingsPath` 讀取遊戲擁有的 JSON，交由統一 `GameSettingsForm` 呈現；沒有另載入 trainer-owned config entry。R2 遊戲的設定／結果都留在 iframe，Hub 不解讀 UI 描述檔。Pixi、jsPsych、Three、MediaPipe、TensorFlow runtime／lifecycle 均屬各遊戲。

**舊流程返回設定的原因（2026-10-23）：** 未遷移遊戲的共用相機／麥克風檢查（`useMediaPermissionPreflight`）失敗時，`rehab-trainer:training-configure`（獨立入口為 `rehab-trainer:standalone-configure` 事件）只帶固定清單中的 `reason`：`camera-denied`、`camera-unavailable`、`camera-unsupported` 與對應的 `microphone-*`；同時要求兩種裝置時不帶原因。Hub overlay 與獨立入口的 `GameSettingsForm` 以自己的文案顯示原因（`role="alert"`），不顯示遊戲送來的文字，清單外的值一律丟棄。2026-09-09 設定改由 Hub 表單呈現後原因沒有顯示，這次補上；遊戲本身沒有改動。本機 `check-browser-route-smoke.mjs --fakeMedia deny` 用假相機加拒絕權限重現。

**舊遊戲頁面的主題與安裝按鈕（2026-10-23）：** 2026-09-08 拆出各遊戲入口後，原本共用 runtime 啟動時呼叫的 `ApplyThemeTokens()` 沒有跟著搬，兩款舊遊戲（獨立入口與 Hub iframe 內）都變成瀏覽器預設字型與黑白樣式。現在由兩款已使用的 `OfficialGameShell` 套用 trainer 主題（舌頭動作訓練傳入原本的口腔類別色），`GameSettings.css`（只在這兩款頁面載入）把設定表單使用的 Hub token 名稱對應到 trainer 主題，表單內的次要文字改用 `--text-secondary` 以達 4.5:1；遊戲沒有新增依賴。`scripts/emit-official-game-pwas.mjs` 的安裝按鈕改為只在設定畫面、以設定表單上方獨立一列顯示，不再浮在標題或遊戲畫面上，文字依遊戲設定的 `<html lang>` 切換中英文。設定畫面時 `#root` 改用表單高度，整頁只有一個捲動區。表單標題改由 `OfficialGameShell` 的 `titleKey` 從遊戲自己的語系檔取遊戲名稱（與目錄名稱一致），英文頁面不再顯示中文分頁標題。這兩款頁面沒有載入圖示字型（須能離線使用），`GameSettings.css` 隱藏表單內的裝飾圖示，「開始訓練」按鈕不再多出「play_arrow」字樣。

**已核准的手部輸入例外（2026-10-09）：** 使用者接受「輸入代理，維持嚴格沙盒」。宣告 `hand-tracking` 的可信官方版本，由 Hub 或 runner 的獨立 PWA 容器經明確同意取得相機、執行固定版本 MediaPipe；模型／WASM 由 runner 的 `/input/hand-tracking-1.0.0/` 提供，瀏覽器不讀 CDN。遊戲保持 `sandbox="allow-scripts"`、相機禁止與原 package CSP，只經私有 MessageChannel 收到經 nonce／sequence 驗證的 21 點 xyz 或空手部訊息，不傳影像／身份資料，不上傳影像。校正、手勢判定、玩法與成績仍由遊戲擁有。此例外不開放第三方任意模型、相機權限或沙盒放寬；結算、退出、撤回與取消啟動皆停止相機、模型及排程。

**已核准的眼動輸入例外（2026-10-10）：** 使用者於本對話回答「核准眼動輸入代理方案」。僅可信官方 `oculomotor-training` release 可宣告 `eye-tracking`；Hub／獨立 PWA 經明確同意後，在固定第一方 `/input/eye-tracking-1.0.0/` 文件執行原固定摘要 WebGazer 與模型。遊戲保持嚴格沙盒、camera 禁止、`connect-src 'none'`，只以私有通道交換有範圍／nonce／sequence 驗證的數值座標、臉部就緒旗標與校正點；影像與身份不進入遊戲。相機／模型／排程於完成、取消、停止、斷線及撤回清理。CSV 經 Hub 用原工作階段／身份寫入私人 bucket，成功後才保存摘要，獨立 PWA 提供本機成果與 CSV 下載。例外不授權第三方相機、不放寬 package CSP，精確版本發布仍須另核准；見 `docs/oculomotor-r2-migration.md`。

**已核准的姿勢／麥克風／舌頭輸入例外（2026-10-23）：** 使用者於本對話回答「核准三種代理（建議）」與「容器在遊戲後方顯示（建議）」。只有可信官方 `every-ball-response` 可宣告 `pose-tracking` 與 `microphone-level`，只有 `tongue-catch` 可宣告 `tongue-tracking`；Hub／獨立 PWA 經明確同意後，執行 runner 版本化 `/input/pose-tracking-1.0.0/`、`/input/microphone-1.0.0/`、`/input/tongue-tracking-1.0.0/` 的固定摘要模型與程式。遊戲保持嚴格沙盒、camera 與 microphone 禁止、`connect-src 'none'`，只經私有通道收到經 nonce／sequence 驗證的數值：雙手 21 點與髖膝 4 點、音量與高低頻比例、嘴部位置與舌頭方向／信心值；影像、聲音、校正樣本與身份不進入遊戲。相機畫面由容器顯示在透明遊戲 iframe 後方的指定區域，遊戲只送正規化位置；需要相機畫面的全螢幕由容器對自己的外框執行。結算、退出、撤回、取消與斷線都停止裝置、模型與排程。例外不授權第三方相機或麥克風、不放寬 package CSP，精確版本發布仍須另核准。有球必應與舌頭動作訓練的 `2.0.0` 候選依此例外實作，見兩份遷移紀錄。

**已核准的頭部轉動輸入例外（2026-10-24）：** 使用者於本對話回答「Approve head proxy (Recommended)」。只有可信官方 `seagull-flight` 可宣告 `head-tracking`；Hub／獨立 PWA 經明確同意後，執行 runner 版本化 `/input/head-tracking-1.0.0/` 的固定摘要 MediaPipe 臉部模型（與舌頭代理同一份 `face_landmarker.task`，不含 TensorFlow）。代理在裝置上把臉部轉換矩陣換算成角度，遊戲只經私有通道收到經 nonce／sequence 驗證的 `yaw`／`pitch`／`roll`（度，四捨五入到 0.01）與是否找到臉；臉部點位、影像與身份不進入遊戲，代理不保存校正樣本（此遊戲的 `input-capture` 一律拒絕）。遊戲保持 `sandbox="allow-scripts"`、camera 與 microphone 禁止、`connect-src 'none'`；相機畫面同樣由容器顯示在透明遊戲 iframe 後方，全螢幕由容器執行。鍵盤操作保留為不開相機的替代方式。結算、退出、撤回、取消與斷線都停止相機、模型與排程。例外不授權第三方相機、不放寬 package CSP，精確版本發布仍須另核准；見 `docs/seagull-flight-r2.md`。

手勢指令對戰 `2.0.0` 已核准精確版本／摘要、發布 R2，完成 runner 先部署／Hub 切換、七項 CI／兩站部署與正式 API／桌機／手機／英文指定模式／獨立 PWA 驗收，見 `docs/gesture-battler-r2-migration.md` 與 `docs/releases/gesture-battler-2.0.0.json`。目前六款完成／34 款舊流程，Hub 排除六款 R2 bundle。MediaPipe 實際模型／WASM 與校正／對戰已測，感測來源使用已核對圖片形成的串流；尚未驗收實體相機、真人數字 1–5 或 Safari／iOS，不把錄製影像當成硬體驗收。`test:game-architecture` 增加手勢聚光燈與自包含遷移測試；`test:gamerunner` 覆蓋代理取消、初始化競態、拒絕／斷線、私有輸入與官方 launcher 安全邊界。兩份 workflow 沿用既有七項 matrix 與相同命令；手勢 Brave 完整流程採 `node scripts/check-r2-game-browser.mjs --game gesture-battler --lobby`，另驗證手機、英文、登入、session 失敗、撤回與獨立 PWA，不加入 Linux CI。

### 訓練 Overlay 流程

未遷移官方遊戲的 `score.json`（`rehab-trainer.game-score/v1`）宣告逐回合數值欄位與總計欄位。`JsonTrainingOverlay` 驗證同源 origin／source、sessionNonce、完成 sequence 及分數 schema 後，卸載 iframe 並以共用 `training-overlay-score` 顯示結果。R2 官方遊戲則由 `R2GameOverlay` 保留 iframe，透過私有 port 接收成果、回覆保存成功或失敗；完整結果與重試 UI 由遊戲呈現。

官方遊戲成果經 Hub `/api/records` 寫入 D1；訪客使用 guest Subject ID，登入紀錄使用另一套帳號範圍 Subject ID 並附帳號。訪客紀錄不顯示於登入帳號的進度追蹤，遊戲嵌入 Hub 時不得自行重複寫入紀錄。`docs/game-score-contract.md` 的 JSON／Hub 結果 UI 契約適用未遷移遊戲；R2 新增／遷移遊戲不建立這兩份 JSON。舊格式契約由 `test:embedded-training` 驗證，R2 自包含契約由 `test:game-architecture` 驗證，後端沿用 `test:hub-functions`。

Hub 大廳透過 `app/gameCatalog.ts` 合併 `games/catalog.ts` 與已核准發布版本；統一卡片、分類、搜尋與 `GameOverlay` 啟動入口。既有 catalog slug 保留自己的啟動契約，歷史投稿不能覆蓋已遷移的 R2 入口；畫畫塔防、小行星護盾防衛、手勢指令對戰、手部目標追蹤練習、移動卡片訓練、眼動練習、蓋伯斑塊練習、閱讀訓練、哈特圖、駕駛注意力模擬練習、21 款腦力練習、16 款點擊與鍵盤遊戲與 UFOV 由工作階段 API 選擇核准 current。2 個未遷移遊戲保持既有 runtime 與產物；內部依版本契約轉接既有 overlay，尚未完成儲存／成果契約整併。設定與 runtime 的來源維持由遊戲擁有。

R2 自包含遊戲以 `public/game.json` 宣告版本化目錄文案、作者、分類與套件內的預覽圖；Vite 複製到 dist，Publisher 驗證後與預覽圖一起納入逐檔 SHA-256 清單。公開 `/api/games` 只讀可信官方 current 的核准 manifest 與雜湊相符的宣告，回傳該版本的 R2 圖片 URL；Hub 的卡片與篩選採用它，啟動仍走固定版本 session。舊 `2.0.2` 尚無此宣告時，使用同一遊戲 source 宣告與由其預覽圖產生的 Hub 相容資產；不使用歷史 `1.0.0` 的標籤或 shell。新增宣告／圖片須使用新版本，不覆寫已發布檔案。

後續每個 R2 遷移依 `docs/r2-game-migration-plan.md` 第 7 節執行並完成第 11 節審查單：先記錄原分類／原圖 SHA-256／既有功能，新增該 gameId 的歷史 slug 碰撞及大廳點擊完整流程測試；正式 sandbox／CSP 下驗證自有設定、教學、引擎、結果、保存重試與獨立 PWA。畫畫塔防專用測試不代表其他遊戲已覆蓋。官方 CLI 會直接公開並切換 current，必須先完成驗證及當版精確 version／contentSha256 的擁有者核准；首次遷移備妥核准 R2 release 後才切換正式 Hub registry。發布後直接核對正式 API 分類／圖片與真實 Hub／runner 瀏覽器流程，正式收據完成才標記遷移完成。

啟動流程：

- Hub 點「開始訓練」：未遷移遊戲先顯示 JSON 設定 overlay；R2 遊戲開啟包含其自有設定的 iframe overlay。背景不切換、不導向 trainer 網站。
- 遊戲 runtime 由 Hub overlay 或單一遊戲 PWA 載入，不建立獨立 trainer 網站。
- 可保留 query/hash deep link；開 config 不得卸載背景頁。
- 開始後由原 trainer runtime 接管 renderer、canvas、input、fullscreen lifecycle。
- 結果頁依來源只顯示一個按鈕：Hub 顯示「返回大廳」並關閉 Hub overlay；單一遊戲 PWA 顯示返回入口。禁止同時顯示兩者。
- 未遷移遊戲以 `embeddedTraining` 的 window message 同步 active／complete／exit，驗證同源 origin 與 window source；R2 遊戲依前述私有 MessageChannel 契約同步。

只有 Hub 是主平台 PWA。未遷移遊戲在 Hub origin 的 `/games/{gameId}/` 提供獨立 manifest／Service Worker；R2 遊戲在 runner origin 的 `/games/{gameId}/{version}/` 提供版本化 PWA，Hub 的 `/games/{gameId}/` 只留下導向連結。四個舊 trainer app 已移除，不存在 `training-modules/`、`training-runtimes/` 或 `/runtimes/*`；四個退役 hostname 已完全移除，沒有 Worker route 或 301 設定。

Hub 使用 Next.js App Router（`apps/rehabtrainerhub/app/`）、`app/globals.css` 及 `packages/ui` 的共用 components／stylesheet；不再使用舊 trainer 的 `pages/settings/`、`pages/links/` 結構。`TrainerApp.css` 目前也仍供未遷移遊戲的 `OfficialGameShell` 使用，此依賴須在遷移時移除。R2 遊戲只引用自身樣式；renderer、教學與規則樣式均留在各遊戲，禁止引入平台共用 CSS。

### 遊戲平台與沙盒執行規範

本平台提供開放開發者上傳 HTML/ZIP 居家練習遊戲的 Steam 式體驗，必須嚴格遵守以下六層安全防護架構。未遷移的同源官方遊戲與 R2／第三方隔離遊戲使用不同載入流程，不可套用錯誤的通訊或 sandbox 契約。

1. **物理隔離（Separate Domain）**：
   - 主平台（`trainerhub.cc`，處理登入、個人紀錄、資料庫）與遊戲執行器（`trainerhubgames.rainbowh9490.workers.dev`，提供 R2 資產、runtime 與 PWA launcher）必須完全分開。
   - `usergamerunner` Cloudflare Pages 專案**嚴禁綁定 D1、KV 認證或任何使用者私密資料**。目前只綁定 `rehab-game-releases`，Functions 僅接受 GET／HEAD 並呼叫 bucket.get；唯讀由程式與部署規範維持，`wrangler.toml` 並無獨立唯讀 binding 宣告，禁止新增 bucket 寫入能力。Worker `trainerhubgames`（`apps/usergamerunner/wrangler.workers.jsonc`）適用同一限制，由 `test:cloudflare-deploy` 檢查。

2. **沙盒機制（Strict Iframe Sandbox）**：
   - 主平台載入 R2 官方／第三方遊戲，以及 runner launcher 載入 package 時，一律使用 `<iframe sandbox="allow-scripts">`。
   - **絕對禁止**加上 `allow-same-origin`（防止突破同源隔離讀取憑證）或 `allow-top-navigation`（防止重導向至釣魚網站）。
   - `JsonTrainingOverlay` 載入未遷移同源官方遊戲時仍有 `allow-same-origin`、下載與舊流程權限；這是既有相容流程，不能複製到 R2／第三方 overlay。

3. **阻斷外連（Restrictive CSP）**：
   - package 回應的 CSP 以 `apps/usergamerunner/functions/[[path]].js` 的 `packageContentSecurityPolicy` 為單一來源；包含 `default-src 'none'`、`script-src 'self' 'unsafe-inline'`、`style-src 'self' 'unsafe-inline'`、`connect-src 'none'`、`worker-src 'none'`、`form-action 'none'`、`sandbox allow-scripts`，另限制 child/frame/object 與 WebRTC，不允許 `unsafe-eval`。
   - `frame-ancestors 'self' https://trainerhub.cc` 目前套在 launcher 文件，package 回應沒有這項指令；不可宣稱所有 package 檔案均具備相同 ancestor 限制。launcher 的 nonce、同源 release 檢查與 Service Worker 權限不能轉交給遊戲 iframe。
   - 禁止遊戲向任何外部伺服器發起 `fetch`、`XMLHttpRequest`、`WebSocket` 或 `WebRTC`。

4. **安全通訊橋樑（postMessage & MessageChannel）**：
   - 新投稿遊戲必須引用隔離執行站提供的版本化通訊橋樑，透過私有 `MessageChannel` 傳送生命週期與彙總成果；舊版 SDK URL 僅供已發布遊戲相容使用。
   - R2／第三方通訊均驗證 `sessionNonce` 與單調遞增 `sequence`。第三方成果使用 `game_run_sessions` 一次性 token（資料庫保留 SHA-256），經 `/api/game-runs` 保存；官方 R2 成果使用 24 小時 HMAC-SHA-256 簽署 token，綁定 game／version／recordId／帳號／Subject ID，經 `/api/records` 冪等保存。官方流程不建立 `game_run_sessions`。
   - 成果 schema 拒絕含 `auth|email|jwt|name|password|token|user` 等敏感欄位；只接受契約規定的設定與數值。這些是使用者端回報紀錄，token／簽章不代表伺服器已重算分數或提供防作弊保證。

5. **自動化掃描與人工審核門檻**：
   - 第三方上傳檢查（`functions/_lib/gamePackages.js`）：危險 API／HTML／CSS 規則以 `blockedSourcePatterns` 為準，包含 fetch、XHR、cookie、navigation、eval、Worker 等；同時檢查單行 5000 字元上限、逃脫字元密度、檔案大小／數量、ZIP 膨脹比與資源路徑，不固定宣稱為 18 種規則。
   - 新投稿經 `/api/game-submissions`（舊 `/api/developer/games` 保留相容）存入私有 R2，D1 同一 transaction 寫入版本審核雜湊及 Issue 工作。`workers/game-review-issues` 只綁 D1，以 GitHub App 建立每版本一張 repo Issue；詳細掃描、原始碼與帳號資料不放 Issue。
   - 第三方審核發布（`app/admin/GameReleaseManager.tsx` + `functions/api/admin/game-releases/[id].js`）：僅 `GAME_RELEASE_OWNER_USER_ID` 指定且具 admin 角色的擁有者能核准、退回或撤回。須綁定 Issue、核對審核雜湊與檔案清單，在無敏感憑證之隔離環境下載試玩，完成「原始碼查核、隔離試玩、公開描述確認」3 項勾選，才能發起具備 Lease 鎖定的 R2 搬遷與發布。Issue 標籤、勾選或關閉不代表核准；每個改版重新投稿及審核。官方遊戲 CLI 暫保留既有發布流程，尚未接入統一投稿 API；不能宣稱全平台已完成統一 Publisher。

6. **獨立 PWA 與生命週期**：
   - 每個遊戲發布版本均在 `/games/{gameId}/{version}/` 提供專屬 Manifest 與 Service Worker，快取僅限該遊戲路徑與平台 runtime。
   - 若遊戲被撤回（Revoked），執行器與 Service Worker 在偵測到 404/410 後自動自毀快取並關閉。


## 測試指引

手勢指令對戰 `2.0.2` 已依擁有者發布指示切換 R2 current：設定採畫畫塔防的遊戲自有前景視窗與分段卡片，教學直接使用實際對戰 HUD，手部預覽在左下。正式 API／桌機／手機／英文登入指定模式／獨立 PWA 與 2.0.1 回退檔案均驗證通過；見 `docs/gesture-battler-settings-ui.md` 與 `docs/releases/gesture-battler-2.0.2.json`。沿用既有 gate 與七項 CI matrix；相機仍使用圖片串流，不宣稱實體相機、真人手勢或 Safari／iOS 已驗收。

後續每款 R2 遊戲的成績頁須以移動卡片訓練的資訊層次為參考，提供主要統計、資料圖表與個別回合明細；統計、SVG 圖表、表格及樣式各自由遊戲擁有，不引入共用 UI，依 `docs/r2-game-migration-plan.md` 第 7 節步驟 B／D 與第 11 節驗收。`scripts/check-r2-game-results.test.mjs` 由既有 `check-self-contained-game.test.mjs` 引入，納入原 `test:game-architecture`，驗證雙語、缺漏／零值、樣本標準差、圖表／明細共同分頁與切換指標重設頁次；兩份 workflow 保持既有七項 matrix／相同命令。三款的 `check-r2-game-browser.mjs` 流程另驗證真正沙盒中的主要統計、圖表切換、手機表格與保存重試；正式截圖保留在 `docs/migrations/r2-game-results-ui/production/`。新版已核准、發布並完成正式 API／Hub／獨立 PWA 驗收，精確摘要、測試先失敗原因及通過結果見 `docs/r2-game-results-ui.md` 與三份正式收據；手勢使用圖片串流，不宣稱真人／實體相機／Safari 或 iOS 已驗收。

小行星護盾 R2 候選另以 `--lobby --english` 驗證私有 init 的英文設定／教學／成果／保存，`--lobby --signed-in --sound-on` 驗證原生 WebAudio 開關與帳號保存。browser 讀 Hub output 時如需並行 build，先用固定輸出副本及 `HUB_OUTPUT_ROOT`；不得一邊重建同一 output 一邊把檔案消失誤判為產品失敗。

UI、auth、routing、共用 package 變更：build Hub、執行 `npm run test:entrypoints`，並以 `npm run test:game-architecture` 檢查全部遊戲 TypeScript；不再對不存在的四個 trainer runtime 執行檢查。Cloudflare Function 變更：對修改檔執行 `node --check`，並執行對應 `test:hub-functions`／`test:gamerunner`。

本機瀏覽器 smoke 使用 Brave；遊戲平台架構或統一 config UI 變更後執行 `npm run test:game-architecture:browser`。此項是本機 Brave 整合測試，不加入缺少 Brave 的 Linux CI matrix。

手部目標追蹤 `2.0.0` 使用 `node scripts/check-r2-game-browser.mjs --game motor-cortex-rehab --lobby`，另驗 `--mobile`、`--session-failure --random`、`--signed-in --english --vertical`、`--signed-in --english --right`、`--camera-disconnect`、`--revoke` 與 `--revoke-playing`；獨立 PWA 使用 `--standalone --mobile --horizontal`、`--standalone --tablet --left`。實際 45 秒 game loop、MediaPipe、原生全螢幕、圖表與保存重試均由專屬 fixture 驗證，只寫本機 SQLite。影像使用已核對圖片串流（左手用水平翻轉），不代表真人／實體相機或 Safari／iOS 驗收。可用 `HUB_OUTPUT_ROOT` 與 `RUNNER_OUTPUT_ROOT` 指向固定輸出副本，避免同步程式改名／重建生成檔干擾測試。核准發布後已完成 `--remote --lobby`；最終部署後正式 `--production-hub --lobby` 桌機／手機／英文登入右手與 `--remote --standalone` 手機水平／平板左手、直接正式 API／圖片均通過。最新三款 source UI 仍含尚未發布的確認／結果 class；正式手勢 2.0.2 相容回歸採發布 commit `712321d` 的原 fixture／結果 helper，詳細版本差異與正式證據見 motor 遷移收據。

## 台灣醫療與職能治療法規文案

本站定位為一般居家練習工具與衛教資訊，不是醫療機構、職能治療所、遠距醫療或個別化職能治療服務。品牌固定為「居家訓練網」，SEO 描述定位為「居家訓練工具與衛教資訊」；不得把專業資格與「復健平台／治療服務／療效」組合成廣告標題或行動呼籲。

- 對外文案優先使用「練習」、「活動」、「當次紀錄」、「刺激參數」與「換算參考值」。不得宣稱診斷、醫囑、處方、個別評估、治療、預防疾病、恢復或改善人體功能、保證療效、臨床級／醫療級，亦不得無證據宣稱特定疾病或族群適用。
- 疾病、復健與治療用語只可出現在中立衛教、正式文獻題名、客觀專業經歷或清楚的非服務聲明中，不得與招徠使用、成效保證、見證或前後比較結合。免責聲明不能補救其他頁面的醫療效能宣稱。
- 專業背景只能陳述已查核事實。目前可使用「蔡泓恩｜職能治療師」及「經職能治療師考試及格並領有職能治療師證書」；未確認有效執業登記前不得使用「執業職能治療師」。學歷、在學狀態及經歷需附最後確認日期，過期時更新或刪除。
- 專業資格放在作者署名、作者背景或內容責任區，不把資格包裝成產品療效背書。沒有實際逐篇審閱紀錄時，不得加入 `reviewedBy`、治療師審閱或類似宣稱；未驗證作者資格時使用中性署名，例如「居家訓練網編輯」。
- 不得公開 104 履歷網址、分享碼、完整證號、地址、電話、年齡或其他非必要個資。除非使用者日後明確撤回此限制，結構化資料的 `sameAs` 也不得加入 104。
- 視標工具雖參考 Freiburg Vision Test（FrACT），只能說明參考其公開演算法、視標呈現、校正資料與文獻；不得推論本站已取得 FrACT 的同等效度、醫療器材認證或臨床用途。logMAR、Snellen、logCS 等輸出必須標示為刺激參數換算參考值，並明示不代表視力、對比敏感度、診斷或療效。
- 若新增或改變疾病風險判定、個別建議、臨床量測、真人諮詢、遠距服務、醫療用途或改善人體功能的 intended use，停止發布並先取得台灣醫療／醫材法規專業意見；不能只靠改文案或加免責聲明放行。

法規初審以法務部全國法規資料庫的[職能治療師法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0020039)、[職能治療師法施行細則](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0020040)、[醫療法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0020021)、[醫療器材管理法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0030106)及食藥署[醫用軟體分類分級參考指引](https://www.fda.gov.tw/TC/siteListContent.aspx?id=41637&sid=11652)最新版本為準。每次修改上述用途或宣稱前重新查核，不依賴倉庫內的舊摘要；程式碼審查只能做保守風險檢視，不得向使用者保證主管機關一定認定合法。

## SEO 與 E-E-A-T 維護

- 品牌與 SEO 單一來源：`apps/rehabtrainerhub/app/hubBrand.ts` 管理 Hub 名稱與首頁 SEO 標題，`app/seo.ts` 管理 description 與 JSON-LD，canonical domain 使用共用 `siteUrls`。不要在頁面、manifest 或檢查腳本另造不一致字串。
- Hub 首頁 production HTML 必須以繁體中文預渲染，`<html lang>`、title、可見 H1、首段、description、Open Graph、Twitter、manifest 與 JSON-LD 的品牌及用途需一致。瀏覽器語言偵測不得讓靜態輸出變成英文；共享語言 helper 的 SSR 修正不得造成 trainers 的既有語言體驗退化。
- 可索引頁必須有正確 canonical、index/follow、自然且唯一的 title/H1 與實質內容。新增、刪除或改名 route 時同步更新 `app/sitemap.ts`、`app/robots.ts` 與 `scripts/check-seo-output.mjs`；管理、帳號、進度及訓練流程頁維持既有 noindex 規則。
- 每個 domain 的 sitemap 只列該正式 origin 下可索引的絕對 canonical URL；`lastmod` 只在主要內容、結構化資料或連結確實有重大更新時填寫，不得為了看似新鮮而改日期。部署後檢查 sitemap 與 robots 為 200、XML／文字內容正確且不是 HTML 錯誤頁，再提交到相符的 Search Console property。
- 不做關鍵字堆砌、隱藏文字、重複／薄內容頁或無法由可見內容支持的 schema。`meta keywords` 不是主要排名手段；目標詞應自然出現在 title、H1、首段與相關站內連結錨文字。
- 衛教文章只在作者個人網站撰寫，Hub 不自建文章、不複製全文。`/qa` 由 `apps/rehabtrainerhub/app/qa/educationFeed.ts` 讀 `https://ian.trainerhub.cc/rss.xml`，只列中風／視覺／動作／認知復健分類的站外連結（https 且限個人網站 host），build 時預渲染、瀏覽器再更新；D1 `education_articles` 與 `ARTICLE_CACHE` 保留舊資料但不再讀寫。
- E-E-A-T 只標示可驗證事實。文章顯示真實作者、發布日期、最近更新日期與可查核來源；作者名稱連至站內作者背景。Person、Organization、WebSite、WebApplication schema 的姓名、資格、學歷、creator／founder 關係必須與可見頁面一致，不填推測欄位或敏感個資。
- E-E-A-T 不是可直接保證排名的單一分數。內容先服務讀者並回答實際問題，不為搜尋流量大量產生相似頁面、重寫他站內容或虛構新鮮度；AI 協助內容需保留人工查核、發布責任與適當揭露。
- 醫療、健康、科學與軟體效度敘述優先引用官方文件、原始研究或同儕審查論文。FrACT 相關內容引用[官方網站／手冊](https://michaelbach.de/fract/)、實際採用的版本與對應研究，並同時揭露校正需求及本站未經等效驗證。
- `ProfilePage` 只用於主要內容確實聚焦單一作者的專頁，不得套在混合問答／文章列表頁；所有 structured data 皆須代表頁面可見內容並以 Rich Results Test 驗證。
- 不得重新加入 `motor.trainerhub.cc`、`vision.trainerhub.cc`、`brain.trainerhub.cc`、`mouth.trainerhub.cc` 的公開連結、canonical、sitemap、auth origin、DNS 記錄或 Worker route；這些退役 hostname 已於 2026-10-19 完全移除。
- SEO 或 E-E-A-T 變更至少執行 Hub build 與 `npm run test:seo`；修改 manifest 再執行 `npm run test:pwa`，修改共用 UI、語言初始化或 entrypoint 再執行 `npm run test:entrypoints`。最後直接檢查 `apps/rehabtrainerhub/out/index.html` 的 title、H1、description、canonical、robots、JSON-LD、繁體中文可見內容及不得出現的 104 URL。

SEO 判斷以 Google Search Central 的[以使用者為優先的實用內容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)、[Sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[結構化資料指南](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)及[ProfilePage 指南](https://developers.google.com/search/docs/appearance/structured-data/profile-page)最新版本為準；規範變更時更新實作與檢查腳本，不以舊 SEO 慣例覆蓋官方說明。

## Commit 與 Pull Request 指引

短 Conventional Commit、聚焦、命令式；常用 `feat:`、`chore:`，例如 `feat: change auth ui`、`chore: unify setting`。PR 包含摘要、受影響 apps/packages、驗證指令、視覺截圖、migration/environment variable 註記。

**分支政策（2026-10-18 起）：** 只在 `main` 上進行。commit 後直接 push 到 `main`，不再開新的功能分支或 PR；Dependabot 等自動 PR 由擁有者另外決定。以前的專用分支 `feat/driving-rehab-r2`、`feat/hart-chart-r2`、`feat/reading-training-r2`、`feat/redesign-lobby-guide-sections`、`fix/oculomotor-2.1.1` 已全部併入 `main`（`ec740bf2`），留作歷史紀錄，不刪除、不再推送。本文件與 `docs/releases/*.json` 中提到的專用分支、「避免 `main` 完整部署」等，都是當時的交付紀錄。

`main` push 會依 `deploy-cloudflare-pages.yml` 驗證並部署（預設部署 Workers，只有 repo variable `CLOUDFLARE_DEPLOY_TARGET=pages` 才走 Pages；純文件變更不觸發）。只改已遷移 R2 遊戲內容／版本時，`deployment_scope` 會跳過部署，可以先 push 再依核准發布；把新遊戲登記進 `packages/ui/src/officialGameReleases.json` 時，Hub 會改走 R2 入口並移除舊 bundle，必須先取得精確 version／contentSha256 核准並完成 R2 發布、current 切換，再 push。需要相容 runner 先部署的變更，依序先 push 平台變更並確認部署，再發布遊戲。

## 安全與設定提示

禁止 frontend secrets。Auth/session secret、OAuth credentials 留在部署環境變數。密碼/session 邏輯放 Cloudflare Functions，不放 client-only code。新 D1 migrations 先部署套用，再依賴 production 功能。
