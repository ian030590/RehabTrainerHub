# tongue-catch：pixelfx 事件回饋

日期：2026-11-02。任務未附 `-o` 路徑，因此報告存放於本檔。

已在 `main` 完成，版本維持 `2.0.1`。沒有 commit、push、部署或發布 R2。變更限於 tongue-catch 與其既有專屬測試；其他工作流程產生的遊戲變更未處理。

## 選用特效

| 來源 | 觸發與時間 | 為什麼選它 |
| --- | --- | --- |
| `pickups/collect-burst` | 真正接住蘋果後，在該蘋果的場景位置播放，0.75 秒 | 小範圍的環形爆閃能清楚標記剛被接住並移除的目標。 |
| `impacts/hit-spark` | 新一次左／右舌頭動作通過既有辨識門檻時，於口部旁播放，0.45 秒 | 短促亮點能回應動作辨識；維持同方向不重播，間隔至少 500 ms。 |
| `ui/confetti` | 成果頁出現時播放一次，0.95 秒 | 雙側紙花提供比接取更完整的結束回饋，縮放至標題右側留白，保留成果可讀性。 |

已先在原 pixelfx checkout 執行 `tools/render.mjs`，實際查看三款候選的 contact sheet，再選用；`tools/check.mjs` 結果為 **3 pass、0 fail、0 warnings**。原始候選圖位於 `.tmp/fx-shots/tongue-catch/candidates/`，實際換色與縮放則以遊戲內截圖驗收。

色階來自 `--tongue-rope-edge`、`--tongue-rope-dark`、`--tongue-rope-light`、`--tongue-cue-glow` 與 `--surface`：沿用粉紅／玫紅與白色明暗層次，不加入新主色。紙花原本獨立的墨色、煙霧與火花也改用此色階。

## 改動檔案

- `TongueCatchGame.tsx`：建立獨立 canvas、接取與辨識事件接線、場景尺寸讀取、保護現存蘋果及口部，以及停止／完成／卸載接線。
- `game.css`：加入不可點擊、像素化的疊加層；reduced-motion 下隱藏。
- `fx/feedback.ts`：獨立 rAF、Pixi 邏輯座標至 CSS／canvas 座標換算、事件期限、最多六個同時特效、內容遮罩與清理。成果遮罩只讀成果內容，不讀已被成果頁蓋住的遊戲 HUD。
- `fx/core/`：複製需要的 `actor.js`、`color.js`、`font.js`、`fx.js`、`math.js`、`painter.js`、`sim.js`，附局部 `index.js` 與 `index.d.ts`。
- `fx/effects/pickups/{collect-burst.js,_lib.js}`、`fx/effects/impacts/hit-spark.js`、`fx/effects/ui/confetti.js`，以及 `fx/effects/{index.js,index.d.ts}`：只包含選用特效及必要 helper。
- `fx/LICENSE-pixelfx.md`：完整 MIT 授權、Patch／Hugo Duprez 版權與相關 Sprite Fusion NOTICE。
- `public/LICENSE-pixelfx.txt`：同一份授權，讓 Vite 輸出及日後套件分發也攜帶歸屬文字；已逐字核對建置輸出。
- `scripts/check-tongue-catch-game.test.mjs`：在既有測試增加六項行為測試；既有 14 項保留。
- `fx/REPORT.md`：本報告。

vendored JS 的識別字依倉庫命名規則調整，保留模擬及繪圖公式；紙花色彩改用傳入色階。沒有安裝新依賴或修改共用測試入口。

## 行為與隔離

- 不在 Pixi render loop 中繪製特效；遊戲 ticker 只在既有事件後通知獨立管理器。捕獲前保留蘋果物件參考，因此可以取得該次更新後的實際位置。
- canvas 使用 `pointer-events: none` 與 `aria-hidden="true"`。繪製後清除 HUD、提示、按鈕、成果文字、現存目標與口部區域的特效像素。
- 所有特效為一次性；沒有常駐動畫。完成紙花先在小型離屏 canvas 繪製，再依可用寬度縮放，避免手機裁切。
- `prefers-reduced-motion: reduce` 下不建立特效或啟動 rAF；偏好即時變動亦清空現有畫面。主機實際預設為 reduce，已驗證這種預設情況。
- blur、visibilitychange、pagehide、停止、重新開始、離開與卸載均清理特效；Dispose 解除全部新增事件監聽器並取消 rAF。
- 特效使用自己的遞增 seed，沒有呼叫 `Math.random`。設定、defaults、遊戲邏輯、碰撞、計分、計時、score schema、Hub bridge、版本及中英文文案均未修改。

## TDD 證據

日誌均在 `.tmp/fx-shots/tongue-catch/`：

1. `tdd-red.log`：原有 14 項通過，新增五項失敗；原因為特效模組不存在及畫面尚未接線。最初實作後 19/19 通過。
2. `tdd-mobile-red.log`：18/19 通過；手機完整構圖斷言失敗。加入離屏縮放後恢復通過。
3. `tdd-license-red.log`：18/19 通過；分發授權檔不存在（ENOENT）。加入 public 授權檔後通過。
4. 手機瀏覽器檢查曾無法看到完成紙花，追查為底下的 HUD 遮罩；`tdd-mask-red.log` 先確認新行為測試失敗（19/20），調整可見內容遮罩後 `tdd-green.log` 為 **20/20 通過**。

測試涵蓋 reduced-motion 預設及即時變動、真實非透明像素、座標換算、內容遮罩、手機構圖、六個同時特效上限、動作節流、事件觸發、session 不被修改、失焦／隱藏／停止／Dispose 後無 rAF 或事件監聽器殘留、不可點擊層、自包含及授權分發。

既有接線：`test:ci` → `test:game-architecture` → `scripts/check-self-contained-game.test.mjs` → `scripts/check-tongue-catch-game.test.mjs`。沒有放寬任何既有檢查。

## 實際驗證結果

| 指令／項目 | 結果與日誌 |
| --- | --- |
| `npm --prefix apps/rehabtrainerhub/games/tongue-catch run build` | PASS，11.79 秒；`build.log`。Vite 仍提示單一 JS chunk 大於 500 kB，最終約 1,149.52 kB／gzip 338.80 kB。 |
| `node node_modules/typescript/bin/tsc -p apps/rehabtrainerhub/tsconfig.games.json --pretty false` | PASS；最終完整架構 gate 亦再次執行同一 tsconfig。 |
| `node --test scripts/check-tongue-catch-game.test.mjs` | PASS，20/20；`tdd-green.log`。 |
| `npm run test:game-architecture` | PASS，**1,240/1,240**，0 skipped；`architecture-final.log`。 |
| `npm run test:naming` | PASS，兩項命名工具測試及全倉庫檢查；`naming-final.log`。 |
| `npm run build:hub` | PASS；為本機大廳驗證建立原本不存在的輸出，未部署；`hub-build.log`。 |
| 桌機特效專項，1280×800 | PASS；實際 dist、測試 parent 與合成感測器訊息，驗證動作／接取／完成像素、HUD 透明、切換 reduce、blur、返回、無水平溢出及無 console exception；`fx-browser-desktop.log`、`desktop-browser-evidence.json`。 |
| 手機特效專項，390×844 CSS px | PASS；同上，含縮放後完整紙花；`fx-browser-mobile.log`、`mobile-browser-evidence.json`。 |
| `node scripts/check-r2-game-browser.mjs --game tongue-catch --standalone --mobile` | PASS；最終套件完成設定、四個聚光燈、拒絕／允許相機、實際 MediaPipe proxy、三動作校正、25 次接取／3 次漏接、成果及返回入口；`browser-mobile-final.log`。 |
| `node scripts/check-r2-game-browser.mjs --game tongue-catch --lobby` | 未完全通過：已走至成果與分析，保存重試等待 `retry saved` 逾時；`browser-lobby.log`。未修改共用保存流程。 |
| 同上加 `--signed-in` | 未通過：本機 DB adapter 缺少目前後端使用的 `db.batch`，在建立 session 時即失敗；`browser-account.log`。 |
| `git diff --check`／行尾 | PASS；原修改檔仍為 `i/lf w/lf`。 |
| `npm run prepare`／hook | PASS；`core.hooksPath` 為 `.githooks`。 |

完整架構 gate 已包含相關的 self-contained、results、UI、audio、settings-memory 與遊戲結構測試。其餘五項 CI gate 本次未另外執行；沒有進行 push。

## 圖片與重現方式

最終特效截圖：`.tmp/fx-shots/tongue-catch/{desktop,mobile}-{movement,collect,complete,reduced-motion}.png`。已實際查看桌機及真正 390 px 手機的事件與完成畫面。

原生流程完整截圖：`.tmp/tongue-catch-validation/standalone-mobile-guest/`；大廳至成果畫面：`.tmp/tongue-catch-validation/lobby-desktop-guest/`。

臨時特效驗收工具保留在 `.tmp/fx-shots/tongue-catch/check-feedback-browser.mjs`，執行方式：

```powershell
node .tmp/fx-shots/tongue-catch/check-feedback-browser.mjs
node .tmp/fx-shots/tongue-catch/check-feedback-browser.mjs --mobile
```

它載入實際 dist，在本機 parent 使用 MessageChannel 傳入合成感測器資料，不呼叫正式 API，也不開實體相機；桌機與手機均在 no-preference／reduce 之間切換，結束時關閉自己的瀏覽器與伺服器。這是忽略目錄內的本機驗收工具，沒有修改共用 browser runner 或 hook；持續回歸由上述 20 項既有 gate 測試保護。

## antislop 交付檢查

方向：依本次明確 brief，沿用舌頭粉紅色階、少量事件回饋、保留相機及目標可讀性。ENERGY 2／RHYTHM 1／MOTION 2；不改版面節奏，只讓已發生的事件有短暫回應。

- Hard Gate PASS：無新增文案、emoji、數字宣稱、圖片人物或導覽；只有已授權的事件特效與原素材。
- R-03／R-32／R-34 PASS：桌機及 390 px 手機檢查無遊戲水平溢出；沒有新增控制或主題，原有焦點及鍵盤處理保留。
- R-25／R-26／R-27 PASS：沒有改動文字、對比、控制或狀態文案；遮罩及實際截圖確認數值、提示與按鈕仍清楚。
- R-33／R-35 PASS：產品接線直接修改原始碼，已 build 並實際跑設定、教學、相機同意、三步校正、接取、成果、減少動態與返回；保存 fixture 失敗另明列，沒有聲稱大廳整體通過。
- Purpose Gate PASS：環形爆閃回應接取、短火花回應新動作、紙花回應完成；色彩與發光均有事件用途，沒有裝飾循環。
- Liveliness PASS：視覺焦點仍為蘋果與舌頭；粉紅亮點沿用既有形狀與色彩語言，完成紙花只用標題旁留白。
- Craftsmanship PASS：六個同時效果上限、0.45／0.75／0.95 秒期限、縮放構圖、可見內容遮罩與 rAF／listener 清理均有執行證據。

## 未解決問題與風險

- 大廳訪客保存重試仍逾時，原因未完整確認；登入 fixture 的 `db.batch` 缺漏已定位。依任務範圍限制，未修改共用腳本、平台或其他遊戲。這兩項不能列為完整大廳驗收通過。
- 視覺與感測器流程使用本機 headless Brave；特效專項使用合成的有效訊息，原 PWA fixture 使用圖像串流及實際 MediaPipe。未驗真人、實體相機、Safari／iOS 或實體手機。
- 保留 Vite 大 chunk 提示；沒有進行跨遊戲或平台拆包。沒有宣稱低階硬體效能或長時間記憶體量測已完成。
- 工作樹中有其他遊戲的並行修改，本報告只涵蓋本次 tongue-catch 變更。
