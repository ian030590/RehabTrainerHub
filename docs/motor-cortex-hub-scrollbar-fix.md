# 手部目標追蹤：Hub 水平置中與背景捲軸

2026-10-10。本機修正 `c36bc62` 與三尺寸完整流程已通過，正式部署狀態另記於本文末尾。

右側捲軸屬於遊戲背後仍可捲動的大廳，不是追蹤場景所需。原 Hub 訓練 dialog 使用 `100vw`，背景捲軸卻佔了 15px：Brave 量測視窗 752px、可視文件 737px、iframe 仍 752px，因此左右留白相對可視區域不對稱，右邊距被捲軸吃掉。

Hub 只在 `dialog.training-overlay[open]` 存在時將根文件 `overflow` 設為 `hidden`。iframe 因而填滿同一個可視寬度，遊戲左右 padding 恢復對稱；關閉視窗後自動恢復大廳捲軸與原 scroll position。設定視窗、完整成績與舊遊戲結果的內部捲動維持可用。

這是 Hub CSS 修正，沒有修改或重發 R2 遊戲。手部目標追蹤仍為 `2.0.0`，dry-run 確認原五檔摘要仍為 `e4e449522ccbb99c5f9fa1a6b0845f8b0202d78df73025d01b779f8a1c4b5b09`。

## 測試先行

先加入實際 browser 行為測試，再修改 CSS。`node scripts/check-r2-game-browser.mjs --game motor-cortex-rehab --production-hub --lobby` 在原正式站失敗：`scrollbarWidth=15`、根文件 overflow 為 `visible`、iframe 超出可視區域。新增檢查同時鎖定左右中心、遊戲頁面無內部捲軸，以及返回時的捲動狀態／位置。

修改後使用固定的 `HUB_OUTPUT_ROOT=.tmp/motor-scrollbar-output`，下列命令均通過；成果只寫本機 SQLite：

| 命令附加於 motor 專屬 browser 基底 | 尺寸／結果 |
| --- | --- |
| `--lobby --wide --windowed` | 1320×713；離開原生全螢幕後仍置中、無背景捲軸，完整 45 秒追蹤與返回大廳 |
| `--lobby --mobile` | 390×844；左右邊距、原生全螢幕、成績圖表／明細捲動、保存重試與返回 |
| `--lobby --tablet` | 820×1180；完整遊戲、成績與原捲動位置恢復 |

三種尺寸的 Hub `innerWidth` 與 `documentElement.clientWidth` 完全相同，捲軸寬均為 0；返回後根文件 overflow 恢復 `visible`，scroll position 分別保持 781、1950、1818。

`npm run test:entrypoints`、`npm run test:naming` 及修改腳本的 `node --check` 通過。`npm run build:hub` 的 36 個舊遊戲建置／快取成功，Hub 預設 Turbopack 再次遇到本機 `.next/build-manifest.json` ENOENT；改用 `next build --webpack` 後，Hub build 與原 prune／shell／PWA／architecture／SEO post-build checks 全部通過，未修改正式 build 指令。原生相機／MediaPipe 仍採核對過的圖片串流，不當作真人硬體驗收。

本機證據：[local-verification.json](migrations/motor-cortex-hub-scrollbar/local-verification.json)、[桌機視窗遊戲](migrations/motor-cortex-hub-scrollbar/local-desktop-playing.png)、[手機遊戲](migrations/motor-cortex-hub-scrollbar/local-mobile-playing.png)、[手機完整明細](migrations/motor-cortex-hub-scrollbar/local-mobile-results-details.png)、[平板遊戲](migrations/motor-cortex-hub-scrollbar/local-tablet-playing.png)。舊遊戲／第三方／JSON 設定／共用成績及導航的完整 Brave 回歸結果，記於同一份本機證據。

首次完整舊遊戲 browser run 在共用成績案例失敗一次，該案例獨立重跑通過 1/1；整批測試在導航檢查完成前因工作階段中斷，沒有最終總結。之後重新執行完整 `npm run test:game-architecture:browser`，5/5 通過、0 失敗，涵蓋目錄、舊遊戲設定／啟動、共用成績與訪客／登入保存、手機按鈕及四尺寸四路由導航；不放寬測試或修改共用成績程式。

## 正式部署驗收

使用者於 2026-10-10 明確核准這次 `git push` 與正式部署，並要求將左右過寬與不必要捲軸列入 R2 搬遷計畫的必查項目。待 CI／部署成功後，核對正式 Hub 桌機視窗／手機／平板。Safari／iOS 尚未驗證。
