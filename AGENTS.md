# 倉庫指引

## 專案結構與模組組織

這是一個 npm workspace / Turborepo monorepo。應用程式程式碼放在 `apps/`：

- `apps/rehabtrainerhub`：Next.js hub 網站與 Cloudflare Pages Functions。
- `apps/motortrainer`、`apps/visiontrainer`、`apps/braintrainer`：Vite React 訓練器應用。

共用 UI、auth helper、layout、settings 與 storage 工具放在 `packages/ui/src`。靜態資產位於各 app 的 `public/` 目錄中，常見路徑是 `public/assets/`。Cloudflare D1 migrations 放在 `apps/rehabtrainerhub/migrations/`。

## 建置、測試與開發指令

- `npm run dev`：透過 Turbo 啟動所有 app 的 dev server。
- `npm run dev:hub`、`npm run dev:motor`、`npm run dev:vision`、`npm run dev:brain`：在本機啟動單一 app。
- `npm run build`：透過 `scripts/build-apps.mjs` 建置所有 app。
- `npm run build:cloudflare`：建置 Cloudflare Pages 輸出。
- `npm run build:hub|motor|mouth|vision|brain`：建置單一 app。
- `npm --prefix apps/<app> run preview`：預覽已建置的 Vite app 或 hub 輸出。

在高風險的 trainer 變更完成前，請先執行 `npm run test:entrypoints`。高風險包含 trainer app entrypoint、routing、被 trainer entrypoint 引入的共用 layout/UI，或任何可能把 Pixi、jsPsych、Three.js、MediaPipe、TensorFlow、Vosk 帶進 app entry bundle 並導致空白畫面的程式碼。

在修改 Asteroid Shield、其全螢幕流程或 Pixi 尺寸後，請執行 `npm --workspace @rehab-trainer/motortrainer run test:asteroid-shield-fullscreen`。這個回歸測試會驗證設定與規則流程、原生全螢幕目標，以及全視窗遊戲 canvas。

目前沒有完整測試套件；對變更而言，針對性 build 是最低限度的驗證方式。

## 程式風格與命名規範

請使用 TypeScript、React functional components 與既有的本地模式。共用行為應放在 `packages/ui`，不要在各 trainer app 重複實作。優先使用 CSS variables 與既有 theme token，不要硬編碼顏色。請使用 2 spaces 縮排、component 用 PascalCase、function 與 variable 用 camelCase，檔名要能清楚對應元件或功能。

## 共享邏輯優先

如果邏輯、UI、樣式、auth 行為、settings 行為、routing helper，或 footer/navbar 行為可以共享，就不應該在每個 trainer 裡各自重寫。請把可重用的程式碼放到 `packages/ui/src` 或其他共用 helper，再只傳入 app 專屬資料，例如 label、顏色、URL 或模組清單。這點非常重要，因為 MotorTrainer、VisionTrainer 與 BrainTrainer 本來就是平行產品：重複邏輯會分歧、造成無障礙行為不一致，還會讓同一個 bug 要修三次。編輯 app-specific 檔案前，先確認這個變更是否應該放到 `TrainerNavbar`、`TrainerAppLayout`、`AuthPanel`、共用 settings utilities、共用 CSS 或共用 storage/auth helpers。app 檔案應該組合共用元件，而不是分叉出自己的版本。

玩家面向的訓練模組是廣泛共享的例外。單一訓練體驗必須自行擁有其 runtime 邏輯、遊戲迴圈、renderer/canvas 生命週期、input handling、jsPsych/Pixi/Three timeline/plugin 設定，以及模組專屬刺激或遊戲內 UI 樣式。不要把長生命週期的訓練引擎狀態集中共用到多個模組，也不要讓某個模組依賴另一個模組的 runtime helper 或視覺規則。這類模組的共用程式碼應限制在 React 頁面外殼：routing、auth、settings form、layout、navigation、結果組合，以及與 renderer 無關的工具函式。

共用 CSS 應放在 `packages/ui/src/components/TrainerApp.css` 或其他 package 層級的 stylesheet，適用於共用外殼，例如 cards、dialogs、trainer setup panel、result summary、result table、routed module selection、buttons、form controls 或 layout primitives。App 的 `index.css` 應只保留產品專屬的視覺、遊戲/刺激渲染，以及 app 專用覆寫。把共用元件搬到 `packages/ui` 時，也要同時搬移對應的可重用 CSS，並在可行時刪除本地重複規則。

請在 trainer 之間維持一致的檔名與資料夾命名。舉例來說，功能相同的 route page 應遵循共用的放置方式，例如 `pages/settings/SettingsPage.tsx` 與 `pages/links/LinksPage.tsx`。不要為相同概念保留不同命名的本地檔案，除非行為真的不同；如果行為不同，檔名就要明確表達該 app 專屬角色。

## 測試指引

目前沒有正式的測試框架。對 UI、auth、routing 或共用 package 的變更，請執行受影響 app 的 build，以及至少一個代表性的 trainer build。對 Cloudflare Function 的變更，也請盡可能對已修改的 function 檔案執行 `node --check`。

## Commit 與 Pull Request 指引

最近的 commit 使用簡短的 Conventional Commit 風格標題，通常是 `feat:` 或 `chore:`（例如 `feat: change auth ui`、`chore: unify setting`）。請讓 commit 保持聚焦且具命令式語氣。Pull request 應包含簡潔摘要、受影響的 apps/packages、驗證指令、視覺變更的截圖，以及 migration 或 environment variable 的註記。

## 安全與設定提示

不要把 secrets 放在 frontend code 裡。Auth/session secret 與 OAuth credentials 必須保留在部署環境變數中。密碼與 session 邏輯應放在 Cloudflare Functions，而不是 client-only code。新的 D1 migrations 上線前，請先套用，之後再依賴相關 production 功能。
