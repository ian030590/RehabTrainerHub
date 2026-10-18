# 哈特圖教學與練習畫面對齊

2026-10-18 已依擁有者「核准發佈」將本修正發布為 `hart-chart@2.0.1`，完成五檔回讀、current 切換與九項正式 Hub／PWA 流程驗收。五檔共 651,767 bytes，`contentSha256: d604b2e25963b90ed8d6ad2e39d230b2d87dad8f3204ae44d30c2301a4884366`。沒有部署 Hub／runner，沒有正式帳號或成果寫入；[正式收據](releases/hart-chart-2.0.1.json)、[核准紀錄](migrations/hart-chart-tutorial-parity/approval.json)與[驗收摘要](migrations/hart-chart-tutorial-parity/production/acceptance-summary.json)。

原本聚光燈照的是另一套縮小的教學版面：字體被 CSS 強制縮小、解碼器只有五個座標文字，工具列也只是一行說明，與實際訓練不同。

現在設定背景、教學與練習使用同一個 `hart-page`，直接呈現真正的字母表、完整座標輸入框、停靠位置與工具列。移除獨立預覽 JSX 及字體覆寫。三步聚光燈分別指向 `.hart-chart-grid`、`.hart-decoder-panel`、`.hart-topbar-controls`。

確認設定時準備新的字母表；教學結束後開始訓練沿用該表與座標。計時仍由進入 playing 後的 jsPsych lifecycle 啟動。教學期間實際畫面設為 `inert`，輸入處理另檢查 playing 階段，避免教學操作被計入答案或嘗試次數。確認面板位於遊戲畫面上方。

## TDD

| RED：先執行測試的失敗原因 | GREEN：修正後結果 |
| --- | --- |
| 聚光燈仍指向 `hart-preview-*`，rules 階段找不到實際 `hart-page` | 教學測試驗證中英文、三種大小、5／30 個完整輸入框，以及與練習一致的版面與字體；教學輸入不改變狀態 |
| 開始訓練呼叫 `resetChart`，使教學中的字母與座標被換掉 | 全螢幕完成後只啟動練習；晚到的啟動仍取消並清理全螢幕 |
| 新版本檢查仍讀到 `2.0.0`；設定記憶 fixture 也固定舊版本 | package.json／lockfile 升至 `2.0.1`，同步設定記憶 fixture；沒有改變設定儲存或成果契約 |

`node --test scripts/check-hart-chart-migration.test.mjs scripts/check-hart-chart-tutorial.test.mjs`：12 項通過。既有設定、演算法、原圖、五項數值成果、私有 bridge 與啟動取消檢查保留。

## 回歸驗證

- `npm run test:game-architecture`：296 項通過，包含所有遊戲 TypeScript。
- `npm run test:entrypoints`、`npm run test:naming`：通過。
- 哈特圖單獨 build、`npm run build:hub`：通過；Hub 仍排除已遷移遊戲 bundle，40 個入口與 SEO 檢查通過。

Brave 使用 `node scripts/check-r2-game-browser.mjs --game hart-chart` 加上下列旗標：

| 旗標 | 結果 |
| --- | --- |
| `--lobby --wide --windowed` | 1320×713 桌機：三步聚光燈、返回設定、確認、全螢幕／視窗、解碼、QR、提示、成果、保存失敗重試與返回捲動通過 |
| `--lobby --mobile --hard` | 390×844 手機：30 個輸入框、聚光燈不遮住目標、完整保存與返回流程通過 |
| `--lobby --signed-in --english --hard --small --wide --windowed` | 英文、小字體、30 個輸入框、本機帳號身份隔離與保存重試通過 |
| `--lobby --signed-in --english --hard --small` | 752×485 小視窗：三步教學不遮擋目標、原生全螢幕、完整保存與返回捲動通過 |
| `--standalone --tablet --english --small` | 820×1180 平板英文獨立 PWA：聚光燈、小字體、完整解碼、QR 與返回設定通過，不上傳成果 |

瀏覽器測試直接比較教學與開始後的字母、座標、完整輸入框數、字體變數、停靠 class 與工具按鈕，並逐步檢查聚光燈邊界、resize、面板不遮擋目標及鍵盤焦點。Hub 紀錄只寫本機 SQLite，沒有正式帳號或紀錄。

首次 Hub 流程使用舊本機輸出，成果保存回覆逾時；重新建置 Hub 後，桌機與手機完整流程通過。沙盒內 esbuild 的父目錄讀取被拒，Brave 初始化也逾時；正常權限重驗 build 與瀏覽器通過，未修改安全政策。

英文小視窗首次返回大廳捲動等待逾時；最後以相同旗標重跑，752×485 全流程及捲動復位通過。

## 畫面

| 尺寸 | 教學 | 實際練習 |
| --- | --- | --- |
| 桌機 | [字母表聚光燈](migrations/hart-chart-tutorial-parity/desktop-tutorial.png) | [相同字母表與解碼器](migrations/hart-chart-tutorial-parity/desktop-gameplay.png) |
| 手機 | [解碼器聚光燈](migrations/hart-chart-tutorial-parity/mobile-tutorial.png) | [相同完整解碼器](migrations/hart-chart-tutorial-parity/mobile-gameplay.png) |

## 視覺交付檢查

- Hard Gate PASS：桌機／手機／平板無頁面溢出，三個教學面板均留在畫面內且不遮住目標；沿用既有焦點與教學鍵盤測試。
- Purpose Gate PASS：刪除教學專用版面與字體覆寫，使用遊戲原有視覺與操作元件。
- Liveliness PASS：沿用既有安靜易讀方向（ENERGY 1／RHYTHM 1／MOTION 1）；每一步由聚光燈明確標出一個練習目標。
- Craftsmanship PASS：保留設定、教學返回、全螢幕、提示、停靠、縮放、QR、完整數值成果與保存重試，五個上述瀏覽器流程通過。

## 正式發布與驗收

新版本五檔均在上傳後回讀 SHA-256，最後發布 approved manifest，再切換 current。正式 `/api/games` 只有一筆哈特圖 `2.0.1`、分類 `vision`；不指定版本的 session 綁定 `2.0.1` 與相同摘要。逐檔公開 bytes、Content-Type、CSP、穩定入口 `302 /games/hart-chart/2.0.1/`／no-store、嚴格 sandbox 及舊 JSON／JS／SW `410` 全部通過。[正式 API 與 bytes 證據](migrations/hart-chart-tutorial-parity/production/production-verification.json)。

七項本機發布 gate 全部通過：naming、PWA（18）、game-architecture（296／全遊戲 TypeScript）、Hub Functions（133）、runner（55）、entrypoints、Cloudflare deploy dry-run。[日誌](migrations/hart-chart-tutorial-parity/tests/)。這次沒有新增 Git commit／push 或觸發遠端 CI。

九項正式瀏覽器流程全部通過：

| 模式 | 內容 |
| --- | --- |
| 正式 Hub 桌機／手機／平板／英文登入 | 三步聚光燈、相同字母與座標、完整輸入框、全螢幕、縮放、提示、QR、成果、保存重試及返回；手機另驗 session 失敗重試，平板與英文驗 30 字母／小視標 |
| 正式手機 PWA／英文平板 PWA | 完整練習與成果，無正式上傳 |
| 正式平板 PWA 停止 | 退出全螢幕、返回設定且不保存 |
| 正式 Hub／手機 PWA 設定記憶 | 重新載入後還原視標大小與停靠設定 |

Hub 模式讀取真正部署頁面與 R2，僅攔截 `/api/*` 至本機 SQLite；PWA 直接讀正式 runner／R2。測試帳號與成果只在本機，沒有正式帳號或紀錄。[逐項驗收 metadata 與日誌](migrations/hart-chart-tutorial-parity/production/browser/)。

正式截圖：[桌機聚光燈](migrations/hart-chart-tutorial-parity/production/hub-desktop-tutorial-grid.png)、[桌機練習](migrations/hart-chart-tutorial-parity/production/hub-desktop-gameplay.png)、[手機聚光燈](migrations/hart-chart-tutorial-parity/production/hub-mobile-tutorial-panel.png)、[手機練習](migrations/hart-chart-tutorial-parity/production/hub-mobile-gameplay.png)、[手機 PWA 聚光燈](migrations/hart-chart-tutorial-parity/production/pwa-mobile-tutorial-grid.png)。

`2.0.0` 的 approved manifest、五個私人 R2 檔案與五個公開檔案均已依既有收據回讀核對，current 歷史保留舊摘要，沒有實際回退。需要回退時執行 `node scripts/publish-official-game.mjs hart-chart --activate-version 2.0.0`。

哈特圖發布完成後的首次核對，其他九款 current 均未變。驗收期間另一個工作流程於 `2026-10-18T11:40:52.417Z` 獨立發布 `driving-rehab@2.0.1`（摘要 `d2b1d8e8d40cb4535a4a16f99f2b1bb262531e13eb81975c120a4e25362a89f9`）；最終核對其發布收據、R2 current 與 approved manifest 一致，另外八款未變。哈特圖 publisher 僅寫入自己的五檔／manifest／current，沒有寫入駕駛或其他遊戲。兩站部署與發布前相同。

手機與平板是 Brave 模擬；實體觸控、Safari／iOS、實體音訊與跨裝置 QR 掃描尚未驗證。已安裝的版本化 PWA 仍固定原版，穩定入口現在選擇 `2.0.1`。
