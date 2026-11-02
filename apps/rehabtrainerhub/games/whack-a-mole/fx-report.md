# whack-a-mole pixelfx 實作報告

2026-11-02。完成盤面事件特效，保留原有星星／叉叉、命中判定、計分、計時、遊戲亂數與成果欄位。全程在 `main`，沒有建立分支、commit、push、R2 發布或更改版本；來源 package.json 維持 `2.0.1`。

任務未提供 `-o` 路徑，因此依工作中告知的預設位置保存本報告。

## 改動檔案

- `HoleBoard.tsx`：實際訓練盤面接受 canvas ref；教學盤面沒有特效層。
- `WhackAMoleGame.tsx`：已接受的點擊觸發特效；漏掉地鼠重設連擊；停止、時間到與卸載清理。原本的下一隻排程先執行，再產生特效；先記錄結束時間，再清理畫面。
- `game.css`：獨立 `.wm-fx` canvas，`pointer-events: none`、像素放大；特效 z-index 0，洞與其 SVG 為 1。繪製範圍限制在盤面，地鼠、星星／叉叉、焦點框、分數、倒數與按鈕保持在上方。
- `fx/holeEffects.ts`：DOM 洞位換算、三種事件、私有視覺 seed、每 5 連中、單次播放、生命週期與清理。
- `fx/pixelfx.d.ts`：此遊戲使用的 pixelfx JavaScript API 型別。
- `public/pixelfx/core/`：`actor.js`、`color.js`、`font.js`、`fx.js`、`math.js`、`painter.js`、`sim.js`，以及縮減出口的 `index.js`。
- `public/pixelfx/fx/impacts/`：`hit-spark.js`、`blunt-hit.js`、`_lib.js`。
- `public/pixelfx/fx/pickups/`：`collect-burst.js`、`_lib.js`。
- `public/pixelfx/LICENSE-pixelfx.md`、`NOTICE.md`：完整 MIT 授權、Patch／Hugo Duprez 署名與 Sprite Fusion 改編聲明；原檔頭保留。
- `scripts/check-whack-a-mole-game.test.mjs`：在既有專屬測試加入 5 項特效測試。
- `fx-report.md`：本報告。

12 份上游來源檔逐一 SHA-256 比對相同；僅 `core/index.js` 改為所需出口。沒有複製其他特效、Hollow Crown act 或 gallery 字型。15 份公開 runtime／授權檔合計 112,983 bytes，皆位於此遊戲內，沒有新增 npm 依賴或跨遊戲／平台 import。

## 特效選擇與理由

已執行 pixelfx 的渲染工具，實際讀取三份候選 contact sheet，再讀取金色色階版本及最終遊戲截圖。

| 事件 | 特效 | 為什麼選它 | 實際播放 |
| --- | --- | --- | --- |
| 打中地鼠 | `impacts/hit-spark` | 短促的定向金色碎光能回應敲擊，原有星形仍是主要命中訊號。 | 約 0.33 秒 |
| 點錯洞 | `impacts/blunt-hit` 的輕塵段 | 地面揚塵符合洞與土壤的場景；先推進 0.24 秒略過亮閃與尖角，縮小並關閉光暈，保留輕塵與少量土粒。 | 約 0.44 秒 |
| 每連中 5、10、15…隻 | `pickups/collect-burst` | 稍大的環狀收集碎光能標記連續命中，無須新增文字、分數或設定。 | 約 0.75 秒 |

錯洞與漏掉地鼠都會中斷視覺連擊。連擊只存在特效控制器，沒有寫入 match、summary 或 rounds。未被遊戲接受的點擊不觸發特效。

金色色階讀取既有 `--hit-edge`、`--hit`、`--surface`；輕塵使用既有 `--hole`、`--mole`、`--text-muted`、`--border`。新增視覺沿用草綠／土棕背景與金色強調，不增加產品文案或醫療宣稱。

## TDD 證據與測試入口

1. 原始專屬測試為 8/8 通過。
2. 先新增 5 項測試再執行：13 項中 8 通過、5 失敗。原因是 `fx/holeEffects.ts`、canvas 與 vendored 授權檔尚未存在。證據：`.tmp/whack-fx-tdd-red.log`。
3. 實作後 13/13 通過，涵蓋真正 pixelfx 像素輸出、reduced-motion 與即時切換、DOM 座標、連擊／漏掉重設、一秒內停止、失焦／隱藏／暫停／resize／pagehide／卸載清理、原星星／叉叉、輸入穿透與自包含。
4. 最後補上「先記錄結束時間才清理」測試，先重現 12 通過、1 失敗，再調整順序恢復 13/13。證據：`.tmp/whack-fx-timing-red.log`、`.tmp/whack-fx-tdd-green.log`。

既有接線為 `test:ci` → `test:game-architecture` → `scripts/check-self-contained-game.test.mjs` → `scripts/check-whack-a-mole-game.test.mjs`，新增測試已由同一入口執行，沒有修改共用測試腳本或放寬檢查。

## 實際驗證結果

| 指令／驗證 | 結果 |
| --- | --- |
| `npm run prepare`；讀取 `git config --local core.hooksPath` | hook 路徑為 `.githooks`。 |
| `npm --prefix apps/rehabtrainerhub/games/whack-a-mole run build` | PASS；最終 Vite build 成功。 |
| `node node_modules/typescript/bin/tsc -p apps/rehabtrainerhub/tsconfig.games.json` | PASS；這就是架構 gate 使用的遊戲 tsc，亦在最終完整 gate 再次執行。 |
| `node --test scripts/check-whack-a-mole-game.test.mjs` | PASS，13/13。 |
| `npm run test:game-architecture` | 最終 PASS，1239/1239，0 skipped；包含此遊戲相關 UI、設定、包裝與安全回歸。 |
| `npm run test:naming` | PASS，2/2 測試與完整命名掃描通過。 |
| `.pixelfx` 內 `node tools/check.mjs impacts/hit-spark impacts/blunt-hit pickups/collect-burst` | PASS，3/3，0 warnings。 |
| `git diff --check` 與 `git ls-files --eol`（限定本次檔案） | PASS；四份修改的既有檔案皆維持 i/lf、w/lf。 |
| `node scripts/check-r2-game-browser.mjs --game whack-a-mole --lobby` | 已實際執行；因缺少 `apps/rehabtrainerhub/out/index.html`，逾時於大廳載入。沒有修改 Hub 或共用 fixture。 |
| 本機 Brave 沙盒特效流程 | PASS；桌機 1000×800、手機 390×844，命中、輕塵、5 連中、即時 reduced-motion、失焦／恢復與停止。 |
| 本機 Brave 30 秒自然結束流程 | PASS；時間到清空 canvas，成果頁卸載 canvas，返回正常；沒有 JavaScript 例外或 console.error。 |

早期完整 gate 曾在其他工作流程的小行星特效測試出現 5 項失敗；本次沒有修改該遊戲，最終完整 gate 已全部通過。最終完整 gate 與命名輸出分別保存在 `.tmp/whack-fx-architecture-final.log`、`.tmp/whack-fx-naming-final.log`。

本機瀏覽器使用不具 `allow-same-origin` 的 `sandbox="allow-scripts"` iframe，套用 runner 相同 CSP；13 個本遊戲 pixelfx 模組成功以 CORS 載入。reduced-motion 下實際 canvas 透明且原有星形仍顯示；恢復偏好或焦點後不重播舊特效。手機盤面沒有水平溢出。瀏覽器流程只使用本機檔案，沒有建立正式帳號或紀錄。

## 視覺與可用性檢核

- Hard Gate PASS：新增 canvas 為 `aria-hidden` 且不接收輸入；原有星星／叉叉保留；reduced-motion 完全不播放，390px 盤面量測無水平溢出。沒有新增文字、按鈕、設定、導覽、統計或宣稱。
- Purpose Gate PASS：三種動態各對應已接受的遊戲事件；選擇理由、色階及播放上限列於上表，沒有常駐動畫或新增裝飾元件。
- Liveliness PASS：ENERGY 2／RHYTHM 1／MOTION 2；盤面保持規律格線與單一搜尋目標，金色只在命中事件出現，5 連中稍微加強。
- Craftsmanship PASS：DOM 命中與既有鍵盤入口維持原路徑；設定與成果回歸由完整 gate 驗證；canvas 在形狀與 HUD 下方，失焦、結束及卸載停止 rAF。新增效果不變更遊戲紀錄。

## 截圖與重現

截圖全部位於 `.tmp/fx-shots/whack-a-mole/`：

- `desktop-wrong-dust.png`：點錯洞的 X 與輕塵。
- `desktop-hit.png`：星形周圍的金色命中碎光。
- `desktop-combo-five.png`：第 5 次連中收集碎光。
- `desktop-reduced-motion-star.png`：特效停用、原星形保留。
- `mobile-hit.png`：手機盤面洞位與命中碎光。
- `mobile-results.png`：自然結束的成果頁。
- `browser-result.json`、`browser-finish-result.json`：兩次沙盒流程結果。
- `candidates/`、`gold/`：已實際閱讀的原色與金色 contact sheets。

本次輔助驗收程式與其重現命令保存在本機暫存目錄：

```powershell
node .tmp/fx-shots/whack-a-mole/check-browser.mjs
node .tmp/fx-shots/whack-a-mole/check-browser.mjs --finish
```

手動驗收：建置此遊戲並以 HTTP 服務其 `dist/`，選 30 秒、3×3 盤面，確認設定並開始。依序點錯一個洞、連中 5 隻；確認輕塵與兩種金色回饋在被點洞位出現，星形與 X 清楚。切換系統 reduced-motion 再命中，應只剩星形；切換分頁或調整視窗，舊特效立即消失。等待時間到並返回，canvas 與 rAF 應已清理。亦可另開一局測試停止。

## 限制與風險

- 完整 Hub 大廳瀏覽器流程尚未通過，限制為本機 Hub 輸出不存在。已完成同 sandbox／CSP 的遊戲流程驗證；未建置或修改 Hub 來繞過本次範圍。
- Vite 提示主 bundle 為 571.06 kB，超過預設 500 kB 警告門檻；建置成功。本次沒有擴大重構既有 jsPsych／Tone 載入。
- 慢速載入或 runtime 資產失敗時，尚未就緒的純視覺特效略過，原有形狀回饋與遊戲照常；不延後目標或訓練。
- 瀏覽器驗證為本機 Brave 模擬；未驗 Safari／iOS、實體觸控或長時間完整離線。
- 本機輔助瀏覽器程式與截圖放在被忽略的 `.tmp/`，不作為永久 CI 或推送 hook；對應可自動化的行為測試已接入既有 `test:game-architecture`。本次沒有改動共用 hook。
