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

## Commit 與 Pull Request 指引

短 Conventional Commit、聚焦、命令式；常用 `feat:`、`chore:`，例如 `feat: change auth ui`、`chore: unify setting`。PR 包含摘要、受影響 apps/packages、驗證指令、視覺截圖、migration/environment variable 註記。

## 安全與設定提示

禁止 frontend secrets。Auth/session secret、OAuth credentials 留在部署環境變數。密碼/session 邏輯放 Cloudflare Functions，不放 client-only code。新 D1 migrations 先部署套用，再依賴 production 功能。
