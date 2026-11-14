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
