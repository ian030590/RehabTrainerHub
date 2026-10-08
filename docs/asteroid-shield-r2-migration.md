# 小行星護盾防衛 R2 遷移審查單

日期：2026-10-09。狀態：**擁有者已核准精確候選，R2 已發布並回讀驗證；Hub 切換待推送／部署與正式驗收。** 本紀錄依 [搬遷計畫第 7、11 節](r2-game-migration-plan.md) 填寫，未完成正式驗收前不標記遷移完成。

## 當版候選與核准邊界

| 項目 | 候選內容 |
| --- | --- |
| gameId／slug | `asteroid-shield` |
| package version | `2.0.0` |
| contentSha256 | `ea21aa905a9537eaac404f83b606d39c782b42987266f8762bd88f397dd1566e` |
| 發布檔案 | 12 檔、1,214,678 bytes；[完整逐檔清單](migrations/asteroid-shield-2.0.0-candidate.json) |
| 格式／能力 | `presentation: game`；audio、fullscreen、pointer、touch |
| 作者／分類 | 居家訓練網；`motor`／`upper-limb` |
| 擁有者核准 | 2026-10-09 對前一則包含精確 `2.0.0`／完整 SHA-256 的發布與切換請求回覆「推送」；當版 bytes 未變更 |
| 已公開證據 | [正式發布收據](releases/asteroid-shield-2.0.0.json)；全部 12 檔回讀與同一摘要、approved manifest／current 已核對 |

dry-run manifest 的 `status: approved`／`approvedAt` 是 publisher 的擬發布格式，**不代表擁有者核准或 R2 已公開**。候選清單放在 `docs/migrations/`，不放 `docs/releases/`；後者的已追蹤收據會被官方歷史 bootstrap 信任。核准後任何發布 bytes 修改都須升版並重新驗證、核准。

`docs/migrations/asteroid-shield-2.0.0-candidate.json` 保留 2026-10-08 送審時的待核准快照；發布後狀態以正式收據為準。正式發布於 `2026-10-08T22:10:38.583Z` 完成（台灣 2026-10-09），runner 全部 12 檔 SHA-256／Content-Type／CSP、穩定 302／no-store、版本化 PWA 200 與舊 `1.0.0` 200 已驗證。官方歷史只包含新格式 `2.0.0`，沒有把舊 JSON 版本冒充新格式。

R2 唯讀發布前檢查於 `2026-10-08T15:31:33.859Z` 通過：同 bucket 的畫畫塔防官方 current 回 200，確認憑證與讀取有效；asteroid 官方 current、`2.0.0/release.json` 及全部 12 個候選檔案目標均回 404。只執行 GET，沒有上傳或切換；核准後發布前仍須重新確認。結果保留在候選 JSON 的 `r2ReadOnlyPreflight`。

## 舊流程、分類與歷史碰撞

- 原始碼基線為 `f5ee67ab742dd8cfa734dbf751c24fc1e4377213`。原遊戲入口依賴 `OfficialGameShell`、`settings.json`、`score.json` 與共用 UI；Hub 大廳使用 catalog 啟動契約及同源 JSON overlay，獨立入口為 `/games/asteroid-shield/`。
- 原 catalog 為 `motor`／`upper-limb`、`motor-upper`。候選以遊戲自己的 [game.json](../apps/rehabtrainerhub/games/asteroid-shield/public/game.json) 保存相同分類及雙語名稱／描述，Hub 相容 catalog 讀同一宣告。
- 原預覽圖完整 bytes 移入遊戲 `public/preview.webp`；SHA-256：`48580bdf2930ce1af7f9e71a8b3f29f294a7a61a0179e646f15ad61cca457a98`。source、dist、候選清單與本機目錄圖片均一致。
- 正式環境於 `2026-10-08T14:46:00.023Z` 唯讀查核：[公開目錄 API](https://trainerhub.cc/api/games) 回傳一筆 `asteroid-shield@1.0.0`、`legacy-package`、`motor`／`general`，設定 URL 指向 runner `1.0.0/package/settings.json`。D1 同 slug 歷史版本為 `1.0.0`／approved／`index.html`；SELECT 的 `rows_written=0`、`changed_db=false`。
- 舊投稿的 `general` 不能取代原官方遊戲的 `upper-limb`；沒有刪除歷史資料。`app/hubGames.test.mjs`、`functions/api/game-catalog.test.mjs` 及真實大廳 fixture 都包含同 slug 舊 shell，驗證 R2 分類、原圖及 `catalog-v1`／固定版本 session 不被它覆蓋。
- 查核時正式 Hub 舊入口為 200，runner 穩定官方入口為 404，沒有此遊戲的官方 current。只有發布後才能完成正式 current／公開 API 驗收。

原雙語公開文案：

| 語言 | 名稱 | 描述 |
| --- | --- | --- |
| zh-TW | 小行星護盾防衛 | 移動護盾保護飛船，練習手部定位與上肢控制。 |
| en | Asteroid Shield Defense | Move a shield to protect the ship and practise hand positioning and upper-limb control. |

## 保留的使用者功能與成果

使用者明確選擇「搬遷目前可用的滑鼠／觸控功能」。舊設定 UI 沒有開放 MediaPipe；候選移除不可達的相機／模型分支，不新增相機權限或擴大用途。

| 設定 | 原預設／邊界 | 候選 runtime 對照 |
| --- | --- | --- |
| difficulty | medium；easy／medium／hard | beginner／intermediate／advanced；1.35／1.08／0.82 秒生成，120／165／215 px/s |
| durationSec | 90；30–300，step 15 | 相同設定秒數進入遊戲及保存 config |
| sensitivity | 5；1–10，step 1 | 護盾比例 `70 + level × 5`，75–120%；不是追蹤靈敏度 |
| soundEnabled | true；boolean | 自有 WebAudio 音效，關閉時不播放 |

原 Pixi 背景、飛船／護盾與四種物件、生成／移動／碰撞／計分、能量補給、10 點飛船耐久、速度級別、時間完成／耐久歸零及 jsPsych lifecycle 保留。滑鼠與觸控操作、真正遊戲 root 原生全螢幕、隨視窗調整 canvas 都在正式 sandbox／CSP 的本機 runner 通過。

設定→三目標教學（小行星、飛船、護盾）→真實遊玩→成果完整保留。教學往返保留設定，縮放重新定位；返回、略過／完成及卸載清除遮罩。設定按鈕與 Enter 使用欄位驗證，無 native form submission。

成果由遊戲自己呈現摘要、可切換指標的趨勢／統計、完整逐物件表格與保存重試。保留舊 `object`／`elapsed`／`damage`／`hp`／`speedLevel` 分析、平均／中位數／樣本標準差／範圍／缺失／完整率、50 筆趨勢分頁；完整表格可捲動查看所有物件，不截斷為最後十筆。分析是當次描述，沒有新醫療效能宣稱。

私有 port 數值成果沿用 `rehab-trainer.game-score/v1`：

- summary：原 duration、spawned、blocked、hits、energy、hp，再保留 score、speedLevel、victory。
- rounds：原 object、elapsed、damage、hp、speedLevel，再保留 type、outcome、spawnedAt、score、controlSource；未有結局時間為 null。
- type：normal=0、heavy=1、lethal=2、energy=3；outcome：shielded=0、hit=1、collected=2、missed=3；mouse／touch 的 controlSource=0；victory 為 0／1。
- 遊戲畫面的 `Guest` 是中性本機標籤；帳號、Subject ID、保存 token 只留在 Hub。Hub 模式結果只返回大廳，獨立 PWA 結果返回自己的設定，並顯示須從 Hub 開啟才能保存。

## 獨立性、安全與輸出

遊戲擁有 React／ReactDOM／Pixi／jsPsych 依賴、Vite entry、CSS tokens、i18n、教學、lifecycle、音效、資產與 port bridge。沒有平台套件／跨遊戲 import、Hub auth／storage／routing 或自存紀錄 API；已刪除此遊戲的兩份 UI JSON 與不用的 shell 檔案。

使用相對資產與 classic IIFE。Pixi 靜態相容入口不需要 `'unsafe-eval'`；圖片改用 Image element，停用 bitmap／worker loader，符合 `connect-src 'none'`／`worker-src 'none'`。iframe 仍為 `sandbox="allow-scripts"`，沒有增加同源、導向、表單或相機能力；runner 的既有 CSP／bindings 未變更。

init 驗證 parent source／origin、game／package version、nonce 與唯一私有 port；Hub 照原契約驗證 sequence、成果 schema／大小與敏感欄位。一般 window 成果不會入庫。`officialGameReleases.json` 只新增資格／名稱／origin，不含 current version。

`sync:games` 排除 asteroid workspace，lockfile 已同步。最後 Hub build 為 38 款舊遊戲＋Hub、39 個成功 tasks；小行星只留導向 runner 的相容入口及原圖相容資產，不包含它的遊戲 bundle／settings.json／score.json。其他 38 款舊遊戲仍維持共用 shell 流程。這是候選分支的輸出，正式站尚未切換。

## TDD 與回歸證據

| 先失敗的行為 | 原因／最小修正 | 通過證據 |
| --- | --- | --- |
| 自有設定／數值成果／隔離 bridge | 舊版缺少自有 settings／bridge，依賴 shared UI | `scripts/check-asteroid-shield-migration.test.mjs` 6 項 |
| 歷史同 slug 不得蓋入口／目錄 | 未登記 asteroid，API 仍讀舊 `1.0.0` shell | Hub 合併＋實際目錄 handler＋大廳 browser |
| 嚴格 CSP 下 renderer 可啟動 | Pixi image bitmap loader 嘗試 fetch／worker | 停用該 loader；真實 canvas 與全螢幕通過 |
| 教學目標／縮放／返回清理 | 短視窗飛船目標位於畫面外 | 調整教學定位，三步 spotlight／resize／cleanup 通過 |
| 手機成果表可讀 | 窄欄逐字換行 | 寬表格及僅表格水平捲動；每欄至少 48px、body 不溢出 |
| 保留原成果指標分析 | 候選缺少 selectable metrics／統計 | Node 缺模組及 Brave 空選項先失敗；補自有 SVG／統計後通過 |
| 原音效序列／靜音 | 候選曾以單音取代原多音序列 | 先失敗的頻率／jsPsych context 重用測試；恢復原四種序列與固定 50% 音量，原生 WebAudio 開關也通過 |
| 英文 Hub 初始化 | 私有 init 在語言 effect 監聽前到達，英文 Hub 遊戲仍顯示中文 | 真實 English Hub 20 秒等待仍失敗；快取已驗證 init 語言並在 provider 掛載後套用，完整英文流程通過 |

本機完整驗證命令及結果：

| 命令 | 結果 |
| --- | --- |
| `npm run test:game-architecture` | 全遊戲 TypeScript、自包含／發布測試 29 項通過 |
| `npm run test:hub-functions` | 98 項通過；drawing／asteroid 各自驗證 session 綁定、current 固定、撤回／digest／身份、SQLite 並行冪等 |
| `npm run test:gamerunner` | 24 項通過，包含第三方既有 bridge／沙盒／SW |
| `npm run test:entrypoints` | 全部通過，含既有設定／教學／training／assessment／i18n／平台 gate |
| `npm run test:naming`、`test:pwa`、`test:seo`、`test:cloudflare-deploy` | 全部通過；PWA 18 項，SEO 實際輸出通過 |
| `npm run build:hub`、`build:gamerunner`、單獨 asteroid build | 通過；Hub bundle 排除 gate 通過 |
| `npm run test:game-architecture:browser` | 搬遷前／後各 5 項 Brave 通過；舊 JSON 設定／共用成果改以未遷移遊戲驗證 |
| `node scripts/publish-official-game.mjs asteroid-shield --dry-run` | 同一 dist 的 12 檔與當版摘要通過；沒有連線 R2 |

專用真實 Brave 流程使用 `node scripts/check-r2-game-browser.mjs --game asteroid-shield`：

| 參數 | 已通過的當版驗證 |
| --- | --- |
| `--lobby`／`--lobby --session-failure` | 大廳分類／原圖／slug 碰撞→固定 session；首次 session 失敗不載入、可重試；設定邊界／往返／Enter→三步教學→真實 30 秒遊玩→指標切換／完整成果→保存失敗／重試→單筆 SQLite→返回 |
| `--lobby --mobile` | 390×844 真正 pointer／touch 輸入、全視窗 canvas、同一完整成果與保存流程 |
| `--lobby --signed-in --sound-on` | 真實本機 auth handler／session，帳號與 guest Subject ID 隔離，單筆 account 成果；開啟聲音後原生 WebAudio 有輸出，其他模式靜音沒有輸出 |
| `--lobby --english` | 英文 Hub 的私有 init、英文設定／教學／成果／保存重試與返回完整流程 |
| `--lobby --revoke` | HEAD 偵測撤回後卸載，沒有成果寫入 |
| `--standalone`／`--standalone --mobile` | 桌機／390×786 本機遊玩與返回；SW ready、版本 scope、game.json／原圖預快取、不跨遊戲／版本 |
| drawing-defense `--lobby` | 原試點真實玩法／保存重試／單筆 SQL／返回回歸通過 |

日誌位於 `.tmp/asteroid-*.log`；先失敗的成果分析另在 `.tmp/asteroid-score-analysis-red.log`、`.tmp/asteroid-score-analysis-browser-red.log`，音效差異在 `.tmp/asteroid-audio-red.log`。最後候選 browser 使用 `HUB_OUTPUT_ROOT=.tmp/asteroid-hub-ea21aa905a95` 固定副本，避免 Hub build 重建 output 期間造成載入失敗；沒有放寬 timeout 或安全檢查。瀏覽器寫入只使用套用全部 migrations 的本機 SQLite，沒有正式帳號或成果寫入。正式舊 UI 截圖時另阻擋 `trainerhub.cc/api/*`。

可保留查閱的截圖：

- [正式舊設定](migrations/asteroid-shield/legacy-settings.png)、[正式舊教學](migrations/asteroid-shield/legacy-tutorial.png)、[舊版真實 gameplay](migrations/asteroid-shield/legacy-gameplay.png)、[舊版結果](migrations/asteroid-shield/legacy-results.png)。
- [候選手機設定](migrations/asteroid-shield/mobile-settings.png)、[教學](migrations/asteroid-shield/mobile-tutorial.png)、[真實 gameplay](migrations/asteroid-shield/mobile-gameplay.png)、[成果分析](migrations/asteroid-shield/mobile-results.png)、[完整表格左側](migrations/asteroid-shield/mobile-results-details.png)、[表格右側與保存](migrations/asteroid-shield/mobile-results-details-end.png)。
- [英文 Hub 設定](migrations/asteroid-shield/english-settings.png)、[英文成果](migrations/asteroid-shield/english-results.png)。

## 核准後的公開與正式驗收

1. 擁有者核准當版精確 `2.0.0`／上述 contentSha256；再次 dry-run 確認 dist 未變更，使用已確認的 Cloudflare 帳號及單一發布者。
2. 執行 `node scripts/publish-official-game.mjs asteroid-shield`；逐檔上傳／回讀雜湊、最後寫 approved manifest 並切 current。先完成此步，才提交／合併並部署包含新 registry 的 Hub 候選；runner 既有格式與 fullscreen 支援已相容，本次沒有 runner 產品變更。
3. 直接確認正式 `/api/games` 同 slug 一筆 `2.0.0`、`presentation: game`、motor／upper-limb、原文案、版本化原圖 URL，沒有通用 settingsUrl；核對圖片 SHA-256、穩定入口 302／no-store、版本 PWA 及 session 選定相同版本／摘要。不得輸出 session token。
4. 從正式 runner 回讀全部 12 檔，核對 status／Content-Type／CSP／實際 SHA-256、current／歷史。保留舊 `1.0.0` 檔案與 D1 投稿，不把它加入新格式官方歷史。
5. 執行同一腳本的 `--game asteroid-shield --remote --lobby`、`--remote --standalone`，部署成功後執行 `--production-hub --lobby`、`--production-hub --lobby --mobile`。它們讀真實 R2／正式 Hub，但所有 `/api/*` 測試寫入仍攔到本機 SQLite；另直接讀正式 API 補足 fixture 邊界。
6. 記錄 CI／部署 URL／commit、擁有者核准、current／歷史、正式 API／圖片／browser 結果到 `docs/releases/asteroid-shield-2.0.0.json`，完成後才更新本審查單為「已遷移」。目前第 1、2 項的核准／R2 發布及第 4 項的回讀已完成；第 5 項真實 R2 的 `--remote --lobby` 與 `--remote --standalone` 均通過。Hub 推送／部署與正式 API／正式 Hub 瀏覽器驗收仍待完成。

## 回退目標與限制

發布前已核對的正式舊流程：Hub [8e957462.rehabtrainerhub.pages.dev](https://8e957462.rehabtrainerhub.pages.dev)，deployment ID `8e957462-7639-4fe6-a3db-acfa278735bd`；相容 runner [e2459d3c.trainerhub-user-games.pages.dev](https://e2459d3c.trainerhub-user-games.pages.dev)，deployment ID `e2459d3c-d5a5-4257-aadf-e9872894510b`。兩者來源 commit 均為 `e22e2d363b1f895567eafa382852f34cb1c31463`。原分類／原圖／設定與教學已唯讀重現；另以正式舊 standalone 資產完成設定→教學→真實全螢幕 Pixi→物件結局與成果，所有正式 API 由 CDP 阻擋，沒有建立正式紀錄（`.tmp/asteroid-rollback-baseline.log`）。

這是 asteroid 首個新格式候選，沒有可供 `--activate-version` 的已核准新格式回退版。首次切換失敗時先恢復上述已驗證 Hub 部署／原遊戲 registry、workspace 依賴、source 與兩份 JSON，重新驗證舊入口；不以舊 `1.0.0` JSON 套件冒充新格式，也不刪除成果或 R2 歷史。runner 此次沒有產品修改，維持已相容的正式版本。

切回舊 Hub 不等同撤回 `2.0.0`。官方 CLI 目前沒有撤回命令；如需撤回，仍須按計畫第 8 節另行制定、驗證 owner 的 R2 status 更新／回讀程序。本機撤回 fixture 通過不代表正式撤回已執行。

已驗證 Brave 桌機與觸控裝置模擬，不代表所有實體手機／Safari／iOS 原生 fullscreen；沒有真人 Turnstile、實際安裝圖示操作或長時間完全離線驗證。MediaPipe 體感／相機不在本次授權範圍，將來啟用需獨立受控能力設計。CI 尚待推送執行，正式 API／Hub 部署驗收仍待完成；R2 當版已核准、發布與回讀驗證。
