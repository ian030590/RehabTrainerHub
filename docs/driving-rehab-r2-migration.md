# 駕駛注意力模擬練習 R2 搬遷驗收

2026-10-18，依[搬遷計畫第 7 節 A–F](r2-game-migration-plan.md)完成搬遷。擁有者在收到精確候選後明確回覆「核准並git push」，核准 `driving-rehab@2.0.0`／`a0b5dda08b2d1c4a48830619dedcf8fa360a83ea3e7da24a60ab1ad69b5dd863`。已按相容 runner → R2 發布及 current → Hub 切換的順序完成，並通過正式 API、八檔 bytes 與九項 Hub／PWA 瀏覽器驗收；正式現為九款 R2／31 款舊流程。程式推送至 `feat/driving-rehab-r2`，沒有提前以 main 自動部署候選 registry。見[正式收據](releases/driving-rehab-2.0.0.json)。

| 項目 | 值 |
| --- | --- |
| gameId／版本 | `driving-rehab@2.0.0` |
| contentSha256 | `a0b5dda08b2d1c4a48830619dedcf8fa360a83ea3e7da24a60ab1ad69b5dd863` |
| 套件 | 8 檔、10,045,727 bytes；[逐檔候選](migrations/driving-rehab/candidate.json) |
| 原碼基準 | `de8d01d7c32953df4f0b057c377633193b80386e` |
| 原契約 | [legacy fixture](../scripts/fixtures/driving-rehab-legacy.json) 保存舊 settings／score 與原資產、核心模組 SHA-256 |
| 公開資訊 | 原中英名稱／說明、`vision/vision` 分類、作者「居家訓練網」、原預覽圖 bytes |

## 保留的玩法與成果

- 四項設定及預設值不變：難度 easy／medium／hard（預設 medium），畫質 high／medium／low（high），控制 arrow／wasd／wheel／touch（arrow），危險紅光提示（true）。設定選項由遊戲自己的原生 radio／checkbox 呈現；容器經私有 port 保存確認值，重新開啟時驗證後還原。
- 保留原 Three.js／jsPsych、路線、80 秒時限、固定步進、DPR／視角／後照鏡、逆行車隨機車種與顏色、車道偏離、交通規則、原模型與地圖。難度仍對應 beginner／intermediate／advanced；沒有縮短正式玩法來驗收。
- 事件從第一次呈現跨車道開始計時，第一次新的煞車或左右轉向才算反應；持續按住不算新反應。完整通過且未碰撞逆行車才算成功，高級另計其他車輛碰撞。未反應 RT 與未完成事件結果保持 null。
- 原 10 個 summary 欄位：`durationMs/meanRt/medianRt/events/responses/collisions/deviations/fps/avoided/rounds`；每回合仍為 `rt/avoided/responded/collision/distance/otherCollision`。送往 Hub 的都是原數值欄位，不包含帳號、Subject ID、方向盤 ID 或校正原始資料。
- 自有成績頁保留所有主要數值及路線／完成狀態／實測更新率；提供可切換圖表、平均線、有效筆數、中位數、樣本標準差、範圍、完整率及同步 50 筆分頁。原始 RT、幀數、預先煞車與回應文字仍在本機明細顯示；實測更新率無效時不顯示推測幀數。保存失敗可重試，返回入口依 Hub／PWA 區分。

## 像畫畫塔防的聚光燈

設定是置中的前景 dialog，背後先呈現道路、逆行車、自車、控制與狀態的示意場景；設定開啟時不計時、不計分、不啟動導覽。

確認後依序聚焦：**逆行車跨越車道 → 所選的控制方式 → 閃避與成果判定**。亮區、外框及說明框跟隨目標與 resize；說明依可用空間定位，短視窗內可捲動並保持目標可見。支援下一步、略過、返回設定、Escape 及 Tab 焦點循環。返回設定保留值並清除導覽；教學結束後顯示最終參數，最後一次開始點擊才請求全螢幕並啟動真正玩法。

設定、確認、成績均使用既有 R2 視覺／DOM 契約，但 JSX、CSS、i18n、tour、音訊、結果與 bridge 都由駕駛 workspace 持有，無共用 UI 或跨遊戲 import。

## 隔離與資源處理

- 移除 `@rehab-trainer/ui`、OfficialGameShell、Router、Hub storage、兩份 JSON 及未被 UI 呼叫的舊 CSV 匯出函式；沒有開放沙盒下載。
- 原 GLB 6,062,428 bytes 以 `vehicle-data.js` classic script 提供 base64，主程式用 `GLTFLoader.parse` 讀取相同 bytes。資料 script 8,083,274 bytes，小於既有單檔 8 MiB；總量小於 24 MiB。主 IIFE 約 1.73 MB；沒有放寬限制或壓縮替換模型。
- GLB 的 14 張內嵌 PNG 使用遊戲自有 `TextureLoader` 圖片元素載入，避免 Three.js 預設 ImageBitmapLoader 的 blob fetch 違反 `connect-src 'none'`。原地圖靜態 import；無 CDN、runtime fetch 或 module script。
- 保持 `sandbox="allow-scripts"`、opaque origin、camera 禁止、`connect-src 'none'`／`worker-src 'none'`。Hub 與 standalone launcher 僅在核准套件宣告 `gamepad` capability 時傳遞 `gamepad *`；其他遊戲的 allow 值不變。沒有加入 `allow-same-origin` 或平台寫入權限。
- 鍵盤必須先收到可信按鍵；觸控需有真實 touch capability；方向盤維持原支援裝置辨識、五階段校正及相容性驗證，未偵測／未校正不能開始，斷線暫停時計與輸入。校正只保留在本次遊戲文件記憶體，重開需重新校正；不保存硬體識別。隨機路線防止立即重複的狀態也只留本次文件。
- 載入失敗返回可見設定視窗並顯示錯誤；停止、Escape、pagehide、卸載與撤回清理 runtime／音訊／全螢幕，不產生成果。啟動中的更新率測量可立即 abort；晚到的載入不得重啟遊戲。
- 提示音沿用原頻率與順序，改為遊戲自有 Tone 15.1.22；保留規範要求的 MIDI 介面，預設背景歌曲為空。

## TDD 與本機驗證

| RED | GREEN |
| --- | --- |
| 缺少自有 settings／score／tour；仍引用 Hub UI | 新遷移與聚光燈測試通過，原 26 項核心行為測試保留 |
| gamepad 未傳入兩種容器 | capability 專屬 allow 測試、原生瀏覽器 permission 查核及模擬方向盤流程通過 |
| 原模型與主程式合併超過 8 MiB，dry-run 拒絕 | 分離 classic 資料 script，逐 bytes 還原與先後順序測試通過，8 檔 dry-run 通過 |
| 啟動取消未傳 AbortSignal | 取消測量／不重啟場景行為測試通過 |
| 預設模型貼圖使用 fetch loader | TextureLoader 選擇測試通過，Brave 會將貼圖／模型載入警告視為失敗 |
| 成績模板殘留理解題標籤 | 雙語成果 render 測試通過，改為事件／閃避／煞車文案 |
| 首次 Linux CI 272／273：Windows 原碼 CRLF 與 Git LF 摘要不同 | 文字原碼／JSON 僅統一 CRLF→LF 後核對完整摘要；GLB 與公開套件仍逐 byte 比對。沒有修改任何核准遊戲 bytes |

七項 gate、遊戲／Hub／runner build、SEO、共用平台 Brave 與逐遊戲驗收的命令、結果見 [validation-summary.json](migrations/driving-rehab/validation-summary.json)。Brave 使用本機 R2 fixture、真實 Three.js／jsPsych／原生全螢幕，Hub 保存只寫本機 SQLite，不建立正式帳號或紀錄。截圖保留於 `.tmp/driving-rehab-validation/`；示意圖與真實 gameplay 分開驗證。

手機／平板以 Brave CDP 模擬觸控，並在父頁和 OOP iframe 啟用 touch emulation；方向盤使用虛擬 G29 軸輸入跑原校正演算法與斷線暫停。這些不代表實體方向盤、觸控硬體、效能或音訊輸出的驗收。Safari／iOS 與長時間完整離線未驗。

## 正式發布、部署與驗收

- [七項遠端 CI](https://github.com/ian030590/RehabTrainerHub/actions/runs/39077259337) 在 `4a278a358a316f89b6313aa60b2fbdbad1a4c12a` 全部成功。首次 Linux CI 的原碼文字換行差異只修正測試與 fixture，核准的遊戲 bytes 完全未變。
- 相容 runner：[56fca01e](https://56fca01e.trainerhub-user-games.pages.dev)，先確認原有八款穩定入口不變，再發布八檔／10,045,727 bytes；發布工具逐檔回讀雜湊後發布 manifest、切換 current。切換 Hub 前再次核對八檔公開 bytes、gamepad launcher，當時舊 Hub settings 仍為 200。
- 正式 Hub：[4a27cfb9](https://4a27cfb9.rehabtrainerhub.pages.dev)，只保留駕駛相容入口及原圖，不攜帶駕駛 bundle／JSON；保留 31 款舊遊戲。首次部署快照漏帶既有分類與相容目錄檔，Wrangler 在本機打包階段失敗，補齊原檔後重試成功，未改產品或核准套件。
- 正式 `/api/games` 僅一筆 `driving-rehab@2.0.0`，分類 vision／vision、原 R2 預覽圖、無 settingsUrl；未指定版本 session 回覆 201 並固定本頁版本／摘要。舊 settings、score、JS、SW 均 410／no-store；其他八款 current 的版本與摘要和發布前完全一致。
- [穩定獨立入口](https://trainerhub-user-games.pages.dev/games/driving-rehab/) 以不可快取 302 導向 2.0.0。原生 gamepad permission 在 Hub 與 PWA 均允許，sandbox 仍為 allow-scripts，無同源、相機或網路存取權限。

正式 Brave 命令都以 `node scripts/check-r2-game-browser.mjs --game driving-rehab` 開頭，九項均通過：

| 入口與模式 | 參數 | 驗收 |
| --- | --- | --- |
| 正式 Hub 桌機 | `--production-hub --lobby --wide --windowed` | 三步教學、視窗場景、完整成果、保存失敗重試與捲動還原 |
| 正式 Hub 手機 | `--production-hub --lobby --mobile --medium --session-failure` | 啟動重試、觸控、視角切換、完整訓練與保存 |
| 正式 Hub 平板 | `--production-hub --lobby --tablet --medium --hard` | 高難度、觸控、完整成果與保存 |
| 正式 Hub 英文登入 | `--production-hub --lobby --signed-in --english --hard --low` | 英文文案、WASD、登入身份隔離與成果 |
| 正式 Hub 方向盤 | `--production-hub --lobby --wide --low --wheel --stop` | 虛擬 G29 五階段校正、斷線暫停、停止清理 |
| 正式 PWA 手機 | `--remote --standalone --mobile --low` | 完整訓練、成果與版本限定快取，包含模型資料 |
| 正式 PWA 平板 | `--remote --standalone --tablet --low --stop` | 教學、全螢幕與停止不保存 |
| 正式 Hub 設定保存 | `--production-hub --lobby --settings-memory` | 確認才保存、重開還原、遊戲仍無 localStorage 權限 |
| 正式 PWA 設定保存 | `--remote --standalone --settings-memory` | 同上 |

Hub 流程使用真正部署的 HTML／JS 與正式 R2；僅攔截 Hub `/api/*` 至本機 SQLite，以驗保存重試及身份隔離。正式 API 另行直接讀取與建立不保存成果的 session。沒有建立正式帳號或訓練紀錄。原始日誌及截圖分別保留在 `.tmp/driving-release/browser-*.log` 與 `.tmp/driving-release/production-browser/`，正式收據追蹤各命令、時間及結果。

本機外部同步程序曾將產物 index.html 改名為 conflicted 檔；只在核對 index 精確 SHA 後還原原名，重新驗證八檔及完整摘要，再凍結套件和平台輸出；未調整 manifest、大小限制或核准內容。

## 回退與限制

首次 native 沒有另一個核准的新格式回退版本。舊 Hub deployment `8dccfbc8-9b51-4035-964e-464e85117009`／來源 `de8d01d7c32953df4f0b057c377633193b80386e` 已回讀：舊 settings、score、預覽圖 bytes 與發布前相同，舊入口 200 並保留原 module／PWA 引用。入口整份 HTML 雜湊與自有網域基準不同，未宣稱它逐 byte 相同。沒有實際回退。

必要時只還原駕駛的舊 registry／依賴／遊戲及 JSON 流程，再部署相容 Hub；保留其他八款 current 和已發布不可變 native 版本。不可用 `--activate-version 1.0.0` 當 native 回退，或回退整站而覆蓋其他遊戲。

手機／平板為 Brave 觸控模擬，方向盤為虛擬 G29；實體方向盤、觸控及音訊輸出、Safari／iOS、長時間完整離線訓練仍未驗收。

## 2.1.0：像素駕駛室（已發布）

2026-10-19，依擁有者要求把場景改成 [javascript-racer](https://github.com/jakesgordon/javascript-racer) 式的 2D 像素投影，不再使用 three.js。擁有者回覆「核准發佈，遊戲手把模式暫緩」後，發布下列精確版本並切換 current；回退版為 2.0.2。見[正式收據](releases/driving-rehab-2.1.0.json)。

| 項目 | 值 |
| --- | --- |
| gameId／版本 | `driving-rehab@2.1.0` |
| contentSha256 | `af1ce685bc96b6ad3c4116472aac9b743e787cc3e103189e87fdafac72852548` |
| 套件 | 8 檔、1,281,420 bytes（主程式約 728 KB、精靈圖 318 KB）；不再有 `vehicle-data.js` 或 GLB |

- 畫面：Canvas 2D 以低解析度繪製，再用 `image-rendering: pixelated` 放大。道路沿既有路線逐段投影，延伸到真實 90 度轉彎與路口；建築、樹、路燈、號誌、車輛與機車是預先算好的多角度像素圖。
- 駕駛室：臺灣左駕第一人稱，視點在左座。方向盤、儀表板與速度表（指針與數字跟隨實際車速）、左右 A 柱、左右車外後視鏡與車內後視鏡；三面鏡子各自往後投影，會看到後方來車。手機狀態列會蓋住車內後視鏡時，後視鏡改掛在狀態列下方；桌機導航地圖移到右上，避開三面鏡子。
- 後方車流：依畫質 2／3／4 台，在玩家後方出生、跟車減速、從鄰車道超車，遠離後重新回到後方。前後車流都會在紅燈停止線前停下。
- 保留：路線、80 秒時限、固定步進、從起點到終點的計分、四項設定與預設值、聚光燈教學、逆向來車事件與反應時間判定，以及原 10 個 summary 欄位與每回合欄位。Space 與煞車鍵相同。
- 素材：全部 CC0，來源與版本見 `games/driving-rehab/sprites/SOURCES.md`；精靈圖由 `scripts/driving-pixel-sprites/build.mjs` 從 Kenney 套件產生，套件本身不進倉庫。
- 修正：機車改用自己的小碰撞框（舊版以縮放判斷，機車縮放為 1.0 而誤用汽車框）；圖片網址改在模組載入時解析，修正觸控方向盤與踏板圖在 IIFE 建置中缺少 `assets/` 路徑；觸控方向盤 SVG 加上 viewBox 並改用已定義的 `--primary` 色，CAM 按鈕移到踏板上方，不再蓋住速度表。
- `models/car.glb` 與 `scenes/taipei-xinyi-osm.json` 原檔保留（legacy fixture 雜湊固定），2.1.0 套件不載入。

驗證：七項 gate 通過（game-architecture 312／312）；本機 Brave 大廳桌機、手機、平板、英文、寬螢幕低畫質方向盤與停止、設定保存、繪圖失敗後重試，以及獨立 PWA 手機共八項流程通過，截圖在 `.tmp/driving-rehab-validation/`。同上，這些不代表實體觸控、方向盤或效能驗收。

正式驗收：發布工具逐檔上傳並回讀雜湊後才切換 current。正式 runner 八檔公開 bytes 與收據一致，穩定入口以 no-store 302 導向 2.1.0，正式 session 回覆 201 並固定 2.1.0／上列摘要。正式 Hub 桌機、正式 Hub 手機與獨立 PWA 手機三項 Brave 流程通過，Hub `/api/*` 只攔截到本機 SQLite，未建立正式帳號或紀錄。capabilities 與 2.0.2 相同，因此沒有另外部署 Hub 或 runner。遊戲手把模式由擁有者暫緩。

## 2.1.1：車流卡住與終點冒車修正（候選，待核准）

2026-10-19 擁有者試玩 2.1.0 回報兩個問題：閃避逆向車時和一台順向車卡在一起動不了；開到終點附近突然冒出一堆對向車。

| 項目 | 值 |
| --- | --- |
| gameId／版本 | `driving-rehab@2.1.1` |
| contentSha256 | `1a25dbd5882557ffd9a145436048d7b205208f523540502e5a35c47d138091ec`（`--dry-run`） |
| 套件 | 8 檔、1,282,872 bytes；只有主程式與引用它的 `index.html` 改變，其他六檔與 2.1.0 相同 |

原因：

- 卡住：玩家碰到車流時，車子退回上一步並把速度歸零。兩車一旦重疊或貼住，之後每一步都算碰撞而退回原地；順向車又把玩家當成前車，玩家不動它也不動，雙方互等。重疊或貼住有兩個來源：切到隔壁車道時側面擦到旁邊的車，以及偏離車道後黑畫面拉回的位置上剛好開來一台後方車。
- 冒車：對向背景車開到路線起點後，直接移到終點前 6 m 重新出發。玩家接近終點時，這些車就在視線內憑空出現，而且繞完一圈的對向車最後都會集中在終點路段。順向車開到終點則跳回起點，玩家還在起點附近時會出現在後視鏡裡。

修正（`traffic/drivingTraffic.ts` 與 `three-driving-rehab.ts`）：

- 已經重疊的兩車可以往分開的方向移動。正在等玩家的順向車（玩家在它前方 2 m 內，或它被玩家車身擋住）貼住玩家時，不再擋住玩家開走；碰到時仍記一次撞車。
- 順向車不會開進玩家車身，玩家斜跨兩線時也一樣，會停在車身前等。
- 偏離車道黑畫面拉回時，停在拉回點上的車在畫面恢復前離開，之後從玩家看不到的地方回來。
- 背景車離開路線，或落後玩家超過 150 m（後視鏡只畫 110 m）時，改在前方可見範圍外（繪製距離 + 40 m）重新出現；接近終點、前方已沒有看不到的路段時，就不再補車。後方車流仍依原規則在後方重生。
- 計分、10 個 summary 欄位、每回合欄位、逆向事件與反應時間判定不變。

TDD：`scripts/check-driving-pixel-view.test.mjs` 新增 4 項，直接載入遊戲 runtime 類別模擬。先在 2.1.0 程式碼上失敗：切車道擦撞後玩家 0 m 移動、和後車重疊後停在原地、拉回點仍壓在車上、1283 m 路線上對向車在距終點 298 m 與 5 m 處出現；修正後通過。另以 288 種切入組合（前車停止或行進、在前或在後、不同油門與方向盤回正）模擬，0 次卡住，兩車最深短暫重疊 0.37 m。

驗證：七項 gate 通過（game-architecture 316／316）；本機 Brave 大廳桌機、大廳手機與獨立 PWA 手機三項流程通過，只寫本機 SQLite。發布前同步程式又把產物 `index.html` 改名為 conflicted 檔，刪除後重建，`--dry-run` 摘要與上表相同。
