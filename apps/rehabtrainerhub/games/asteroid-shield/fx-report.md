# asteroid-shield pixelfx 實作報告

日期：2026-11-02。使用者未附 `-o` 路徑，因此將報告放在遊戲目錄內的 `fx-report.md`。

工作維持在 `main`。未建立分支、commit、push、部署、發布 R2 或修改版本號；`package.json` 仍為 `2.0.12`。本次只修改小行星護盾及其兩支專屬測試。其他遊戲的同時修改未介入。

## 行為與選材

先讀取 `CLAUDE.md`、`AGENTS.md` 的 TDD／R2 自包含／醫療法規文案規範，以及本機 pixelfx 的技能、README、CATALOG、LICENSE、NOTICE。候選與換色後的 contact sheet 均實際渲染並開圖檢視。

| 素材 | 事件與時長 | 為什麼選它 |
| --- | --- | --- |
| `impacts/parry` | 護盾攔截的局部光圈，0.8 秒；成績標題旁的短收尾也沿用它 | 破開的圓弧能表達抵擋成功，沒有文字、煙柱或全畫面閃爍。 |
| `impacts/blunt-hit` | 小行星被擋下或撞上飛船後的碎屑，0.9 秒 | 小碎塊和薄塵能讓小行星破碎更清楚，且可按原本的小行星尺寸縮放。 |
| `impacts/hit-spark` | 飛船受擊點的輕微藍白閃光，0.5 秒 | 短火花能指出受擊位置，縮小後不會變成蓋住畫面的警報。 |

色階取自現有 `--primary-hover`、`--primary`、`--primary-soft`、`--text-on-accent`，維持藍色與白色；碎屑和薄塵也換成同一色系。降低光照與透明度，不加入文案、設定或循環裝飾。

## 實作界線

- 獨立 canvas 為 `aria-hidden="true"`、`pointer-events: none`、`image-rendering: pixelated`。遊戲中的圖層低於 HUD，繪製後清除仍在場的目標、護盾和飛船範圍，保留原本形狀。
- 同時最多 8 個效果。只在事件發生後借用原有 Pixi ticker，最多每秒合成 30 次；使用 200×112 的重用 stamp buffer，閒置時不繪製，不建立額外 rAF 或 timer。
- `prefers-reduced-motion: reduce` 在進入與動態切換時都禁止播放，CSS 另隱藏圖層。失焦、隱藏頁面、pagehide、暫停事件、捲動、resize、階段切換和退出會清空；卸載移除監聽並釋放 scratch canvas。
- 結束時先清除 gameplay 效果，立即照原流程產生與傳送成果；成績頁僅在標題旁保留的 64×48 空白區播放收尾，0.8 秒內自行清除，捲動時也立即清除。
- 不改碰撞、分數、計時、物件生成亂數、設定、defaults 或 Hub payload。效果使用自己的固定 seed 計數器。
- pixelfx 必要核心、三種特效與 helper 均位於本遊戲內，沒有平台或跨遊戲 import。提供 JS 的型別宣告，不改共用 tsconfig。
- 為符合既有命名 gate，複製來源的具名函式與區域變數做了語意重新命名，並調整相對 import。93 個畫格與原版的 color／light buffer 逐一完全一致。未擴張共用掃描器的忽略規則。
- MIT 授權與 Hugo Duprez／Sprite Fusion 的相關 NOTICE 保留於 `fx/`，Vite 也將它們輸出到 `dist/`。

## 改動檔案

遊戲根目錄皆以 `apps/rehabtrainerhub/games/asteroid-shield/` 為起點：

| 檔案 | 用途 |
| --- | --- |
| `AsteroidShieldGame.tsx` | 接入碰撞事件、現有 ticker、階段與 resize 清理、canvas 和收尾空白區。 |
| `game.css` | canvas 圖層、輸入穿透、像素縮放、reduced motion 與收尾空白區。 |
| `vite.config.ts` | 將授權與 NOTICE 一起放進可發布的輸出。 |
| `fx/AsteroidEffects.ts` | 效果排程、數量上限、合成、保護區與清理。 |
| `fx/core/actor.js`、`color.js`、`font.js`、`fx.js`、`math.js`、`painter.js`、`sim.js` | 三款特效使用的本機核心依賴。 |
| `fx/core/index.js`、`index.d.ts` | 精簡的本機 exports 與 TypeScript 邊界。 |
| `fx/impacts/parry.js`、`parry.d.ts` | 抵擋與收尾。 |
| `fx/impacts/blunt-hit.js`、`blunt-hit.d.ts` | 尺寸相應的破碎。 |
| `fx/impacts/hit-spark.js`、`hit-spark.d.ts` | 受擊閃光。 |
| `fx/impacts/_lib.js` | 上述效果使用的繪圖 helper。 |
| `fx/LICENSE-pixelfx.md`、`fx/NOTICE.md` | 授權、來源與本機調整說明。 |
| `fx-report.md` | 本報告。 |

專屬測試：

- `scripts/check-asteroid-shield-migration.test.mjs`：沿用 root gate 已直接執行的入口，新增 5 項行為測試，保留原有 13 項。
- `scripts/asteroid-shield-browser.mjs`：沿用 `check-r2-game-browser --game asteroid-shield` 的既有專屬 fixture，加入 canvas／偏好切換／失焦／效能檢查與 30 秒真實指標操作。既有設定、教學、全螢幕、保存重試、返回等斷言仍保留。

未修改 root 測試入口或其他共用腳本。瀏覽器 fixture 的既有保存斷言另對齊現行 API：D1 中的 `score.rounds` 為空，必須有非零 `scoreRoundCount`、與畫面相同的列數，以及對應 CSV 的 `rawFiles.rows`、SHA-256、遊戲路徑。

## TDD 證據

證據根目錄：`.tmp/fx-shots/asteroid-shield/`。

| 階段 | 實際結果與證據 |
| --- | --- |
| 首次新增測試，尚未改產品碼 | `tdd-red.txt`：18 項中原有 13 項通過，新增 5 項失敗；原因為缺少事件、效果模組與 canvas。 |
| 捲動清理需求 | `scroll-red.txt`：1 項失敗，捲動後仍有活動效果；補上捕獲階段 scroll 清理後通過。 |
| 輸出授權檔需求 | `license-red.txt`：1 項失敗，Vite 尚未輸出授權檔；補上遊戲自己的 build plugin 後通過。 |
| 最終專屬測試 | `tdd-green.txt`：18/18 通過；包含真正渲染像素、最大 8 個、依尺寸縮放、保護區、生命週期、偏好變更與卸載後無回呼殘留。 |

碰撞測試使用相同輸入，逐一比較有／無特效回呼時的整份紀錄、metrics 與 `Math.random` 呼叫數。效果測試另將 `Math.random` 設成丟錯，仍可完成所有繪製，確認不消耗遊戲亂數。

## 實際驗證

| 指令或檢查 | 結果 |
| --- | --- |
| `npm --prefix apps/rehabtrainerhub/games/asteroid-shield run build` | 通過；含授權檔的最終建置約 12 秒。Vite 保留既有的大型 bundle 警告，JS 約 1.38 MB、gzip 約 379 KB。 |
| `node node_modules/typescript/bin/tsc -p apps/rehabtrainerhub/tsconfig.games.json` | 最終由完整 architecture gate 執行並通過。 |
| `node node_modules/typescript/bin/tsc -p .tmp/fx-shots/asteroid-shield/tsconfig.json` | 通過；使用相同 compiler options，include 限定本遊戲。`tsc-game.txt` 無錯誤。 |
| `node --test scripts/check-asteroid-shield-migration.test.mjs` | 18/18。 |
| `node --test scripts/check-asteroid-shield-migration.test.mjs scripts/check-r2-game-fullscreen.test.mjs scripts/check-r2-game-audio.test.mjs scripts/check-game-input-layouts.test.mjs` | 300/300；`related-tests.txt`。 |
| `npm run test:game-architecture` | 最終 1239/1239，含所有遊戲 tsc；`architecture-final.txt`。 |
| `npm run test:naming` | 2/2 測試與完整命名掃描通過；`naming.txt`。 |
| `npm run test:entrypoints` | 全部子檢查通過，含 training config 樣式；`entrypoints.txt`。 |
| `npm run build:hub` | 通過，約 1 分 48 秒；51 款獨立遊戲架構與 SEO 輸出檢查通過。 |
| `node scripts/check-r2-game-browser.mjs --game asteroid-shield --lobby` | 通過；桌機 752×485，30 秒、攔截、特效、偏好切換、失焦、成績、失敗保存／重試、單筆本機 SQL 與返回大廳；`browser-lobby.txt`。 |
| `node scripts/check-r2-game-browser.mjs --game asteroid-shield --standalone --mobile` | 通過；390×844、觸控、30 秒、相同特效檢查、PWA cache 範圍與返回入口；`browser-mobile.txt`。 |
| pixelfx `tools/check.mjs` 三個選用 ID | 3/3 通過，無警告。 |
| 原版與複製版逐幀比較 | 93/93 個固定 seed 畫格的 color／light buffer 完全相同；`vendor-parity.txt`。 |
| `git diff --check` | 通過。修改的既有檔案經 `git ls-files --eol` 確認 index／工作樹均為 LF。 |
| `npm run prepare`／Git hook | 執行完成，`core.hooksPath` 為 `.githooks`。 |

所有瀏覽器流程都使用 localhost、本機 R2 mock 和記憶體 SQLite；沒有正式帳號或訓練紀錄。完整 architecture gate 中 publisher 的測試也是 mock，沒有發布 R2。

## 畫面與效能

實際開圖檢視以下事件與成績畫面：

- `.tmp/fx-shots/asteroid-shield/lobby-desktop/pixelfx-event.png`
- `.tmp/fx-shots/asteroid-shield/lobby-desktop/pixelfx-finish.png`
- `.tmp/fx-shots/asteroid-shield/standalone-mobile/pixelfx-event.png`
- `.tmp/fx-shots/asteroid-shield/standalone-mobile/pixelfx-finish.png`

同目錄也包含原有設定、教學、確認、gameplay、落下動畫與成績等截圖；原色候選與換色後 contact sheet 分別放在 `candidates/`、`theme/`。

| 30 秒流程 | 記錄畫格 | 同幀最多特效 | Pixi ticker 平均耗時 | P95 | 最大值 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 桌機大廳 | 1012 | 4 | 4.22 ms | 23.1 ms | 92.9 ms |
| 手機 PWA 模擬 | 1550 | 4 | 1.27 ms | 6.4 ms | 44.8 ms |

數據保留於各流程的 `performance.json`。量測涵蓋遊戲更新、特效與 Pixi render；兩個瀏覽器及部分倉庫檢查同時執行，並非隔離的裝置 benchmark，也沒有主張這是新增特效相對於舊版的耗時差。單元測試另驗證繁忙時的 8 個上限。兩個流程均沒有 console 錯誤，收尾後 alpha buffer 全為透明。

## 限制與風險

- 這台 Windows 預設 reduced motion 為 true：首次 30 秒驗收完全不繪製特效，符合需求。後續 fixture 明確切至一般動態偏好，再於 gameplay 中切回 reduce 驗證立即停止。
- 初次全倉 tsc 曾遇到另一個同時工作中的遊戲缺少 JS 型別宣告；未改其檔案，最終完整 gate 已通過。
- 初次 Vite／部分 Git 命令受沙盒上層讀取限制；經工具核准後重跑本機命令成功，未部署或發布。
- 手機為 Brave 模擬；未驗實體手機、Safari／iOS、長時間 heap profile 或所有低階硬體，不能從本次數據保證每台裝置穩定 60 fps。
- 本次未執行整套 `test:ci` 的其他非相關 gate，沒有任何 push；本地候選未發布。
