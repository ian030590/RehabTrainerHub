# 移動卡片訓練：視覺搜尋與教學圖卡修正

2026-10-12 擁有者核准精確版本／摘要，已發布 R2 並切換 current；正式 API 與 Hub／獨立 PWA 的手機、桌機三種排列共 12 個完整流程均通過。正式收據見 [moving-card-2.0.1.json](releases/moving-card-2.0.1.json)。

## 已核准並發布的套件

- Game：`moving-card`
- Version：`2.0.1`
- `contentSha256`：`85197c5f6a4e41f6e53d5b2d307a5d0703c682a3b978a1103b26064e664318e3`
- `node scripts/publish-official-game.mjs moving-card --dry-run` 通過：5 個套件檔案；逐檔摘要見 `.tmp/official-game-releases/moving-card/2.0.1/release.json`。
- 已驗收的完整 bytes 保留於 `.tmp/moving-card-visual-search-2.0.1/package/`。本機同步工具曾把 `dist/index.html` 改成 `index [conflicted ...].html`；衝突副本已保存於 `.tmp/moving-card-layout-baseline/`。恢復原入口後重新驗證相同摘要，不放寬發布掃描器。發布前已逐檔核對凍結副本、既有 `dist/` 及上述摘要。

## 修改內容

設定與最終確認使用「方形排列」、「圓形散亂」、「圓形散亂旋轉」；英文為 Square grid、Scattered circles、Scattered circles with rotation。

教學與 Pixi renderer 使用同一個遊戲自有 `cardLayout.ts` 計算搜尋區域、圖卡尺寸、格線／散亂位置與旋轉角度。教學不再用 CSS grid 拉長圓形，字級依原毫米校正與可用圖卡尺寸縮限；目標、HUD、十字標記及搜尋區域亦對齊原玩法。ResizeObserver 更新圖卡後通知聚光燈重新定位；返回、略過、完成和卸載仍清除監聽器。

原玩法、數值成果、設定邊界、移動／重試、全螢幕、私有通道與保存契約保持原行為；預覽圖 SHA-256 保持 `e14346b7bef3fba14f82f9c377fde9d0709c529d75f5cc23ef5e81652180e2b6`。新增邏輯只位於 moving-card，不引入平台或其他遊戲程式碼。

## TDD 與回歸

修正產品程式碼前，先鎖定三種正式玩法在 390×844／1320×713、4／18／40 張圖卡與 resize 的尺寸、圓角、字級、完整選項與目標；既有錯選重試、計時、取消與原設定測試保持通過。

新增 Brave 行為測試先失敗：舊名稱不符；752×427 教學圓卡約 134.55×29.36 px，正式計算為直徑 25.43 px；教學選項字級 28 px／目標 48 px，正式為約 17.80／34.16 px；圓形模式仍在格線。修正後 DOM computed style 與實際 Pixi Graphics 的寬、高、圓角及 Text 字級相符。

新增教學 resize 測試另重現聚光燈落在更新前位置；通知重排後測試通過，並驗證所有退出路徑移除新增監聽器。

Hub 圓形散亂驗收亦發現原瀏覽器 fixture 可能點到已移動或被遮住的卡片，卻未確認錯選真的發生。fixture 改選最上層錯卡並等待實際紅色回饋，之後驗證同回合重試與保存的錯誤數；不停止正式移動、不放寬成果斷言。

全部通過：

| 檢查 | 結果 |
| --- | --- |
| `npm run test:naming` | 通過 |
| `npm run test:pwa` | 通過，含 18 項離線導航回歸 |
| `npm run test:game-architecture` | TypeScript 與 108 項測試通過 |
| `npm run test:hub-functions` | 117 項通過 |
| `npm run test:gamerunner` | 47 項通過 |
| `npm run test:entrypoints` | 入口、training flow、lifecycle、i18n 與原內含 gate 通過 |
| `npm run test:cloudflare-deploy` | 通過 |
| moving-card `npm run build` | 通過 |
| `npm run build:hub` | 35 個建置通過；Hub 保留 34 個舊遊戲，R2 bundle 排除與 SEO output 檢查通過 |

桌機／手機三種排列皆以 `node scripts/check-r2-game-browser.mjs --game moving-card --standalone` 驗證；桌機加 `--wide --windowed`，手機加 `--mobile`，圓形與旋轉分別加 `--medium`／`--hard`。涵蓋預設 18 張與設定 40 張、毫米校正、教學返回／值保留、三目標、視窗縮放、開始、原生全螢幕、真實滑鼠／觸控五回合、重試、成果切換、版本 scope 快取與返回入口。手機旋轉另以 `--english` 驗證。

Hub 使用固定本機 `HUB_OUTPUT_ROOT=.tmp/moving-card-hub-output`；`--lobby --wide --medium --windowed` 與 `--lobby --mobile --hard --english --signed-in` 通過，驗證大廳點擊、舊 slug 碰撞、固定 session、保存失敗後重試、完整成果與登入身份隔離、返回後還原大廳捲動。全部只寫本機 SQLite，未寫正式紀錄。

## 本機教學畫面

| 排列 | 電腦 | 手機 |
| --- | --- | --- |
| 方形排列 | [畫面](migrations/moving-card-visual-search-2.0.1/desktop-grid.png) | [畫面](migrations/moving-card-visual-search-2.0.1/mobile-grid.png) |
| 圓形散亂 | [畫面](migrations/moving-card-visual-search-2.0.1/desktop-circles.png) | [畫面](migrations/moving-card-visual-search-2.0.1/mobile-circles.png) |
| 圓形散亂旋轉 | [畫面](migrations/moving-card-visual-search-2.0.1/desktop-rotation.png) | [英文畫面](migrations/moving-card-visual-search-2.0.1/mobile-rotation-en.png) |

## 正式發布驗收

擁有者於本對話回覆「核准」，對應前一則明列的 `2.0.1` 與完整摘要。官方發布流程於 `2026-10-12T03:50:42.327Z` 完成逐檔 R2 回讀、manifest 與 current 核對。原 Wrangler access token 過期曾造成帳號查詢 403；以 Wrangler 更新同一登入權杖後成功發布，未重新建置或更換候選 bytes。

直接讀正式 `/api/games` 與 session API，確認 `moving-card@2.0.1`、受核准摘要、`vision` 分類、套件內原預覽圖與 `presentation=game`，沒有舊設定 JSON URL。正式 session 回 HTTP 201、固定版本／摘要與 no-store；穩定 PWA 入口回不可快取 HTTP 302 至 2.0.1。五個公開檔案全部回 HTTP 200，大小、SHA-256、Content-Type 與 package CSP 均核對通過；見 [API 驗收](migrations/moving-card-visual-search-2.0.1/production/api-verification.json)。

正式瀏覽器模式為 `--production-hub --lobby` 與 `--remote --standalone`；各跑桌機 `--wide --windowed`、手機 `--mobile`，以及三種排列（預設／`--medium`／`--hard`），共 12 個完整流程。手機旋轉另驗英文；Hub 旋轉另驗登入身份隔離。檢查相同卡片 geometry／字級、18／40 張、縮放後聚光燈、設定往返、原生全螢幕、真實 CDP 滑鼠／觸控五回合、錯選紅色回饋與重試、成績切換及返回。PWA 核對版本 scope 快取；Hub 驗保存重試與返回後大廳捲動還原。完整命令、時間、寫入範圍與截圖記於正式收據。

以下為真正正式 Hub／runner 的畫面，Hub `/api/*` 僅攔截到本機 SQLite，未建立正式帳號或訓練紀錄：

| 排列 | 電腦教學／玩法 | 手機教學／玩法 |
| --- | --- | --- |
| 方形排列 | [教學](migrations/moving-card-visual-search-2.0.1/production/hub-desktop-grid-tutorial.png)／[玩法](migrations/moving-card-visual-search-2.0.1/production/hub-desktop-grid-gameplay.png) | [教學](migrations/moving-card-visual-search-2.0.1/production/hub-mobile-grid-tutorial.png)／[玩法](migrations/moving-card-visual-search-2.0.1/production/hub-mobile-grid-gameplay.png) |
| 圓形散亂 | [教學](migrations/moving-card-visual-search-2.0.1/production/hub-desktop-circles-tutorial.png)／[玩法](migrations/moving-card-visual-search-2.0.1/production/hub-desktop-circles-gameplay.png) | [教學](migrations/moving-card-visual-search-2.0.1/production/hub-mobile-circles-tutorial.png)／[玩法](migrations/moving-card-visual-search-2.0.1/production/hub-mobile-circles-gameplay.png) |
| 圓形散亂旋轉 | [教學](migrations/moving-card-visual-search-2.0.1/production/hub-desktop-rotation-tutorial.png)／[玩法](migrations/moving-card-visual-search-2.0.1/production/hub-desktop-rotation-gameplay.png) | [英文教學](migrations/moving-card-visual-search-2.0.1/production/hub-mobile-rotation-en-tutorial.png)／[玩法](migrations/moving-card-visual-search-2.0.1/production/hub-mobile-rotation-en-gameplay.png) |

## 回退與限制

發布前已讀取正式 2.0.0 的核准版本及五個公開檔案，全部符合其既有正式收據，保留為已核對回退版；見 [回退驗證](migrations/moving-card-visual-search-2.0.1/production/rollback-verification.json)。需要回退時使用 `node scripts/publish-official-game.mjs moving-card --activate-version 2.0.0`，本次未實際執行回退。

此變更只發布 R2 遊戲，既有正式 Hub／runner 已支援新版本，未重新部署平台。七項驗證為核准前的本機 gate，沒有宣稱新增 CI run；本次沒有 Git commit 或 push 指示。

尚未驗收 Safari／iOS、實體觸控、尺量校正與長時間完整離線訓練；Brave 的手機模擬不代表實體硬體驗收。
