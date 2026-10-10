# R2 遊戲相機與全螢幕流程

日期：2026-10-10。本次為本機程式碼修正，尚未發布新的 R2 遊戲版本或部署 Hub。

## 使用流程

- 畫畫塔防、小行星護盾：設定、教學與最終參數確認均保持視窗，在最後開始按鈕中請求遊戲根元素全螢幕，再啟動原 runtime。
- 手部目標追蹤：最終確認先按「啟用相機」，在外層同意視窗允許相機並等待實際輸入代理初始化。準備完成後返回同一確認畫面，按「開始訓練」才請求全螢幕及啟動計時。相機等待期間取消不會啟動；全螢幕切換期間取消會清理稍晚完成的切換。
- 手勢指令對戰：相機同意與初始化保持視窗；相機就緒後按第一次開始校正，先等待全螢幕完成再取樣。手機也使用此流程。校正途中返回會阻止未完成的切換留下全螢幕。
- 四款遊戲自有 bridge 的 `ExitGame` 先退出全螢幕，再傳送私有 exit 或返回獨立入口。手部遊戲保留停止相機的訊息。
- Hub 的退出訊息、對話框取消與錯誤返回使用同一清理流程；卸載、重新載入與版本撤回也退出全螢幕。相機同意顯示前，Hub 退出既有全螢幕，避免舊版遊戲遮住同意視窗；取消中的同意請求不再顯示。
- Hub 關閉視窗後還原進入遊戲前的捲動位置。

全螢幕請求來自最後一次實際按鈕點擊，以保留瀏覽器使用者啟動權限。瀏覽器不支援或拒絕全螢幕時沿用既有視窗玩法。

## TDD 紀錄

先新增可執行的全螢幕回歸，再修改產品程式碼：

1. 原手部追蹤先請求全螢幕，測試期待先等待相機而失敗；取消相機期間也已發生全螢幕請求。
2. 原手勢校正未等待全螢幕便開始取樣，且手機被排除。
3. 四款原 `ExitGame` 未退出全螢幕；Hub 未提供等待清理後再關閉的共同出口。
4. 兩款手部遊戲在取消全螢幕請求後，稍晚成功的請求仍可能留下全螢幕；新增延遲完成測試先失敗，再補上清理。
5. 真實 Brave 流程重現兩款手部遊戲返回大廳捲動位置偏移；保留原位置斷言，補上視窗關閉時還原。

`scripts/check-r2-game-fullscreen.test.mjs` 的 10 項測試通過，由 `check-self-contained-game.test.mjs` 引入，沿用 `test:game-architecture` 與既有 CI matrix。

## 自動驗證結果

- `npm run test:game-architecture`：TypeScript 與 81 項測試通過，包含上述 10 項全螢幕回歸。
- `npm run test:entrypoints`、`npm run test:naming`：通過。
- `npm run test:hub-functions`：109 項通過；`npm run test:gamerunner`：34 項通過。
- `npm run build:hub`：37 個 build tasks 通過，Hub 仍排除四款 R2 bundle／JSON。
- 四款各自的 `npm --prefix apps/rehabtrainerhub/games/{gameId} run build`：全部通過。

本機 Brave 使用 `node scripts/check-r2-game-browser.mjs`，搭配下表參數；所有項目通過：

| gameId（省略時為 drawing-defense） | Hub 流程 | 獨立 PWA 流程 |
| --- | --- | --- |
| drawing-defense | `--lobby` | `--standalone` |
| asteroid-shield | `--game asteroid-shield --lobby` | `--game asteroid-shield --standalone` |
| gesture-battler | `--game gesture-battler --lobby`、追加 `--mobile` | `--game gesture-battler --standalone --mobile` |
| motor-cortex-rehab | `--game motor-cortex-rehab --lobby`、追加 `--mobile` | `--game motor-cortex-rehab --standalone --mobile` |

驗證包含相機同意按鈕的實際命中測試、相機拒絕後重試、原生遊戲根元素全螢幕、完整活動、數值成果、保存失敗重試及返回。手機為 Brave 尺寸／觸控模擬。兩款手部遊戲的 Hub 桌機與手機模式均驗證返回前後大廳捲動位置相同。

測試過程曾遇到同步程式將遊戲 `dist/index.html` 改為 conflicted 檔名，以及重建期間的 Service Worker 預快取失敗；重新建置並在固定輸出下執行後通過。測試未刪除既有捲動／快取／安全斷言。

## 驗收步驟與限制

1. 從 Hub 大廳開啟四款遊戲，確認設定、教學、最終參數確認都未進入全螢幕。
2. 兩款手部遊戲確認相機同意按鈕實際可見、可用滑鼠／觸控點擊；拒絕後可重新設定及重試。允許相機並等候就緒後，再按開始訓練／校正進入全螢幕。
3. 確認計時／校正取樣在全螢幕請求完成後開始。完成活動、保存失敗重試與成果欄位沿用原功能。
4. 返回 Hub 或獨立 PWA 入口，確認外層 `document.fullscreenElement === null`、相機 track 已停止、Hub 大廳捲動位置保留。
5. 手部目標追蹤另外在成績畫面主動切成全螢幕，再按返回，驗證此階段也會退出。

Brave 的相機驗證使用已核對圖片形成的串流與實際 MediaPipe 模型／WASM，不代表真人、實體相機或 Safari／iOS 已驗收。所有瀏覽器測試只寫本機 SQLite。

遊戲內容已改變，但既有正式版本未覆寫。後續發布需先設定新版本、建置並核對精確 contentSha256，取得當版擁有者核准，再依現有發布及正式驗收流程辦理。
