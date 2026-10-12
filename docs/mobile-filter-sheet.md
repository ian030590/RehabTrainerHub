# 手機大廳篩選 Sheet

互動參照 [Apple Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)；這是網頁實作，並非 SwiftUI 系統元件。

720px 以下沿用同一份篩選選項，使用原生 modal dialog，支援中段／展開高度、跟手拖曳、依距離與速度吸附／關閉、彈簧回彈及背景頁縮退。展開時向上捲動內容；內容回到頂端後，下拉可縮回中段，再下拉關閉。把手也可用點擊、Enter／Space 調整高度。

篩選維持即時套用。把手、標題與選項區可開始拖曳，拖曳 checkbox 不改變選取；關閉、背景、Escape 與「查看結果」皆保留選項。原生 dialog 限制背景操作與鍵盤焦點；固定 body 防止背景捲動，關閉或卸載時還原原有 inline style、焦點與捲動位置。桌機／平板保留行內篩選。共用行為與樣式位於 `packages/ui/src`，未新增依賴。

`visualViewport` 更新高度與底部位置，並保留上下安全區。減少動態模式直接到達目標高度、停用背景縮退；彈簧以時間步進，30／60／120Hz 維持相同速度。

## TDD 與驗證

- `scripts/check-mobile-filter-sheet.test.mjs` 先因缺少原生 modal／吸附／彈簧實作失敗；上方 47px 安全區先得到錯誤的 820px 展開高度，修正後為 785px；30Hz 動畫原本較慢，改用小時間步進後通過。沿用 `test:entrypoints`，沒有新增 CI matrix。
- 本機 Brave 增加 390×844、600×844、820×844、390×390 與減少動態模式，驗證篩選、拖曳、回彈、背景／Escape／查看結果關閉、值保留、焦點與捲動還原。另用 CDP 的實際滑鼠／touch gesture 驗證把手及展開後內容捲動；不將合成 touch event 或桌機模擬當作實體 iPhone 驗收。
- 背景縮退測試先失敗；從 checkbox 開始向上拖曳亦先失敗，再擴充可拖曳區域。瀏覽器工具改為等待非同步斷言並拒絕 CDP `exceptionDetails`，避免把拒絕的 Promise 所回傳之錯誤物件誤認為通過；已以刻意拒絕的斷言確認測試會失敗。
- 「查看結果」關閉途中再點把手的測試先造成面板重新展開；關閉期間忽略調整高度後通過。測試中的開啟焦點使用 `preventScroll`，避免人工 `.focus()` 自行捲動畫面而干擾捲動還原驗證。
- 執行 `npm run test:entrypoints`、`npm run test:naming`、`npm run build:hub`，最後以 Hub app 的 build 更新輸出，再對固定輸出做 Brave 回歸。同步工具可能將建置檔改名為 `[conflicted N]`；本機檢查使用 `.tmp/filter-sheet/output` 的完整固定副本。
- 最終結果：面板單元／契約測試 7 項通過，Brave 面板完整驗證與其餘 6 項回歸均通過，涵蓋原大廳目錄、14 款認知遊戲的啟動、原設定／全螢幕、訪客／登入成果保存、手機操作目標與四種寬度的導覽。最終入口 gate、命名、TypeScript、Hub build／產物架構與 SEO 輸出檢查通過。

## iPhone 人工驗收

1. Safari 與安裝後 PWA 各開啟大廳，先捲動，再開啟篩選。確認背景縮退、不能捲動，且沒有水平溢出。
2. 由把手、標題與 checkbox 上方分別向上拖至展開；持續上滑可捲動選項。向下捲至頂端，再拖回中段；短拉回彈、快速下甩與長下拉關閉。拖曳不切換 checkbox。
3. 選取分類後分別以背景、關閉與查看結果結束，確認選項、筆數、原大廳位置與焦點保留；以 VoiceOver／外接鍵盤檢查標題、把手、Tab／Shift+Tab、Enter／Space 與 Escape。
4. 開啟面板時旋轉螢幕、收合 Safari 工具列，檢查把手、關閉與結果按鈕避開瀏海及 home indicator；超過 720px 時回復行內篩選並解除鎖定。
5. 開啟系統減少動態效果再重做開關與拖曳，確認停用動畫及背景縮退。

Safari／實體 iOS、VoiceOver 與裝置觸覺尚待上述人工驗收；不宣稱與系統 sheet 手感完全相同。

## 正式部署驗證（2026-10-12）

- 程式提交：`f8a93b7df9b124e1410d288a181ec85118e261de`。既有 [CI／部署流程](https://github.com/ian030590/RehabTrainerHub/actions/runs/38187963929) 的七項驗證與部署均成功。
- Hub：[0f753a83.rehabtrainerhub.pages.dev](https://0f753a83.rehabtrainerhub.pages.dev)；runner：[e5db427e.trainerhub-user-games.pages.dev](https://e5db427e.trainerhub-user-games.pages.dev)。正式 [trainerhub.cc](https://trainerhub.cc/) 回覆 200，HTML 已含新面板；runner 入口、robots.txt 與 sitemap.xml 均回覆 200，內容型別正確。
- 直接對正式站使用 Brave 驗證 390×844、600×844、820×844 與減少動態模式，完整篩選、拖曳／吸附、關閉競態、背景縮退、選項保留、焦點與捲動還原均通過。另以 390×700 的實際 CDP 滑鼠／touch 輸入驗證把手展開與內容捲動通過。
- 正式驗證只操作篩選，不啟動訓練或建立正式訓練紀錄；本機詳細結果保留在 `.tmp/filter-sheet-production-results.json`。Safari／實體 iOS 與 VoiceOver 仍待人工驗收。
