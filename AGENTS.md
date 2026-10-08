# 倉庫指引

## 測試先行與最小實作（TDD）

- 所有功能開發與重構，先寫可執行、能反映使用者行為的測試，確認測試因尚未實作的需求而失敗，再修改產品程式碼。
- 只寫足以讓測試通過的產品程式碼；通過後才在測試保護下整理重複與命名，避免預先建立未使用的抽象或額外功能。
- UI 重構先以測試鎖定既有功能、導航、設定、訓練啟動與完成流程；新增行動版或平板版互動時，先加入對應測試。不得為了讓測試通過而刪除既有功能或放寬安全檢查。
- 每次提交附上測試的失敗原因、修正後結果及相關回歸驗證；若無法自動化測試，先記錄可重現的人工驗收步驟與限制。

## 專案結構與模組組織

npm workspace / Turborepo monorepo；目前只有兩個 app，App 程式碼位於 `apps/`：

- `apps/rehabtrainerhub`：Next.js Hub + Cloudflare Pages Functions（主平台、大廳、內建訓練 runtime、API、審核後台、開發者入口）。
- `apps/usergamerunner`：獨立遊戲隔離執行環境（Cloudflare Pages + Functions），從 R2 讀取核准版本，提供套件資產、安全標頭、版本化 runtime 與 PWA launcher；支援官方原生遊戲與第三方 HTML/ZIP 遊戲。
- `apps/rehabtrainerhub/games/{gameId}/`：目前有 40 個正式遊戲 workspace，擁有各自的 Vite entry、runtime、規則與 i18n。39 個未遷移遊戲仍依賴 `@rehab-trainer/ui` 的既有 `OfficialGameShell`、樣式、語言 provider 與設定橋樑，維持 `settings.json`／`score.json` 流程；這是尚待移除的遷移負債，不能宣稱所有遊戲已完全獨立。**新遊戲與 R2 遷移完成的遊戲嚴禁引入共用 UI 或跨遊戲程式碼；既有共用依賴不得擴張。** 登記於 `packages/ui/src/officialGameReleases.json` 的 R2 遊戲自行呈現設定、教學與成績，僅透過私有 MessageChannel 傳送成果，由 Hub 驗證後入庫。首個試點為畫畫塔防 `2.0.2`，詳見 `docs/r2-game-migration-plan.md`。
  **新增遊戲與 Workspace 同步：** 加入 `apps/rehabtrainerhub/games/catalog.ts` 後執行 `npm run sync:games`；有 workspace／依賴異動時更新 lockfile。sync 依 registry 將未遷移遊戲加入 Hub 依賴樹，將 R2 遊戲排除。其舊模板仍會為缺少設定檔的遊戲產生共用 UI 依賴及 alias，並不驗證遊戲是否獨立；新遊戲與 R2 遊戲須先提供自有 `package.json`、Vite entry 及依賴，不能靠 sync 取得符合新架構的套件。

Hub 的共用 UI、client auth、layout、storage、訊息協定位於 `packages/ui/src`；登入／session、授權及資料庫寫入位於 `apps/rehabtrainerhub/functions/`。`packages/game-settings` 提供 Hub 與 runner 使用的 JSON schema／validation，不是遊戲開發 SDK。R2 遊戲不得依賴這些平台套件。
第三方遊戲通訊橋樑由 `apps/usergamerunner/runtime/` 維護；RehabBuilder 規劃負責視覺化遊戲製作與 Hub 套件匯出，本倉庫不提供開發者 SDK 套件。
靜態資產：各 app `public/`，通常 `public/assets/`。
D1 migrations：`apps/rehabtrainerhub/migrations/`。
Cloudflare bindings 以各 app 的 `wrangler.toml` 為準：Hub 有 `REHAB_DB` D1、`ARTICLE_CACHE` KV 與下列四個 R2 bucket；runner 只有 `GAME_RELEASE_BUCKET`，沒有 D1／KV 或 auth bindings。
R2 Buckets：`rehab-storage`（靜態素材）、`oculomotor-data`（私人眼動逐筆 CSV，含新版 WebGazer 上傳與舊版歷史紀錄）、`rehab-game-quarantine`（待審上傳暫存）、`rehab-game-releases`（已核准不可變發布）。新版眼動練習另由瀏覽器下載原參考格式的 CSV。
舊本機 `.dist-releases/` 已刪除並由 Git 忽略。發布讀取遊戲 workspace 的 `dist/`，暫存收據位於 `.tmp/official-game-releases/`，正式收據保留在 `docs/releases/`。

## 建置、測試與開發指令

- `npm run dev`：Turbo 啟動宣告 `dev` script 的 workspace；目前只有 Hub。
- `npm run dev:hub`：啟動 Hub。
- `npm run build`：執行測試 gate，再由 `scripts/build-apps.mjs` 先建置全部遊戲 workspace、後建置兩個 app；不會自動發布 R2。
- `npm run build:cloudflare`：執行本機完整 gate，並建置 Cloudflare Pages 輸出；已在 CI 驗證時使用 `build:cloudflare:only`。
  Pages build 僅建置 39 個未遷移遊戲與兩個 app，排除 registry 登記的 R2 遊戲；R2 遊戲另行建置與發布。
- `npm run build:hub`：Turbo 建置 Hub 及其 39 個未遷移遊戲依賴，產生 `apps/rehabtrainerhub/out/`；畫畫塔防只留下導向 R2 PWA 的入口，不攜帶遊戲 bundle／JSON。
- `npm run build:gamerunner`：建置隔離站的靜態 runtime 到 `apps/usergamerunner/dist/`；遊戲版本仍由 Functions 從 R2 讀取。
- `npm --prefix apps/rehabtrainerhub/games/drawing-defense run build`：單獨建置 R2 遊戲到其 `dist/`。發布腳本讀取既有輸出，不會先建置。
- `npm run publish:game -- drawing-defense`：版本取自遊戲 package.json；檢查並發布至 R2。同版本不同內容禁止覆寫；逐檔比對、上傳並回讀 SHA-256，最後發布 release manifest，再更新 `official-games/{gameId}/current.json`。此官方 CLI 採每遊戲單一發布者，沒有第三方審核 API 的 Lease 鎖；同遊戲的發布與回退不可平行執行。
- `node scripts/publish-official-game.mjs drawing-defense --activate-version 2.0.1`：核對官方歷史、approved manifest 與實際檔案後回退 current；保留所有發布版本，不部署 Hub。首次建立官方歷史只使用 `docs/releases/` 已追蹤收據的雜湊，不能掃描共用 releases prefix 當作官方來源。
- `node scripts/publish-official-game.mjs drawing-defense --dry-run`：只做本機套件驗證與暫存收據，不連線 R2。直接呼叫腳本可避免本機 npm 未轉交 `--dry-run` 參數而意外執行發布流程。
- `npm run test:hub-functions`：驗證 Hub 後端 API 與安全防護測試。
- `npm run test:gamerunner`：驗證 usergamerunner 路由、沙盒、SW 與安全標頭測試。
- `npm run test:game-platform`：驗證遊戲套件掃描器與平台通訊橋樑。
- `npm --prefix apps/rehabtrainerhub run preview`：預覽 Hub 的 `out/`；runner 與現有遊戲 workspace 未宣告 `preview` script。

高風險 trainer 變更完成前執行 `npm run test:entrypoints`：entrypoint、routing、entrypoint 引入的共用 layout/UI，或可能把 Pixi、jsPsych、Three.js、MediaPipe、TensorFlow、Vosk 帶入 entry bundle、造成白畫面的變更。此 gate 包含 Subject ID helper、training flow、assessment jsPsych lifecycle 與 i18n dictionary parity 檢查。

修改 Asteroid Shield、全螢幕流程或 Pixi 尺寸後，至少執行 `npm run test:entrypoints` 與 `npm run build:hub`，驗證設定/rules 流程、原生全螢幕目標、全視窗 canvas。

驗證使用 Node.js 內建 `node:test`、assert 檢查腳本、TypeScript、針對性 build 與本機 Brave smoke；依變更範圍選用對應 gate。Hub API、runner、遊戲流程、assessment lifecycle 與 i18n 分別有 `test:hub-functions`、`test:gamerunner`、`test:training-flow`、`test:assessment-lifecycle`、`test:i18n`。

## CI/CD 維護

- `npm run test:naming` 先執行命名檢查器回歸測試，再掃描原始碼；明確排除 `.dist-releases` 等建置產物，仍檢查原始碼的函式、參數與變數命名。兩份 workflow 的 `naming` matrix 均使用此命令。
- `npm run test:pwa` 包含 `test:pwa-navigation`，以本機 HTTP 308 轉址及實際產生的 Service Worker 驗證內嵌頁面預快取、離線導航與舊快取清理；兩份 workflow 的 `pwa` matrix 均執行此命令，不依賴 Brave。

- `.github/workflows/ci.yml` 在 PR 與非 `main` push 的應用程式、package、script、lockfile、Turbo 或 workflow 變更時執行；純文件變更不得啟動 CI。
- `.github/workflows/deploy-cloudflare-pages.yml` 在 `main` 的既有應用程式／package／script／workflow 觸發範圍執行 matrix 驗證。`deployment_scope` 另判斷 Pages 是否需部署：只有已遷移 R2 遊戲內容、遊戲 package.json 版本號及對應 lockfile 版本中繼資料變更時跳過部署；平台、依賴與未遷移遊戲變更仍部署。手動執行或無法確認差異時保守部署；workflow 自身仍在觸發範圍。新增 gate 時加入兩份 workflow 的 matrix，並維持相同命令。
- CI/CD 乾淨安裝使用 `npm ci --workspaces --include-workspace-root`；Hub 的內建遊戲相容 build 需要 root 的 Vite 與訓練 runtime dependencies，不得省略 workspace root。
- `test:game-platform` 由兩份 workflow 的 `test:entrypoints` matrix 間接執行，涵蓋遊戲通訊橋樑、訊息協定與設定 schema；SDK workspace 已移除。兩份 workflow 維持相同的 `test:entrypoints` 命令。
- Hub 單一四路由導覽與 `aria-current` 契約由 `scripts/check-hub-navigation.test.mjs` 驗證，包含於兩份 workflow 共用的 `test:entrypoints` 命令；手機導覽與平板無水平溢出另以本機 Brave browser smoke 驗證。
- `npm run test:game-architecture` 檢查全部遊戲 TypeScript、逐遊戲依賴與 i18n、未遷移遊戲的 JSON／統一 config UI，以及 R2 遊戲的自有設定／成績、無共用依賴、私有通訊和實際 bytes 雜湊驗證（`scripts/check-self-contained-game.test.mjs`）；發布工具測試另驗證上傳失敗不切換 current、不可變檔案與歷史回退。確認舊 `.dist-releases/` 已移除且由 Git 忽略，正式發布收據仍可追蹤。CI 與部署 workflow 維持同名 matrix 與相同命令。Hub build 另驗證已遷移遊戲不得攜帶 bundle／JSON，且不得恢復 `/runtimes/*`。
- 畫畫塔防 R2 本機 Brave 測試為 `node scripts/check-r2-game-browser.mjs`，另執行 `--mobile`、`--revoke`、`--session-failure`；發布後執行 `--remote` 與 `--remote --standalone`。平台部署後另以 `--production-hub` 讀正式 Hub 與 R2，僅攔截 Hub `/api/*` 至本機，驗證真正部署的開始前固定版本流程。不加入沒有 Brave 的 Linux CI matrix。所有模式的資料庫寫入只在本機測試 SQLite，不建立正式紀錄。
- `npm run test:webgazer` 驗證眼動練習參考實驗的 WebGazer/jsPsych bundle 完整性、校正與驗證程序、`settings.json` 與 `score.json` 欄位；包含於 `test:entrypoints`。網頁版沒有原生 Tobii 橋接。
- `npm run test:webgazer-browser` 以本機 Brave 驗證眼動練習設定、無眼動刺激與成績流程、雙層同源 iframe 的相機權限，以及 R2 CSV 上傳失敗重試；此項為本機測試，不加入 Linux CI matrix。
- `npm run build:cloudflare` 保留給本機完整 gate + build。CI/CD 已完成驗證時，部署 job 使用 `npm run build:cloudflare:only`，不可再序列重跑同一批測試。
- `npm run test:cloudflare-deploy` 包含私人眼動 R2 bucket 建立流程的冪等性與失敗情境，以及 R2 遊戲變更／版本 metadata 的 Pages 部署判斷測試；兩份 workflow 維持相同的 `cloudflare-deploy` matrix 命令。`test:gamerunner` 包含官方 current 入口、歷史雜湊與撤回驗證，並保留第三方 bridge 測試。
- 部署 job 先以 Cloudflare API 確認或建立私人 `oculomotor-data` R2 bucket，再部署含 `OCULOMOTOR_DATA` binding 的 Hub；bucket 不設定公開網域，也不綁定 usergamerunner。
- 兩份 workflow 的驗證 matrix 均為 `naming`、`pwa`、`game-architecture`、`hub-functions`、`gamerunner`、`trainer-entrypoints`、`cloudflare-deploy`；`test:entrypoints` 的內含 gate 以 root `package.json` 為準。
- `npm run test:seo` 同時驗證文章正文的伺服器渲染與實際 HTML SEO 輸出，目前沒有獨立 CI matrix，也未列入 root build gate。Hub build 末尾會執行 `check-seo-output.mjs`，因此部署 build 有 HTML SEO 輸出檢查，PR 驗證 matrix 不會執行完整 `test:seo`；SEO 變更仍須本機另行驗證。
- 變更 workflow 觸發範圍、測試命令或 build gate 時，必須同步更新本節，並確認 workflow 自身路徑仍會觸發驗證。

## 程式風格與命名規範

### Training panel 長期規範

- 所有遊戲的 `training-panel` 必須使用明確語意標籤：主標題使用 `<h2>`、分段標題使用 `<h3>`、標籤與說明使用 `<p>`，有順序的規則使用 `<ol><li>`；不得以無語意的 `<div>` 或 `<span>` 取代。
- `training-panel` 內的文字字重至少為 `700`，字體大小以對應設定表單的基準放大 `1.15` 倍，並維持可讀的行高與鍵盤操作。

使用 TypeScript、React functional components、既有模式。Hub 共用行為放 `packages/ui`；遊戲專屬 runtime、規則、i18n 與樣式留在各遊戲。優先 CSS variables/theme tokens，禁止硬編碼顏色。2 spaces；components／classes／types 使用 PascalCase，變數與參數使用 camelCase。命名 gate 要求具名 `function` 宣告使用 PascalCase；`use*`、`onRequest*` 與 Next.js framework functions 依 `scripts/check-identifier-names.mjs` 例外處理，函式值可使用 camelCase 或 PascalCase；檔名明確對應功能。

## 共享邏輯優先

Hub 的共用邏輯、UI、樣式、auth、settings、routing helper、footer/navbar 放 `packages/ui/src` 或共用 helper；Hub app 組合共用元件，不分叉版本。

遊戲隔離的目標是：**每個遊戲擁有完整設定、教學、game loop、renderer、i18n 與成績 UI，不引入 `packages/ui` 或任何跨遊戲共用元件**。目前只有 registry 登記的畫畫塔防達到 R2 自包含格式；39 個舊遊戲仍使用共用 shell，其專屬引擎、字典與規則已放回遊戲內，剩餘平台 UI 依賴須在逐步遷移時移除。

| 流程 | 設定／結果 UI | Hub 入庫方式 |
| --- | --- | --- |
| 未遷移官方遊戲 | 遊戲提供 `settings.json`／`score.json`；Hub 使用 `GameSettingsForm`／`TrainingScore`，獨立入口沿用 `OfficialGameShell` | `/api/records` → `training_records` |
| R2 官方遊戲 | 遊戲自己呈現，不建立兩份 JSON；Hub 使用 `R2GameOverlay` | `/api/official-game-sessions` 簽署 token，再經 `/api/records` → `training_records` |
| 開發者上傳遊戲 | `PackageGameOverlay`／runner launcher 使用上傳契約與版本化 bridge，維持第三方既有設定／成績格式 | `/api/game-run-sessions` 建立一次性 token，再經 `/api/game-runs` → `game_runs` |

R2 官方遊戲的 `rehab-trainer.game-score/v1` 為數值傳輸／入庫格式，並非 UI 描述檔；以 `docs/r2-game-migration-plan.md` 為準。Hub 僅提供 container、身份隔離、私有通訊、保存與 exit。禁止將已遷移遊戲 bundle 或共用 UI 依賴重新加入 Hub 依賴樹／output。

`officialGameReleases.json` 只登記遊戲名稱、可信 origin 與遷移資格，不包含 current version。Hub 在 iframe 載入前請求 `/api/official-game-sessions`，由後端讀取 R2 官方 current／雜湊歷史與 approved manifest，回傳固定的 version、contentSha256、recordId 與 token。保存重試沿用該工作階段；current 切換不影響仍核准的舊版，撤回或雜湊不符時拒絕保存，R2 故障回覆 503。相容舊 Hub 可指定官方歷史版本；第三方上傳不得使用已登記的官方 slug，已提交的歷史投稿亦不得透過第三方審核 API 發布或撤回官方 slug。穩定 PWA 入口 `/games/{gameId}/` 以不可快取 302 選擇 current，已安裝的版本化 PWA 仍固定原版本。

R2 遊戲與 Hub 分屬不同 origin。成果僅走交給指定 iframe window 的私有 MessageChannel；遊戲核對 init 的 parent source／origin，Hub 核對 nonce、game/version、sequence 與成果 schema，不接受一般 window message 的成果。獨立 PWA 只在新格式 release 明確宣告 fullscreen capability 時委派全螢幕，仍保持 `sandbox="allow-scripts"`。

Hub 禁止複製／分叉遊戲的 defaults、validation、rules 或 runtime。現行未遷移流程依 catalog 的 `settingsPath` 讀取遊戲擁有的 JSON，交由統一 `GameSettingsForm` 呈現；沒有另載入 trainer-owned config entry。R2 遊戲的設定／結果都留在 iframe，Hub 不解讀 UI 描述檔。Pixi、jsPsych、Three、MediaPipe、TensorFlow runtime／lifecycle 均屬各遊戲。

### 訓練 Overlay 流程

未遷移官方遊戲的 `score.json`（`rehab-trainer.game-score/v1`）宣告逐回合數值欄位與總計欄位。`JsonTrainingOverlay` 驗證同源 origin／source、sessionNonce、完成 sequence 及分數 schema 後，卸載 iframe 並以共用 `training-overlay-score` 顯示結果。R2 官方遊戲則由 `R2GameOverlay` 保留 iframe，透過私有 port 接收成果、回覆保存成功或失敗；完整結果與重試 UI 由遊戲呈現。

官方遊戲成果經 Hub `/api/records` 寫入 D1；訪客使用 guest Subject ID，登入紀錄使用另一套帳號範圍 Subject ID 並附帳號。訪客紀錄不顯示於登入帳號的進度追蹤，遊戲嵌入 Hub 時不得自行重複寫入紀錄。`docs/game-score-contract.md` 的 JSON／Hub 結果 UI 契約適用未遷移遊戲；R2 新增／遷移遊戲不建立這兩份 JSON。舊格式契約由 `test:embedded-training` 驗證，R2 自包含契約由 `test:game-architecture` 驗證，後端沿用 `test:hub-functions`。

Hub 大廳依 `games/catalog.ts` 選擇遊戲，設定與 runtime 的來源維持由遊戲擁有：

- Hub 點「開始訓練」：未遷移遊戲先顯示 JSON 設定 overlay；R2 遊戲開啟包含其自有設定的 iframe overlay。背景不切換、不導向 trainer 網站。
- 遊戲 runtime 由 Hub overlay 或單一遊戲 PWA 載入，不建立獨立 trainer 網站。
- 可保留 query/hash deep link；開 config 不得卸載背景頁。
- 開始後由原 trainer runtime 接管 renderer、canvas、input、fullscreen lifecycle。
- 結果頁依來源只顯示一個按鈕：Hub 顯示「返回大廳」並關閉 Hub overlay；單一遊戲 PWA 顯示返回入口。禁止同時顯示兩者。
- 未遷移遊戲以 `embeddedTraining` 的 window message 同步 active／complete／exit，驗證同源 origin 與 window source；R2 遊戲依前述私有 MessageChannel 契約同步。

只有 Hub 是主平台 PWA。未遷移遊戲在 Hub origin 的 `/games/{gameId}/` 提供獨立 manifest／Service Worker；R2 遊戲在 runner origin 的 `/games/{gameId}/{version}/` 提供版本化 PWA，Hub 的 `/games/{gameId}/` 只留下導向連結。四個舊 trainer app 已移除，不存在 `training-modules/`、`training-runtimes/` 或 `/runtimes/*`；四個退役 hostname 僅保留 Hub 的 301 相容設定。

Hub 使用 Next.js App Router（`apps/rehabtrainerhub/app/`）、`app/globals.css` 及 `packages/ui` 的共用 components／stylesheet；不再使用舊 trainer 的 `pages/settings/`、`pages/links/` 結構。`TrainerApp.css` 目前也仍供未遷移遊戲的 `OfficialGameShell` 使用，此依賴須在遷移時移除。R2 遊戲只引用自身樣式；renderer、教學與規則樣式均留在各遊戲，禁止引入平台共用 CSS。

### 遊戲平台與沙盒執行規範

本平台提供開放開發者上傳 HTML/ZIP 居家練習遊戲的 Steam 式體驗，必須嚴格遵守以下六層安全防護架構。未遷移的同源官方遊戲與 R2／第三方隔離遊戲使用不同載入流程，不可套用錯誤的通訊或 sandbox 契約。

1. **物理隔離（Separate Domain）**：
   - 主平台（`trainerhub.cc`，處理登入、個人紀錄、資料庫）與遊戲執行器（`trainerhub-user-games.pages.dev`，提供 R2 資產、runtime 與 PWA launcher）必須完全分開。
   - `usergamerunner` Cloudflare Pages 專案**嚴禁綁定 D1、KV 認證或任何使用者私密資料**。目前只綁定 `rehab-game-releases`，Functions 僅接受 GET／HEAD 並呼叫 bucket.get；唯讀由程式與部署規範維持，`wrangler.toml` 並無獨立唯讀 binding 宣告，禁止新增 bucket 寫入能力。

2. **沙盒機制（Strict Iframe Sandbox）**：
   - 主平台載入 R2 官方／第三方遊戲，以及 runner launcher 載入 package 時，一律使用 `<iframe sandbox="allow-scripts">`。
   - **絕對禁止**加上 `allow-same-origin`（防止突破同源隔離讀取憑證）或 `allow-top-navigation`（防止重導向至釣魚網站）。
   - `JsonTrainingOverlay` 載入未遷移同源官方遊戲時仍有 `allow-same-origin`、下載與舊流程權限；這是既有相容流程，不能複製到 R2／第三方 overlay。

3. **阻斷外連（Restrictive CSP）**：
   - package 回應的 CSP 以 `apps/usergamerunner/functions/[[path]].js` 的 `packageContentSecurityPolicy` 為單一來源；包含 `default-src 'none'`、`script-src 'self' 'unsafe-inline'`、`style-src 'self' 'unsafe-inline'`、`connect-src 'none'`、`worker-src 'none'`、`form-action 'none'`、`sandbox allow-scripts`，另限制 child/frame/object 與 WebRTC，不允許 `unsafe-eval`。
   - `frame-ancestors 'self' https://trainerhub.cc` 目前套在 launcher 文件，package 回應沒有這項指令；不可宣稱所有 package 檔案均具備相同 ancestor 限制。launcher 的 nonce、同源 release 檢查與 Service Worker 權限不能轉交給遊戲 iframe。
   - 禁止遊戲向任何外部伺服器發起 `fetch`、`XMLHttpRequest`、`WebSocket` 或 `WebRTC`。

4. **安全通訊橋樑（postMessage & MessageChannel）**：
   - 新投稿遊戲必須引用隔離執行站提供的版本化通訊橋樑，透過私有 `MessageChannel` 傳送生命週期與彙總成果；舊版 SDK URL 僅供已發布遊戲相容使用。
   - R2／第三方通訊均驗證 `sessionNonce` 與單調遞增 `sequence`。第三方成果使用 `game_run_sessions` 一次性 token（資料庫保留 SHA-256），經 `/api/game-runs` 保存；官方 R2 成果使用 24 小時 HMAC-SHA-256 簽署 token，綁定 game／version／recordId／帳號／Subject ID，經 `/api/records` 冪等保存。官方流程不建立 `game_run_sessions`。
   - 成果 schema 拒絕含 `auth|email|jwt|name|password|token|user` 等敏感欄位；只接受契約規定的設定與數值。這些是使用者端回報紀錄，token／簽章不代表伺服器已重算分數或提供防作弊保證。

5. **自動化掃描與人工審核門檻**：
   - 第三方上傳檢查（`functions/_lib/gamePackages.js`）：危險 API／HTML／CSS 規則以 `blockedSourcePatterns` 為準，包含 fetch、XHR、cookie、navigation、eval、Worker 等；同時檢查單行 5000 字元上限、逃脫字元密度、檔案大小／數量、ZIP 膨脹比與資源路徑，不固定宣稱為 18 種規則。
   - 第三方審核發布（`app/admin/GameReleaseManager.tsx` + `functions/api/admin/game-releases/[id].js`）：管理者須在無敏感憑證之隔離環境下載試玩，且必須完成「原始碼查核、隔離試玩、公開描述確認」3 項勾選後，才能發起具備 Lease 鎖定的 R2 搬遷與發布作業。官方遊戲 CLI 是另一套發布流程，不經此上傳／審核 API。

6. **獨立 PWA 與生命週期**：
   - 每個遊戲發布版本均在 `/games/{gameId}/{version}/` 提供專屬 Manifest 與 Service Worker，快取僅限該遊戲路徑與平台 runtime。
   - 若遊戲被撤回（Revoked），執行器與 Service Worker 在偵測到 404/410 後自動自毀快取並關閉。


## 測試指引

UI、auth、routing、共用 package 變更：build Hub、執行 `npm run test:entrypoints`，並以 `npm run test:game-architecture` 檢查全部遊戲 TypeScript；不再對不存在的四個 trainer runtime 執行檢查。Cloudflare Function 變更：對修改檔執行 `node --check`，並執行對應 `test:hub-functions`／`test:gamerunner`。

本機瀏覽器 smoke 使用 Brave；遊戲平台架構或統一 config UI 變更後執行 `npm run test:game-architecture:browser`。此項是本機 Brave 整合測試，不加入缺少 Brave 的 Linux CI matrix。

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
