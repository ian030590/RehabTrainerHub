# UI／UX 修正與 TDD 證據（2026-11-10）

依擁有者要求，先以可執行測試重現 [審查報告](uiux-audit-2026-11-10.md) 的問題，再修改產品；另加入 OKLCH、Stagger 與 Shared element transition。本次只修改 Hub／平台 UI，未發布、部署、推送或寫入正式資料。

## 修正與先失敗的證據

| 範圍 | 修正前測試失敗原因 | 修正後行為 |
| --- | --- | --- |
| 登入與問卷視窗 | 非原生 modal、焦點未移入或可離開、錯誤在視窗外；取消後舊請求仍可影響新狀態 | Native dialog + body portal，背景 inert、Tab／Shift+Tab 循環、可達的關閉、焦點還原、視窗內錯誤公告 |
| 隱藏父層與登入競態 | 自動問卷位於 hidden 帳號選單內；storage 事件取代請求後一直 pending | 問卷實際可見並可操作；以當前請求世代結束 pending，關閉後有可見的焦點返回位置 |
| 手機登入 | 大量前置文字與關閉操作在捲動範圍內；登入等待沒有回饋 | 完整說明可展開，保留既有明確同意與驗證；關閉操作在捲動區外，立即顯示 pending 並可取消 |
| 清單 | 首次 loading 回傳 null，晚到內容插入結果前 | 患者清單保留精簡狀態列；載入、無清單、錯誤及已載入的收合列穩定，內容由使用者展開 |
| 進度與 CSV | 錯誤仍顯示假零值／無紀錄，沒有可用重試或重試了錯誤操作 | 區分未知與真零；重試清單、指定下載或分頁，保留已確認資料，切換帳號立即遮蔽前一帳號資料 |
| 圖示／色彩／觸控／排版 | 缺少本機圖示、OKLCH 色票、44px 操作區及繁中標題專用 metrics | 本站 10KB 圖示子集、語意 OKLCH + 原色 fallback、對比計算、44px 操作區、涵蓋 zh-Hant-TW 的標題排版 |
| Stagger | 缺少新增可見卡片的短暫位移；無 reduced-motion／中斷行為 | 畫面內新增卡片 160ms、每張 24ms、最多延遲 96ms；保留卡片／畫面外不重播，控制項立即可用 |
| Shared element transition | 缺少共享過場，及原型的重複命名／捲動鎖造成 viewport 改變 | 公開卡片與 dialog 背景表面雙向 220ms；具名表面不含 iframe，可中斷、清理命名、處理 Promise rejection；不支援 API 或減少動態時直接切換 |
| 網站導覽 | reduced motion 仍請求 smooth，快速切步留下舊 timer | 尊重偏好直接定位、取消舊捲動並比對步驟；減少動態時也停止非必要旋轉 |
| 推送接線 | 原 hook 只跑七項一般 gate，新增瀏覽器 gate 不會執行 | 保留完整 test:ci，成功後執行適用的本機瀏覽器 gate；任一失敗阻止推送，已用本機 bare remote 驗證 |

失敗日誌位於 `.tmp/uiux-implementation/`：`auth-red.txt`、`auth-review-red.txt`、`auth-cancel-race-red.txt`、`auth-error-focus-red.txt`、`auth-backdrop-red.txt`、`progress-red.txt`、`csv-retry-red.txt`、`motion-red.txt`、`motion-unique-name-red.txt`、`visual-red.txt`、`browser-visual-red.txt`、`browser-hook-red.txt`。這些是本機臨時證據，不納入版本控制。

其中瀏覽器先重現缺少圖示字型／OKLCH，以及 320px 的標題「開發居家練習遊／戲」。修正後再由實際渲染驗證，沒有把單純 CSS 出現某屬性視為完整證明。後續還重現原型 transition 的重複名稱，以及捲動鎖導致的 `Viewport size changed`，修正後確認 native `ready` 成功且實際產生具名動畫。

## 自動化與執行方式

新增一般測試：

- `scripts/check-auth-dialog.test.mjs`
- `scripts/check-progress-feedback.test.mjs`
- `scripts/check-hub-motion.test.mjs`
- `scripts/check-hub-visual-contract.test.mjs`

這 **34 項** 經 `test:uiux` → `test:entrypoints` → `test:ci` 執行。既有 identity、指南、清單與推送 hook 測試一併回歸；沒有修改七項 gate 的清單或繞過失敗。

```powershell
npm run test:uiux
npm run test:ci
npm run test:uiux-browser
npm run test:seo
```

`test:uiux-browser` 先建置 Hub，再以 Brave 與靜態輸出執行 12 個本機驗收情境。API、身分、延遲及失敗都是攔截的假回應，禁止正式站目標；圖示驗收阻擋外部服務並確認全部 32 個 glyph 真正形成圖示。可用 `BRAVE_BIN` 指定瀏覽器。

`.githooks/pre-push` 在全部七項 gate 成功後執行這個本機瀏覽器檢查。Windows 缺少 Brave 會失敗；沒有 Brave 的其他主機明列 NOT ASSESSED，須在具備 Brave 的主機執行。沒有新增 Linux CI 的瀏覽器需求。每個 checkout 仍須 `npm run prepare`，本次確認 `core.hooksPath=.githooks`。

Windows PowerShell 的 `bash` 若解析到 WindowsApps 的 WSL alias，既有 wrapper 測試會因環境變數與 Windows 路徑傳遞而失敗。本次先重現該環境問題，再將 **本次測試程序的 PATH** 指向已安裝的 `C:\Users\ian\scoop\apps\git\current\bin`；原 wrapper 六項回歸全部通過，未修改或略過 wrapper 測試。

## 驗收結果

- 新增一般測試：34／34 通過。
- Auth 與既有身分回歸：29／29 通過。
- 靜態 Hub 建置：通過，包含輸出架構與 SEO 檢查。
- 靜態輸出的 Brave UI／UX：12／12 通過。具名過場與 Stagger 的實際證據保留於 `.tmp/uiux-implementation/browser/`。
- `test:seo`：8／8，輸出檢查通過。
- 七項 gate 分段全部通過：naming、PWA、game architecture（1400）、Hub functions（480）、runner（78）見 `test-ci-gitbash.txt`；entrypoints 見 `entrypoints-final.txt`；Cloudflare 部署邏輯測試（52）見 `cloudflare-final.txt`。括號只列該測試 runner 的項目數，並非全站總數。
- 畫畫塔防手機完整本機 R2 流程通過：設定 → 教學 → 訓練 → 成果 → 保存失敗 → 重試 → 一筆本機紀錄 → 返回大廳，原捲動位置 537px 還原。見 `r2-mobile-final.txt`。
- `git diff --check` 通過，沒有納入 Next dev 自動產生的工作規則或環境宣告變更。

整套 gate 另外揭露舊對比測試以第一個 `}` 前的文字當作 root tokens，新增 `@font-face` 後會選錯區塊。修正為依 `:root` 選擇器取值，保留原有 3:1 斷言；新的 OKLCH 對比測試另驗證實際現代色票。修正後重跑 entrypoints 及最後一項 gate，其餘已通過項目沒有省略失敗或改成跳過。

既有畫畫塔防瀏覽器測試也仍要求 D1 保留逐回合資料，與目前私人 CSV 契約衝突。本次先留下失敗，再改為更完整地驗證：客戶端確有逐回合成果、兩個 D1 欄位都是無原始回合的摘要，以及私人 CSV 的版本、範圍、雜湊與完整筆數。未修改遊戲或資料 API，也沒有放寬保存檢查。

未驗證實體手機、Safari／iOS、真人問卷、相機及所有遊戲硬體流程。過場對不支援 API 的瀏覽器已有立即切換 fallback；本機 UI 測試不取代實體裝置或所有遊戲驗收。
