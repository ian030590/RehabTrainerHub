# 探索掃視練習 1.0.0

`exploratory-saccade@1.0.0` 已完成自包含套件、catalog／module flow／R2 registry／workspace lockfile 登記與共用測試接線。這是本機候選，未發布 R2、切換 current、部署、commit 或 push，未建立正式帳號或紀錄。

## 來源與本作選擇

參考產品是 VISIOcoach；遊戲不使用其名稱、資產或 UI，不宣稱醫療效果。介面來源列為「Roth 等（2009）；Ivanov 等（2016、2018）」／「Roth et al. (2009); Ivanov et al. (2016, 2018)」。

| 來源 | 方法與採用範圍 |
| --- | --- |
| [Roth 等，2009，Neurology 72:324-331](https://www.neurology.org/doi/10.1212/01.wnl.0000341276.65721.f2) | 參考探索搜尋方法；不重製另一組閃爍刺激或推論本作效果。 |
| [Ivanov 等，2016，PLoS ONE e0157825](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0157825) | 數字／字母陣列、多個指定目標、滑鼠移入後發聲及變紅、中央按鈕開始下一個畫面、保存每目標與每個畫面時間。文獻描述 30cm 距離、水平 47.7 度、每日兩次 30 分鐘。本作保留搜尋、標記與計時，另加觸控及設定。 |
| [Ivanov 等，2018，PLoS ONE e0197285](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0197285) | 每個畫面 6 目標加 34 干擾、四象限平衡、約 60×40 度、15 分鐘。本作預設 40 個符號／6 目標／15 分鐘；距離按約水平 48 度換算，沒有照搬 60×40 度。 |

本作新增：目標數字逐個畫面更換且不連續重複、排除 I／O、畫面上限與漏找外框、僅累積搜尋時間、兩字寬間距、三字寬中央排除區、種子決定的位置、找到加底線、誤點統計。沒有眼動追蹤、前後測或問卷。

## 設定與畫面

| key | 可選值 | 預設 |
| --- | --- | --- |
| `practiceMinutes` | 5–30，每 5 分鐘 | 15 |
| `itemsPerScreen` | 20–60，每 10 個 | 40 |
| `targetsPerScreen` | 3–8，且小於符號總數 | 6 |
| `distractors` | mixed 數字與字母／letters 僅字母 | mixed |
| `symbolSizeDeg` | 1、1.5、2、2.5、3 度 | 1.5 |
| `screenTimeLimitSec` | 0（全部找到才換畫面）、30、60、90、120 秒 | 60 |
| `screenWidthCm` | 15–80，每 0.5 公分 | 30 |

所有數值驗證型別、範圍、步距。符號設定標示為「符號大小（視角度數）」／「Symbol size (degrees of visual angle)」。距離為 `round((screenWidthCm / 2) / tan(24°))`，30cm 寬得到約 34cm；設定與確認面板均顯示。字級為 `max(16, round(screen.width * tan(symbolSizeDeg / 2) / tan(24°)))` CSS px。

流程：設定 → inert 的實際 RunningView 聚光燈 → 確認與距離 → 原生全螢幕 → 中央開始鈕 → 搜尋 → 下一個畫面或成果。每個畫面的目標數字都會更換，每個畫面從中央開始；每個畫面先按中央的開始鈕，等待不計時。

滑鼠 pointerover／pointermove 可標記；任何指標的 pointerdown／click 可標記，目標只計一次。點按干擾計一次誤點，hover 不計；pointerdown 與其 click 共用 activation id 去重。符號 `tabIndex={-1}`，避免逐項 Tab 揭露位置；開始與停止仍可聚焦，Enter／Space 啟動，Escape 中止。

全部找到提示 600ms；逾時漏找外框 1500ms，期間不能補找，提示文字留在搜尋區外。僅搜尋時間扣除 session；用完後仍完成目前這個畫面。停止、Escape、pagehide、卸載取消計時與音訊，不保存中止成果。

每個點按區至少 44×44px；中心間距至少 `max(2 * symbolPx, 44)`，邊界至少 `max(symbolPx, 22)`，中央排除半徑 3 個字。目標四象限數量差最多 1，額外目標逐個畫面輪替；四個畫面累計相等，干擾亦平均分布。無足夠空間時提供調整設定／返回，不縮字或重疊。

初始全螢幕等待兩個 animation frame，若尺寸在第一個尚未開始的畫面仍改變，僅重建該準備畫面；搜尋開始後及已有成果的情況仍中止，以免混用座標尺度。每個畫面自行記錄其尺寸及符號尺度。

## 成果與保存

summary 恰有十二欄：`screens, targets, found, missed, falseClicks, meanTargetMs, meanScreenMs, leftFoundMs, rightFoundMs, leftMissed, rightMissed, searchSeconds`。meanTargetMs 是找到間隔平均，第一個由畫面出現起算；meanScreenMs 是全部找到的畫面平均時間。畫面平均時間只計全部找到的畫面，沒有完整畫面為 null；側別時間由畫面出現至找到，沒有觀察為 null。

rounds 每個目標一列、十一欄：`screen, target, side, quadrant, xDeg, yDeg, found, foundMs, intervalMs, order, screenFalseClicks`。側別 0 左／1 右，象限 0 左上起；漏找時間與順序為 null。`screenFalseClicks` 是該畫面誤點數，在該畫面每列重複，不可逐列加總。

視角以 `scale = 2 * tan(symbolSizeDeg / 2) / symbolPx` 回推，`xDeg = atan((x - 0.5) * fieldWidth * scale)`，y 同理，角度一位小數，向右／向下為正。時間統計一位小數。成果頁提供找到比例、目標間隔、漏找、畫面時間、左右比較、誤點與搜尋時間；ScoreAnalysis 預設 foundMs，含圖表、統計、缺值與分頁。保存失敗重試同一結果，一顆返回按鈕，config 保留當次七項設定。

練習時間的設定鍵名為 `practiceMinutes`。最初命名 `sessionMinutes` 時，Hub API 的敏感欄位檢查（鍵名含 session）會拒收，匿名清除也會刪除它；改名後七項設定都通過既有檢查，Hub API 不需修改。Node 測試以真實 API＋本機 SQLite 確認匿名保存保留完整七項 config、相同請求重試成功，且含 session、token、user 等字樣的鍵名仍被拒絕。

## 視覺理由與量測

Design read：Hub 居家練習畫面，沿用 R2 對話框，ENERGY 1／RHYTHM 1／MOTION 1。

| 決定 | 理由 |
| --- | --- |
| 白色無紋理搜尋區 | 額外裝飾也會是干擾。 |
| 系統粗體數字與字母 | 不下載字型，目標與干擾字重相同。 |
| 找到紅色加底線 | 保留來源回饋，並以形狀補充色彩。 |
| 漏找棕色外框 | 只在提示時標位置，搜尋時不揭露答案。 |
| 上方 HUD、中央開始 | 狀態可讀，搜尋每次從相同位置開始。 |
| 手機 HUD 換行 | 360px 寬仍可讀目標、時間與停止。 |
| 固定提示行 | 漏找符號不被文字遮住。 |
| 自有 R2 控制與圖表副本 | 保留一致操作，同時不依賴平台 UI。 |

`python C:/Users/ian/.claude/skills/antislop-human/contrast-check.py` 實測：正文 #202428／白 15.62:1；次要文字 #606970／白 5.60:1；找到 #a51d23／白 7.50:1；漏找外框 #925000／白 6.23:1；焦點環 #1d6fd1／白 4.95:1；控制邊框 #7d868e／白 3.70:1（非文字）。全部色碼在自有 CSS。

## 接線、預覽與 TDD

套件包含自有 React／Vite 入口、metadata、ExploratorySaccadeGame、RunningView、教學、i18n、settings、screens／screenRun／saccadeScore、score／ScoreAnalysis、runtime、CSS。沿用自有 Tone soundManager，另有 music.ts 可設定曲目與 running／退出清理，預設沒有背景音樂。

登記於 catalog、moduleFlowManifest（vision:exploratory-saccade、none、external-runtime-adapter）、officialGameReleases、lockfile；共用 UI／成果／設定／音訊／研究契約／流程／middleware 清單均接入。專用 `scripts/check-exploratory-saccade-game.test.mjs` 由 check-self-contained-game.test.mjs import，經 root test:game-architecture 進入 test:ci／pre-push。

`scripts/exploratory-saccade-r2-browser.mjs` 接入 brainGameSpecs，trainer／purpose 為 vision、phasePrefix 為 saccade。共用 harness 先以 Enter 確認，再返回設定、以確認鈕重開教學。原本 type=submit 在 allow-scripts 沙盒被擋，現改用與 popout 相同的 type=button 及明確 handler，沒有加入 allow-forms。原生全螢幕、觸控／移入、漏找外框、誤點去重、成果、保存失敗重試及返回皆由共用 driver 驗證。

瀏覽器 clock fixture 僅由 beforeStart 注入；暫包 performance.now／timeout，加速五分鐘搜尋，結束還原。第一個畫面全找到，後續每個畫面漏一個；產品無測試模式或隱藏設定。測試只寫本機資料庫與記憶體 bucket，沒有正式 API 或正式紀錄。

實拍 preview.webp 來自預設設定的正式搜尋，經共用 game-preview-capture.mjs 產生 640×360 WebP，1280×720 PNG 與 preview.json 保留在 `.tmp/game-preview-captures/exploratory-saccade/`；SHA 已加入 docs/game-preview-captures.json，已親自檢視。受限沙盒 Brave Page.enable 逾時，本機權限可執行；暫存 driver 不凍結瀏覽器時鐘以避開 screenshot 逾時。

最初遊戲實作前 16／16 失敗；登記前 18／20 通過、2 項因 registry／catalog 缺少失敗。本次先重現未登記、缺預覽及鍵盤／文案失敗，再完成登記。另保留以下先失敗後修正的證據：缺少 saccade-phase-menu；嚴格沙盒阻擋 submit；shared audio 缺少曲目設定生命週期；API 拒收含 session 的設定鍵名（改名為 practiceMinutes 解決）。以上 Node 與 browser 記錄在 `.tmp/codex/task-b-*.log`。

人工限制：尚未驗實體尺量／觀看距離、真人搜尋、實體相機、觸控板／觸控筆、Safari／iOS、正式部署與正式保存。手機是 Brave 觸控模擬；不把本機候選當作正式發行。

## 最終驗證

| 命令 | 結果 |
| --- | --- |
| `npm --prefix apps/rehabtrainerhub/games/exploratory-saccade run build` | 通過；自有 IIFE／jsPsych／Tone，保留既有 500kB 提示 |
| `node --test scripts/check-exploratory-saccade-game.test.mjs` | 23／23，含註冊、預覽、Tab、文案、API 接受全部設定鍵名與匿名保存／重試 |
| `node scripts/check-r2-game-browser.mjs --game exploratory-saccade --lobby` | 通過；真實移入、三步教學、完整搜尋、API 保存重試、七項 config、成果及返回 |
| `node scripts/check-r2-game-browser.mjs --game exploratory-saccade --lobby --mobile` | 通過；390px／觸控模擬，完整搜尋與保存 |
| `node scripts/check-r2-game-browser.mjs --game exploratory-saccade --standalone` | 通過；獨立 launcher／service worker scope、完整搜尋、0 次 Hub 保存 |
| `node scripts/check-r2-game-browser.mjs --game exploratory-saccade --lobby --stop` | 通過；0 筆保存、大廳捲動還原 |
| `node --test scripts/check-game-catalog-metadata.test.mjs` | 7／7，包含本款真實 gameplay 預覽與 SHA |
| `npm run build:hub` | 通過，55 個獨立遊戲與本款入口 |
| `npm run test:ci` | 七項 gate 全通過，含 TypeScript、1367 項架構測試、308 項 Hub functions、78 項 runner 及完整入口／部署檢查 |
| `node scripts/publish-official-game.mjs exploratory-saccade --dry-run` | 通過；1.0.0、5 檔，僅本機收據 |

最終 dry-run contentSha256：`57bac27304dc156f0bb00ba676919cbce70d5ad28d45b0e6ece4bbe11a1f4186`。共用 gates 及另外三款的精確結果見 `docs/visual-search-training.md`。遊戲內舊 smoke 與暫存目錄已在共用 harness 通過後移除。

擁有者核准後於 2026-11-04 發布 1.0.0 到 R2，收據為 `docs/releases/exploratory-saccade-1.0.0.json`。
