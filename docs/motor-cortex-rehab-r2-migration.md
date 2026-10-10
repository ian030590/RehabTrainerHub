# 手部目標追蹤練習 R2 候選審查

2026-10-10。狀態：**擁有者已核准精確候選，待公開與正式站驗收**。擁有者回覆「核准並git push」，核准下列 `2.0.0`／精確 SHA-256 及 runner → R2 → Hub 的發布順序。尚未執行 R2 發布、Pages 部署或正式 registry 切換；本文件與 candidate JSON 均不是正式發布收據。

使用者已確認採畫畫塔防的「遊戲背景上的前景設定視窗＋聚光燈教學」，保留原參數。候選版本 `motor-cortex-rehab@2.0.0`，contentSha256：

```text
e4e449522ccbb99c5f9fa1a6b0845f8b0202d78df73025d01b779f8a1c4b5b09
```

[候選逐檔清單](migrations/motor-cortex-rehab/candidate-2.0.0.json)包含五個檔案，共 380,014 bytes；來源為已驗證的遊戲 `dist/`。本機 dry-run 會產生 publisher 的 release 模板，模板中的 `approved`／時間不是擁有者核准或 R2 公開證據。審查後若變更發布 bytes，須升新版本、重新驗證及核准。

## 原功能與碰撞盤點

基準 commit：`545ba80b7f2deed6f8a06e276e913754cb560a7e`。原 workspace `1.0.0` 使用 OfficialGameShell、共用設定／結果 JSON、遊戲內直接相機與 MediaPipe、Hub storage/auth。原啟動為大廳 JSON 設定 overlay，獨立入口也使用共用 shell；雙語文案、jsPsych lifecycle 與 WebAudio 回饋保留。

| 項目 | 基準／候選 |
| --- | --- |
| 遊戲身份 | `motor-cortex-rehab`，手部目標追蹤練習／Hand Target Tracking Practice |
| 分類 | 原 source 為 `motor`／`upper-limb`；正式同名歷史投稿為 `motor`／`general`。候選採遊戲原 source 的上肢分類，由 `public/game.json` 擁有 |
| 原圖 | `apps/rehabtrainerhub/public/assets/training-modules/motor-cortex-rehab.webp`；原 bytes 複製至遊戲 `public/preview.webp` |
| 原圖 SHA-256 | `6a6085136389ad1250b036fb13ad6505032d9033cf115b336e9c7ae8721e1455`；source／dist 一致 |
| 四種路徑 | 反彈、垂直、水平、隨機；原目標移動、維持、中斷、手部消失與自適應演算法移至自己的 `engine.ts` |
| 起始難度 | 初階 82 px／120 px/s／560 ms；中階 66／165／760；進階 54／220／980；舊 JSON easy／medium／hard 對應 beginner／intermediate／advanced，數值不變 |
| 時間 | 45／60／90 秒，預設 60；從輸入與引擎準備好才開始 |
| 大小／速度 | 75–130%／70–140%，步長 5，預設均 100% |
| 手部 | 預設任一手；保留原 runtime 的左／右手選擇。舊 hosted 設定未暴露此欄位，候選設定視窗可選 |
| 設定預設 | bounce、intermediate、60 秒、any、100%、100% |
| 成果 | 完整 duration、追蹤／目標內比例、完成／中斷、最佳維持、級別；每個成功／中斷事件保留序號、結果、活動累計時間、維持時間、目標直徑、級別與累計目標內比例 |

舊設定與成績契約保留於 [settings.json](migrations/motor-cortex-rehab-legacy/settings.json)／[score.json](migrations/motor-cortex-rehab-legacy/score.json)供核對，遊戲／Hub 不載入它們。原程式可從上述基準 commit 還原；已只讀正式舊大廳並點此卡片，保存 [舊桌機設定](migrations/motor-cortex-rehab/legacy-desktop-settings.png)／[舊手機設定](migrations/motor-cortex-rehab/legacy-mobile-settings.png)，確認原 JSON overlay、預設 66／165／760 與 60 秒；未點開始、未啟動相機或提交成果。未另錄製舊版真人相機流程。

只讀正式 `https://trainerhub.cc/api/games` 得到 HTTP 200，當時同 slug 有 `official-motor-cortex-rehab`／`rel-motor-cortex-rehab-1.0.0`，摘要 `636a44cd63c03476890ee127096dbfb38ed084af9985d97544ba1170b22f315d`，仍含 `settingsUrl`。已將此 identity、分類與舊版能力加入 API fixture，並測大廳同名卡片不覆蓋固定版本 session。完整無身份基準保留於 [production-baseline.json](migrations/motor-cortex-rehab/production-baseline.json)；這只是舊正式目錄的讀取證據，不是新版驗收。

## 候選架構與 UI

遊戲自己擁有設定、五步教學、引擎、雙語、音效、統計／SVG 圖表／完整事件明細與樣式；只依賴 React、React DOM、jsPsych，不引入平台或跨遊戲程式碼。classic IIFE 與相對資產在正式 package CSP 下執行。刪除遊戲的 `settings.json`／`score.json`、舊教學 panel 及共用 shell；沒有另一個設定頁面。

設定視窗開啟時已呈現真實 HUD／目標／游標／維持條／座標預覽背景，尚未啟動教學、相機或活動計時。確認後依序聚光燈說明這五個元件；返回保留所有設定，略過／完成清除遮罩。設定與最終參數確認採同一 header／可捲動 body／footer，字級與字重、焦點循環、按鈕及手機邊距由實際 DOM／computed style 驗證。短視窗的說明框會避開目標。活動結束顯示主要統計、當次設定、描述統計、指標切換、平均參考線及每頁 50 筆圖表／明細；零值與缺漏分開，累計數值明示。

Hub 只經私有 MessageChannel 接收 config 與有限數值成果，核對 parent/source/origin、nonce、sequence、game/version 與 schema；保留 session 固定版本、保存重試與身份隔離。Hub 只有返回大廳，獨立 PWA 只有返回入口並重設 HUD。遊戲不接收身份、token 或影像，也不自行寫紀錄。

手部輸入沿用已核准的可信容器代理；明確同意後由 Hub／runner 執行固定 MediaPipe `0.10.35`，模型／WASM 只讀 runner `/input/hand-tracking-1.0.0/`。新增相容的 `{hand: any|left|right}` input-start 選項；手勢遊戲原空 payload 仍可用。容器選擇要求的手，向遊戲仍只傳 timestamp＋21 點 xyz 或空陣列；沒有擴張影像／權限／模型選擇。package 相機仍禁止，`sandbox="allow-scripts"`、`connect-src 'none'` 等限制保持。停止、結算、取消、斷線、撤回及晚到初始化皆清理相機與排程。

本機 registry 增加遷移資格，沒有 version 指標；sync 後 Hub 不依賴此 workspace。Hub build 排除四款候選／已遷移遊戲，保留 36 款舊流程；手部目標追蹤 output 只含導向 runner 的 `index.html`，原圖作為相容 preview，沒有遊戲 bundle／JSON／`runtimes`。正式完成仍為三款／37 款舊流程。

## TDD 與本機驗證

| 先失敗的測試 | 原因／修正後結果 |
| --- | --- |
| migration：1 過／3 失敗 | 原引擎行為已鎖定，新 config／score 尚不存在、版本仍 1.0.0；移至自有模組後 4／4 通過 |
| motor results：3 個新增案例失敗 | 尚無自有統計／圖表／明細；完成後連同其他三款共 18／18 通過 |
| 指定手輸入與 launcher title | 選項未通過契約、未傳到 detector、launcher 固定手勢遊戲標題；新增精確 enum／同意後轉送與 HTML escape，保留原安全測試 |
| 短桌機聚光燈 | 說明框覆蓋 target；用可用上下／側邊空間定位，五步逐一確認不重疊 |
| 最終確認鍵盤 | Start 未取得焦點、Tab 未限制在視窗；加入初始 focus 與 Tab／Shift-Tab 循環後真實瀏覽器通過 |
| PWA 返回入口 | 前場 HUD 數值仍存在；重設數值後完整 45 秒流程及再次進入驗證通過 |

已通過：`test:naming`、`test:pwa`（18）、`test:game-architecture`（71）、`test:hub-functions`（109）、`test:gamerunner`（34）、`test:entrypoints`、`test:cloudflare-deploy`、遊戲／runner build、Hub build（37 tasks＝Hub＋36 舊遊戲）及 `test:seo`。`test:game-architecture:browser` 最終在乾淨固定 Hub 輸出為 5／5 通過，涵蓋第三方卡片／舊 JSON 設定／舊實驗、guest／登入共用成績圖表與保存，以及手機 header／四尺寸 navigation；先前共用圖表案例未生成 SVG，重建後單案及完整 gate 均重驗通過，未修改共用圖表產品程式碼。修改的 JS Functions／代理另通過 `node --check`。兩份 workflow 維持既有七項 matrix／同一 root command，新增三個 motor 測試加入原架構 gate。

專屬 Brave 命令基底：`node scripts/check-r2-game-browser.mjs --game motor-cortex-rehab`。

| 附加參數 | 本機驗證 |
| --- | --- |
| `--lobby`、`--lobby --mobile` | 真正大廳卡片／原圖／分類／固定 session、設定與五聚光燈、實際 45 秒反彈追蹤、成果／重試／一筆 SQLite 保存 |
| `--lobby --signed-in --english --vertical`、`--lobby --signed-in --english --right` | 英文、垂直／指定右手、帳號 Subject ID 與訪客隔離、完整成果與保存 |
| `--lobby --mobile --session-failure --random` | 503 不提前載入、重試後隨機追蹤、session 恰好兩次與完整結果 |
| `--standalone --mobile --horizontal`、`--standalone --tablet --left` | 水平／指定左手、390×844／820×1180、版本 scope、模型快取、本機結果、唯一返回入口與 HUD 清理 |
| `--lobby --camera-disconnect` | 真實開始後斷線，所有相機 tracks 停止、回設定、有可見提示、零保存 |
| `--lobby --revoke`、`--lobby --revoke-playing` | 載入後／實際遊玩中撤回：卸載 iframe、零保存；遊玩中確認所有相機 tracks 停止 |

以上 detector／game loop／jsPsych／WebAudio／原生 fullscreen 都是真實執行，感測來源是經 SHA-256 核對的 MediaPipe 圖片串流；左手使用同一圖片水平翻轉，沒有偽造送進遊戲的座標或 mock inference。指定手不符圖片時確實收到空手部訊息，因此改用相符 fixture 才驗完整流程。既有手勢遊戲 `--game gesture-battler --lobby` 通過真實校正／對戰／保存回歸。

驗證曾因本機同步程式把生成的 runner `index.js`／Hub HTML 改為 `[conflicted]` 名稱而失敗；沒有調整 manifest 配合缺檔。重建 runner／Hub、核對 bytes，改用固定 `HUB_OUTPUT_ROOT`／`RUNNER_OUTPUT_ROOT` 副本驗瀏覽器，重建 Hub 後立即執行 SEO gate。正式 Pages 必須使用乾淨 CI build，不上傳有衝突的 output。

截圖：[桌機設定](migrations/motor-cortex-rehab/desktop-settings.png)、[桌機聚光燈](migrations/motor-cortex-rehab/desktop-tutorial.png)、[桌機分析](migrations/motor-cortex-rehab/desktop-results-analysis.png)、[手機聚光燈](migrations/motor-cortex-rehab/mobile-tutorial.png)、[手機明細](migrations/motor-cortex-rehab/mobile-results-details.png)、[平板確認](migrations/motor-cortex-rehab/tablet-confirmation.png)。這些皆為本機候選截圖。

## 核准後發布順序與回退

依 [搬遷計畫第 7 節 E](r2-game-migration-plan.md#步驟-e每版核准後才公開-r2)，先由擁有者審查原始碼、隔離試玩、公開雙語資料／分類／原圖，核准上述精確 version／contentSha256。準備完成後再執行：

1. 部署相容 runner 支援（指定手輸入與正確 launcher title），驗證原手勢版本仍相容；此時正式 Hub 保持原 registry。
2. 再次直接執行 `node scripts/publish-official-game.mjs motor-cortex-rehab --dry-run`，核對精確摘要與五檔案；核對 Cloudflare 帳號／憑證、單一發布者後執行正式 publisher。它會直接公開並切 current，不能當 staging 使用。
3. 確認 approved manifest、每檔 R2 回讀、官方 current／歷史後，才部署本分支 Hub registry／bundle 排除與輸入選項支援。不可先合併觸發兩站同時部署而讓 Hub 搶先切換。
4. 直接讀正式 `/api/games`／圖片 bytes／穩定入口 302，確認一筆上肢 current、同版 preview、沒有 settingsUrl；核對正式 session 選版，不公開 token。跑 `--remote --lobby`／`--remote --standalone`／`--production-hub --lobby` 及手機模式，僅攔 API 至本機 SQLite。完成正式收據 `docs/releases/motor-cortex-rehab-2.0.0.json` 才標記搬遷完成。

首次遷移沒有另一個已核准新格式回退版；舊 `1.0.0` JSON 投稿不能用 `--activate-version` 加入官方歷史。若切換失敗，先回復遷移前 Hub Pages 部署／上述基準 commit 的 registry、workspace 依賴與原遊戲／JSON，重跑 gate 並驗舊入口；runner 相容擴充可保留。不得刪除舊投稿、覆寫發布檔案或把 dry-run 放進正式收據目錄；必要的撤回由既有官方狀態／停止使用流程處理。後續新格式版本核准後才有可用的 `--activate-version` 回退目標。

## 待完成／限制

- runner／Hub 正式部署、R2 回讀、正式新 API／圖片／瀏覽器驗收與正式收據尚未完成。
- 尚未驗實體相機、真人左／右手、Safari／iOS、完整斷網長時間遊玩或真人 Turnstile。人工驗收：桌機／手機同意相機後分別選左右手，以真人移動四路徑、遮住／移出手部、取消／完成／退出後觀察相機燈停止；拒絕與中斷必須回設定且無成果。所有相關瀏覽器仍需實機驗證。
