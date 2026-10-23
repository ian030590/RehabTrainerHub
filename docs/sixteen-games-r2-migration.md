# 16 款點擊與鍵盤遊戲 R2 搬遷審查單

狀態：**2026-10-23 已發布**。擁有者核准文末「發布候選」表列的精確 version／contentSha256 後親自執行發布，16 款 current 都是該表版本，正式 runner 逐檔驗證通過；推送部署後正式 Hub 目錄、工作階段 API 與舊 `settings.json` 410 都符合，正式站大廳桌面與手機英文版 32 次瀏覽器實測通過（`/api/*` 攔截到本機 SQLite，未建立正式紀錄）。各款紀錄見 `docs/releases/<gameId>-2.0.0.json`。16 款都寫成 R2 自包含套件（自有設定、聚光燈教學、成果與 i18n），版本都是 `2.0.0`。

範圍：擁有者要求依 `docs/r2-game-migration-plan.md` 搬遷剩餘遊戲，並像畫畫塔防一樣提供聚光燈說明；擁有者選擇「先搬 17 款」，舌頭動作訓練與有球必應因相機／麥克風輸入暫留舊流程。17 款中的 UFOV 尚未搬遷，原因見「UFOV」一節。

## 遊戲對照

| gameId | 名稱 | 分類 | 原本形式 |
| --- | --- | --- | --- |
| `tic-tac-toe` | 圈圈叉叉 | higher-cognition | Pixi 參考遊戲 |
| `connect4` | 四子棋 | higher-cognition | Pixi 參考遊戲 |
| `hex` | Hex 連線棋 | higher-cognition | Pixi 參考遊戲 |
| `dots-and-boxes` | 點格成盒 | higher-cognition | Pixi 參考遊戲 |
| `lights-out` | 熄燈解題 | higher-cognition | Pixi 參考遊戲 |
| `sliding-puzzle` | 滑塊拼圖 | higher-cognition | Pixi 參考遊戲 |
| `maze` | 迷宮 | higher-cognition | Pixi 參考遊戲 |
| `sudoku` | 數獨 | higher-cognition | Pixi 參考遊戲 |
| `memory-match` | 記憶配對 | memory | Pixi 參考遊戲 |
| `simon-says` | 順序記憶 | memory | Pixi 參考遊戲 |
| `whack-a-mole` | 目標點擊 | attention | Pixi 參考遊戲 |
| `minesweeper` | 踩地雷 | higher-cognition | canvas 遊戲 |
| `antisaccade` | 反向眼跳抑制（Antisaccade） | attention | ExpFactory jsPsych |
| `keep-track` | 類別記憶追蹤（Keep Track） | memory | ExpFactory jsPsych |
| `letter-memory` | 字母記憶更新（Letter Memory） | memory | ExpFactory jsPsych |
| `plus-minus` | 心算加減切換（Plus-Minus） | higher-cognition | ExpFactory jsPsych |

gameId、分類與中文名稱不變。英文名稱去掉多餘字尾：Antisaccade Task → Antisaccade、Keep Track Task → Keep Track、Letter Memory Task → Letter Memory、Plus-Minus Arithmetic Switching → Plus-Minus Arithmetic。舊的 `settings.json`／`score.json`／`public/runtime` 與共用 `OfficialGameShell` 依賴全部移除；四款 ExpFactory 遊戲搬遷後，`packages/ui` 的 `ExpFactoryGame` 已沒有遊戲使用，發布後連同 `expFactoryRuntime`、只檢查它的 `check-expfactory-originals.mjs` 與 `nativeInstructionTrainingFlow` 一起移除；原腳本裡 `toutour.css` 不得有漸層的檢查，改由 `check-tour.test.mjs` 在 `test:training-flow` 執行。

## 共同做法

與 21 款腦力練習相同（見 `docs/brain-training-r2-rewrite.md`）：

- 設定用遊戲自有原生 dialog，Enter 確認、Escape 返回；確認後先跑聚光燈教學，最後一次「開始訓練」才要求全螢幕。設定由容器保存，不讀寫 localStorage。
- 教學場景與執行畫面共用同一套版面，聚光燈照在真正的控制項位置；教學裡的控制項是不能操作的 `span` 複本，外觀與按鈕相同。
- 盤面類遊戲改用 DOM 盤面取代 Pixi／canvas，每格都是可用 Tab 到達的按鈕，手機上按鍵至少 44 px。
- 成果頁顯示主要數值、當次設定、可切換指標的逐回合圖表與明細、保存狀態與重試。summary 不超過 12 個數值欄位，練習題列在明細但不計入統計。
- 成果只走 Hub 交給 iframe 的私有 MessageChannel；iframe 維持 `sandbox="allow-scripts"`，不 fetch、不讀寫使用者資料。顏色全部用 CSS 變數。

## 行為差異

這些差異都有測試覆蓋，發布前請擁有者確認。

### 盤面與解題（8 款）

- **共通**：結束時最後盤面與結果文字停留 1.6 到 1.8 秒再進成果頁（原本直接跳成果；原 Hex 與點格成盒沒有停留，原四子棋平手立即結束）。點到不能下的位置會有失敗音效與說明文字。成果明細改為每一步一列，summary 新增 `draw`、`meanThinkMs` 與各遊戲的剩餘量（`boxes`、`lightsLeft`、`misplaced`、`shortestPath`、`distanceLeft`、`blanksLeft`）。時限改用 m:ss 倒數。
- **四子棋、Hex、點格成盒**：新配色（藍／鏽紅，取代原本黃／紅、藍／紅），兩方另有實心與環形的形狀差異，不只靠顏色。Hex 在直式螢幕旋轉 90 度；點格成盒的邊用菱形點擊區。
- **熄燈解題**：解開時不再重複播放成功音效。
- **滑塊拼圖**：洗牌後保證不是已完成狀態。
- **迷宮**：點自己所在的格子不再算錯；方向鍵盤一律顯示；新增螢幕報讀位置狀態。
- **數獨**：依規則判定，任何符合規則的填法都算完成；新增鍵盤數字輸入；summary 的錯誤改為「填滿但違反規則」的次數。

### 記憶配對、順序記憶、目標點擊、踩地雷

- **記憶配對**：DOM 卡片翻面；配對成功的卡片加上勾號，配錯有外框與文字；最後一對不再重複播放成功音效；明細每一步記錄 `thinkMs`；教學畫面示範一組已找到的卡片。
- **順序記憶**：色塊上加形狀與數字；新增數字鍵 1 到 4 作答；明細新增 `correctTaps`，summary 新增 `completed`、`maxLives`、`longestCorrect`、`targetLength`；失敗畫面停留 1.6 秒（原 420 ms）；機會次數改為下拉選單 1／3／5（原為滑桿）。
- **目標點擊**：DOM 盤面；反應時間從目標真正畫出的那一幀起算，點擊用 pointerdown 時間；新增方向鍵加 Enter 的鍵盤玩法；summary 新增 `bestMs`、`expired`、`wrongTaps`；命中與點錯有星號與叉號提示；結束停留 1.6 秒；未出現的目標完全藏在洞下。
- **踩地雷**：DOM 盤面取代 canvas；新增旗子計數與經過時間（仍無時限）；預設難度與盤面依原設定（中／中），新增聲音設定；踩到時顯示所有地雷並標出引爆格；明細每個動作一列，summary 新增 `moves`、`meanThinkMs`；放大盤面可用單指捲動，滑鼠滾輪縮放（沿用原本）；F 鍵插旗、方向鍵移動；點已插旗的格子會說明原因；最後一格不播成功音效；結束停留 1.6 秒。

### 四款 ExpFactory 作業

- **Antisaccade**：練習段改為設定（預設開啟，22 題），練習題答完顯示 800 ms 回饋，正式題沒有回饋（同原作業）；箭頭方向每 6 題平衡一次（原本用 `Math.round` 抽籤，比例偏成 25／50／25）；注視點 500 ms（原作業實際生效的長度）；提示出現期間的按鍵仍不計（同原作業）；練習題不計入統計；summary 新增 `correctResponseMs`、`wrong`、`misses`。答錯回饋寫出箭頭實際方向。
- **Keep Track**：原本要用英文自由輸入詞彙（中文介面也一樣），改為從每個目標類別的 5 個詞中點選；詞彙依介面語言顯示；正式段平均分到負荷 3／4／5（每種 rounds／3 段，同負荷相連）；練習段顯示正確答案，並改為可關閉的設定；summary 新增 `correctItems`、`requiredItems`、`itemAccuracy`。
- **Letter Memory**：用畫面上的 A 到 Z 鍵盤作答（實體鍵盤、Backspace、Enter 也可用），一定要輸入 4 個字母；字母串長度以 5／7／9／11 洗牌循環（原本每題隨機抽）；相鄰字母不重複；練習回饋顯示 2 秒，練習段改為設定。
- **Plus-Minus**：數字一個一個出現，用數字鍵盤作答，取代原本一次填完整張表單；每題時間從數字出現算到送出；保留原本三段順序（加 3、減 3、輪流）與 15 題照抄練習，練習題答完顯示 ✓ 或正確答案；明細新增 `number`、`response`，summary 新增三段各自平均時間與 `switchCostMs`（輪流段減去加、減兩段平均）。

## UFOV（尚未搬遷）

UFOV 只用點擊作答，但成果頁有三個下載按鈕（原始分數 CSV、統計成績 CSV、含滑鼠軌跡的 JSON）。R2 iframe 的 `sandbox="allow-scripts"` 不允許下載；目前唯一經 Hub 代為下載的通道（`csv-file`／`csv-download`）在 `selfContainedGame.js` 只開放給有 `eye-tracking` capability 的 `oculomotor-training`。依搬遷計畫第 7 節第 3 步，不相容的能力要先設計並經擁有者核准，遊戲在此之前留在舊流程。可選做法：

1. 把 Hub 代下載通道擴充給 UFOV（新的 capability，Hub 先部署，再發布遊戲）。
2. 暫留舊流程，與舌頭動作訓練、有球必應一起之後處理。
3. 搬遷時拿掉遊戲內下載，只保留存入 Hub 的數值紀錄（等於刪除既有功能，規範不建議）。

另外 UFOV 現有文案含「評估」「測驗」「Subtest」等字樣，搬遷時要一併改寫。

## 測試與驗證

- 每款各有 `scripts/check-<gameId>-game.test.mjs`（由 `check-self-contained-game.test.mjs` 引入），涵蓋設定範圍、規則、計分、成果欄位、套件自包含與私有通訊。
- 共用測試同步加入 16 款：UI、成果、設定記憶、音效、antislop、研究契約、目錄架構、middleware 410、training flow。
- `scripts/migrated-brain-r2-browser.mjs` 為每款寫了 Brave 實際操作流程：設定、全部聚光燈、真實鍵盤或觸控遊玩、成果與保存生命週期；四款 ExpFactory 作業另刻意答錯並核對練習回饋。每款都在獨立執行的桌機中文與手機英文通過，並在 Hub 大廳 `--lobby --signed-in` 與 `--lobby --mobile --english` 通過（32 次）。踩地雷的大廳流程第一次失敗：測試把鍵盤焦點寫死在中央格，但遊戲會把 Tab 停點留在最後操作的格子（正確行為），修正測試後通過。
- 七項 CI gate、`npm run test:training-flow` 與 `npm run test:seo` 在最後一次修改遊戲後通過；Hub 與 runner 重新建置通過。
- 16 款原始碼掃描沒有破折號與受限用語。
- 移除研究契約與架構測試裡只服務舊 ExpFactory 版本的分支。本機 `check-game-architecture-browser` 的舊流程範例改用仍未遷移的遊戲：Hub overlay 用有球必應，獨立入口的規則／返回設定流程用 UFOV；大廳卡片數由過時的 41 改為 51（50 款遊戲加一筆審核版本），7 項全部通過。

## 其他紀錄

- 教學裡的「停止」複本原本沒有邊框（基礎樣式只套用在 `button`），這批以 `span.btn` 規則修正並加上瀏覽器檢查。已發布的反應時間（`reaction-time`）有同樣問題，要修需要升版，這次沒有處理。
- 有球必應的獨立入口按「開始訓練」後沒有出現規則畫面（本機與正式站相同，這批沒有改動它的檔案），之後另查。
- 同步工具會把檔案與 `dist/index.html` 改名為 `[conflicted]`；建置、瀏覽器測試與發布前都先修復再重新建置。

## 發布候選

每款 5 個檔案。兩次重新建置的 digest 相同；發布工具會先重新建置，比對與下表一致才上傳並切換 current。

| gameId | version | contentSha256 | bytes |
| --- | --- | --- | --- |
| `tic-tac-toe` | `2.0.0` | `41a28238bb03254060a1dee9519256c2a9e4b4c5962246534d8249ffdbb787d7` | 592396 |
| `connect4` | `2.0.0` | `2950b0abd9198304bcb58e90b5a2ece1b73691400cd03a2ae34e6e0096b14587` | 611835 |
| `hex` | `2.0.0` | `9c5f589bde0d0c0b857cc1622462bdeab948f78d4849673796b4b0a6bd708d17` | 602115 |
| `dots-and-boxes` | `2.0.0` | `40a2aa34cc4ddad029b59b80037ac58b0737b47cce7405567e59fbc87fa7d278` | 600453 |
| `lights-out` | `2.0.0` | `0e81b9ffb30ca5536a630e5de8e635e90958fa185529e9b253a5522cbcb1beea` | 598640 |
| `sliding-puzzle` | `2.0.0` | `755feb1080ab8f58a4cda4264697f7d39e174fefdb3ac63c7798ab40b7e1498e` | 596836 |
| `maze` | `2.0.0` | `72eca38e7ec1b1693bf956f967a23195e03742312cb9ee902733a69810b7350c` | 593013 |
| `sudoku` | `2.0.0` | `14c8fdf53d19cd90ea41d1bedeedc7228ba7c81de1aacdf4a6dd204dbea9b439` | 597347 |
| `memory-match` | `2.0.0` | `a2647930d57893ecdb7da8d01f91ccd43dad97e947ec89119b5c8abd20e91e27` | 602408 |
| `simon-says` | `2.0.0` | `3a854c4ed63cf2fc4a4e38e88d7e7c82e753c068c7681f323280c63897f5f43a` | 593139 |
| `whack-a-mole` | `2.0.0` | `d1f899cf2042b290814921902688491637683a7bb9659e48b177094d74e11135` | 594393 |
| `minesweeper` | `2.0.0` | `b08efef066b9ab67eb06bf91cc202cab99f8ed33ca5ef536e0d16130dc585c58` | 603034 |
| `antisaccade` | `2.0.0` | `5787080e6693fbb84c1c577d52613bb09186cd11cd1b8c9ed6bd752d6c6795cc` | 594477 |
| `keep-track` | `2.0.0` | `7814d4aaf2584cbf58621b95ccf6e183f13c794efededec6129ae1399b352847` | 606286 |
| `letter-memory` | `2.0.0` | `3c87ecd817da46fbb44c3092184062d9489dd6548d00cd36d4308115fcfb9563` | 596437 |
| `plus-minus` | `2.0.0` | `7cdc052aa180b2aa7bcdba3224b7cd6278534d7fcba844644f9698a4e6f1c6df` | 602399 |

核准後的發布指令（擁有者執行；同步工具若改名檔案會先修復，逐款重新建置並比對上表，不一致就停止）：

```
node .tmp/brain-tools/publish-approved.mjs .tmp/brain-tools/batch16-candidates.txt
```
