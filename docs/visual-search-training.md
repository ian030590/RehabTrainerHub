# 視覺搜尋練習

## 共用方法與範圍

本文件記錄 `popout-search@1.0.0`、`complex-search@1.0.0`（第 5 到 8 級）與 `conjunction-search@1.0.0`（第 9 到 12 級）的實作及本機驗收。此次沒有發布 R2、切換 current、部署、提交或推送，也沒有建立正式帳號或訓練紀錄。以下突顯目標的初次驗證紀錄保留為歷史；Task B 的最終結果列於文末。

來源為 Sahraie、Smania 與 Zihl（2016），[Use of NeuroEyeCoach to Improve Eye Movement Efficacy in Patients with Homonymous Visual Field Loss](https://doi.org/10.1155/2016/5186461)，BioMed Research International，Article ID 5186461，第 3 頁 2.2.2 節。遊戲與大廳使用中性活動名稱，介面僅列作者與年份，不使用來源產品商標或宣稱效果。

依來源採用：三類搜尋各四級；每級依序為 8、16、24 字三段；每段預設 200 題，恰有一半含目標；字形及目標分布於四象限；中央橘圈一直提供目標範例；兩鍵回答有／沒有；初始時限 1500 ms，重做放寬至 2000 ms，再次未通過則不限時；三段至少兩段正確率達 85% 才通過。觀看距離以螢幕左右各 20° 計算，字形從 1.4° 起以 0.1° 調至 1.8°。

本專案新增：每類的第四組字形、SVG 描線、500 ms 答題回饋、300 ms 間隔、自行決定何時繼續的段間休息，以及 20／50／100 題選項。自動記住下次等級／時限是擁有者決定，並非來源軟體規格。來源約每段 15 分、完整一級約 45 分為研究描述；介面預估時間依本遊戲的實際時序計算，不含休息。未實作來源的前後測、取消作業、O 與 T/L 搜尋或日常生活問卷。

## 突顯目標：第 1 到 4 級

| 內部等級／顯示等級 | 目標 | 干擾字形 | 來源 |
| --- | --- | --- | --- |
| 1／1 | X | O | 來源例子 |
| 2／2 | T | O | 來源例子 |
| 3／3 | H | C | 來源例子 |
| 4／4 | E | C | 本專案新增 |

四組刺激、SVG path、活動名稱／介紹及下一款指標集中於 `logic/levels.ts`；引擎依 `target`、`distractors`、`globalLevel` 運作，不判斷搜尋類型。字形採相同的 100 × 100 viewBox、8 單位描線與圓線端。未來兩色搜尋可使用同一引擎的 `ink`／`green`／`blue` 色彩 token；兩種干擾字形在各象限交錯，目標輪流替換其中一種。各遊戲仍須複製成自包含套件，不能跨遊戲引用。

### 設定與觀看距離

| 鍵 | 預設 | 可用值 |
| --- | --- | --- |
| `level` | 1 | 1、2、3、4；顯示全域級數與要找的字形 |
| `timeLimitMs` | 1500 | 1500、2000、0；0 表示不限時 |
| `trialsPerBlock` | 200 | 20、50、100、200 |
| `symbolSizeDeg` | 1.4 | 1.4 到 1.8，每 0.1 |
| `screenWidthCm` | 30 | 15 到 80，每 0.5 公分 |

遊戲嚴格拒絕錯誤型別、超出範圍及不在步距上的數值，僅容忍浮點運算的微小誤差。螢幕寬度量可見畫面左右邊緣，設定面板即時計算距離，最後確認面板再次醒目顯示。例如 30 公分對應約 41 公分觀看距離。

距離：`round((screenWidthCm / 2) / tan(20°))`。字形 CSS px：`max(16, round(screen.width * tan(symbolSizeDeg / 2) / tan(20°)))`。這是依量測與建議距離的換算，不是裝置校正；需實際量螢幕並依提示坐好。

### 生成與時序

一級有三段，順序固定為 8／16／24 字。每題各象限恰有四分之一的字；含目標題恰有一個目標，其餘為干擾。每段有目標／沒有目標各半，含目標題的四象限數量差最多一，左右差最多一。使用種子亂數，同種子／設定／畫面尺寸可重現相同序列。

字形中心距邊緣至少一個字形寬，中心間距至少 1.8 個字形寬，排除橘圈半徑再加一個字形寬的區域。隨機取樣不足時使用四象限鏡像、保留邊緣格子的微偏移網格；短筆電畫面另用交錯列網格，不放寬間距。位置保存為 0 到 1 的座標，在段落開始時以實際搜尋區大小配置。畫面改變時丟棄未完成段落，經「繼續」重做；已完成段落保留。全螢幕起始若仍在第一題準備期間，會自動重排。實際放不下時提示放大視窗或旋轉螢幕。

| 階段 | 時間與行為 |
| --- | --- |
| 準備 | 500 ms，只顯示中央目標範例 |
| 搜尋 | 顯示圈外字群；1500／2000 ms 或等到回答 |
| 回答 | F／左方向鍵／左按鈕＝有；J／右方向鍵／右按鈕＝沒有 |
| 回饋 | 500 ms，隱藏字群，以文字及正誤音效提示；超時算錯 |
| 間隔 | 300 ms 後開始下一題 |
| 段間休息 | 顯示正確率與是否達 85%，按繼續或聚焦後 Enter／Space 前往下一段 |

設定及教學保持視窗；最後一次開始點擊請求遊戲根節點全螢幕，等待版面穩定後啟動。Escape／停止取消整次活動而不保存部分成果，configure、pagehide、卸載會清理試次計時、jsPsych 生命週期與音訊。完成後離開全螢幕，再顯示成果與保存狀態。

### 計分與下次設定

各段正確率為答對／全部題數 × 100，顯示一位小數，85.0% 也通過；至少兩段通過才算這一級通過。超時記為錯且 RT 為 `null`。所有平均時間只納入正確回答；左／右比較只納入該側的正確有目標題。搜尋斜率用各段正確有目標題的平均 RT 對 8／16／24 字作最小平方法，至少要有兩段有效值；不足時為 `null`。

先以確認時設定呼叫 `SendGameResult`，再以 `NextSettings` 計算並送出 `SaveGameSettings`：

| 當次結果 | 下次設定 |
| --- | --- |
| 通過且未到第 4 級 | 升一級，恢復 1500 ms |
| 第 4 級通過 | 保留第 4 級，恢復 1500 ms，成果提示下一款「視覺搜尋：相似字形」 |
| 未通過、1500 ms | 同級、2000 ms |
| 未通過、2000 ms 或不限時 | 同級、不限時 |

題數、字形大小、螢幕寬度不變。結果明列下次等級與時限，使用者仍可修改。設定儲存交由 Hub／獨立 launcher 經私有 MessageChannel 處理，遊戲不直接存取裝置儲存或網路。成果保存失敗可重試相同結果，避免重算或再次進階。

### 紀錄欄位

`config` 是當次確認的完整五項設定。summary 恰有十二個數值或 `null` 欄位：

| 欄位 | 意義 |
| --- | --- |
| `level` | 全域等級 1 到 12 |
| `passed`、`blocksPassed` | 整級通過 0／1、通過段數 |
| `accuracy8`、`accuracy16`、`accuracy24` | 各段正確率 |
| `accuracy` | 全部三段正確率 |
| `presentRtMs`、`absentRtMs` | 正確有目標／無目標題的平均時間 |
| `slopeMsPerItem` | 每增加一字的平均 RT 斜率，ms／字 |
| `leftRtMs`、`rightRtMs` | 左側／右側有目標題的正確平均 RT |

rounds 每題一列，十欄：`trial, block, setSize, present, targetSide, targetQuadrant, response, correct, rtMs, timeLimitMs`。序號從 1 起；`present`／`correct` 為 0／1；側別 0 左／1 右；象限 0 左上／1 右上／2 左下／3 右下；無目標時側別與象限為 `null`；回答 1 有／0 沒有／`null` 超時。rounds 與 summary 都通過正式數值結果驗證。

成果頁有通過規則、整體正確率、有目標平均時間、各段表格、左右比較、斜率說明與下次設定。`ScoreAnalysis` 預設 `rtMs`，提供其他欄位切換、平均／中位數／樣本標準差／範圍、圖表、缺值與每頁 50 列明細，含保存狀態、重試與一顆返回按鈕。

### 設計與可及性

Design read：Hub 居家使用者的練習畫面，沿用 R2 設定、教學與成果對話框；ENERGY 1／RHYTHM 1／MOTION 1。

- 白色搜尋區：額外圖案也會成為干擾，因此不加紋理、裝飾或背景動畫。
- 橘色中央圈：表示持續可查閱的目標範例，與圈外搜尋項目分開。
- 固定 SVG 描線：避免系統字型或裝置造成字形差異。
- 系統字型、深色正文與既有 R2 間距：保持對話框、兩種語言及長設定的閱讀方式一致。
- 底部並排作答鈕：左右映射固定，至少 44 px，顯示文字與鍵盤提示；HUD 停止鈕保持原位置。
- 正誤文字搭配顏色及音效：關閉音訊或無法分辨顏色時仍可讀取結果。
- 段間繼續鈕自動聚焦、對話框焦點循環、可見 focus outline：支援鍵盤操作並避免焦點落入背景。
- 設定與成果可垂直捲動，資料表獨立水平捲動：手機頁面不產生整頁橫向溢出。

以 `python C:/Users/ian/.claude/skills/antislop-human/contrast-check.py` 計算：

| 前景／背景 | 比值 | 用途 |
| --- | --- | --- |
| `#202428`／`#ffffff` | 15.62:1 | 正文與字形 |
| `#606970`／`#ffffff` | 5.60:1 | 次要文字 |
| `#606970`／`#f6f7f9` | 5.22:1 | 按鈕鍵位提示 |
| `#ad4e00`／`#ffffff` | 5.43:1 | 橘圈 |
| `#17613b`／`#ffffff` | 7.47:1 | 正確提示與綠色字形 |
| `#1558a6`／`#ffffff` | 7.05:1 | 後續兩色字形 |
| `#ffffff`／`#005eb8` | 6.38:1 | 主要按鈕 |
| `#ba1a1a`／`#ffffff` | 6.46:1 | 錯誤文字 |
| `#7d868e`／`#ffffff` | 3.70:1 | 控制邊框，達非文字 3:1 |

### 檔案與驗證

套件內：`PopoutSearchGame.tsx`、`settings.ts`、`score.ts`、`scoreStatistics.ts`、`ScoreAnalysis.tsx`、`Glyph.tsx`、`logic/{levels,layout,searchTrials,searchScore,trialRun}.ts`、`rules/{PopoutSearchTutorial.tsx,tutorialSteps.ts}`、`i18n/`、`runtime/`、`music.ts`、三份 CSS、Vite／React 入口、package.json、public/game.json 與實際遊戲擷取的 preview.webp。

平台接線：catalog、moduleFlowManifest、officialGameReleases、workspace lockfile；既有 UI、成果、設定記憶、音訊、研究契約、antislop、流程、嵌入結果、建置及 middleware 清單／檢查。目錄架構檢查直接讀 registry，不需新增靜態清單。舊固定 51 款檢查改為精確比對 registry。

專用 `scripts/check-popout-search-game.test.mjs` 經 `check-self-contained-game.test.mjs` 接入 root `test:game-architecture`，因此也由 `test:ci`／pre-push 執行。瀏覽器規格放在 `brain-r2-browser.mjs`；dispatcher 支援規格宣告 `trainer`、`purpose` 與 `phasePrefix`，其他遊戲預設仍為 brain 及原本 id。使用真實鍵盤／觸控作答 60 題，刻意答錯一題及超時一題，驗證三段、休息、成果、當次 config 與保存重試。

TDD：最初 13 項測試全因尚無設定、刺激、計分、元件或套件檔而失敗。完成後 13／13 通過。實際瀏覽器另重現備援網格丟失邊緣格子；新增 768 × 432、720 × 420、720 × 317、358 × 620、每尺寸 20 種種子的回歸測試，先以 `Search field is too small` 失敗，修正後 14／14 通過。全螢幕起始另等待兩個 animation frame，resize 只在搜尋區尺寸實際變更時重做該段。桌機瀏覽器重現晚到的全螢幕 resize 後，再修正第一題準備期間的自動重排，完整桌機局通過。i18n 標題改為讀取 levels 資料，測試先失敗後通過；包裝共用 helper 允許提供資料模組的標題，既有遊戲的字面值檢查保持原樣。

| 命令 | 結果 |
| --- | --- |
| `npm run prepare` | 通過；`git config --local core.hooksPath`＝`.githooks` |
| `npm install --package-lock-only --ignore-scripts` | 通過；保留 npm 同時加入的 exploratory-saccade workspace／link 兩項，未手寫 lockfile |
| `npm run sync:games` | 52 款，已同步，無其他 workspace 改動 |
| `npm --prefix apps/rehabtrainerhub/games/popout-search run build` | 通過，1037 modules；自包含 JS 約 577.54 kB，Vite 提示超過 500 kB |
| `node --test scripts/check-popout-search-game.test.mjs` | 14／14 |
| `npm run test:naming` | 2／2，identifier check 通過 |
| `npm run test:game-architecture` | tsc 通過；1270／1272，兩項 exploratory-saccade 相關失敗，見下文 |
| `npm run test:entrypoints` | 入口／storage／WebGazer／flow／i18n 及測試組 95、18、15、9、6 均通過；embedded 組 8／10，兩項 exploratory-saccade 相關失敗 |
| `npm run test:hub-functions` | 307／308，一項 exploratory-saccade 相關失敗 |
| `npm run test:gamerunner` | 78／78 |
| `npm run test:entrypoints` | 全部通過；測試組 95、18、15、9、6、10、29 項，另有 entrypoint／storage／WebGazer／flow／i18n／樣式檢查 |
| `npm run test:cloudflare-deploy` | 靜態部署檢查及 46／46 通過，沒有執行部署 |
| `npm run test:ci` | 七項 gate 全數通過，exit 0；最終 log：`.tmp/codex/task-b-test-ci-final2.log` |
| `npm run test:driving-rehab` | 29／29；另補跑被 embedded 失敗截斷的後續項目 |
| `npm run test:training-config-styles` | 通過 |
| `node --test scripts/check-game-catalog-metadata.test.mjs` | 7／7，包含真實預覽圖及摘要核對 |
| `node scripts/check-r2-game-browser.mjs --game popout-search --lobby` | 通過：鍵盤、3 個 spotlight、60 題、2 次休息、刻意錯答／超時、保存重試、config、下次設定與返回 |
| `node scripts/check-r2-game-browser.mjs --game popout-search --lobby --mobile` | 通過，390 px 與觸控模擬；包含同一組保存與進階驗證 |
| `node scripts/check-r2-game-browser.mjs --game popout-search --standalone` | 通過，獨立 launcher／service worker scope、60 題與下次設定；0 次 Hub 成果保存 |
| `node scripts/check-r2-game-browser.mjs --game popout-search --lobby --stop` | 通過，停止後 0 筆保存並還原大廳捲動 |
| `node scripts/publish-official-game.mjs popout-search --dry-run` | 通過，1.0.0、5 檔，僅本機驗證與暫存收據 |

最終 dry-run contentSha256：`e3e6ef88b9d31572a2bdc64bfe56db93177d7e79d5a91c1e44ed64d0e338c7bf`。發布收據見 `docs/releases/popout-search-1.0.0.json`。

受限模式的 Vite／runner esbuild 曾因祖先目錄無權讀取而失敗，Brave 曾在 `Page.enable` 逾時；允許本機執行後，上表建置、runner 及三種 browser 流程均成功。實際預覽由本機 `.tmp/codex/popout-preview.mjs` 開啟建置後遊戲、完成教學並開始正式試次擷取，保留 `.tmp/popout-preview.png`，輸出 640 × 360 WebP 與 `docs/game-preview-captures.json` 的原始／預覽 SHA。已檢視桌機原圖及手機 gameplay、確認與成果圖；沒有用示意圖替代。

額外 Stop 檢查首次與 Hub build 同時執行，遇到建置清理中的 `out/index.html` 而逾時；等待建置完成後單獨重跑即通過。

平行工作隔離：未修改或註冊 exploratory-saccade。它尚未登記的資料夾造成 `catalog and game roots retain one exact settings definition per official game` 失敗；它的新測試尚未接入 gate，造成 `every test file runs in pre-push except the documented optional suites` 失敗。entrypoints 的 research contract／embedded score contract 也因同一個資料夾與 registry 不一致而失敗；Hub functions 的 `D1 score payload is bounded, numeric, and tied to its game` 嘗試讀取該遊戲不存在的舊 `settings.json`，因此失敗。最初 tsc 的該遊戲兩項 i18n 匯出錯誤，在平行工作後已消失，最後 tsc 通過。額外 Hub build 已完成 Next 編譯與靜態輸出，但 built architecture 精確目錄比對同樣被該資料夾阻擋；本機 browser 使用這份輸出驗證新增大廳卡片。沒有為避開它而放寬任何檢查。

最終未發現 `conflicted` 複本；原有 browser fixture 修改保持。所有瀏覽器與資料庫 fixture 僅在本機；硬體尺量、真人觀看距離、實體觸控、Safari／iOS 仍需人工確認。人工步驟：量可見螢幕寬度、依確認面板距離坐好，確認 1.4° 到 1.8° 字形均可辨識；用實體觸控完成一級；作答中旋轉螢幕後重做該段；以 Escape／停止確認不保存未完成活動。

## 相似字形：第 5 到 8 級

`complex-search@1.0.0` 從已審查的 popout 套件複製成自包含 workspace。沒有跨遊戲 import；設定、試次生成、備援配置、時間、計分、教學、全螢幕、私有 bridge、保存重試及分析皆保留相同流程。主要差異是目標與干擾字形相近。

| 設定 level／顯示及 summary level | 目標 | 干擾 | 來源 |
| --- | --- | --- | --- |
| 1／5 | S | C | 來源例子 |
| 2／6 | O | G | 來源例子 |
| 3／7 | B | D | 來源例子 |
| 4／8 | P | R | 本專案新增 |

全部使用自有 SVG 描線，沿用 100×100 viewBox、8 單位描線與圓線端，不依賴系統字型。S/C、O/G、B/D、P/R 各保留識別該字形的曲線與筆畫；不使用旋轉或鏡像代替另一個字。正文／字形 `--search-ink: #202428` 對 `--search-field: #fff` 為 15.62:1。

第四級通過後仍保存內部 level 4 及 1500ms，成果指向下一款「視覺搜尋：顏色與字形」。其他進階及未通過分支與 popout 一致；summary 依資料換成全域 5–8，config 的 level 保持 1–4。

視覺選擇沿用 ENERGY 1／RHYTHM 1／MOTION 1：白色場地避免額外干擾；橘色中央圈保留隨時可對照的範例；相同字形尺寸與筆畫讓等級差異來自搜尋內容。沒有新增裝飾、動態或控制方式。

專用測試 `scripts/check-complex-search-game.test.mjs` 複製並改編 popout 的全部檢查，另鎖定精確四級刺激、全域成果級數、核准文案與 vision 瀏覽器規格。實作前因遊戲資料夾與模組不存在而失敗，並保留 `.tmp/codex/task-b-red.log`。

## 顏色與字形：第 9 到 12 級

`conjunction-search@1.0.0` 也從 popout 複製完整遊戲；中央圈顯示綠色目標。圈外必須同時符合字形及綠色才算目標。兩種干擾分別只符合字形或只符合顏色。

| 設定 level／顯示及 summary level | 綠色目標 | 藍色干擾 | 綠色干擾 | 來源 |
| --- | --- | --- | --- | --- |
| 1／9 | X | X | R | 來源例子 |
| 2／10 | b | b | p | 來源例子 |
| 3／11 | T | T | 倒 T | 來源例子 |
| 4／12 | d | d | b | 本專案新增 |

字形轉換使用同一份基底 path：倒 T 是 `rotate(180 50 50)`；p 是 b 的 `translate(0 100) scale(1 -1)`；d 是 b 的 `translate(100 0) scale(-1 1)`。X、R 自有描線。選項以兩種語言明列顏色與字形，倒 T 不顯示內部代號 `upsideDownT`。教學同時呈現兩種干擾，並說明必須同色同形。

每題每象限放 setSize/4 個項目，兩種干擾各 setSize/8 個。含目標時只在目標象限替換一個干擾，輪流替換藍色與綠色，因此該象限兩類數量差 1，其他象限相等；每段累計差最多 1。20／50／100／200 題、四級、三段均以種子測試精確核對，包含每題每象限及每段總數。目標象限／左右平衡與位置安全距離的 popout 測試也完整保留。

| 自有 CSS token／場地 | contrast-check.py 實測 | HSL 色相 |
| --- | --- | --- |
| `--search-green: #17613b`／白色 | 7.47:1 | 149.19° |
| `--search-blue: #1558a6`／白色 | 7.05:1 | 212.28° |

兩色的色相相差約 63.09°，且兩者均超過 4.5:1。深綠／深藍用來區分刺激類型，白色場地及橘色範例圈維持原搜尋結構；已在真實 gameplay 預覽檢視兩色及字形。這項檢視不代表已驗證所有色覺差異的可辨識度。

第四級通過後保留內部 level 4、1500ms，成果顯示「十二級視覺搜尋已完成」，沒有下一款指標。summary level 為 9–12，config level 為 1–4；其他結果與設定保存流程不變。

專用測試 `scripts/check-conjunction-search-game.test.mjs` 保留 popout 全部檢查，再加入精確刺激、三個基底轉換、綠色中央目標、兩色 token、每題每象限／每段干擾平衡及教學兩色示例。新增教學測試先以 18／19 通過、缺少第二類干擾及顏色說明失敗，修正後全通過。

## Task B 接線與回歸

三款搜尋的 `public/game.json` 與 `logic/levels.ts` description 均改為 lead 指定的中英文文案。實際 UI 的中央範例確實在橘色圓圈內，文案與畫面一致。popout 仍是尚未發布的 1.0.0；未增版本。

complex、conjunction、exploratory-saccade 一起接入 catalog、vision module flow、officialGameReleases、lockfile 及原有共用 UI／成果／音訊／設定記憶／研究契約／流程／middleware 檢查清單。所有專用測試由 `check-self-contained-game.test.mjs` import，經 `test:game-architecture` 進入 `test:ci`；沒有新增 CI matrix，也沒有略過原本檢查。`npm run sync:games` 核對 55 款已同步。

相似字形與顏色字形的瀏覽器 spec 各自位於 `scripts/complex-search-r2-browser.mjs`、`scripts/conjunction-search-r2-browser.mjs`，再由 `brainGameSpecs` 註冊。複製 popout 的 60 題真實作答、三段、休息、錯答／超時、結果與自動下一級設定驗證，並核對 summary 全域級數為 5 或 9。掃視另接入既有的 `exploratory-saccade-r2-browser.mjs`。

TDD 初跑合計 70 項中 32 通過、38 失敗：新遊戲不存在、掃視未註冊、核准文案及 Tab 修正尚未實作。新增套件與登記後只剩三個實拍預覽缺檔；完成擷取後均通過。後續瀏覽器另外抓到掃視原生 submit 在嚴格沙盒受阻，以及原設定鍵名 `sessionMinutes` 含 session 被 API 拒收（已改名為 `practiceMinutes`，API 不變），詳見 `docs/exploratory-saccade.md`；未增加沙盒權限。

新三款的預覽使用 `.tmp/codex/task-b-preview.mjs` 啟動實際建置後的遊戲，經設定、教學、原生全螢幕後在正式搜尋中擷取。共用 `scripts/game-preview-capture.mjs` 負責 640×360 WebP 及原圖／預覽 SHA，並加入 `docs/game-preview-captures.json`。三張均已逐張檢視。Brave 在受限沙盒 `Page.enable` 逾時，允許本機執行後可啟動；虛擬時間暫停曾使截圖逾時，因此暫存 driver 不凍結時鐘，保持真實 gameplay 直接擷取。產品與共用截圖工具沒有加入測試模式或繞過驗證。

### Task B 最終結果

| 命令 | 結果 |
| --- | --- |
| `npm --prefix apps/rehabtrainerhub/games/popout-search run build` | 通過；1.0.0，核准文案已納入 |
| `npm --prefix apps/rehabtrainerhub/games/complex-search run build` | 通過；1.0.0 |
| `npm --prefix apps/rehabtrainerhub/games/conjunction-search run build` | 通過；1.0.0 |
| `npm --prefix apps/rehabtrainerhub/games/exploratory-saccade run build` | 通過；1.0.0 |
| `node --test scripts/check-popout-search-game.test.mjs` | 15／15 |
| `node --test scripts/check-complex-search-game.test.mjs` | 16／16 |
| `node --test scripts/check-conjunction-search-game.test.mjs` | 19／19 |
| `node --test scripts/check-exploratory-saccade-game.test.mjs` | 23／23 |
| `node --test scripts/check-game-catalog-metadata.test.mjs` | 7／7，含全部真實預覽及 SHA |
| `node --test scripts/check-r2-game-ui.test.mjs scripts/check-r2-game-results.test.mjs` | 270／270 |
| `npm run test:naming` | 2／2，identifier check 通過 |
| `npm run test:pwa` | 靜態資產檢查及 3／3 navigation 通過 |
| `npm run test:game-architecture` | TypeScript 及 1367／1367 通過 |
| `npm run test:hub-functions` | 308／308 |
| `npm run test:gamerunner` | 78／78 |
| `npm run build:hub` | 通過；55 個獨立遊戲、PWA／built architecture／SEO 通過 |
| `npm run prepare` | 通過；core.hooksPath＝.githooks |
| `npm install --package-lock-only --ignore-scripts --offline` | 通過，新增 workspace／link，未新增依賴 |
| `npm run sync:games` | 55 款，已同步 |

四款建置均保留既有 Vite bundle 大於 500kB 的提示。初次受限模式的 esbuild 拒讀祖先目錄，本機權限重跑通過；沒有調高限制來隱藏提示或略過檢查。

每一列均執行 `node scripts/check-r2-game-browser.mjs --game <gameId>`，後接表頭旗標：

| gameId | `--lobby` | `--lobby --mobile` | `--standalone` |
| --- | --- | --- | --- |
| popout-search | 通過 | 通過 | 通過 |
| complex-search | 通過 | 通過 | 通過 |
| conjunction-search | 通過 | 通過 | 通過 |
| exploratory-saccade | 通過 | 通過 | 通過 |

另執行 `node scripts/check-r2-game-browser.mjs --game exploratory-saccade --lobby --stop`，停止後 0 筆保存、大廳捲動還原。掃視共用 harness 通過後，依指示刪除其遊戲內 smoke 與暫存目錄，沒有其他產品／測試／文件引用舊入口。

以下每列先執行 `node scripts/publish-official-game.mjs <gameId> --dry-run`，全部通過；每款 1.0.0、5 檔。擁有者核准這四個精確版本與 contentSha256 後，於 2026-11-04 發布到 R2 並逐檔驗證，收據為 `docs/releases/<gameId>-1.0.0.json`：

| gameId | contentSha256 |
| --- | --- |
| popout-search | `e3e6ef88b9d31572a2bdc64bfe56db93177d7e79d5a91c1e44ed64d0e338c7bf` |
| complex-search | `67e1c2a4ec617c5dd196e2283e714a3223666bf1b9ddfd040c77f80753046be9` |
| conjunction-search | `9d71d251e72dcd1149ab09b1da83fbb5b2a17606a1c7a716806117a0a0b875dc` |
| exploratory-saccade | `57bac27304dc156f0bb00ba676919cbce70d5ad28d45b0e6ece4bbe11a1f4186` |

本次沒有因缺預覽留下失敗測試。實體觀看距離、色覺差異、實體觸控、Safari／iOS 與長時間離線仍待人工驗收。推送前仍必須由既有 hook 再執行完整 test:ci。最終掃描沒有 conflicted 複本，原有 browser fixture 修改保留。

四款都不需要 Hub API 變更。
