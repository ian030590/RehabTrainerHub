# 21 款腦力練習 R2 重寫審查單

狀態：**2026-10-22 已發布**。擁有者核准文末「發布候選」表列的精確 version／contentSha256 後親自執行發布，21 款 current 都是該表版本，正式 runner 逐檔驗證通過；推送部署後正式 Hub 目錄、工作階段 API 與舊子資產 410 都符合，正式站大廳桌面與手機英文版 42 次瀏覽器實測通過（`/api/*` 攔截到本機 SQLite，未建立正式紀錄）。各款紀錄見 `docs/releases/<gameId>-<version>.json`。21 款都寫成 R2 自包含套件（自有設定、聚光燈教學、成果與 i18n），既有 11 款升為 `2.0.0`，新的 10 款為 `1.0.0`。

來源：擁有者要求檢視 ADHD Focus Pro 訓練頁面（`/zh-Hant/training`）的 21 個練習模組並在本站重寫。只參考模組種類與一般作業規則，文字、圖片、程式都重新撰寫；不使用對方素材與品牌。對外文案遵守本站法規限制：只用「練習／活動／當次紀錄」，不宣稱治療、診斷、療效，也不提疾病名稱。

## 模組對照

| 參考模組 | 本站 gameId | 名稱 | 分類 | 類型 |
| --- | --- | --- | --- | --- |
| Stop-Signal | `stop-signal` | 煞車抑制反應（Stop-Signal） | attention | 既有遊戲重寫 |
| SART | `sart` | 持續注意反應（SART） | attention | 新遊戲 |
| 六角舒爾特 | `hex-schulte` | 六角舒爾特方格 | attention | 新遊戲 |
| N-Back | `n-back` | 工作記憶更新（N-back） | memory | 既有遊戲重寫 |
| Stroop | `stroop` | 色彩干擾抑制（Stroop） | attention | 既有遊戲重寫 |
| 舒爾特方格 | `schulte-grid` | 舒爾特方格 | attention | 新遊戲 |
| 反應時間 | `reaction-time` | 反應時間 | attention | 既有遊戲重寫 |
| 數字廣度 | `digit-span` | 數字廣度記憶（Digit Span） | memory | 既有遊戲重寫 |
| Go/No-Go | `go-nogo` | 通行與抑制反應（Go/No-go） | attention | 既有遊戲重寫 |
| CPT | `continuous-performance` | 連續表現作業（CPT） | attention | 新遊戲 |
| Flanker | `flanker` | 側翼干擾選擇（Flanker） | attention | 既有遊戲重寫 |
| Corsi 空間廣度 | `spatial-span` | 空間廣度記憶（Spatial Span） | memory | 既有遊戲重寫 |
| Simon | `simon-task` | Simon 作業 | attention | 新遊戲 |
| 任務切換 | `number-letter` | 數字字母切換（Number-Letter） | higher-cognition | 既有遊戲重寫 |
| 卡片分類（WCST 改編） | `card-sorting` | 卡片規則分類 | higher-cognition | 新遊戲 |
| 倫敦塔 | `tower-of-london` | 倫敦塔規劃（Tower of London） | higher-cognition | 既有遊戲重寫 |
| 注意力眨眼 | `attentional-blink` | 注意力眨眼 | attention | 新遊戲 |
| 時間感知 | `time-perception` | 時間感知 | higher-cognition | 新遊戲 |
| ANT | `attention-network-task` | 注意力網絡練習（ANT） | attention | 既有遊戲重寫 |
| 分配注意力 | `divided-attention` | 分配注意力 | attention | 新遊戲 |
| 圖形記憶 | `pattern-memory` | 圖形記憶 | memory | 新遊戲 |

既有 11 款保留原 gameId、分類與合規的中英文名稱說明；原本是 ExpFactory jsPsych 或 Pixi 參考遊戲，依 `docs/r2-game-migration-plan.md` 第 7 節改為自包含套件，舊的 `settings.json`／`score.json`／`public/runtime` 與共用 `OfficialGameShell` 依賴全部移除。

## 共同做法

- 設定用遊戲自有原生 dialog，Enter 確認、Escape 返回；確認後先跑聚光燈教學，最後一次「開始訓練」才要求全螢幕。設定由容器保存，不讀寫 localStorage。
- 執行畫面與教學場景共用同一套版面，聚光燈只照小元素，說明框不蓋住目標；手機寬度另有版面，按鍵至少 44 px。
- 成果頁顯示三項主要數值、當次設定、可切換指標的逐回合圖表與明細、保存狀態與重試。summary 不超過 12 個數值欄位，練習題列在明細但不計入統計。
- 成果只走 Hub 交給 iframe 的私有 MessageChannel；iframe 維持 `sandbox="allow-scripts"`，不 fetch、不讀寫使用者資料。
- 顏色全部用 CSS 變數，文字與背景對比都經計算達 4.5:1；紅綠等顏色訊號一律搭配文字。

## 既有遊戲的行為差異

這些差異都有測試覆蓋，發布前請擁有者確認：

- **Stroop**：保留原試次數、回應時限與練習段；練習段改為可在設定中關閉（Flanker、Go/No-go、Stop-signal、ANT、N-back 相同）。
- **Flanker**：預設改用箭頭刺激，原本的字母版本保留為設定選項。
- **Go/No-go**：保留原刺激時間與試次數。
- **Stop-signal**：說明改寫為圖形判斷；新增「顯示按鍵提示」選項；正式段兩種圖形數量平衡。
- **ANT**：名稱「注意力網絡測驗」改為「注意力網絡練習（ANT）」，移除「測驗」字樣。
- **N-back**：相同字母比例 20%，字母間空白 250 ms，練習段大小寫不分；每段開始前顯示規則。
- **Number-letter**：說明移除「測驗認知彈性」；新增練習段；畫面標出上半部看數字、下半部看字母，按鍵上寫出對應分類。
- **Digit span**：輸入的數字以方框顯示（原本不顯示）；答錯時顯示正確順序 2 秒；新增練習段；修正原本負荷 1 時錯誤次數不歸零的問題；焦點在數字鍵上按 Enter 也會送出。
- **Spatial span**：新增方格大小設定（預設 5 × 5，可選 3／4）；說明「九宮格」改為「方格」；答錯時在方格上標出正確順序；焦點在方格上按 Enter 也會送出。
- **Tower of London**：保留原 12 題、目標、起始盤面與每題 20 秒；每題前顯示「這題最少 N 步」，執行中也顯示已移動步數（原作業只要求用最少步數，沒有顯示數字）；點空柱子或滿的柱子會說明原因；新增「規劃時間」（題目出現到拿起第一顆球）。
- **Reaction time**：保留原等待區間（1.4–3.2／1.8–4.4／2.2–5.2 秒）、成功次數目標、時間限制與聲音回饋；改用 DOM 實作取代 Pixi，訊號出現時間以畫出綠色的那一幀計算；成果加上中位數、最快一次與標準差。

## 測試與驗證

- 每款各有 `scripts/check-<gameId>-game.test.mjs`（由 `check-self-contained-game.test.mjs` 引入），涵蓋設定範圍、試次規則、計分、成果欄位、套件自包含與私有通訊。
- 共用測試同步加入 21 款：UI、成果、設定記憶、音效、antislop、研究契約、目錄架構、middleware 410。
- `scripts/brain-r2-browser.mjs` 為每款寫了 Brave 實際操作流程：設定、全部聚光燈、真實鍵盤或觸控遊玩、成果與保存生命週期。每款都在獨立執行與 Hub 大廳（`--lobby --signed-in`、`--lobby --mobile --english`）通過，大廳 42 次全數通過；紀錄只寫本機 SQLite。
- 七項 CI gate 與 `npm run test:seo` 在最後一次修改後重跑通過；21 款原始碼掃描沒有破折號與受限用語；文字與背景色對比逐款計算，皆達 4.5:1。
- 移除舊 ExpFactory／參考遊戲測試中已不存在的分支；`check-game-architecture-browser` 的舊版範例改用仍未遷移的遊戲。

## 其他紀錄

- 開發期間曾發現 `reading-training/i18n/` 被刪除（非本工作造成），已用 `git checkout` 還原。
- 同步工具會把檔案改名為 `[conflicted]`；建置與瀏覽器測試都在同一個指令內先修復再執行。

## 發布候選

每款 5 個檔案。重新建置後 digest 不變；發布腳本會先重新建置，比對與下表一致才上傳並切換 current。

| gameId | version | contentSha256 |
| --- | --- | --- |
| `stop-signal` | `2.0.0` | `1f0350ff380a05c067f27c8ab60936788fd748e4d3129867e0871c533e6fc656` |
| `sart` | `1.0.0` | `2c221d165c7169fc05a36718d17e7e166c65acaf425ca6db51dac1ab5d63eb6e` |
| `hex-schulte` | `1.0.0` | `3d92ae8cc394ada98a6eab518c23d41b2955cbdf501c38d01f6de2d542429844` |
| `n-back` | `2.0.0` | `178fbb158365e95dc7fabeb0518e3666cff269c2c0a681b58f6a6650d48cdd3f` |
| `stroop` | `2.0.0` | `35af611d3df3b267c91c4e4c710315c9afda3469476a9d17416b0a8b92ed7500` |
| `schulte-grid` | `1.0.0` | `ce30439975f7b807965b1b83712524ec0f955c9aaaaaad42a2b55ce1f101408d` |
| `reaction-time` | `2.0.0` | `7ef512a0a684971b173ffeb4022b2a4f33de74289e531820376be71ea75bb9f5` |
| `digit-span` | `2.0.0` | `74344a97038a4a588f2af679d69218401778fdae8426d5f03348ac6dbe3ed3a5` |
| `go-nogo` | `2.0.0` | `5acceb5f09dcc5388e4d62f4202303621ed1e118a253a7a15d76b31c1dca3c56` |
| `continuous-performance` | `1.0.0` | `12e06189161040a2312ecca489f2ec9cba933dfafde872c3897e9c6155dd6c98` |
| `flanker` | `2.0.0` | `5912c200f53afd7ca9e998b960caae1cdc3a9e4877708d9b59332129b9f40f11` |
| `spatial-span` | `2.0.0` | `96e132f476f634e35f6d69ca2b1a5162526457804becf4d3a37a0a57fa840ed0` |
| `simon-task` | `1.0.0` | `9bcc15cc6e5913c0d47d2bbb8558c7c80a77fb8f9d1c75e198910d3b3611143e` |
| `number-letter` | `2.0.0` | `41b750e4cc68947a9bf6d05823bb157bc740607006d8821fbcbfd285d36c02c2` |
| `card-sorting` | `1.0.0` | `d7a6552de193753f546d7d037dadb69392d7f8fe117d5733601535d61fa15c84` |
| `tower-of-london` | `2.0.0` | `b4f980da59e419d1815c797f80e4d01b4b6d13310bb8b1e4aa9ace1c98fda3bf` |
| `attentional-blink` | `1.0.0` | `dab5e49f8610e29f6eb5333b1cb86b26fbe93d51f5c59fd5ccdc5af0c5eacd17` |
| `time-perception` | `1.0.0` | `a2bc4742f512f2981546d670854dafae8897cac957617ca7fbac46e332cbfff7` |
| `attention-network-task` | `2.0.0` | `563e8d9baadf99ceeae210b7a43fc5b182c44c9bc76ba1f008415cd71ce2e5cf` |
| `divided-attention` | `1.0.0` | `b17a194e8ecd3b5df6bf02d96d4fb3df34ee6a048cd8de6335a4821afe9d4608` |
| `pattern-memory` | `1.0.0` | `81d532e2882996e8746e3384437eaa1f4c4d63c197889f73a55c43e1c550e1b1` |
