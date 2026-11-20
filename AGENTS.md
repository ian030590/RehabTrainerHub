# 倉庫指引

npm workspace 與 Turborepo monorepo。Hub 位於 `apps/rehabtrainerhub`，runner 位於 `apps/usergamerunner`，兩者部署為 Cloudflare Workers。
Hub 的 Next.js App Router 位於 `app/`，後端 `functions/` 編譯進 Worker。部署設定以各 app 的 `wrangler.workers.jsonc` 為準。
遊戲各在 `apps/rehabtrainerhub/games/<gameId>/`。Runner 提供核准 R2 資產、版本化 PWA、通訊 bridge 與可信輸入代理。
開發者遊戲契約見 [投稿規格](docs/developer-game-packages.md)，官方 R2 流程見 [遷移計畫](docs/r2-game-migration-plan.md)。
版本、回退與正式驗收見 [發布收據](docs/releases/)，歷史敘述見 [原指引存檔](docs/history/agents-log.md)。

## 測試與 CI 規則

- [AG-RULES-01] 新增規則時，在同一筆變更新增有 ID 的條目、`scripts/repo-rules.json` 登記與可執行的 CI 測試。需本機或人工執行時，登記命令或原因。
- [AG-RULES-02] 以 `AGENTS.md` 為唯一權威。根目錄 `CLAUDE.md` 只匯入本檔。
- [AG-CI-01] 同步 `test:ci` 與 `ci.yml` 的八項 gate、十項工作。遊戲架構分 types／tests／games，每個原命令執行一次。
- [AG-CI-02] 自動測試須由本機 aggregate 與 CI matrix 同步涵蓋。新增測試未被探索時，同時補上入口。
- [AG-CI-03] CI 使用 Node 24 與 root 加 workspace 的乾淨安裝，支援 PR、手動、重用。Workflow 與指引變更須觸發 PR 驗證。
- [AG-CI-04] 安裝套件不得設定 Git hook。Brave 與需要建置成品的檢查保留本機命令。
- [AG-CI-05] 依變更範圍補驗。Hub UI／auth／routing／共用套件須建置 Hub。Asteroid Shield、全螢幕或 Pixi 尺寸變更也須建置 Hub。
- [AG-CI-06] 平台流程或共用設定 UI 有變更時，準備建置成品後以本機 Brave 驗收遊戲架構。
- [AG-CI-07] Hub UI 變更以 Brave 驗收桌機、手機、平板、鍵盤與導覽，執行前準備對應 build。
- [AG-CI-08] 遊戲互動變更以本機 Brave 驗收大廳與獨立 PWA。模擬媒體、觸控或方向盤結果須如實標註。
- [AG-CI-09] 相機／眼動及駕駛變更依範圍執行各自的 Brave 測試。
- [AG-CI-10] R2 Hub 輸出隔離及 Worker HTTP 相容性須驗證建置成品。並行建置時固定 HUB_OUTPUT_ROOT／RUNNER_OUTPUT_ROOT。
- [AG-CI-11] 修改 Cloudflare Functions 時，對修改檔執行 `node --check` 並驗證對應的 `test:hub-functions` 或 `test:gamerunner`。
- [AG-CI-12] 本機測試只用隔離的資料與服務，不部署正式環境、不發布遊戲、不寫入正式資料。

## 測試先行與最小實作（TDD）

- [AG-TDD-01] 功能與重構先跑可執行的行為測試，確認因需求缺少而失敗，只做通過所需的實作，再在測試保護下整理。
- [AG-TDD-02] UI 變更先鎖定既有導航、設定、訓練開始與完成流程，新增手機或平板互動先補測試。保留既有功能與安全檢查。
- [AG-TDD-03] 提交附失敗原因、修正結果與回歸命令。無法自動化時先記錄可重現人工步驟及限制。
- [AG-TDD-04] Claude／Codex 工具與腳本只回報觀察，審查結論由角色或擁有者依證據決定。

## 遊戲團隊流程

- [AG-TEAM-01] 新增遊戲目錄或 catalog 項目前，依 `.claude/docs/rehab-game-team.md` 走遊戲團隊流程。
- [AG-TEAM-02] 新遊戲附 `design/gdd/<gameId>.md`，含 Summary、Overview、Detailed Design、Edge Cases、Dependencies、Acceptance Criteria 六個二級標題。
- [AG-TEAM-03] `scripts/game-team-legacy-games.json` 只能移除已刪除的豁免遊戲。
- [AG-TEAM-04] 每款遊戲須有中英文聚光燈教學。提交前依 hook 提示核對受影響的步驟。
- [AG-TEAM-05] 玩法或控制改動時更新受影響的聚光燈步驟，使說明對應實際遊戲行為。
- [AG-TEAM-06] Claude 依 `.claude/docs/codex-workers.md` 用 `.claude/scripts/codex-agent.sh` 協調 Codex workers。Codex 依轉接器逐一承擔角色。
- [AG-TEAM-07] 只編輯 `.claude/skills/` 的團隊技能來源。修改後用 `npm run sync:team-skills` 產生 `.agents/skills/` 轉接器。

## 共享邏輯優先

- [AG-ARCH-01] Hub 使用 Next.js App Router 與 `packages/ui/src` 共用 UI、樣式、auth、storage、設定及導覽。Hub Functions 掌管登入、授權與資料寫入。
- [AG-ARCH-02] 遊戲各自擁有 Vite entry、設定、教學、runtime、規則、i18n、樣式與結果。R2 與新遊戲禁止依賴平台套件或其他遊戲程式。
- [AG-ARCH-03] Hub 只組合容器、私有通訊、身份、保存與離開流程。遊戲專屬 defaults、validation、引擎與 lifecycle 留在各自 workspace。
- [AG-ARCH-04] 遊戲目錄、catalog 與 registry 要同步。改 catalog 或 workspace 後執行 `npm run sync:games`，依賴異動同步 lockfile。
- [AG-ARCH-05] `officialGameReleases.json` 只存名稱與可信 origin。開啟前從核准 R2 manifest 與 current 固定版本、雜湊、recordId 及 token。
- [AG-ARCH-06] R2 不建立 `settings.json`／`score.json`。Hub 建置只留 R2 PWA 連結，已遷移舊資產回 410。
- [AG-ARCH-07] 保留舊官方遊戲的同源 JSON／`OfficialGameShell` 契約與既有依賴。舊流程 `reason` 使用固定代碼及 Hub 自有提示。
- [AG-ARCH-08] R2 目錄文案、分類、預覽圖由遊戲 `public/game.json` 宣告並隨版本 SHA-256 驗證。舊版回退以遊戲自有資料為準。
- [AG-ARCH-09] Hub 維持統一目錄、分類、搜尋、卡片與啟動入口。投稿的同名 slug 不得覆蓋官方遊戲的啟動契約。
- [AG-ARCH-10] 訓練載入 overlay 或單遊戲 PWA，設定階段保留背景；保留 deep link。結果依來源只顯示一個返回按鈕。
- [AG-ARCH-11] 大廳 SSO 與資料留在 Hub。R2 穩定 PWA 入口以不可快取的 302 選 current，版本化 PWA 固定原版。退役 trainer 網域及 `/runtimes/*` 不復用。
- [AG-ARCH-12] R2 設定由容器在每台裝置按遊戲保存，須有 capability 且由遊戲驗證。第三方由容器驗證 `settings.json` 並保存最後提交值。
- [AG-ARCH-13] 只允許可信 UFOV 用 `result-files` 暫存三個固定格式、最多 4 MiB 的檔案。成果後由容器下載，關閉即清除。
- [AG-ARCH-14] R2 版本化 PWA 的 Manifest／Service Worker 只能快取該版本及平台 runtime。偵測撤回須關閉並清除該版快取。
- [AG-ARCH-15] R2 遷移先記錄原功能、分類、預覽圖摘要。依 `docs/r2-game-migration-plan.md` 第 7、11 節驗收並留正式收據。

## 遊戲平台與沙盒執行規範

- [AG-SANDBOX-01] Hub 與 runner 位於不同 origin。Runner 的部署及相容設定只綁 `rehab-game-releases`，禁止 D1、KV、認證及私人資料。
- [AG-SANDBOX-02] Runner Functions 只接受 GET／HEAD，release bucket 只可查讀。
- [AG-SANDBOX-03] 官方 R2／第三方及 runner 的 package iframe 只用 `sandbox="allow-scripts"`，禁止 `allow-same-origin`、任何 `allow-top-navigation` 與 `allow-downloads`。
- [AG-SANDBOX-04] Package CSP 以 runner `functions/[[path]].js` 的 `packageContentSecurityPolicy` 為準。封鎖外連、Worker、WebRTC 和 eval，launcher 權限不得轉交。
- [AG-SANDBOX-05] R2 與第三方以私有 MessageChannel 驗指定窗口、origin、nonce、單調 sequence 及成果 schema。僅核准 capability 可使用全螢幕或 gamepad。
- [AG-SANDBOX-06] 第三方使用 runner 的版本化 bridge。一次性 token 存雜湊並經 `/api/game-runs` 入庫，拒絕未宣告與識別資料欄位。
- [AG-SANDBOX-07] 官方成果使用 24 小時 HMAC token 綁版本、recordId、帳號、Subject ID，經 `/api/records` 冪等保存。撤回或雜湊不符一律拒絕。
- [AG-SANDBOX-08] 投稿掃描危險 API、HTML／CSS、路徑、體積、單行、跳脫密度及 ZIP 膨脹率。掃描規則數以 `blockedSourcePatterns` 為準。
- [AG-SANDBOX-09] 新投稿保存私有 R2，D1 同時記錄版本雜湊與 Issue 工作。Issue 不含原始碼、掃描細節或帳號資料，標籤與關閉不得核准發布。
- [AG-SANDBOX-10] 第三方核准限指定的 admin 擁有者，驗 Issue、檔案雜湊及三項審查紀錄，用 Lease 發布。官方 slug 禁止借第三方流程發布或撤回。
- [AG-SANDBOX-11] 審查者在無敏感憑證的隔離環境核對來源、試玩及公開描述。成果是用戶端回報，文案不宣稱防作弊或伺服器重算。
- [AG-SANDBOX-12] 手部、眼動、姿勢、音量、舌頭與頭部只用可信官方 capability 及固定版本代理。容器取得同意，遊戲只收契約數值，不收影音或身份。
- [AG-SANDBOX-13] 容器顯示相機預覽並管全螢幕，完成、退出、取消、撤回及斷線清理裝置、模型與排程。僅舌頭代理接受固定校正標籤。
- [AG-SANDBOX-14] 前端不得放 secret。OAuth、登入與 session 憑證留在後端執行期，runner 不收 Hub secrets。

## Training panel 長期規範

- [AG-UI-01] `training-panel` 主標題用 `h2`、分段用 `h3`、標籤與說明用 `p`、順序用 `ol`／`li`。文字字重至少 700。
- [AG-UI-02] 設定、最終確認與結算採一致語意與布局，各遊戲自行實作。確認欄位、開始、返回與保存期間保留設定。
- [AG-UI-03] 維持訓練文字基準 1.15 倍、可讀行高及一致 computed style；Brave 另驗手機和平板減少溢出。
- [AG-UI-04] 以 token 供 Hub 與共用 CSS 的色值。表單控制邊框 ≥3:1，聚光燈按鈕與哈特圖控制保留可見鍵盤焦點。
- [AG-UI-05] R2 結算包含主要統計、可讀圖表與逐回合明細，保留雙語、缺值及保存重試。圖表與明細共用分頁。
- [AG-UI-06] 訓練設定與教學保持視窗模式。手部先完成相機同意，從最後開始鈕進全螢幕；手勢以相機就緒後首次校正點擊進入。返回時清理全螢幕。
- [AG-UI-07] 使用本機遊戲自有音訊模組及 Tone 樂譜。背景音樂於遊玩期間播放，結束或取消清理。不將瀏覽器模擬視為實體音訊驗收。
- [AG-UI-08] 功能元件採 React／TypeScript，沿用兩格縮排與既有模式。PascalCase 用於具名函式、型別、元件；變數、參數 camelCase，框架入口按命名檢查例外。
- [AG-UI-09] 原始碼避免 em dash。缺值用「無」或 `N/A`，網站導覽與分類教學須對應實際介面。
- [AG-UI-10] UI、文案、人因、行動版或註解工作讀 `antislop` 核心，再選用 `antislop-ui`、`antislop-copywriting`、`antislop-human`、`antislop-layoutmobile` 或 `antislop-code`。
- [AG-UI-11] antislop 模式依明示的當次選擇、全域偏好、詢問順序解析。依技能規定時機公告模式與來源。未解析時先詢問再做 UI 工作。

## 台灣醫療與職能治療法規文案

- [AG-COPY-01] 品牌為「居家訓練網」，定位為「居家訓練工具與衛教資訊」。公開文案用練習、活動、當次紀錄、刺激參數、換算參考值。
- [AG-COPY-02] 公開文案禁止聲稱診斷、醫囑、處方、個別評估、治療、預防疾病、改善人體功能、保證療效、臨床級／醫療級。
- [AG-COPY-03] 疾病、復健及治療詞限中立衛教、正式題名、客觀經歷或非服務聲明。禁用見證、前後對照、免責聲明或資格背書來宣稱效果。
- [AG-COPY-04] 專業資格限已查核事實，寫在作者／責任區。未確認有效執業登記禁用「執業職能治療師」，未逐篇審閱不填 `reviewedBy`。
- [AG-COPY-05] 署名、學歷、在學與經歷應可查核且附確認日期。未驗證資格以「居家訓練網編輯」署名。不要公開履歷分享碼、證號、地址、電話或年齡。
- [AG-COPY-06] 公開 copy 或 JSON-LD 不得加入 104 履歷連結。
- [AG-COPY-07] FrACT 只說明公開方法、實際版本、來源及校正需求；logMAR／Snellen／logCS 標明換算參考值並說明限制，不聲稱等效、認證或臨床用途。
- [AG-COPY-08] 新增疾病判定、個別建議、臨床量測、諮詢、遠距服務或改 intended use，先停發並取得台灣醫療／醫材法規專業意見。

## SEO 與 E-E-A-T 維護

- [AG-SEO-01] Hub 名稱及首頁標題來自 `app/hubBrand.ts`，metadata／JSON-LD 由 `app/seo.ts` 管理，canonical origin 取自 `siteUrls`。
- [AG-SEO-02] Hub 正式 HTML 預渲染繁中首頁，title、H1、首段、description、canonical、robots、OG／Twitter、manifest 與 JSON-LD 用途一致。
- [AG-SEO-03] 可索引頁有正確 canonical／index、獨特標題與可見內容。路由異動同步 sitemap、robots 與 SEO 檢查；維持管理、帳號、進度與訓練 noindex。
- [AG-SEO-04] sitemap 只列該 origin 的可索引 canonical。主要內容實際更新才改 lastmod。部署後驗 sitemap／robots、Rich Results Test 與對應 Search Console。
- [AG-SEO-05] 衛教 FAQ 只連結外部部落格並保留作者個人網站。不載文章 feed、不刊摘要、不自建文章。
- [AG-SEO-06] 相容 `/api/education-feed` 只讀固定 Blogger 來源、鍵只放 header，限制頁數、逾時、資料量、標籤、摘要、連結及 600 秒快取。
- [AG-SEO-07] 作者、日期、來源、責任及 schema 以可見且可查核事實為準。`ProfilePage` 只用於單一作者專頁。
- [AG-SEO-08] 依 Google Search Central 最新指南；以讀者問題為先，避免堆疊關鍵字、隱藏內容、重複或薄頁。健康、科學及效度引用可信原始來源，AI 輔助保留人工查核。

## 身分、原始資料與練習清單

- [AG-DATA-01] 裝置訪客與後端帳號 Subject ID 分離。帳號跨裝置一致，首次指派原子更新帳號歷史，登出只清除帳號快取。
- [AG-DATA-02] Hub 寫入成績並隔離訪客、登入帳號及跨帳號切換。Hub iframe 不自行另寫一道紀錄。
- [AG-DATA-03] D1 只存摘要。核准逐回合及感測 CSV 先存私人 `rehab-raw-data`／`oculomotor-data`，依 session 時間與 capability，使用匿名鍵且不可覆寫。
- [AG-DATA-04] pCloud Cron 每小時用 EU API、Bearer 與 `checksumfile` 核對 SHA-256／大小及身份。不覆寫、不跟轉址，僅在複核來源與目的物件後刪除 R2。
- [AG-DATA-05] 練習清單僅 `TRAINING_PLANS_ENABLED=1` 啟用，限授權員工指派最多 12 款官方遊戲。週一至週日計達成，連續六週給「六週全勤」。
- [AG-DATA-06] 練習清單文案用「練習清單／指派／本週進度」。個別化使用另依 上節的法規審查規則。
- [AG-DATA-07] D1 migration 由 `0001` 起連續編號，部署先套用 migrations，再部署 runner 與 Hub。

## Commit 與 Pull Request 指引

- [AG-GIT-01] 提交用簡短 Conventional Commit。
- [AG-GIT-02] 僅在 `main` 工作。Commit、push、部署與發布須明確授權。核准後直接推 main，Dependabot 等自動 PR 由擁有者另決。
- [AG-GIT-03] 若使用 PR，附摘要、受影響範圍、驗證命令、適用的截圖及 migration／環境變數。
- [AG-DEPLOY-01] `main` push 只部署 Workers。Build、verify、deployment_scope 並行，deploy 須等三者成功且需部署，從 artifact 部署。
- [AG-DEPLOY-02] 純文件及僅有已遷移遊戲內容／版號的變更跳過平台部署。手動執行、無法確認差異或平台、依賴與舊遊戲變更依部署範圍執行。
- [AG-DEPLOY-03] CI 只快取 Hub `.next/cache`。部署 artifact 帶隱藏檔，缺 Worker entry／`.assetsignore`、Hub routes 或 runner origin 不符時拒絕。
- [AG-DEPLOY-04] 部署 Hub 前確認私人原始資料 bucket。Issue 與 pCloud Cron Worker 另行部署，執行期 secrets 只給需要的 Worker。
- [AG-PUBLISH-01] 官方發布前須驗證並取得精確 version／contentSha256 核准。未核准只跑 dry run。同一遊戲發布與回退不得並行；自動模式由擁有者執行正式發布。
- [AG-PUBLISH-02] 先部署相容 runner，再發布。首次登記 R2 遊戲時，須發布並切 current 後才推 registry。發布後核對正式 bytes、API、session 及 Hub／PWA，留收據。
- [AG-PUBLISH-03] Publisher 讀各遊戲 dist，版本取 package.json，逐檔回讀雜湊再切 current。同版不可覆寫。回退核對核准歷史，首次來源限已追蹤收據。

## 推薦流程

- [AG-REC-01] 官方遊戲須在 `recommendation/gameFeatures.json` 以可觀察的任務需求與功能佐證分類，重新產出 index 並通過 gate。
- [AG-REC-02] 推薦標籤對齊倉庫註冊的架構與雙語詞彙。保留未知值遮罩、固定群組權重與可重現排序；相似度審閱限管理員。
- [AG-REC-03] 新官方遊戲先將推薦項目登記為 `draft`，審閱後再改為 `confirmed`。
- [AG-REC-04] 大廳只依活動內容相似度與近期活動 ID 推薦。訪客只在裝置保留活動 ID 與時間。文案說明並非個人評估。
- [AG-REC-05] 公開活動地圖只用建置時計算的內容相似度座標，說明不代表個人能力或練習建議，並提供鍵盤與列表操作。

## 指令參考

```sh
npm install
npm ci --workspaces --include-workspace-root --no-audit --no-fund
npm run dev
npm run dev:hub
npm --prefix apps/rehabtrainerhub run preview
npm run build:hub                                  # Hub out/
npm run build:gamerunner                           # runner dist/
npm --prefix apps/rehabtrainerhub/games/<gameId> run build
npm run build                                      # 測試與建置全部遊戲和兩個 app
npm run build:cloudflare                           # 完整 gate 及 Workers 靜態資產輸出
npm run build:cloudflare:only                      # CI 的獨立 build 工作
npm run build:workers                              # 編譯 Functions
npm run test:ci
npm run test:naming
npm run test:pwa
npm run test:game-architecture
npm run test:hub-functions
npm run test:gamerunner
npm run test:entrypoints
npm run test:recommendation
npm run test:cloudflare-deploy
node --test scripts/check-repo-rules.test.mjs       # 單檔測試範例
node --check apps/rehabtrainerhub/functions/_middleware.js
npm run sync:games
npm run sync:team-skills
npm run recommendation:build
node scripts/deploy-cloudflare-workers.mjs --dry-run
node scripts/publish-official-game.mjs <gameId> --dry-run
node scripts/publish-official-game.mjs <gameId> --activate-version <version>
```

本機驗收命令與限制見 [規則登記](scripts/repo-rules.json)。R2 Brave 常用 `--mobile`、`--tablet`、`--signed-in --english`、
`--session-failure`、`--revoke` 及 `--standalone`；`--remote`／`--production-hub` 屬於正式站讀取流程。
Worker 回退見 [Workers 遷移報告](docs/workers-migration-report.md)，Issue Worker 前置條件見 [審核部署指引](docs/hub-game-review-rollout.md)。
