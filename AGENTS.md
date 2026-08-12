# 倉庫指引

## 專案結構與模組組織

npm workspace / Turborepo monorepo；App 程式碼位於 `apps/`：

- `apps/rehabtrainerhub`：Next.js Hub + Cloudflare Pages Functions。
- `apps/motortrainer`、`apps/visiontrainer`、`apps/braintrainer`、`apps/mouthtrainer`：Vite React trainers。

共用 UI、auth、layout、settings、storage：`packages/ui/src`。靜態資產：各 app `public/`，通常 `public/assets/`。D1 migrations：`apps/rehabtrainerhub/migrations/`。

## 建置、測試與開發指令

- `npm run dev`：Turbo 啟動全部 dev servers。
- `npm run dev:hub`、`npm run dev:motor`、`npm run dev:vision`、`npm run dev:brain`：啟動單一 app。
- `npm run build`：透過 `scripts/build-apps.mjs` 建置全部 app。
- `npm run build:cloudflare`：建置 Cloudflare Pages 輸出。
- `npm run build:hub|motor|mouth|vision|brain`：建置單一 app。
- `npm --prefix apps/<app> run preview`：預覽 Vite app 或 Hub 輸出。

高風險 trainer 變更完成前執行 `npm run test:entrypoints`：entrypoint、routing、entrypoint 引入的共用 layout/UI，或可能把 Pixi、jsPsych、Three.js、MediaPipe、TensorFlow、Vosk 帶入 entry bundle、造成白畫面的變更。

修改 Asteroid Shield、全螢幕流程或 Pixi 尺寸後執行 `npm --workspace @rehab-trainer/motortrainer run test:asteroid-shield-fullscreen`；驗證設定/rules 流程、原生全螢幕目標、全視窗 canvas。

無完整測試套件；針對性 build 為最低驗證。

## 程式風格與命名規範

使用 TypeScript、React functional components、既有模式。共用行為放 `packages/ui`，不在 trainers 重複。優先 CSS variables/theme tokens，禁止硬編碼顏色。2 spaces；components PascalCase；functions/variables camelCase；檔名明確對應功能。

## 共享邏輯優先

可共享的邏輯、UI、樣式、auth、settings、routing helper、footer/navbar 放 `packages/ui/src` 或共用 helper；app 只傳 label、顏色、URL、模組清單等專屬資料。編輯 app-specific 檔案前，先檢查 `TrainerNavbar`、`TrainerAppLayout`、`AuthPanel`、共用 settings utilities/CSS/storage/auth helpers。app 組合共用元件，不分叉版本。

玩家訓練 runtime 例外：每個訓練體驗自行擁有 runtime、game loop、renderer/canvas lifecycle、input、jsPsych/Pixi/Three timeline/plugin、刺激與遊戲內 UI。禁止跨模組集中長生命週期引擎狀態、依賴其他模組 runtime helper/視覺規則。只共享 React shell：routing、auth、settings form、layout、navigation、結果組合、renderer-independent utilities。

Hub 禁止複製/分叉 trainer 設定表單、defaults、validation、rules、runtime。Hub 僅依 training catalog 裝載 trainer-owned config entry；trainer config 變更須自動反映，無需改 Hub。Hub 只負責選擇、container、history、exit、瀏覽器權限委派。Pixi、jsPsych、Three、MediaPipe、TensorFlow runtime/lifecycle 仍屬各模組。

### 訓練 Overlay 流程

Hub 與 trainer 使用同一份 trainer-owned config/runtime：

- Hub 點「開始訓練」：只在訓練大廳上生成 trainer config overlay；背景不切換、不導向 trainer 網站。
- Trainer 點模組：只在目前頁籤/清單上生成同一 config overlay；不切到獨立設定頁。
- 可保留 query/hash deep link；開 config 不得卸載背景頁。
- 開始後由原 trainer runtime 接管 renderer、canvas、input、fullscreen lifecycle。
- 結果頁依來源只顯示一個按鈕：Hub 顯示「返回大廳」並關閉 Hub overlay；trainer 顯示「返回清單」並關閉模組 overlay、回原清單。禁止同時顯示兩者；禁止把 Hub 載入 trainer iframe。
- Hub/trainer active、complete、exit 透過共用嵌入訊息協定同步；必須驗證 origin 與 window source。

Hub 與各 trainer 為獨立 PWA；各自保留 manifest、app identity、scope、同來源下載頁。安裝來源只安裝該 app。Hub 內嵌 trainer 不得改頂層來源或導向其他 trainer 網站。

共用 shell CSS 放 `packages/ui/src/components/TrainerApp.css` 或 package stylesheet：cards、dialogs、trainer setup、results、tables、routed selection、buttons、forms、layout primitives。App `index.css` 只留產品視覺、遊戲/刺激 renderer、app overrides。搬共用 component 時同步搬 CSS，盡量刪本地重複。

Trainers 維持一致檔名/資料夾，例如 `pages/settings/SettingsPage.tsx`、`pages/links/LinksPage.tsx`。相同概念勿用不同本地命名；行為不同時用明確 app-specific 名稱。

## 測試指引

無正式完整框架。UI、auth、routing、共用 package 變更：build 受影響 app + 至少一個代表 trainer。Cloudflare Function 變更：盡量對修改檔執行 `node --check`。

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
- Hub 與四個 trainers 的跨站連結使用可理解的品牌錨文字，例如「居家訓練網」，避免只寫網址或模糊的「點這裡」。獨立 PWA、canonical 與 sitemap 仍各自指向所屬正式 origin。
- SEO 或 E-E-A-T 變更至少執行受影響 app build 與 `npm run test:seo`；修改 manifest 再執行 `npm run test:pwa`，修改共用 UI、語言初始化或 entrypoint 再執行 `npm run test:entrypoints`。最後直接檢查 `out/index.html`／`dist/index.html` 的 title、H1、description、canonical、robots、JSON-LD、繁體中文可見內容及不得出現的 104 URL。

SEO 判斷以 Google Search Central 的[以使用者為優先的實用內容指南](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)、[Sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[結構化資料指南](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)及[ProfilePage 指南](https://developers.google.com/search/docs/appearance/structured-data/profile-page)最新版本為準；規範變更時更新實作與檢查腳本，不以舊 SEO 慣例覆蓋官方說明。

## Commit 與 Pull Request 指引

短 Conventional Commit、聚焦、命令式；常用 `feat:`、`chore:`，例如 `feat: change auth ui`、`chore: unify setting`。PR 包含摘要、受影響 apps/packages、驗證指令、視覺截圖、migration/environment variable 註記。

## 安全與設定提示

禁止 frontend secrets。Auth/session secret、OAuth credentials 留在部署環境變數。密碼/session 邏輯放 Cloudflare Functions，不放 client-only code。新 D1 migrations 先部署套用，再依賴 production 功能。
