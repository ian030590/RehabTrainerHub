# 蓋伯斑塊練習 R2 搬遷與發布

2026-10-17：擁有者以「也核准gabor-patching，請同步幫我上傳」核准既有 `gabor-patching@2.0.0` 精確摘要。已發布 R2／切換 current，正式 API、五個公開檔案、桌機／手機／平板／英文登入／獨立 PWA 驗收通過；正式為七款 R2、33 款舊流程。完整核准與證據見 [正式收據](releases/gabor-patching-2.0.0.json)及[驗證摘要](migrations/gabor-patching/validation-summary.json)。此次沒有變更產品程式、重新部署平台或建立正式訓練紀錄。

2026-10-13 的 A–D 本機候選與當時六款／34 款平台基準保留於下文；2026-10-17 完成 E／F，不能再把候選時的數量當作目前狀態。

2026-10-14 最後查核：dry-run 摘要維持相同，命名檢查通過；既有 Wrangler session 更新後，已唯讀取得正式 Hub／runner deployment 與舊 Gabor 回退產物，未執行發布或推送。

核准 `contentSha256`：`fe2dfb2d0edba20f2706a9aa638c8a1fc1daffd2531fe1c74a925049b2a2429a`。五個檔案共 1,157,718 bytes；完整逐檔清單見 [審查資料](migrations/gabor-patching/candidate.json)。`--dry-run` 的 `status: approved` 本身不是核准證據；本次另保留擁有者核准、實際上傳／回讀、正式公開 bytes 與流程結果。

## 原流程與保留內容

原碼基準：`51018eed98339cc14a9d58278e11f79db043ecd6`。原設定／數值成果保存在 [legacy fixture](../scripts/fixtures/gabor-patching-legacy.json)。[正式搬遷前核對](migrations/gabor-patching/production-baseline.json)確認 Hub 舊入口、設定、成績與圖片均 HTTP 200；公開 API 仍是 `official-gabor-patching@1.0.0`、`vision/general` 舊投稿，runner 穩定入口為 404。這份核對沒有建立工作階段或成果。

| 項目 | 保留的行為 |
| --- | --- |
| 難度 | easy／medium／hard 對應 beginner／intermediate／advanced；存續 4／3／2 秒，每幀生成機率 2%／5%／8% |
| 設定 | 預設 medium、60 秒、8 個刺激；時間 30–180 秒、步長 15；最大刺激數 3–20、步長 1 |
| 刺激 | 原 256px Gaussian／sine 演算法；頻率 0.05／0.08／0.03、角度 0／π/4／π/2、隨機旋轉與位置 |
| 呈現 | 灰背景；由 0.2 放大至 0.8，透明度由 0 增至 0.8；逾時移除、維持最大同時刺激數 |
| 計分 | `max(0, ceil(1000 × (1 − age / lifetime)))`，原總分、點擊目標數與設定時間毫秒值 |
| 輸入／完成 | 真正 Pixi pointerdown 接受滑鼠／觸控；倒數到期才完成；停止／Escape 取消並清理，不把未完成活動保存成完整時間 |
| 原圖 | `preview.webp` 原 bytes；SHA-256 `b9045dbfdb81944472874e73bee32f2594003337806d88390293e30ad4885de8` |

遊戲自有 `public/game.json` 使用原 catalog 的 `vision/vision` 分類、雙語名稱／描述與「居家訓練網」署名；同名舊投稿不得把新入口覆蓋成第三方 JSON shell。新增聲音開關預設開啟，採遊戲自有 Tone 15.1.22 回饋與空的背景譜面，沒有加歌曲或外連。

設定為前景原生 dialog，背景預先顯示正式 Gabor 圖樣與 HUD；確認設定後才開始三步聚光燈：斑塊 → 倒數 → 積分。教學使用遊戲本身產生的圖樣，遮罩／框線跟隨目標及 resize；支援下一步、略過、返回、Tab 焦點循環與 Escape。完成後同一套 UI 確認參數，再由最後的開始按鈕請求全螢幕，等待後才啟動計時。

成績前方保留三項原數值與當次設定，另記錄每個斑塊的圖樣、結局、出現／移除時間、點擊反應時間、得分與設定存續時間。只有實際點擊才有反應時間；逾時與結束時仍顯示的斑塊分別記錄，缺漏維持 null。新增時間以整數毫秒紀錄，積分仍以原高解析度時間計算。圖表／平均線、描述統計、資料完整率與 50 筆共同分頁都使用保存的同一份數值；不虛構命中率、視力或對比敏感度量測。

## 隔離與平台變更

- 遊戲移除 `@rehab-trainer/ui`、共用 shell／CSS／storage／auth／router 與兩份 JSON；設定、i18n、教學、Pixi 管理、音訊、結果及私有 bridge 均由本遊戲持有。沒有跨遊戲 import。
- 本機 registry 僅登記名稱／origin／資格，不固定版本。`sync:games` 與 lockfile 已同步；Hub build 僅留下導向 runner 的入口與相容原圖，沒有 Gabor bundle、設定／成績 JSON 或公共 trainer runtime。
- 依現有 `sandbox="allow-scripts"`／CSP 執行，維持 camera 禁止、`connect-src 'none'`、`worker-src 'none'`、`form-action 'none'`；不新增 runner 能力、binding、migration、secret 或權限。
- Hub 在載入前建立固定版本 session；私有 port 驗 parent source／origin、版本與 nonce，Hub 驗 sequence 與數值成果。保存失敗重試沿用原 session；遊戲不另存身份或紀錄。
- Gabor 的 API／SQL session、同 slug 目錄合併、metadata、middleware 舊資產阻擋、穩定入口、UI／結果／全螢幕／音訊及專屬 browser fixture 已納入原 gates。

## TDD 與本機驗收

| 先失敗情境 | 原因與修正／結果 |
| --- | --- |
| 自有設定、成果、教學、依賴與大廳 | 缺少本機模組、仍引用共用 UI；同 slug API 仍回舊投稿。自包含實作與 registry／目錄補齊後通過 |
| 教學目標與清理 | 尚無 tour；加入三個實際目標、resize／結束／略過／返回／dispose 清理與鍵盤測試 |
| 重複點擊／取消 | 原引擎沒有明確 abort；已移除斑塊仍可能被重複計分。加入有效目標檢查與 trial 清理 |
| 晚到的 renderer | display 卸載後仍有 listener；初始化前核對 display 並清理，取消不產生成果 |
| 退出全螢幕後 canvas | 舊 relative container 依賴平台 CSS 撐開；改成遊戲自有 absolute container，1320×713、390×844、820×1180 均填滿 viewport |
| 長紀錄 | 180 秒／240 Hz 模擬的浮點時間讓 3,488 筆成果超出容量；整數毫秒後，全部紀錄通過原 4,000 筆／450 KiB 邊界，沒有截斷或放寬驗證 |

七項本機 gate 通過：`test:naming`、`test:pwa`、`test:game-architecture`（171 項）、`test:hub-functions`（121 項）、`test:gamerunner`（48 項）、`test:entrypoints`、`test:cloudflare-deploy`。另外 Gabor build、Hub build（33 個舊遊戲）、`test:seo` 與 Publisher dry-run 通過。

`test:game-architecture` 新增 Gabor migration／tutorial 兩份測試；UI／結果／全螢幕／音訊沿用原 self-contained gate。兩份 workflow 保持既有七項 matrix 與相同命令，不新增 Brave CI 項目。

平台 Brave 回歸共七項：六項於完整命令通過；reading-training 共用成績項目一度未等到設定按鈕，原測試未修改，以 `node --test --test-name-pattern='Brave shows shared score' scripts/check-game-architecture-browser.test.mjs` 重跑通過。完整命令曾 exit 1，不能把該次稱為整批全綠；無產品變更用來迴避此失敗。

以下是專屬 Gabor 命令（前綴均為 `node scripts/check-r2-game-browser.mjs --game gabor-patching`），完整活動使用真實 30 秒，僅本機 SQLite 保存：

| 參數 | 結果 |
| --- | --- |
| `--lobby --wide --windowed` | 1320×713，easy，設定／聚光燈／滑鼠／退出全螢幕／結果／失敗重試／單筆保存／捲動還原通過 |
| `--lobby --mobile --medium --session-failure` | 390×844，medium，session 503 不提前載入；重試、觸控完整流程通過 |
| `--lobby --tablet --hard` | 820×1180，hard，完整流程與內部捲動通過 |
| `--lobby --signed-in --english --hard --sound-on --renderer-failure` | 英文登入、初始化失敗可見並重試、實際 WebAudio、帳號／Subject ID 隔離通過 |
| `--standalone --mobile --medium` | 390×844，獨立 PWA／嚴格 iframe／版本 scope 與素材快取／觸控／成績／返回通過，零 Hub 寫入 |
| `--standalone --tablet --hard --stop` | 停止活動並退出全螢幕，沒有完成成果或紀錄 |
| `--lobby --revoke` | 記憶體 fixture 撤回後卸載，不保存；沒有操作正式 R2 status |

最後兩項僅清理 fixture，前五項在最終摘要的產物重驗。每次保存均核對總點擊數／總積分等於逐斑塊明細；current 中途切換仍保存啟動前固定 session。Hub 背景捲軸寬 0、左右邊距誤差 ≤1px，根頁無水平／垂直溢出，返回恢復大廳位置。

桌機：[設定](migrations/gabor-patching/local/desktop-settings.png)、[聚光燈](migrations/gabor-patching/local/desktop-tutorial.png)、[成績](migrations/gabor-patching/local/desktop-results.png)。手機：[設定](migrations/gabor-patching/local/mobile-settings.png)、[聚光燈](migrations/gabor-patching/local/mobile-tutorial.png)、[成績明細](migrations/gabor-patching/local/mobile-details.png)。平板：[成績](migrations/gabor-patching/local/tablet-results.png)。獨立 PWA：[成績](migrations/gabor-patching/local/pwa-results.png)。

## 核准發布與正式驗收

發布前第一次 dry-run 因本機 `dist/index.html` 缺少而拒絕。從既有已審查原碼重新執行遊戲 build，五檔名稱、長度、逐檔 SHA-256 與整體摘要均與 10 月 13 日候選完全相同，才執行發布。沒有改動原碼、設定、閾值或安全檢查。上述候選 TDD RED／GREEN 保留；最新 [七項 CI](https://github.com/ian030590/RehabTrainerHub/actions/runs/39003626288)在 `f7a4350` 全部通過，包含 197 項架構、121 項 Hub functions、49 項 runner 測試及 Gabor 原有回歸。遊戲 build、Hub build（33 個舊遊戲）與 dry-run 通過。

發布前唯讀核對發現平台順序已不同於原計畫：先前 `main@9ae0561` 自動部署已帶入七款 registry，Gabor 舊資產已 410，唯缺核准 R2 current。此事在眼動 `2.1.1` 發布前已存在。本次先核對既有相容平台，再由單一發布者發布核准的五檔、回讀 SHA-256、approved manifest 與 current；沒有另部署或回退 Pages。Hub deployment 為 `4bdef687-cef7-4b92-a8cf-fa801f4ca6a2`，runner 為 `2af33d05-6648-4aef-b806-cbacef7e4266`，前後相同。批准後原有入口已能啟動 Gabor；舊 `settings.json` 維持 410，是遷移後的預期阻擋。

正式 `/api/games` 回傳七個 R2 遊戲，`gabor-patching` 只有一筆，分類 `vision/vision`、`presentation: game`、無 `settingsUrl`。不指定版本的 session 回 201，版本／摘要一致且 no-store；只驗證無狀態簽署，不記錄 token、recordId 或 Subject ID。五個 package 檔案與預覽圖的公開 bytes 全部核對，穩定 PWA 入口以 302／no-store 指向 `2.0.0`，仍使用 `sandbox="allow-scripts"` 與 camera 禁止；官方歷史只含新核准 `2.0.0`，沒有收編舊 `1.0.0` 投稿。眼動 current／摘要仍是 `2.1.1`。

以下命令前綴均為 `node scripts/check-r2-game-browser.mjs --game gabor-patching`。前五項使用正式資產、真正 30 秒活動，Hub 保存僅攔截至本機 SQLite：

| 參數 | 驗證結果 |
| --- | --- |
| `--production-hub --lobby --wide --windowed` | 桌機 1320×713：設定、三步教學、退出全螢幕後 canvas 滿版、成績／重試／單筆保存與捲動還原 |
| `--production-hub --lobby --mobile --medium --session-failure` | 手機 390×844：session 503 不提前載入，重試、觸控、數值與完整明細、保存 |
| `--production-hub --lobby --tablet --hard` | 平板 820×1180：hard、教學不擋目標、完整流程及內部捲動 |
| `--production-hub --lobby --signed-in --english --hard --sound-on --renderer-failure` | 英文／本機登入：可見初始化錯誤及重試、真實 WebAudio、身份隔離與保存 |
| `--remote --standalone --mobile --medium` | 手機 PWA：版本 scope、實際快取、觸控、數值與返回，零 Hub 寫入 |
| `--remote --standalone --tablet --hard --stop` | 正式 PWA：停止、退出全螢幕且無完成成果／保存 |
| `--lobby --revoke` | 本機 Hub／R2 fixture：撤回後卸載、顯示錯誤且零保存；沒有修改正式 R2 狀態 |

曾以 `--production-hub --lobby --revoke` 補驗，但該旗標只變動記憶體 fixture，正式 Hub 的 HEAD 仍讀取未撤回的正式 R2，因此等待卸載逾時（exit 1）。改以支援的本機 fixture 完成同一清理測試；未改產品或放寬斷言。失敗原因、通過命令、截圖與雜湊保存在 [validation-summary.json](migrations/gabor-patching/validation-summary.json)，不將該次失敗稱為正式撤回驗收。

## 回退與限制

這是首個 native 自包含 Gabor 發布，沒有另一個核准新格式回退版；不能用 `--activate-version 1.0.0` 切回舊 JSON 投稿。2026-10-14 保留的歷史 Hub [8a4e84e4](https://8a4e84e4.rehabtrainerhub.pages.dev) 與 runner [907e363d](https://907e363d.trainerhub-user-games.pages.dev) source commit 均為 `51018eed98339cc14a9d58278e11f79db043ecd6`。本次發布前重新核對該 Hub 快照的舊入口／設定／成績，均 200 且長度與 SHA-256 與[回退基準](migrations/gabor-patching/rollback-baseline.json)相同。若需回退，從原碼基準只還原 **Gabor workspace、registry、catalog、Hub 依賴、lockfile 與原兩份 JSON**，保留其他六款 R2（含眼動 `2.1.1`）、D1 歷史與不可變檔案，重跑 gates 後部署。不可直接將整個 Hub 回到舊快照而移除後續其他遊戲修正。相容 runner 可保留；未實際回退。

Brave 手機／平板為模擬，未做 Safari／iOS、實體觸控／小喇叭輸出或長時間完整離線訓練。PWA 驗證版本 scope 與實際快取，未宣稱離線硬體驗收。原生成機率仍按每幀計算，不同更新率／難度的活動條件應分開看待；紀錄只是當次活動數值。
