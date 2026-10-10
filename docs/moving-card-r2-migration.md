# 移動卡片訓練 R2 遷移驗收

2026-10-10。狀態：**精確摘要已核准、R2 已發布、七項 CI／兩站部署與正式 API／Hub／PWA 驗收通過**。正式完成五款，Hub build 排除五款 R2 bundle／JSON，保留 35 款舊流程。正式收據見 [moving-card-2.0.0.json](releases/moving-card-2.0.0.json)。

正式 current 為 `moving-card@2.0.0`，`contentSha256`：

```text
34915a0b84b4c83428b386cab8521351ddafa98d824c3fc46cb242f5c5a57037
```

精確五檔清單、逐檔 bytes／SHA-256、能力、驗證命令與待辦見 [candidate.json](migrations/moving-card/candidate.json)。Publisher dry-run 輸出的 manifest 具有 `approved` 欄位，但只代表工具生成的待發布內容，不是擁有者核准或 R2 公開證據；審查紀錄已附擁有者核准；正式收據記錄 R2 回讀、CI、兩站部署、正式 API 與實際 browser 證據。

## 原始流程與設定盤點

原始碼基準 commit 為 `dfb507b0914048e5111853a4fdb3fe9ccbb37fb0`。遊戲原為 `1.0.0`、Hub 同源 JSON 設定／成績 overlay 與共用 `OfficialGameShell`；原 jsPsych／Pixi 引擎尋找兩個大寫字母，錯選提示後重試同回合，完成時間包含重試。原設定與數值契約保留於 [legacy/settings.json](migrations/moving-card/legacy/settings.json)、[legacy/score.json](migrations/moving-card/legacy/score.json)，候選執行時不讀這兩份檔案。

| 設定 | 原預設／邊界與候選對照 |
| --- | --- |
| 視覺搜尋排列 | medium；easy／medium／hard 對應原 beginner／intermediate／advanced，矩形移位／圓形卡片／圓形卡片旋轉 |
| 回合數 | 10；5–40，步長 5 |
| 選項數量 | 18；4–40，步長 1 |
| 移動間隔 | 800 ms；200–5000 ms，步長 100 |
| 目標大小 | 15 mm；2–100 mm，步長 1 |
| 選項大小 | 10 mm；2–80 mm，步長 1 |
| 聲音回饋 | 預設開啟；沿用原成功／失敗音調與固定 50% 音量 |
| 螢幕校正 | 保留 `mm × 700 / calBarLengthInMM` 換算與原預設 149。隔離遊戲自有 280px 線段，實測 59.6mm 對應 149；70mm 對應 175。候選不讀 Hub storage，需在遊戲重新量測 |

原 source 分類為 `vision`／`vision`；正式歷史投稿為 `vision`／`general`。候選 `public/game.json` 沿用原 source 的視覺訓練分類、原中文名稱與雙語說明。原圖 `apps/rehabtrainerhub/public/assets/training-modules/moving-card.webp` 的 bytes 複製至遊戲 `public/preview.webp`，SHA-256 為 `e14346b7bef3fba14f82f9c377fde9d0709c529d75f5cc23ef5e81652180e2b6`；source／dist 相符。Hub 保留舊預覽相容資產，但新卡片採同版本 R2 圖片。

只讀正式 `/api/games` 為 HTTP 200，同 slug 原資料為 `official-moving-card`／`rel-moving-card-1.0.0`，digest `35083a8dfe0b9297cf642cd8066e9123237d48e2cf1eae3f68b763e2f27bf246`，含舊 `settingsUrl`。無身份資料的讀取證據為 [production-baseline.json](migrations/moving-card/production-baseline.json)。API fixture 採這筆原 identity／分類，並驗證舊投稿不能覆蓋新 current；大廳只有一張此 slug 的卡片。

已讀正式舊大廳並只開設定，保存 [舊桌機設定](migrations/moving-card/legacy-desktop-settings.png)／[舊手機設定](migrations/moving-card/legacy-mobile-settings.png)，未開始訓練或寫入正式紀錄。另在 frozen 舊 Hub build 跑過既有 config browser 測試。未錄製舊版真人完整訓練影片。

## 自包含遊戲與聚光燈

遊戲自己擁有 React、jsPsych、Pixi、設定／validation、i18n、renderer、音效、三步教學、成果統計／SVG 圖表／明細與 CSS，沒有平台或跨遊戲程式碼依賴。移除原 JSON 設定／成績依賴、router、共用 shell、storage／auth 寫入與未使用 CSV helper；classic IIFE、相對資產與 Pixi CSP 相容模板在真實 runner 回應中執行，不增加 `unsafe-eval` 或外連。

開啟時使用前景設定 dialog，後方已呈現目標 `AB`、選項與回合預覽；教學、活動計時及移動尚未開始。確認後依序聚光燈說明「目標字母 → 追蹤並選擇 → 回合與成果」，提供下一步、略過與返回設定。返回保留全部數值，完成／略過／退出清除遮罩與事件。設定與最終確認採一致 header／可捲動 body／footer；焦點循環、Enter、錯誤提示、字重至少 700、training-panel 字級放大 1.15 倍均有測試。

最後一次「開始訓練」點擊才請求原生全螢幕，等待結果後啟動 jsPsych；拒絕時可視窗遊玩。取消後晚到的全螢幕轉換會退出，停止／卸載清除移動計時器、回饋 timeout、RAF、resize／鍵盤事件與 Pixi。初始化失敗顯示可重試提示，釋放已建立的 renderer；不產生成績。

原 beginner 最多只建立 20 個 grid slot，設定 40 張時會漏掉卡片甚至目標。先以行為測試重現，候選依選項數增加列數並保留空移位位置，三難度均有完整 40 張與一個目標。原動態移位、300ms 動畫、350ms 回饋、旋轉、錯選重試與整段搜尋計時保留。

成果主要區顯示找到目標、選擇次數與錯誤次數；當次八項設定完整保留。分析可切換搜尋完成時間／選擇次數／錯誤次數，提供平均數、中位數、樣本標準差、範圍、平均參考線、完整率與逐回合明細；零值不當作缺漏，缺漏不補零，圖表與表格每頁 50 筆、切換指標重設頁次。當次畫面可顯示原 target／response 字母，但私有 port 只傳原數值契約 `trials`／`completed` 及 `completed`／`searchMs`／`attempts`／`errors`，不含身份或字母字串。

Hub 接收私有 nonce／version／sequence 綁定成果並冪等保存。獨立 PWA 不自行保存 Hub 紀錄，只顯示返回入口；Hub 僅顯示返回大廳。R2／第三方 iframe 保持 `sandbox="allow-scripts"`，package CSP、相機禁止與身份隔離不變。

英文獨立 PWA 原先被 runner 的嵌入參數檢查拒絕。新增兩個失敗測試後，原生自包含 launcher 支援唯一 `lang=zh|en`，傳給 package 並保留語言入口／package 文件的離線快取；重複語言、未知語言、未知 query、混合 embed 仍拒絕，第三方 runtime 參數契約維持原樣。cache revision 升為 `2026-10-10-self-contained-games-v5`。這項相容 runner 變更須先部署，再發布候選遊戲。

## TDD 與本機驗收

| 先失敗原因 | 修正後結果／測試 |
| --- | --- |
| 缺少獨立設定、成果、preview／registry 與平台隔離；舊 40 選項只呈現 20；取消不清理 timer／RAF | `check-moving-card-migration.test.mjs` 驗證全部設定／校正、三難度、真實 plugin 的錯選／完成／計時、清理、timeline 與私有 bridge |
| 缺少本機 tour／三個目標與可清理遮罩 | `check-moving-card-tutorial.test.mjs` 驗證雙語、目標定位、resize、下一步／略過／返回、Escape、焦點與清理 |
| 同 slug 舊文案／JSON 入口會覆蓋候選 | API game-catalog 與 Hub catalog tests 驗證可信 current、vision 分類、同版 preview、無 settingsUrl、metadata bytes 受損時拒絕 |
| 取消後晚到的全螢幕仍留在設定 | `check-r2-game-fullscreen.test.mjs` 驗證待全螢幕完成才啟動與取消後退出，既有四款與 Hub cleanup 繼續通過 |
| 主要成果值只有 16px | 820×1180 Brave 行為檢查先失敗，修正為至少 32px 的階層後通過；設定／確認／成果 computed style 檢查通過 |
| 初始化失敗遺留已建立 renderer | 行為測試先因 `destroyed=false` 失敗；釋放失敗資源並重試成功，實際 Pixi init hook 失敗／恢復 browser 流程通過 |
| native PWA `lang=en` HTTP 400／離線語言文件未被接管 | runner regression 先兩項失敗，修正後 `test:gamerunner` 全 36 項通過，包括既有 hand input／third-party bridge／沙盒與 CSP |
| 正式英文 renderer 重試時，viewport 已全螢幕而 canvas 尚在前一尺寸 | 實際 browser 先因 800×600／752×485 尺寸差失敗；等待可觀察的 resize 完成，再執行原本嚴格尺寸／捲軸斷言，同一情境及正式回歸通過；核准遊戲 bytes 不變 |
| 原 keyboard 能力未明確宣告 | package capability 測試先失敗，補上原 audio／fullscreen／keyboard／pointer 與 touch 後通過 |

本機七項既有 gate 均通過：`test:naming`、`test:pwa`、`test:game-architecture`、`test:hub-functions`、`test:gamerunner`、`test:entrypoints`、`test:cloudflare-deploy`。architecture 100 項、Hub API 113 項、runner 36 項通過；UI／成果／全螢幕測試沿用 self-contained gate。兩份 workflow 保留相同七項 matrix 與命令、workflow 自身仍會觸發，新增移動卡片 migration／tutorial 測試納入原 architecture 命令，未新增 Brave CI 項目。`test:seo`、遊戲 build、Hub build 與 runner build 亦通過，Hub output 只有 R2 導向入口，不含此遊戲 bundle／JSON 或 `/runtimes/*`。

本機生成的 `out` 曾出現 `index [conflicted 2].html` 等改名產物，導致重跑產物檢查失敗。已將原生成目錄完整備份到 `.tmp/moving-card-conflicted-output-*`，再從通過建置／Brave 的固定副本還原，使用標準 `node scripts/check-built-game-architecture.mjs apps/rehabtrainerhub/out` 檢查通過；未放寬檢查器或改動 source 來接受衝突產物。本機 browser 持續使用固定副本，正式 CI 仍必須乾淨安裝／建置。

完整本機 Brave 指令以 `node scripts/check-r2-game-browser.mjs --game moving-card` 為基底；Hub 使用 `HUB_OUTPUT_ROOT=.tmp/moving-card-hub-output` 的固定建置副本，所有 API／帳號／成果只用本機 SQLite：

| 附加參數 | 已驗證行為 |
| --- | --- |
| `--lobby --wide --windowed` | 1320×713、舊 slug 碰撞／原圖、前景設定／Enter／往返、三聚光燈、原生全螢幕後退出的真實滑鼠活動、成果／保存重試／單筆訪客紀錄／返回原大廳位置 |
| `--lobby --mobile --session-failure` | 390×844、session 503 不載入 iframe、重試固定版本、真實觸控／錯選重試、成果內部捲動、保存與返回 |
| `--lobby --tablet --medium` | 820×1180、圓形卡片、確認／成果字級與完整流程 |
| `--lobby --english --signed-in --hard --renderer-failure --sound-on` | 英文帳號 Subject ID 與 guest 分離、旋轉卡片、Pixi init failure 提示／重試、真實 WebAudio、完整成果／保存 |
| `--lobby --mobile --stop` | 未完成活動退出全螢幕／返回大廳，不產生成果或 SQL 紀錄 |
| `--lobby --revoke` | 已載入候選撤回後卸載，零保存 |
| `--standalone --mobile` | 獨立手機 PWA 完整觸控、成果／唯一返回入口、零 Hub 保存與版本 scope cache |
| `--standalone --tablet --english --hard` | 英文平板 PWA、旋轉模式、圖表／明細／返回與版本快取 |
| `--standalone --wide --medium` | 桌機 PWA、真實圓形卡片活動與完整成果／返回 |

桌機／手機／平板 Hub 背景捲軸寬均為 0、iframe 左右邊距差 ≤1px；gameplay canvas 分別完整填滿 1320×713／390×844／820×1180，根頁無水平／垂直溢出。設定／成果保留必要內部捲動，返回後大廳 `overflow=visible` 並恢復原位置。音效關閉時實際 oscillator 數為零；開啟時有實際音訊輸出。原先在移動間隔 200ms 下的 CDP 點擊可能落在已移動卡片，fixture 改為實際指標重試並保留所有錯選數值，不暫停或改寫引擎／成績。

另通過既有 `test:game-architecture:browser` 全五項：未遷移 config／原生 fullscreen、未遷移共同成果 guest／登入保存、第三方卡片、手機點擊目標與四路由導覽。原 config fixture 改用仍未遷移的眼動練習、共同 score fixture 改用閱讀訓練，未放寬檢查。launcher 更新後，小行星護盾 `--standalone --mobile` 真實完整活動／PWA／設定與結果回歸通過。

本機截圖：[大廳卡片](migrations/moving-card/local/lobby-desktop-guest-wide-windowed/lobby.png)、[桌機設定](migrations/moving-card/local/lobby-desktop-guest-wide-windowed/settings.png)、[目標聚光燈](migrations/moving-card/local/lobby-desktop-guest-wide-windowed/tutorial-target.png)、[選項聚光燈](migrations/moving-card/local/lobby-desktop-guest-wide-windowed/tutorial-options.png)、[桌機視窗玩法](migrations/moving-card/local/lobby-desktop-guest-wide-windowed/gameplay.png)、[手機成果](migrations/moving-card/local/lobby-mobile-guest/results.png)、[手機分析](migrations/moving-card/local/lobby-mobile-guest/results-analysis.png)、[手機明細](migrations/moving-card/local/lobby-mobile-guest/results-details.png)、[平板確認](migrations/moving-card/local/lobby-tablet-guest/confirmation.png)、[英文恢復](migrations/moving-card/local/lobby-desktop-account-en/renderer-failure.png)、[英文 PWA](migrations/moving-card/local/standalone-tablet-guest-en/confirmation.png)。本機截圖不能作為新版正式站驗收證據。

## 當版核准、發布與正式驗收

擁有者於 2026-10-10 在本對話以「核准並git push」核准本候選精確 `version=2.0.0`／上述 `contentSha256`，授權發布與推送。依搬遷計畫第 7 節步驟 C／E，先部署相容 runner，再發布 R2，最後切換 Hub；正式驗收與收據完成後才標記遷移完成。

已先推送／部署相容 runner，核對英文 native launcher／Service Worker 與 Hub 舊設定 HTTP 200，保持當時正式 Hub 的舊 registry。再對同一五檔 candidate 執行 `node scripts/publish-official-game.mjs moving-card`，逐檔回讀及 SHA-256 通過後確認 current／官方歷史，最後才推送／部署含本版 registry 的 Hub，未提前切換。現行合併 Pages workflow 同時部署兩站，操作時必須用 runner-only 相容部署或拆開發布時序，不能先把尚未公開的遊戲登記到正式 Hub。

正式驗收已另直接讀真正 `/api/games`、session API 與 preview bytes，確認同 slug 唯一 current `2.0.0`、`presentation=game`、vision 分類、同版原圖與無 settingsUrl；session token 不寫入公開證據。核對穩定入口 302／no-store、版本 PWA 與五檔公開 bytes／CSP／Content-Type，再跑 `--remote --lobby`、`--remote --standalone` 及 `--production-hub --lobby --wide --windowed`／`--mobile`／`--tablet`，保存正式截圖、CI／兩站 deployment 與 `docs/releases/moving-card-2.0.0.json`。正式 browser 只攔 Hub API 至本機 SQLite，不建立虛構正式帳號／成果。全部正式證據與收據已完成，倉庫完成數更新為五款／35 款舊流程。

## 正式部署與瀏覽器證據

相容提交 `5660c037629bd13e101d613510655ef7043c3dd2` 的[七項 CI／兩站部署](https://github.com/ian030590/RehabTrainerHub/actions/runs/38054168901)先成功；runner deployment 為 [ae8039a5](https://ae8039a5.trainerhub-user-games.pages.dev)，Hub 當時仍可讀移動卡片舊設定。R2 發布於 `2026-10-10T13:07:28.173Z` 完成回讀，唯一 native 官方歷史為 `2.0.0`，未將舊 `1.0.0` 投稿列入 native 回退歷史。

遷移提交 `1339f196218a6a51992dae6bbfeaaf4efc4da3a3` 與測試時序修正 `bf87f3cbbb77a312c7c263576096e07e402a45f7` 的[七項 CI／兩站部署](https://github.com/ian030590/RehabTrainerHub/actions/runs/38055113478)全部成功。正式 Hub 為 [0527277d](https://0527277d.rehabtrainerhub.pages.dev)，runner 為 [f622830c](https://f622830c.trainerhub-user-games.pages.dev)，兩站均核對同一提交。真正 `/api/games` 的 moving-card 只有一筆，`2.0.0`／原圖摘要／vision 分類與 `presentation=game` 正確、無 settingsUrl；不指定版本 session HTTP 201 並固定核准摘要，token 不存入公開紀錄。五檔公開 bytes／Content-Type／CSP、穩定入口 302／no-store 與版本 PWA 通過，Hub 舊 JSON／JS／SW／manifest 皆 410／no-store。證據見 [production-verification.json](migrations/moving-card/production-verification.json)。

正式 browser 全九項通過：發布後 `--remote --lobby` 與三尺寸獨立 PWA；部署後真正 `--production-hub --lobby` 桌機視窗、手機 session 失敗重試、平板 medium、英文登入 hard／renderer 失敗恢復／音效開啟、手機停止。桌機 1320×713、手機 390×844、平板 820×1180 均驗證完整 canvas、捲軸占用 0、設定／確認／成績字級、三聚光燈、實際移動卡片及錯選重試。完整指令、執行時間與各情境截圖列於正式收據。全部帳號／成果與保存失敗情境只用本機 API／SQLite；正式 API 另直接核對，不建立虛構正式帳號或訓練紀錄。

正式截圖：[桌機聚光燈](migrations/moving-card/production/hub-desktop/tutorial-options.png)、[桌機視窗玩法](migrations/moving-card/production/hub-desktop/gameplay.png)、[手機成績](migrations/moving-card/production/hub-mobile/results.png)、[平板確認](migrations/moving-card/production/hub-tablet/confirmation.png)、[英文恢復](migrations/moving-card/production/hub-account-en/renderer-failure.png)、[英文 PWA 分析](migrations/moving-card/production/standalone-tablet-en/results-analysis.png)。

正式 `--production-hub --revoke` 嘗試未列為通過：該工具只改本機 bucket，但正式 Hub HEAD 健康檢查仍讀真實 runner，因此在未撤回的正式版本上逾時。未修改正式 R2 狀態；另重跑本機 `--lobby --revoke` 通過，iframe 卸載且零紀錄，保留既有安全斷言。

## 回退與第 11 節審查單

已只讀確認可恢復的原 Hub production deployment 為 [8dec36b4](https://8dec36b4.rehabtrainerhub.pages.dev)，完整 ID `8dec36b4-262d-4a6d-9834-6b348a94f215`，production commit `cd490d0397c201a8564a4a17781538949ebee334`；此 deployment 的 `/games/moving-card/`、`settings.json` 與原圖均 HTTP 200。原 runner production 為 [526d787b](https://526d787b.trainerhub-user-games.pages.dev)。只讀證據見 [rollback-baseline.json](migrations/moving-card/rollback-baseline.json)。這與本機原始碼基準 commit 分別記錄，未執行正式回退。

首次遷移沒有另一個已核准新格式回退版，不能用 `--activate-version 1.0.0` 切回舊 JSON。若新版正式驗收失敗，恢復上述 Hub deployment 的入口；若重建舊流程，從原始碼基準還原 moving-card、registry、catalog／依賴／lockfile 與 JSON，重跑 gate／build 並驗舊入口。相容 runner 可保留，訓練歷史不得刪除；R2 不可變檔案不得覆寫。官方撤回尚須計畫第 8 節的 owner R2 status 更新／回讀程序，本機 `--revoke` 通過不代表正式撤回已完成。

| 第 11 節欄位 | 狀態與證據 |
| --- | --- |
| 身份／舊流程、分類／原圖、原功能 | 已盤點；原 JSON、正式舊 catalog、兩尺寸舊設定、原圖摘要見上 |
| 獨立性／安全、使用者行為、UI 一致性、有效寬度／捲軸、成績 | 本機及正式 Hub／runner sandbox／Brave／截圖通過；正式證據與收據見下 |
| 保存／失敗、平台回歸 | 本機固定版本、guest／帳號、保存重試／並行冪等、session 失敗、撤回／digest 拒絕與七 gate 通過 |
| 當版核准 | 擁有者於本對話以「核准並git push」核准本候選精確版本／摘要，紀錄見 candidate.json |
| 正式公開 | R2 五檔 bytes／官方歷史／current、runner 先部署／Hub 後切換、七 CI／兩站部署、正式 API 與 browser 全數通過 |
| 回退／限制 | 舊部署／資產已只讀核對；首次新格式無另一回退版，未實際正式回退／撤回 |

尚未驗 Safari／iOS、實體手機／平板的觸控手感、尺量物理大小、長時間完整斷網、真人 Turnstile 與正式保存流程。人工驗收：用尺量自有校正線段，依三難度調整卡片／字母／移動間隔，桌機與實體手機各完整做 5 回合並刻意錯選；確認設定／聚光燈可用鍵盤與觸控操作，停止／返回退出全螢幕、不保存未完成活動；在離線與恢復網路後確認已安裝版本 scope、圖表與保存重試。這些未測項目不能宣稱已驗收。
