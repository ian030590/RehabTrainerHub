# Hub UI rehearsal

## 設計與範圍

以 `DESIGN.md` 的居家練習工具定位為準，保留品牌綠、Noto Sans TC、Material Symbols 與遊戲自有預覽圖。ENERGY 1 / RHYTHM 2 / MOTION 1：目錄是主角，說明退居次要，只有既有抽屜保留必要動態。

Stageshow 參照 `examples/static-card` 與 `references/craft.md` 的主次、內距、文字密度和真實產品內容原則。這是可操作的 Hub，直接重構原有元件，不在產品內插入虛構瀏覽器、假資料或自動播放的示範操作。沒有新增套件或生成素材。

首頁集中標題、練習前提醒、搜尋及指南入口；卡片保留完整 16:9 遊戲畫面、分類識別、作者、開始與安裝。手機為單欄與底部分頁，平板為兩欄與篩選抽屜，桌面保留側欄。抽屜與程式的分界一致為 1023px，寬度最多 680px。

## TDD 與既有流程

- 修改前，47 項導航、分類、分頁、練習清單及訓練通訊測試通過。
- 新增搜尋清除測試先因缺少清除按鈕失敗；實作後確認搜尋歸零、分類保留、焦點回輸入欄。
- 新增指南測試先因缺少實際錨點失敗；實作後確認連結與目標存在、維持一個 H1 及明確搜尋標籤。
- 新增平板篩選測試先因 720px 舊分界失敗；實作後與 CSS 同步為 1023px。
- 保留遊戲開始、安裝網址與 overlay 關閉測試。修正既有瀏覽器測試對「全部遊戲同時顯示」的過期假設，驗證每頁 12 筆、總數、第三方搜尋、安裝目的地及官方 slug 衝突保護。
- 新增 Node 測試已接到 root `test:entrypoints`，由 `test:ci` 與 `.githooks/pre-push` 間接執行。

## 本機重驗方式

推送 UI 變更前執行以下檢查；保留 pre-push 的七項 gate，不得跳過失敗測試：

```powershell
npm run prepare
npm run test:ci
npm run build:hub
npm run test:game-architecture:browser
node scripts/check-r2-game-browser.mjs --game driving-rehab --lobby --mobile
```

瀏覽器 suite 使用本機正式 build，需要 Brave；可設定 `BRAVE_BIN` 或 `BROWSER_EXECUTABLE_PATH`。完整訓練 fixture 還需要現有 runner 輸出與該遊戲 `dist/`，只寫入本機記憶體 SQLite。這兩項屬於本機推送前驗收，不放進沒有 Brave 的 Linux CI。

`npm run test:ci` 七項 gate、`npm run build:hub` 與 `npm run test:seo` 均通過；建置同時通過 51 款遊戲隔離架構檢查。駕駛遊戲手機 fixture 的設定、三步聚光燈、完整練習、成果保存重試與返回均通過，Hub 捲動還原，390px overlay 與遊戲沒有溢出。

`npm run test:game-architecture:browser` 5/5 通過：非同步失敗偵測、手機／平板抽屜與焦點捲動、官方與第三方分頁目錄、44px 頂部操作區，以及四主路由在四種寬度的導航。

## 畫面與品質檢查

截圖位於 `.tmp/hub-stageshow/`，包含首頁、空結果、抽屜、帳戶及七個內頁。靜態預覽的遊戲清單與未登入 session 使用本機 fixture；既有瀏覽器 suite 另驗證已審核的第三方遊戲。這些不是正式 API 驗收。

- Hard gate PASS：320、390、768、1024、1440px 首頁無橫向溢出；四路由與帳戶操作可達；圖片保留完整畫面；搜尋、空結果、清除及分類可操作。
- Purpose gate PASS：品牌綠標記導航與共用操作，遊戲分類維持自有色；低彩度表面區分提醒；陰影用於浮層；沒有裝飾性動畫或虛構統計。
- Liveliness PASS：真實遊戲圖片是視覺重心，分類色、既有識別圖示與一致的閱讀邊線提供產品辨識。
- Craft PASS：繁中／英文、200% 文字縮放與減少動態已檢查；進度、衛教、下載、開發者、管理、關於與隱私頁於 390、768、1440px 無頁面橫向溢出。
- Contrast PASS：次要文字在頁面為 5.71:1、在提醒底色為 5.26:1；標題在白底為 12.12:1；品牌綠在選取底色為 5.41:1。由 antislop-human `contrast-check.py` 驗證。

沒有變更正式部署、遊戲發布、資料保存協定或安全權限。未實測 Safari／iOS、實體觸控裝置與正式帳號登入；它們仍需在實際發布環境驗收。

額外嘗試的 `reaction-time --lobby --mobile` 已走到成果保存重試，但舊 `brain-r2-browser.mjs` 仍以 D1 `score.rounds.length === 7` 驗證，與目前「D1 僅摘要、R2 保存逐筆 CSV」契約不符而失敗。未為了此斷言修改產品或放寬資料隔離；完整流程改用已對齊該契約的駕駛 fixture 驗收。
