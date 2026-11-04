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

## 1.0.1：全螢幕尺寸穩定與排版重試（2026-11-05）

正式 `conjunction-search@1.0.0` 曾在 `--lobby --production-hub` 量到全螢幕切換前的 768×432 搜尋區，24 字排版失敗後直接進入「請調整畫面」，即使欄位稍後長大也不會恢復。三款搜尋使用同一份引擎的各自副本；探索掃視第一次 `prepare()` 失敗後也會停止 runtime。已發布的 1.0.0 保持不變，四款均改為 1.0.1。擁有者核准下列四個精確 contentSha256 後，於 2026-11-05 發布到 R2 並逐檔驗證，收據為 `docs/releases/<gameId>-1.0.1.json`。

每款自有 `logic/fieldSettle.ts`，沒有跨遊戲 import。全螢幕請求在開始按鈕的使用者操作內發出，掛載實際場地後才測量：拒絕時立即採目前尺寸；進入全螢幕後須連續兩個影格不變；1000 ms 上限包含未完成的請求與持續變化的尺寸。沒有固定 sleep。每段開始均先等待；ResizeObserver 追蹤實際欄位，未作答的第一題在 lead 或 target 可無聲重排。初次排版失敗保留至首次失敗後 1000 ms，只在尺寸變化時重試，不能因再次失敗延長期限。期限內的變大直接重試，避免最後一刻的有效尺寸被額外等待影格吃掉。

第一題作答後改尺寸仍要求 Continue，僅重做該段，保留完成段落。真正太小而沒有變化的欄位仍顯示原來的中英文提示；放大後 Continue 可用。每段完成、退出、卸載均取消等待、重試及觀察器；這也避免成果頁移除欄位時的 0×0 通知覆蓋成果。原鍵盤、時間、計分、設定保存、私有 bridge 與安全政策保持原流程。探索掃視的後續畫面等待與開始後限制另見 `docs/exploratory-saccade.md`。

視覺選擇：沿用白色場地、原字形、橘色目標圈、原設定／成果與提示，因為本次只處理場地生命週期，額外視覺變化會干擾搜尋。ENERGY 1／RHYTHM 1／MOTION 1 保持。`docs/game-preview-captures.json` 的檢查只要求真實 gameplay、圖片尺寸及 SHA 一致，沒有要求拍攝版本等於 package 版本，因此保留四款 1.0.0 的實拍圖與原拍攝紀錄，沒有改圖片或捏造 1.0.1 拍攝。重新用 contrast-check.py 驗證白底正文 15.62:1、綠 7.47:1、藍 7.05:1、橘 5.43:1，均通過 AA。

### TDD 證據與測試接線

- 先新增四款專用測試的 fake clock、frame／size source：拒絕、兩個穩定影格、等待上限、失敗重試期限、成功取消、退出取消與可無聲重排狀態；版本斷言先改為 1.0.1。第一次 `node --test scripts/check-popout-search-game.test.mjs scripts/check-complex-search-game.test.mjs scripts/check-conjunction-search-game.test.mjs scripts/check-exploratory-saccade-game.test.mjs` 為 86 項、70 通過／16 失敗，原因為缺少模組及版本仍為 1.0.0；紀錄 `.tmp/codex/task-c-red.log`。
- 探索掃視另先測延後每畫面準備與停止取消，修正前產生畫面的次數為 1，預期 0；開始過第一畫面後的排版失敗也先測出錯誤被延後，才限制重試資格。合計最終 88／88，分別為 popout 18、complex 19、conjunction 22、saccade 29。
- 四款瀏覽器 spec 先透過 CDP 在真正的 running 場地注入 120×120 尺寸，300 ms 後恢復。未修改產品的 1.0.0 build 時，三款搜尋皆先出現「請調整畫面」；探索掃視先出現原錯誤頁，無法進入 running。紀錄 `.tmp/codex/task-c-browser-red-<gameId>.log`。
- 完整流程再重現成果卸載 0×0 被當作 resize 的錯誤，才補上段落完成取消監聽。七項 gate 第一輪指出設定記憶測試仍固定四款為 1.0.0（1381 項、1377 通過／4 失敗），更新精確版本後該組 114／114。
- 四款專用測試仍由 `check-self-contained-game.test.mjs` import，直接隸屬 root `test:game-architecture`，再由 `test:ci`／pre-push 執行；沒有新增 CI matrix 或未接線的測試入口。

瀏覽器搜尋情境同時驗證：延後長大期間沒有調整提示；真正過小時 1000 ms 後提示及放大後 Continue；每段第一題 target 改尺寸可無聲重排；第二段首題作答後改尺寸須提示、Continue 後仍保留第一段；最後仍有 60 筆原計分規則的成果與保存重試。原生鍵盤與手機觸控均使用 CDP 真實 input，fixture 僅在 harness 內，未編入遊戲。

### 1.0.1 本機 gate 與 dry run

| 命令 | 結果 |
| --- | --- |
| `npm run prepare`；`git config --local core.hooksPath` | 通過；`.githooks` |
| `npm --prefix apps/rehabtrainerhub/games/<gameId> run build`，四款各一次 | 四款均通過，保留既有 500kB bundle 提示 |
| `node --test scripts/check-popout-search-game.test.mjs` | 18／18 |
| `node --test scripts/check-complex-search-game.test.mjs` | 19／19 |
| `node --test scripts/check-conjunction-search-game.test.mjs` | 22／22 |
| `node --test scripts/check-exploratory-saccade-game.test.mjs` | 29／29 |
| `node --test scripts/check-r2-settings-memory.test.mjs` | 114／114 |
| `npm run test:ci` | 七項 gate 全通過；紀錄 `.tmp/codex/task-c-ci-final.log` |
| `test:naming`／`test:pwa`／`test:game-architecture` | 2／2 與命名掃描；3／3 與靜態資產；TypeScript 及 1382／1382 |
| `test:hub-functions`／`test:gamerunner` | 308／308；78／78 |
| `test:entrypoints` | 入口掃描與各組 95、18、15、9、6、10、29 項全通過，WebGazer／i18n／樣式掃描通過 |
| `test:cloudflare-deploy` | 部署腳本靜態檢查及 46／46；沒有部署 |
| `npm run build:hub` | 通過；55 款獨立遊戲架構、0 個 Hub 遊戲 bundle、PWA／SEO 通過；25.028 秒 |
| `node scripts/publish-official-game.mjs <gameId> --dry-run`，四款各一次 | 全通過；各為 1.0.1、5 檔，digest 與正式發布一致 |

| 1.0.1 候選 | contentSha256 |
| --- | --- |
| popout-search | `6162903ade68bcd5a0f228b6ffc21601c0a361ceb7b6bec3ccb348b6b80cf6a2` |
| complex-search | `9ed3946d5195a3ec7b0eaeecac2d0224b8cc171d29875e784f07e994c470df96` |
| conjunction-search | `3bd94b0805cfc4dc3d789d41ef603ed6b7360f5969be3a1de177771cfe955b7b` |
| exploratory-saccade | `6a3bcaab74370a2e9a91e9a0080473598c1f135a195bfd632b651c899bcb253e` |

本機 esbuild 受沙盒祖先目錄限制、Brave 受 CDP 初始化限制時，使用核准的本機權限執行相同命令，沒有改 gate。同步工具曾將 popout 的生成檔 `dist/index.html` 改名成 `index [conflicted 4].html`，已還原生成檔檔名，套件驗證與後續 browser 能正常讀取。沒有修改任何已追蹤檔的行尾格式或發布收據。

Hub build 之後同步工具也將 `out/` 與 `.next/` 共 123 個生成檔改名，導致一次英文登入流程在進入大廳前就因缺少 `out/index.html` 失敗。逐一確認目標仍在各生成目錄、目標檔不存在後還原檔名，再把完整 out 複製到本機 Temp 的唯一目錄，後續 browser 使用 `HUB_OUTPUT_ROOT` 指向該固定快照。路徑紀錄在 `.tmp/codex/task-c-browser-snapshot.json`；測試命令可先執行 `$env:HUB_OUTPUT_ROOT = (Get-Content -Raw .tmp/codex/task-c-browser-snapshot.json | ConvertFrom-Json).hubOutputRoot`。受影響流程已在快照上重跑，沒有將這個環境失敗當成遊戲通過，也沒有停用同步程式或修改來源檔來迴避問題。

最後檢視另為掃視新增「重排失敗不能開始舊畫面」的先紅後綠測試；未修正時純邏輯會錯進 search，browser 開始鈕也未停用。修正後本款 29 項、四款合計 88 項；成功 gameplay 不變，失敗等待期間沿用既有 disabled 狀態。詳見掃視文件的 1.0.1 節。修改範圍為四款自有 TSX／fieldSettle／package.json、掃視 screenRun／RunningView、root lockfile、四款專用測試與設定記憶版本、四份 browser spec／vision-field-browser fixture，以及這兩份文件。

### 1.0.1 瀏覽器結果與交付檢查

每格的命令是 `node scripts/check-r2-game-browser.mjs --game <gameId>`，後接表頭旗標；三次大廳在各款內連續執行。四款皆完成原生啟動、成果、保存／重試及返回流程，沒有正式 API、帳號或資料寫入。搜尋保留真正的逐題時間，單次約 95 至 101 秒；掃視沿用原有 harness clock fixture。

| gameId | `--lobby` 連續三次 | `--lobby --mobile` | `--standalone` | `--lobby --signed-in --english` |
| --- | --- | --- | --- | --- |
| popout-search | 3／3 通過 | 通過 | 通過 | 通過 |
| complex-search | 3／3 通過 | 通過 | 通過 | 通過 |
| conjunction-search | 3／3 通過 | 通過 | 通過 | 通過 |
| exploratory-saccade | 3／3 通過 | 通過 | 通過 | 通過 |

最終 24／24。逐次結果與 log 路徑在 `.tmp/codex/task-c-browser-matrix-final.json`，各 log 為 `.tmp/codex/task-c-browser-<gameId>-<flow>.log`。掃視補上失敗排版保護後重新完成全部六格；最後七項 gate 為 1382 項架構測試全部通過，Hub build 25.028 秒通過，四款 dry run 再次通過，以上摘要是最後候選 bytes。

掃視重開測試一度在第三次大廳讀到確認頁，原因是 helper 把教學的 `.saccade-field` 誤認為 running 場地，退出全螢幕後尺寸變化也可能讓原生點擊落空（紀錄 `.tmp/codex/task-c-saccade-restart-missed-click.log`）。helper 改為限定 `.saccade-running .saccade-field`，並以原生點擊及真正進入 running 作為重開成功條件，之後才繼續原本的成果驗證；沒有放寬遊戲結果、時間或保存斷言。修正後重新連續三次大廳與其餘三個流程，全部通過。

| antislop DURING 交付項目 | 結果與證據 |
| --- | --- |
| Hard Gate | PASS：無新增破折號、虛構文案、素材或裝飾；手機 viewport／鍵盤／觸控、錯誤與恢復均由四款 browser 驗證；色彩 AA 比率如上 |
| Purpose Gate | PASS：保留原場地／字形／預覽；唯一新增狀態為無有效掃視排版時停用開始，避免啟動舊位置 |
| Liveliness | PASS：既有 1／1／1、平面場地與目標焦點不變；沒有新增動畫或視覺元素 |
| Craftsmanship | PASS：四款 build、88 項專用測試、24 個完整 browser、七項 gate、Hub build 與 dry run 通過；git diff 檢查與完整 conflicted 掃描完成 |

沒有發布、commit、push、部署、改 `docs/releases/` 或改正式 current。Safari／iOS、實體裝置與長時間離線仍是既有人工限制；本次手機為 Brave 觸控模擬。

最後一次 Hub build 也遇到同步工具改名 125 個 `out/`／`.next/` 生成檔，已按相同目錄邊界與目標不存在檢查還原。結束時完整掃描 apps／packages／scripts（含 ignored 產物、排除 node_modules）為 0 個 conflicted 檔，`git diff --check` 通過，發布收據無差異。來源檔未被改名，browser 使用的固定快照不受這次生成檔改名影響；同步工具本身未在本工作中調整。
