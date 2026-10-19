# 哈特圖座標順序、Decoder 排版與中文字（2.0.4）

2026-10-19 擁有者要求三項修改：

1. 座標依一般慣例，第一個數字是欄、第二個數字是列（與 2.0.3 相反）。
2. Decoder 依語句排列，詞與詞之間保留空格，單字不會被切成兩行。
3. 增加中文字的哈特圖與 Decoder。

擁有者另外決定：中文模式放在設定裡（「解碼文字：英文字母／中文字」，預設英文字母，與介面語言無關，成果紀錄帶有此設定）；中文答案用輸入法打字，組字完成後才判斷。

## 變更

**座標**：輸入框顯示［欄,列］，例如［3,2］是從左邊數到第 3 欄、再往下數到第 2 列。螢幕報讀先念欄（「第 3 欄，第 2 列」／"Column 3, row 2"）。教學第二步改寫為新順序；第三步原本寫「重設字母」，與按鈕「重置字母」不一致，一併更正。字母表、座標資料與 `logic/hartChart.ts` 都沒有改（遷移測試固定其 SHA-256），只改顯示。

**Decoder 排版**：解碼器原本把每個字母與空格都當成可以各自換行的項目，長單字會從中間斷開。現在每個詞是一個不換行的群組，詞與詞之間是 14px 的空格（手機 10px，格子之間為 3px／2px）。格子寬度依最長的詞自動縮小（`container-type: inline-size` 與 `100cqi`），下限 28px；座標字級跟著縮小但不低於約 7.5px，讓「[10,10]」仍放得進格子。左右停靠時，若最長的詞在下限寬度仍放不下，解碼欄會加寬，最多到工作區的 55%。計算式由 `logic/decoderLayout.ts` 依各詞的格數、純文字字數與間距產生。

**中文字**：

- 設定新增「解碼文字」，`characterSet: 'english' | 'chinese'`，預設 `english`；舊版存下的設定沒有此欄位時會補上預設值。成果 `config` 因此多一個欄位，五項數值成果不變。
- `logic/hartChineseChart.ts`：13 句繁體中文日常句子，以詞分組（例如「下雨天／記得／帶／一把／雨傘」），內容不涉及治療或療效。字表 100 格：句子用到的每個字各放兩份，其餘由 78 個常用字填滿，同一列相鄰的字不重複；同一個 seed 一定產生同一張字表與同一組座標。要求字數超過句子長度時，和英文一樣重複句子。
- 中文輸入：組字中顯示注音但不算答案；組字完成（`compositionend`）後取最後一個中文字判斷，打錯可直接再打，不必先刪除。Safari 在組字完成後會再送一次相同文字，取消組字會留下原本的字，這兩種情況都不重複計算嘗試次數。沒有中文字的內容（例如英文字母）會清空該格。
- 中文字表與 Decoder 標記 `lang="zh-Hant"`，讓瀏覽器選繁體字形；中文字比拉丁字母寬，字表字級乘以 0.82 以留在格子內。
- 依模式調整的文字：要求解碼字母數／字數、重置字母／字表、預覽字母表／字表、Decoder 提示、QR 說明與教學三步。QR 第二螢幕網址在中文模式帶 `characters=chinese`。

## TDD

先寫測試並確認因功能未實作而失敗：

| 測試 | 修改前的失敗 |
| --- | --- |
| `check-hart-chart-migration.test.mjs` 預設值含 `characterSet`、中文字表／Decoder（字表可重現、全為漢字、句子用字都在表上、同列相鄰不重複、5／10／30 格數精確、詞界保留）、版本 `2.0.4` | 預設值缺 `characterSet`；找不到 `logic/hartChineseChart.ts`；版本仍為 `2.0.3` |
| `check-hart-chart-tutorial.test.mjs` 教學文案（［欄,列］與［3,2］範例、中文模式不出現「字母」、重置按鈕名稱一致）、輸入框 placeholder 為 `[欄,列]` 與朗讀標籤、Decoder 詞群組順序與空格、CSS 不換行規則、設定選項與確認摘要、輸入法組字 | 教學仍是［列,欄］；渲染時缺中文模組；其餘項目同時失敗 |
| `check-r2-settings-memory.test.mjs` 版本 | 仍為 `2.0.3` |

Brave fixture（`scripts/hart-chart-browser.mjs`）改為依 `[欄,列]` 讀座標、檢查朗讀標籤，新增 `--chinese`（以 CDP `Input.imeSetComposition`／`Input.insertText` 送出真正的組字事件：先打錯字再打對字），並在每次流程量測 Decoder：沒有詞被切成兩行、沒有詞超出 Decoder、沒有橫向捲動、格子 ≥27.5px、座標字級 ≥7px、詞間距大於格子間距。`--hard`（30 格）會連續按「重置字母」直到句子有 9 格以上的長單字，確保最難排的情況被測到。

## 驗收

本機 gate：`test:game-architecture` 322 項（含全部遊戲 TypeScript）、`test:naming`、`test:entrypoints` 通過；push `fd835611` 後 deploy workflow 的七項 gate 也通過（run 39273146102）。

本機 Brave（2.0.4 build，紀錄只寫本機 SQLite）13 項流程通過：

| 旗標 | 重點 |
| --- | --- |
| `--lobby`、`--lobby --hard` | 752×485 小視窗；30 格時 SANDCASTLE（10 格）在一行內，右側解碼欄由 316px 加寬到 369px，格子 29.4px |
| `--lobby --chinese --hard`、`--lobby --wide --chinese --hard`、`--lobby --tablet --chinese --hard` | 中文字表、組字（注音、先錯後對、游標跳格）、QR 第二螢幕同一張字表、成果 config 帶 `characterSet: 'chinese'` |
| `--lobby --mobile --hard`、`--lobby --mobile --chinese --hard` | 390×844 手機，SANDCASTLE 格子 31.4px，沒有橫向捲動 |
| `--lobby --wide --windowed --hard` | 1320×713 桌機，INTENTIONAL 在一行內，格子 33px |
| `--lobby --signed-in --english --chinese --hard`、`--lobby --signed-in --english --hard --small` | 英文介面搭配中文字；英文帳號流程 |
| `--standalone --tablet --english --small --hard`、`--standalone --mobile --chinese` | 獨立 PWA，不上傳成果 |

正式發布：擁有者確認精確 version／摘要後親自執行發布，`hart-chart@2.0.4` 五檔、659,003 bytes、`contentSha256: 751ea298b25c523cb9d0519f604de377e09d3c841039a2c3351154a74dcfde09`，與瀏覽器測過的 build 是同一份（bundle 檔名相同）。正式五檔 bytes 與本機一致、穩定入口 `302 /games/hart-chart/2.0.4/`、session 201、catalog 都指向 2.0.4。正式 Hub 桌機、手機、中文、英文登入加中文，以及正式獨立 PWA 手機中文與平板英文，共七項流程通過；`/api/*` 只導到本機 SQLite，沒有正式帳號或紀錄。見[正式收據](releases/hart-chart-2.0.4.json)。

回退：`node scripts/publish-official-game.mjs hart-chart --activate-version 2.0.3`（未執行）。2.0.3 沒有中文模式，存下的中文設定在那一版會改回預設值。

### 畫面

| 情境 | 截圖 |
| --- | --- |
| 桌機長單字 | [desktop-long-word](migrations/hart-chart-decoder-text/desktop-long-word.png) |
| 小視窗側邊停靠 | [small-window-side-dock-en](migrations/hart-chart-decoder-text/small-window-side-dock-en.png) |
| 手機長單字 | [mobile-long-word](migrations/hart-chart-decoder-text/mobile-long-word.png)、[正式](migrations/hart-chart-decoder-text/production-mobile-long-word.png) |
| 中文組字與提示 | [desktop-chinese-ime](migrations/hart-chart-decoder-text/desktop-chinese-ime.png) |
| 中文字表 | [手機](migrations/hart-chart-decoder-text/mobile-chinese.png)、[正式桌機](migrations/hart-chart-decoder-text/production-desktop-chinese.png) |
| 中文設定、成果、QR | [settings](migrations/hart-chart-decoder-text/chinese-settings.png)、[results](migrations/hart-chart-decoder-text/chinese-results.png)、[QR](migrations/hart-chart-decoder-text/tablet-chinese-qr.png) |

### 視覺交付檢查

- Hard Gate PASS：13 項本機與 7 項正式流程量測，沒有詞斷成兩行、沒有詞超出 Decoder、沒有橫向捲動；新增的 select 與輸入框可用鍵盤操作，3px 焦點外框保留（`check-antislop.test.mjs` 通過）；文案沒有 em dash，也沒有治療、診斷或療效用語。
- Purpose Gate PASS：沒有新增裝飾。詞間距用來分出詞、格子縮小用來讓長單字留在同一行、中文字級乘 0.82 讓字留在格子內，理由都寫在 CSS 註解。
- Liveliness PASS：沿用遊戲原本安靜易讀的方向（ENERGY 1／RHYTHM 1／MOTION 1），沿用既有顏色 token 與元件。
- Craftsmanship PASS：設定、教學、全螢幕、提示、停靠、縮放、QR、成果與保存重試都在每次流程中跑過。

### 限制

- 長單字把格子壓到 28px 時，座標字約 7.5 到 8.6px；一般情況仍是 10px。
- 寬度 320px 的手機沒有驗證；在那種螢幕上，最長的單字要在 Decoder 內左右捲動。
- 用簡體輸入法打出的字（例如「温」與「溫」）會被判錯。
- 組字是在 Brave 以 CDP 模擬；實體手機輸入法與 Safari 尚未驗證。已安裝的版本化 PWA 仍固定在原本的版本。
