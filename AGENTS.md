# 倉庫指引

## 專案結構與模組組織

npm workspace / Turborepo monorepo；App 程式碼位於 `apps/`：

- `apps/rehabtrainerhub`：Next.js Hub + Cloudflare Pages Functions（主平台、大廳、內建訓練 runtime、API、審核後台、開發者入口）。
- `apps/usergamerunner`：獨立遊戲隔離執行環境（Cloudflare Pages + Functions），負責以 sandboxed iframe 載入第三方 HTML/ZIP 遊戲並提供 PWA。
- `apps/rehabtrainerhub/training-runtimes/`：Hub 同源的 `motor`、`vision`、`brain`、`mouth` Vite runtime；不是獨立網站或 workspace app。

共用 UI、auth、layout、settings、storage、gamePlatform 規範：`packages/ui/src`。
開發者遊戲 SDK：`packages/game-sdk`（`@rehab-trainer/game-sdk`）。
靜態資產：各 app `public/`，通常 `public/assets/`。
D1 migrations：`apps/rehabtrainerhub/migrations/`。
R2 Buckets：`rehab-storage`（靜態素材）、`rehab-game-quarantine`（待審上傳暫存）、`rehab-game-releases`（已核准不可變發布）。

## 建置、測試與開發指令

- `npm run dev`：Turbo 啟動全部 dev servers。
- `npm run dev:hub`：啟動 Hub。
- `npm run build`：執行測試 gate 並透過 `scripts/build-apps.mjs` 建置全部 app。
- `npm run build:cloudflare`：建置 Cloudflare Pages 輸出。
- `npm run build:hub|gamerunner`：建置單一 app；Hub build 會一併建置四個內建 training runtimes。
- `npm run test:hub-functions`：驗證 Hub 後端 API 與安全防護測試。
- `npm run test:gamerunner`：驗證 usergamerunner 路由、沙盒、SW 與安全標頭測試。
- `npm run test:game-platform`：驗證遊戲套件掃描器與 SDK。
- `npm --prefix apps/<app> run preview`：預覽 Vite app 或 Hub 輸出。

高風險 trainer 變更完成前執行 `npm run test:entrypoints`：entrypoint、routing、entrypoint 引入的共用 layout/UI，或可能把 Pixi、jsPsych、Three.js、MediaPipe、TensorFlow、Vosk 帶入 entry bundle、造成白畫面的變更。此 gate 包含 training flow、assessment jsPsych lifecycle 與 i18n dictionary parity 檢查。

修改 Asteroid Shield、全螢幕流程或 Pixi 尺寸後，至少執行 `npm run test:entrypoints` 與 `npm run build:hub`，驗證設定/rules 流程、原生全螢幕目標、全視窗 canvas。

無完整測試套件；針對性 build 與 `npm run test:hub-functions`、`npm run test:gamerunner`、`npm run test:training-flow`、`npm run test:assessment-lifecycle`、`npm run test:i18n` 為最低驗證。

## CI/CD 維護

- `.github/workflows/ci.yml` 在 PR 與非 `main` push 的應用程式、package、script、lockfile、Turbo 或 workflow 變更時執行；純文件變更不得啟動 CI。
- `.github/workflows/deploy-cloudflare-pages.yml` 只在 `main` 上的可部署變更時執行。部署前的驗證以 matrix 平行執行；新增 gate 時加入兩份 workflow 的 matrix，並維持相同命令。
- `npm run build:cloudflare` 保留給本機完整 gate + build。CI/CD 已完成驗證時，部署 job 使用 `npm run build:cloudflare:only`，不可再序列重跑同一批測試。
- 變更 workflow 觸發範圍、測試命令或 build gate 時，必須同步更新本節，並確認 workflow 自身路徑仍會觸發驗證。

## 程式風格與命名規範

使用 TypeScript、React functional components、既有模式。共用行為放 `packages/ui`，不在 trainers 重複。優先 CSS variables/theme tokens，禁止硬編碼顏色。2 spaces；components PascalCase；functions/variables camelCase；檔名明確對應功能。

## 共享邏輯優先

可共享的邏輯、UI、樣式、auth、settings、routing helper、footer/navbar 放 `packages/ui/src` 或共用 helper；app 只傳 label、顏色、URL、模組清單等專屬資料。編輯 app-specific 檔案前，先檢查 `TrainerNavbar`、`TrainerAppLayout`、`AuthPanel`、共用 settings utilities/CSS/storage/auth helpers。app 組合共用元件，不分叉版本。

玩家訓練 runtime 例外：每個訓練體驗自行擁有 runtime、game loop、renderer/canvas lifecycle、input、jsPsych/Pixi/Three timeline/plugin、刺激與遊戲內 UI。禁止跨模組集中長生命週期引擎狀態、依賴其他模組 runtime helper/視覺規則。只共享 React shell：routing、auth、settings form、layout、navigation、結果組合、renderer-independent utilities。

Hub 禁止複製/分叉 trainer 設定表單、defaults、validation、rules、runtime。Hub 僅依 training catalog 裝載 trainer-owned config entry；trainer config 變更須自動反映，無需改 Hub。Hub 只負責選擇、container、history、exit、瀏覽器權限委派。Pixi、jsPsych、Three、MediaPipe、TensorFlow runtime/lifecycle 仍屬各模組。

### 訓練 Overlay 流程

Hub 大廳與 Hub 內建 runtime 使用同一份 module-owned config/runtime：

- Hub 點「開始訓練」：只在訓練大廳上生成 trainer config overlay；背景不切換、不導向 trainer 網站。
- 內建 runtime 只由 Hub overlay 或單一遊戲 PWA 載入，不建立獨立 trainer 網站。
- 可保留 query/hash deep link；開 config 不得卸載背景頁。
- 開始後由原 trainer runtime 接管 renderer、canvas、input、fullscreen lifecycle。
- 結果頁依來源只顯示一個按鈕：Hub 顯示「返回大廳」並關閉 Hub overlay；單一遊戲 PWA 顯示返回入口。禁止同時顯示兩者。
- Hub/runtime active、complete、exit 透過共用嵌入訊息協定同步；必須驗證同源 origin 與 window source。

只有 Hub 是平台 PWA；每個正式遊戲仍可保留 `/games/{gameId}/` 的獨立 scope。四個內建 runtime 不得有自己的 manifest、canonical、sitemap、下載頁或外部 trainer domain。

共用 shell CSS 放 `packages/ui/src/components/TrainerApp.css` 或 package stylesheet：cards、dialogs、trainer setup、results、tables、routed selection、buttons、forms、layout primitives。App `index.css` 只留產品視覺、遊戲/刺激 renderer、app overrides。搬共用 component 時同步搬 CSS，盡量刪本地重複。

Trainers 維持一致檔名/資料夾，例如 `pages/settings/SettingsPage.tsx`、`pages/links/LinksPage.tsx`。相同概念勿用不同本地命名；行為不同時用明確 app-specific 名稱。

### 遊戲平台與沙盒執行規範

本平台提供開放開發者上傳 HTML/ZIP 居家練習遊戲的 Steam 式體驗，必須嚴格遵守以下五層安全防護架構：

1. **物理隔離（Separate Domain）**：
   - 主平台（`trainerhub.cc`，處理登入、個人紀錄、資料庫）與遊戲執行器（`trainerhub-user-games.pages.dev`，只負責靜態檔案與 jsPsych 執行）必須完全分開。
   - `usergamerunner` Cloudflare Pages 專案**嚴禁綁定 D1、KV 認證或任何使用者私密資料**，僅具備 `rehab-game-releases` R2 bucket 的唯讀讀取能力。

2. **沙盒機制（Strict Iframe Sandbox）**：
   - 主平台載入第三方遊戲時，一律使用 `<iframe sandbox="allow-scripts">`。
   - **絕對禁止**加上 `allow-same-origin`（防止突破同源隔離讀取憑證）或 `allow-top-navigation`（防止重導向至釣魚網站）。

3. **阻斷外連（Restrictive CSP）**：
   - 所有 package 靜態檔案回傳時強制套用 CSP：`default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; worker-src 'none'; form-action 'none'; frame-ancestors 'self' https://trainerhub.cc;`。
   - 禁止遊戲向任何外部伺服器發起 `fetch`、`XMLHttpRequest`、`WebSocket` 或 `WebRTC`。

4. **安全通訊橋樑（postMessage & MessageChannel）**：
   - 遊戲端必須引用 `@rehab-trainer/game-sdk`，透過私有 `MessageChannel` 傳送生命週期與彙總成果。
   - 主平台驗證由 `sessionNonce` + 單調遞增 `sequence` 防禦重放攻擊；成績寫入透過後端一次性 `game_run_sessions` Token（SHA-256 驗證）防偽。
   - 彙總指標自動過濾所有含 `auth|email|jwt|name|password|token|user` 等敏感欄位。

5. **自動化掃描與人工審核門檻**：
   - 上傳檢查（`gamePackages.js`）：自動阻擋 18 種危險 API（fetch、XHR、cookie、location、eval、Worker 等）、單行超過 5000 字元或逃脫字元密度 > 5% 的混淆代碼。
   - 審核發布（`GameReleaseManager.tsx` + `admin/game-releases/[id].js`）：管理者須在無敏感憑證之隔離環境下載試玩，且必須完成「原始碼查核、隔離試玩、公開描述確認」3 項勾選後，才能發起具備 Lease 鎖定的 R2 搬遷與發布作業。

6. **獨立 PWA 與生命週期**：
   - 每個遊戲發布版本均在 `/games/{gameId}/{version}/` 提供專屬 Manifest 與 Service Worker，快取僅限該遊戲路徑與平台 runtime。
   - 若遊戲被撤回（Revoked），執行器與 Service Worker 在偵測到 404/410 後自動自毀快取並關閉。


## 測試指引

無正式完整框架。UI、auth、routing、共用 package 變更：build Hub 並對四個 runtime 執行 TypeScript 檢查。Cloudflare Function 變更：盡量對修改檔執行 `node --check`。

## 台灣醫療與職能治療法規文案

本站定位為一般居家練習工具與衛教資訊，不是醫療機構、職能治療所、遠距醫療或個別化職能治療服務。品牌固定為「居家訓練網」，SEO 描述定位為「居家訓練工具與衛教資訊」；不得把專業資格與「復健平台／治療服務／療效」組合成廣告標題或行動呼籲。

- 對外文案優先使用「練習」、「活動」、「當次紀錄」、「刺激參數」與「換算參考值」。不得宣稱診斷、醫囑、處方、個別評估、治療、預防疾病、恢復或改善人體功能、保證療效、臨床級／醫療級，亦不得無證據宣稱特定疾病或族群適用。
- 疾病、復健與治療用語只可出現在中立衛教、正式文獻題名、客觀專業經歷或清楚的非服務聲明中，不得與招徠使用、成效保證、見證或前後比較結合。免責聲明不能補救其他頁面的醫療效能宣稱。
- 專業背景只能陳述已查核事實。目前可使用「蔡泓恩｜職能治療師」及「經職能治療師考試及格並領有職能治療師證書」；未確認有效執業登記前不得使用「執業職能治療師」。學歷、在學狀態及經歷需附最後確認日期，過期時更新或刪除。
- 專業資格放在作者署名、作者背景或內容責任區，不把資格包裝成產品療效背書。沒有實際逐篇審閱紀錄時，不得加入 `reviewedBy`、治療師審閱或類似宣稱；未驗證作者資格時使用中性署名，例如「居家訓練網編輯」。
- 不得公開 104 履歷網址、分享碼、完整證號、地址、電話、年齡或其他非必要個資。除非使用者日後明確撤回此限制，結構化資料的 `sameAs` 也不得加入 104。
- 視標工具雖參考 Freiburg Vision Test（FrACT），只能說明參考其公開演算法、視標呈現、校正資料與文獻；不得推論本站已取得 FrACT 的同等效度、醫療器材認證或臨床用途。logMAR、Snellen、logCS 等輸出必須標示為刺激參數換算參考值，並明示不代表視力、對比敏感度、診斷或療效。
- 若新增或改變疾病風險判定、個別建議、臨床量測、真人諮詢、遠距服務、醫療用途或改善人體功能的 intended use，停止發布並先取得台灣醫療／醫材法規專業意見；不能只靠改文案或加免責聲明放行。

法規初審以法務部全國法規資料庫的[職能治療師法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0020039)、[職能治療師法施行細則](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0020040)、[醫療法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0020021)、[醫療器材管理法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0030106)及食藥署[醫用軟體分類分級參考指引](https://www.fda.gov.tw/TC/siteListContent.aspx?id=41637&sid=11652)最新版本為準。每次修改上述用途或宣稱前重新查核，不依賴倉庫內的舊摘要；程式碼審查只能做保守風險檢視，不得向使用者保證主管機關一定認定合法。

## SEO 與 E-E-A-T 維護

- 品牌與 SEO 單一來源：`apps/rehabtrainerhub/app/hubBrand.ts` 管理 Hub 名稱與首頁 SEO 標題，`app/seo.ts` 管理 description 與 JSON-LD，canonical domain 使用共用 `siteUrls`。不要在頁面、manifest 或檢查腳本另造不一致字串。
- Hub 首頁 production HTML 必須以繁體中文預渲染，`<html lang>`、title、可見 H1、首段、description、Open Graph、Twitter、manifest 與 JSON-LD 的品牌及用途需一致。瀏覽器語言偵測不得讓靜態輸出變成英文；共享語言 helper 的 SSR 修正不得造成 trainers 的既有語言體驗退化。
- 可索引頁必須有正確 canonical、index/follow、自然且唯一的 title/H1 與實質內容。新增、刪除或改名 route 時同步更新 `app/sitemap.ts`、`app/robots.ts` 與 `scripts/check-seo-output.mjs`；管理、帳號、進度及訓練流程頁維持既有 noindex 規則。
- 每個 domain 的 sitemap 只列該正式 origin 下可索引的絕對 canonical URL；`lastmod` 只在主要內容、結構化資料或連結確實有重大更新時填寫，不得為了看似新鮮而改日期。部署後檢查 sitemap 與 robots 為 200、XML／文字內容正確且不是 HTML 錯誤頁，再提交到相符的 Search Console property。
- 不做關鍵字堆砌、隱藏文字、重複／薄內容頁或無法由可見內容支持的 schema。`meta keywords` 不是主要排名手段；目標詞應自然出現在 title、H1、首段與相關站內連結錨文字。
- E-E-A-T 只標示可驗證事實。文章顯示真實作者、發布日期、最近更新日期與可查核來源；作者名稱連至站內作者背景。Person、Organization、WebSite、WebApplication schema 的姓名、資格、學歷、creator／founder 關係必須與可見頁面一致，不填推測欄位或敏感個資。
- E-E-A-T 不是可直接保證排名的單一分數。內容先服務讀者並回答實際問題，不為搜尋流量大量產生相似頁面、重寫他站內容或虛構新鮮度；AI 協助內容需保留人工查核、發布責任與適當揭露。
- 醫療、健康、科學與軟體效度敘述優先引用官方文件、原始研究或同儕審查論文。FrACT 相關內容引用[官方網站／手冊](https://michaelbach.de/fract/)、實際採用的版本與對應研究，並同時揭露校正需求及本站未經等效驗證。
- `ProfilePage` 只用於主要內容確實聚焦單一作者的專頁，不得套在混合問答／文章列表頁；所有 structured data 皆須代表頁面可見內容並以 Rich Results Test 驗證。
- 不得重新加入 `motor.trainerhub.cc`、`vision.trainerhub.cc`、`brain.trainerhub.cc`、`mouth.trainerhub.cc` 的公開連結、canonical、sitemap 或 auth origin；這些退役 hostname 只保留 301 設定。
- SEO 或 E-E-A-T 變更至少執行 Hub build 與 `npm run test:seo`；修改 manifest 再執行 `npm run test:pwa`，修改共用 UI、語言初始化或 entrypoint 再執行 `npm run test:entrypoints`。最後直接檢查 `apps/rehabtrainerhub/out/index.html` 的 title、H1、description、canonical、robots、JSON-LD、繁體中文可見內容及不得出現的 104 URL。

SEO 判斷以 Google Search Central 的[以使用者為優先的實用內容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)、[Sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[結構化資料指南](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)及[ProfilePage 指南](https://developers.google.com/search/docs/appearance/structured-data/profile-page)最新版本為準；規範變更時更新實作與檢查腳本，不以舊 SEO 慣例覆蓋官方說明。

## Commit 與 Pull Request 指引

短 Conventional Commit、聚焦、命令式；常用 `feat:`、`chore:`，例如 `feat: change auth ui`、`chore: unify setting`。PR 包含摘要、受影響 apps/packages、驗證指令、視覺截圖、migration/environment variable 註記。

## 安全與設定提示

禁止 frontend secrets。Auth/session secret、OAuth credentials 留在部署環境變數。密碼/session 邏輯放 Cloudflare Functions，不放 client-only code。新 D1 migrations 先部署套用，再依賴 production 功能。
