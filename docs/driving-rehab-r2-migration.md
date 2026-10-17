# 駕駛注意力模擬練習 R2 搬遷候選

2026-10-18：依[搬遷計畫第 7 節 A–D](r2-game-migration-plan.md)完成本機候選，擁有者於回報此精確候選後明確回答「核准並git push」，已核准下列 `2.0.0`／contentSha256 及按序部署、發布、驗收與 Git 交付。**目前進行發布作業，尚未切換正式 Hub**；切換前正式仍為八款 R2／32 款舊流程，本機候選 registry 為九款／31 款舊 bundle。

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

## 核准後的發布與回退

1. 依搬遷計畫第 7 節 E：「明確核准精確 version／contentSha256 後才執行發布」。本文件與 candidate 都是未發布候選，不是正式收據。
2. 先部署相容 runner 的 reviewed gamepad 權限傳遞；此時保留舊 Hub 駕駛流程。再次 dry-run 比對本頁精確摘要，再由單一發布者執行 `node scripts/publish-official-game.mjs driving-rehab`，逐檔上傳／回讀後才切換 current。
3. R2 current 完備後才部署本機候選的 Hub registry／bundle 排除及 gamepad iframe allow。不能提前部署含此 registry 的整份工作樹。Hub 只留下相容入口與原圖，沒有 bundle／settings.json／score.json。
4. 依第 7 節 F 驗正式目錄唯一卡片／分類／原圖、未指定版本 session、8 檔公開 SHA-256、舊資產 410，以及正式 Hub／PWA 桌機、手機、平板、英文、方向盤權限及保存流程；完成後才在 `docs/releases/` 留正式收據、宣稱搬遷完成。
5. 首次新格式沒有另一個已核准 native 回退版本。回退需針對 driving-rehab 還原基準 commit 的舊 Hub registry／依賴／遊戲與 JSON 流程，保留其他八款 current；不得使用 `--activate-version 1.0.0` 或回退整個平台覆蓋其他遊戲。正式舊 deployment／公開 bytes 的回讀核對留在發布前後作業，尚未執行。
