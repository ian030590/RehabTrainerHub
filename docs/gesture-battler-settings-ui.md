# 手勢指令對戰設定與教學版面

2026-10-09 完成本機 UI 修正；2026-10-10 依擁有者「發佈並且git push」指示發布 `2.0.2` 並切換 R2 current。

- 設定沿用畫畫塔防的前景視窗、活動設定分段卡片、字級基準、可捲動內容及獨立底部操作列。「遊戲教學」與返回按鈕採既有遊戲自有樣式。
- 四項設定、預設值、範圍與安全驗證保留，教學返回設定後保留選擇。
- 教學直接呈現遊戲自身的對戰 HUD：手部預覽在左下、敵人狀態在右上、招式列表在右下。四段聚光燈指向這些實際介面，刪除另外一套示意卡片。
- 設定／教學只顯示手部示意；開始並同意相機後才透過原有私有輸入代理校正與遊玩。沒有引入平台 UI 或其他遊戲的程式碼。

## 測試先行

先修改 `scripts/gesture-battler-browser.mjs`，再執行：

```powershell
node scripts/check-r2-game-browser.mjs --game gesture-battler --standalone
```

原程式以 `Settings use the drawing defense section layout` 失敗：預期「活動設定」，實際沒有分段標題。之後才修改遊戲 JSX 與 CSS。

新增驗收同時檢查四個設定欄位、底部按鈕間距與主次樣式、內容捲動、教學／對戰三個區塊的方位、不重疊、無水平溢出及教學不啟動相機。手機額外在 390 × 844 與 844 × 390 驗證教學；等待 iframe 尺寸更新後才檢查聚光燈，避免量到切換中的畫面。

## 修正後驗證

- `npm run test:game-architecture`：TypeScript 與 53 項測試通過。
- `npm run test:entrypoints`、`npm run test:naming`、`node --check scripts/gesture-battler-browser.mjs`：通過。
- `npm --prefix apps/rehabtrainerhub/games/gesture-battler run build`：通過。
- Brave 完整流程通過：下列命令都以本機 runner 與 SQLite 驗證設定、完整教學、返回／略過、相機同意／取消重試、實際 MediaPipe 七步校正、對戰、成績、相機停止及返回入口；Hub 模式另驗證保存失敗重試與身份範圍。

```powershell
node scripts/check-r2-game-browser.mjs --game gesture-battler --standalone
node scripts/check-r2-game-browser.mjs --game gesture-battler --lobby
node scripts/check-r2-game-browser.mjs --game gesture-battler --lobby --mobile
node scripts/check-r2-game-browser.mjs --game gesture-battler --lobby --signed-in --english --directed
node scripts/check-r2-game-browser.mjs --game gesture-battler --standalone --mobile --english --directed
```

桌機／手機中文大廳的初次測試使用 `HUB_OUTPUT_ROOT=.tmp/gesture-hub-output` 固定副本；英文登入指定模式及手機最終驗證使用本次建置的 `apps/rehabtrainerhub/out/`。本機截圖保留在 `.tmp/gesture-validation/` 對應模式目錄。

`npm run build:hub` 的預設 Turbopack 在本機兩次因 `.next` manifest 遺失失敗，產物可見 `[conflicted 10]` 名稱。改在 Hub 目錄執行 `node ../../node_modules/next/dist/bin/next build --webpack` 通過，再完成原 build script 的匯出整理、37 款遊戲複製、Hub／遊戲 PWA 產生、`check-built-game-architecture.mjs` 與 `check-seo-output.mjs`，全部通過；未修改正式建置設定。

相機驗收使用已核對圖片形成的串流，沒有驗收實體相機、真人手勢、Safari 或 iOS。本次使用新版本 2.0.2，保留已發布的 2.0.1，沒有覆寫檔案。

## 正式發布與驗收

- 版本：`2.0.2`；完整 contentSha256：`cbc35d319fd69922705fb9986831b10f3731de124a9be8b215f13b21bb0dca4c`。
- [正式收據](releases/gesture-battler-2.0.2.json)保留使用者發布指示、逐檔清單、正式 API／PWA／session／CSP 與瀏覽器證據。Publisher 逐檔上傳、回讀 SHA-256，再發布 manifest 與切換 current，沒有覆寫舊版。
- 不指定版本的正式 session API 回覆 201 與此版本／摘要；token 未輸出或保存，沒有送出正式訓練成果。正式目錄只有一個官方 slug，分類、雙語資料與版本化預覽圖都核對通過。
- 正式瀏覽器通過桌機、手機直橫向、英文登入指定模式及手機英文獨立 PWA；另以本機固定 Hub 輸出搭配正式 R2 驗證大廳流程。全部保存只寫本機 SQLite。
- [正式截圖](migrations/gesture-battler-2.0.2/production/)保留設定、左下手部教學與對戰。
- `2.0.1` 的核准 manifest 與實際檔案雜湊已核對，回退命令：`node scripts/publish-official-game.mjs gesture-battler --activate-version 2.0.1`；本次未實際回退。
- 現有正式 Hub／runner 已支援此版本，R2 activation 不需重新部署兩站；Git push 後仍按現有 workflow 驗證並處理 Pages 部署。

## Git push、CI 與部署後驗證

提交 `712321d799a08e0f07462fb3a3ae639d341c47c9` 已推送至 `origin/main`；[七項驗證與 Pages 部署](https://github.com/ian030590/RehabTrainerHub/actions/runs/37958379827)全部成功，包含 Linux 預設 Hub 建置。

- Hub deployment：`57abb260-b51b-4d12-943a-f809719bb2d1`。
- Runner deployment：`6bde5a12-eb29-4448-b2a0-83aaa40047fd`。
- 兩站部署都對應此提交；部署後再次回讀正式 API、固定版本 session、逐檔 SHA-256／CSP、PWA 與 2.0.1 回退版本，並重跑實際正式 Hub 桌機／手機完整流程，全部通過。成果仍只寫本機 SQLite。
