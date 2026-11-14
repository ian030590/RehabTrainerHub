# 手部目標追蹤：像素鐳射英雄

**Type**: Addition
**System**: `motor-cortex-rehab`
**Date**: 2026-11-13
**Reference**: `docs/motor-cortex-rehab-r2-migration.md`、既有遊戲程式與測試。此既有遊戲沒有 GDD 或 systems index，沿用原 gameId，不新增遊戲或平台權限。

## Change Summary

把手部追蹤的目標包裝成從遠處跑來的像素敵人。玩家舉手發射鐳射並連續瞄準敵人，完成穩定維持後消滅敵人並得一分。每次只有一名敵人。

## New Rules / Values

- 掌心位置維持原本鏡像映射。掌心進入攝影機畫面的上方 80% 才能發射，放下手或失去追蹤立即停止。這是畫面內的舉手操作門檻，不推算肩關節角度。
- 敵人的移動範圍在場景上方 80%，保留原有反彈、垂直、水平、隨機四種路徑與左右手選擇。
- 敵人使用兩幀跑步圖像，從遠景小尺寸逐漸逼近，速度設定控制逼近時間。到達近處後繼續巡行，等待玩家完成穩定命中，沒有碰撞扣分。
- 初階／中階／進階須連續命中 1.5／2.0／2.5 秒，隨機模式首名敵人另加 0.24 秒，才消滅敵人。移開、放手或失去追蹤會把該次進度歸零，沿用成功／中斷事件、自適應與成果欄位。
- 消滅後保留 400 ms 的像素消散，再產生下一名敵人；消散期間不累積傷害、不重複加分。
- 美術與鐳射／命中／完成音效使用 Kenney CC0 素材，保存原授權、來源與逐檔摘要，從遊戲套件內載入。
- 設定、聚光燈教學、確認、相機同意、全螢幕、成果、保存重試、取消與退出保留原流程。遊戲不取得相機或新增跨遊戲依賴。

## Acceptance Criteria

- [x] 同時只有一名敵人，逼近與消散狀態可見。
- [x] 未舉手、沒有有效追蹤或未連續命中時不得得分。
- [x] 中斷後必須重新連續命中，擊殺一次只加一分。
- [x] 消散完成才換下一名敵人，時間到正常結算。
- [x] 中英文教學說明舉手、鐳射、穩定追蹤及計分。
- [x] 手機／平板／桌面可見場景、進度與相機狀態。
- [x] CC0 檔案可核對，取消／結束／離開停止鐳射與音效。
- [x] 行為測試經 `test:ci` 的既有 motor 測試執行；瀏覽器流程沿用 `scripts/motor-cortex-browser.mjs`，只使用本機感測 fixture。

## GDD Update Required?

No。此變更沿用既有遊戲，設計差異記錄於本文件。

## Verification

- 本機候選 `motor-cortex-rehab@2.1.0`，13 檔，`contentSha256: 4698ab6a2488f731ab363145ef996f758dcf6b109d3a0e23d7c89200d1a9776a`。只執行 `node scripts/publish-official-game.mjs motor-cortex-rehab --dry-run`，未發布、部署、commit 或 push。
- TDD 先失敗於缺少敵人狀態／音效模組；另重現背景間隔仍累積 450 ms、縮小場景時敵人超出邊界，以及原 560／760／980 ms 不符合新維持時間。修正後，下列相關回歸 153/153 通過：`node --test scripts/check-motor-cortex-migration.test.mjs scripts/check-motor-cortex-tutorial.test.mjs scripts/check-motor-cortex-bridge.test.mjs scripts/check-r2-game-fullscreen.test.mjs scripts/check-r2-settings-controls.test.mjs scripts/check-r2-settings-memory.test.mjs`。
- 遊戲 build、`tsc -p apps/rehabtrainerhub/tsconfig.games.json`、`npm run test:naming`、套件 dry run 通過。
- 本機 Brave：`node scripts/check-r2-game-browser.mjs --game motor-cortex-rehab` 加上 `--standalone --mobile`、`--standalone --wide --english --right`、`--standalone --tablet --left --vertical` 三組全部通過。涵蓋 CC0 圖像載入與步伐交替、設定、五步教學、相機同意、全螢幕、45 秒模型推論、穩定命中擊殺、單一敵人計分、成果圖表、返回及相機停止。三組已接入 `npm run test:uiux-browser`，需安裝 Brave 並在本機手動執行；GitHub CI 的一般 gate 不包含感測瀏覽器流程。
- 完整 `test:game-architecture` 首次為 1400 通過／6 失敗；其中本次新增音效相依造成的兩項全螢幕測試缺少 mock 已修復，該檔 18/18 通過。另四項是既有 `check-codex-agent-wrapper.test.mjs` 的 Windows Bash 環境／路徑／暫存清理失敗，未修改 wrapper 或略過測試，不宣稱完整 gate 通過。
- 截圖與執行紀錄保留於 `.tmp/motor-laser-validation/`；原始素材授權、來源及六個素材的 SHA-256 位於遊戲自己的 `public/assets/laser-hero/`。

## Hardware Acceptance

瀏覽器驗證使用合成圖片串流與實際 MediaPipe 模型，不代表真人、實體攝影機、Safari／iOS 或肩關節角度已驗收。實機驗收請選擇指定手、允許相機後開始：放下手應停止發射；舉手瞄準直到敵人消滅；維持途中移開後進度應歸零；停止、Escape 或返回應停止相機與鐳射。

## 2026-11-14 v2 changes

本節追加擁有者已選定的四項修改。保留尚未發布的 `2.1.0`，不改動上述首次候選的歷史紀錄。

- 發射高度改為遊戲自有設定 `raiseLinePercent`：只接受整數 50、65、80，預設 65。舊設定缺少此欄位時，以 `RestoreSettings` 補入預設值，其他有效選項保留。掌心維持鏡像 1:1 映射，只有未過期的追蹤點在虛線上方或線上才發射；敵人完整尺寸限制在線上方，場景與手部預覽顯示相同高度。線下提示「再舉高一點」附在準星上方，限制於場景內並避開相機與停止按鈕，保留狀態報讀；設定、最終確認與當次概況均顯示高度。
- 當次紀錄新增 `Raise_Line_Percent` 與 `Raised_Percent`。後者為整段活動時間中，掌心有有效追蹤且在線上方的時間比例，包含消滅回饋與換敵人的時間，不包含遺失／過期追蹤。結果顯示「舉手過線時間」。唯讀核對 Hub、runner 與 records API 的數值驗證後，摘要新增第八欄 `raised`，維持最多 12 欄的契約。
- 英雄改用 Kenney Cursor Pixel Pack `tile_0138` 的 16×16 像素衍生紅手套／金色袖口，逐像素換色並保留透明度，沒有平滑或重採樣。前景手臂在線下隨掌心水平移動，左手鏡像；角框準星、兩色 10 px 邊緣／4 px 核心鐳射、掌心火花與命中火花均為遊戲自有場景。只有鐳射使用光暈。
- 地平線位於場景高度 15%，灰色 Tiny Battle 建築使用同一整數像素倍率，緊鄰排列並依寬度重複填滿地平線，道路向下展開至發射線。每名敵人以小尺寸從中央遠景跑到其任務起點，逼近時間仍為 `4200 / speedScale` ms，途中可命中。到達後分別斜向反彈、上下巡行、左右巡行，或在隨機位置站定；上下巡行保留以場景中線為中心的左右輕晃，左右巡行保留以抵達高度為中心的上下輕晃，全部限制於可達範圍。水平輔助線跟隨實際巡行中心，垂直輔助線僅從地平線畫到發射線。教學預覽在空間足夠時把敵人及血條放到標題下方的道路上，放不下時沿用原有縮小與置中規則。完整敵人保持在線上，支援縮小與旋轉後的場景。
- 四組兩幀敵人依序循環，使用 Pixel Platformer 0000/0001、0006/0007、0015/0016、0021/0022。已對照原圖表及放大的尖刺敵人圖確認成對圖像；移動方向決定水平翻轉，跑步時交替步伐與顯示地面陰影。
- 命中時閃爍、輕微震動、血條隨連續命中減少。中斷時進度歸零、血條回滿，進度旁短暫顯示「中斷，重新瞄準」。消滅仍只加一分，400 ms 內依序呈現 Shmup 0004–0007 四幀及 0008 煙霧、上升 +1 與計數強調，之後下一名敵人才跑入。降低動態效果時不震動、不上下晃動、不上升，爆炸固定一幀後消失。
- 未命中時播放既有 `laser.ogg`；命中改播 `charge.ogg`（Sci-fi Sounds `forceField_001`），停掉發射音並以進度將播放速度從 1.0 升至 1.6，關閉保留音高。消滅仍用 `hit.ogg`，完成改用 Digital Audio `powerUp3`。放下手或追蹤過期只停止發射與蓄力循環，已開始的消滅／完成單次音效繼續播放；隱藏頁面、取消、Stop、Escape、退出與清理才停止全部音效。晚到的 `play()` 不得重啟已停止的音效。

驗證、確切資產摘要、建置檔案數／大小及沙盒限制由本次 worker 報告記錄：`production/session-state/codex-briefs/motor-laser-hero-v2-report.md`。本節是工作樹設計差異，不是正式發布或獨立驗收收據。
