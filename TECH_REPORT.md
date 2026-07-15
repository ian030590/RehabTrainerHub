# RehabTrainerHub 技術報告

> 報告日期：2026-07-15  
> 報告範圍：Turborepo Monorepo 全專案（`apps/` + `packages/ui`）

---

## 目錄

1. [如何降低程式碼維護難度](#1-如何降低程式碼維護難度)
2. [資安漏洞分析](#2-資安漏洞分析)
3. [如何加快 CI/CD 流程](#3-如何加快-cicd-流程)
4. [在不影響 UI 體驗的前提下降低記憶體消耗](#4-在不影響-ui-體驗的前提下降低記憶體消耗)

---

## 1. 如何降低程式碼維護難度

### 現況優點（已做到的部分）

- **共用元件層集中管理**：`packages/ui/src` 已承載 `AuthPanel`、`TrainerNavbar`、`TrainerAppLayout`、`RehabFooter` 等 26 個跨 Trainer 共用元件，有效避免三個 Trainer App 各自維護一份相同邏輯。
- **路由結構一致性**：StrokeTrainer 與 BrainTrainer 的 `App.tsx` 結構幾乎對稱，使用 `React.lazy` + `Suspense` 動態載入，有統一的 fallback 樣式（`AppLoading`）。
- **Vite 設定共用模式**：三個 Trainer 的 `vite.config.ts` 使用相同的 `normalizeSiteUrl` / `escapeHtml` 工具函數與 `manualChunks` 分包策略。
- **TypeScript 全面覆蓋**：所有前端原始碼以 TypeScript 撰寫，型別定義明確，有助長期維護。

---

### 待改善項目

#### 1.1 Vite 設定有程式碼重複

**問題**：`apps/stroketrainer/vite.config.ts`、`apps/visiontrainer/vite.config.ts`、`apps/braintrainer/vite.config.ts` 各自定義了同名的 `normalizeSiteUrl()` 與 `escapeHtml()` 工具函數，且 `manualChunks` 分包策略也有部分重複。

**建議**：在 `packages/config-eslint` 或新建的 `packages/config-vite` 共用套件中抽出這兩個工具函數與基礎 `rollupOptions`，讓各 Trainer 的 `vite.config.ts` 僅需設定 app 特有的環境變數與 `manualChunks` 項目。

```ts
// packages/config-vite/src/index.ts（建議新增）
export function normalizeSiteUrl(value: string | undefined, fallback: string): string { ... }
export function escapeHtml(value: string): string { ... }
export function trainerBaseRollupOptions(): RollupOptions { ... }
```

#### 1.2 `AppLayout` 中的 `footerLabels` 重複定義

**問題**：StrokeTrainer 與 BrainTrainer 的 `AppLayout()` 函數各自包含一段完全對等的 i18n 文字物件（`hub`、`privacy`、`repo`、`disclaimer`、`rights`），唯一差異只有 `disclaimer` 的文案。

**建議**：在 `TrainerAppLayout` 的 props 中加入 `disclaimerKey` 或直接傳入 disclaimer 字串，其他固定欄位（`hub`、`privacy`、`repo`、`rights`）改由 `RehabFooter` 元件內部透過 locale prop 自行處理，避免每個 App 重複定義四份一樣的標籤。

#### 1.3 `applyDisplaySettings` 事件監聽邏輯重複

**問題**：StrokeTrainer 與 BrainTrainer 的 `AppLayout` 的 `useLayoutEffect` 完全相同（監聽 `SETTINGS_CHANGED_EVENT` 和 `storage`）。

**建議**：將此邏輯提升為 `packages/ui/src/hooks/useAppDisplaySettings.ts`，供所有 App 直接引用一行即可：

```ts
// 建議新增
export function useAppDisplaySettings(defaultFontSizePx: number) { ... }

// 各 App 的 AppLayout 使用
useAppDisplaySettings(DEFAULT_UI_FONT_SIZE_PX);
```

#### 1.4 Cloudflare Function 缺少 TypeScript

**問題**：`apps/rehabtrainerhub/functions/` 下所有後端程式碼（`auth.js`、`submissions.js`、`records.js` 等）皆為純 JavaScript，沒有型別保護。

**建議**：逐步將 `_lib/auth.js` 與各 API handler 遷移至 TypeScript（`.ts`），並搭配 `@cloudflare/workers-types` 取得完整的 `Env`、`Request`、`D1Database` 型別定義，可大幅減少執行期型別錯誤。

#### 1.5 `turbo.json` 缺少 env 輸入追蹤

**問題**：`turbo.json` 的 `build` task 未設定 `env` 輸入清單，導致 Turborepo 無法偵測環境變數變更並使快取失效，可能造成舊 build 被重複使用。

**建議**：

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "out/**", ".next/**"],
      "env": [
        "VITE_AUTH_API_BASE",
        "VITE_STROKETRAINER_URL",
        "VITE_VISIONTRAINER_URL",
        "VITE_BRAINTRAINER_URL",
        "VITE_REHABTRAINERHUB_URL",
        "NEXT_PUBLIC_SITE_URL",
        "NEXT_PUBLIC_AUTH_API_BASE"
      ]
    }
  }
}
```

---

## 2. 資安漏洞分析

### 2.1 現況良好的防護（已實作）

| 防護機制 | 位置 | 說明 |
|---|---|---|
| PBKDF2-SHA256（150,000 次迭代） | `_lib/auth.js:hashPassword` | 密碼雜湊符合現代標準 |
| Constant-Time 比較 | `_lib/auth.js:constantTimeEqual` | 防止 Timing Attack |
| HMAC-SHA256 Session Token | `_lib/auth.js:createSignature` | 自製輕量 JWT，避免 Algorithm Confusion |
| Origin 白名單驗證 | `_lib/auth.js:isAllowedOrigin` | 所有 API 端點皆有 CORS 阻擋 |
| IP + 帳號雙層 Rate Limit | `password/login.js:37-44` | 登入嘗試限速 |
| OAuth State HMAC 驗證 | `auth/start.js:78-88` | 防止 CSRF |
| `isSafeReturnTo` 驗證 | `_lib/auth.js:328-335` | 防止 Open Redirect |
| HTML 安全掃描（提交物） | `submissions.js:90-113` | 阻擋 script 標籤、inline event 等 |
| `HttpOnly` Cookie | `_lib/auth.js:238` | 防止 XSS 偷取 Session |
| Webhook URL 來源驗證 | `submissions.js:308-312` | 僅接受 discord.com / discordapp.com |

---

### 2.2 需要關注的資安問題

#### 🔴 高風險：Rate Limit 存在跨 Isolate 競爭問題（TOCTOU）

**位置**：`_lib/auth.js:24`

```js
let rateLimitTableReady = false;
```

**問題**：`rateLimitTableReady` 是 module-level 變數，Cloudflare Worker 在不同的 isolate 或冷啟動後此旗標會重置。Rate Limit 計數本身存在 D1，在 D1 寫入並發競爭下，多個並發請求可能在計數更新前同時通過限速門檻，造成**短暫的 Rate Limit bypass**（TOCTOU 問題）。

**建議**：考慮使用 Cloudflare Durable Objects 或 KV 實作嚴格的原子計數器，確保跨 isolate 的計數一致性。或者在限速閾值上留有安全餘量（例如設定 limit 為實際容忍值的 60%）。

#### 🟡 中風險：`DELETE FROM rate_limits` 在每次請求執行，增加 D1 寫入壓力

**位置**：`_lib/auth.js:452-454`

```js
await db.prepare('DELETE FROM rate_limits WHERE reset_at < ?')
  .bind(now - 60 * 60)
  .run();
```

**問題**：每次 Rate Limit 檢查都執行一次 DELETE，在高流量下會增加 D1 的寫入壓力。

**建議**：改用 Cloudflare Cron Trigger 定時清理，或降低清理頻率（例如每 100 次請求才觸發一次）。

#### 🟡 中風險：`constantTimeEqual` 對多位元組 Unicode 字元的假設

**位置**：`_lib/auth.js:296-303`

**問題**：`charCodeAt` 在 Base64URL 字串情境下是安全的（只有 ASCII 字元），但若未來此函數被誤用於含 Emoji 或多位元組 Unicode 的字串時，可能造成比較行為不預期。

**建議**：在函數頂部加入 JSDoc 說明此函數的使用限制（只接受 ASCII/Base64URL 字串），或改用 `crypto.subtle.timingSafeEqual` 搭配 `TextEncoder`：

```js
async function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  return crypto.subtle.timingSafeEqual(a, b); // Cloudflare Workers 支援
}
```

#### 🟡 中風險：`authPopupHtml` 中 JSON 字串只有單向跳脫

**位置**：`_lib/auth.js:377`

```js
const message = JSON.stringify({ type: AUTH_MESSAGE_TYPE, token, user })
  .replace(/</g, '\\u003c');
```

**問題**：只跳脫 `<`，若 token 或 user 欄位含有 `</script>` 等特殊字串，HTML 解析器可能提早結束 `<script>` block，有潛在 XSS 風險。

**建議**：

```js
const message = JSON.stringify({ type: AUTH_MESSAGE_TYPE, token, user })
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');
```

#### 🟢 低風險：`submissions.js` HTML 掃描使用正則表達式

**問題**：以 RegExp 掃描 HTML 無法完全解析所有混淆輸入（HTML entity、Unicode 正規化等），目前覆蓋率已相當高，但存在理論上的盲點。

**建議**：目前安全性已可接受。若未來需要更嚴格的審查，可在服務端加入 HTML sanitizer library（如 `sanitize-html`）進行第二層驗證。

---

### 2.3 資安整體評估

整體後端安全設計良好，使用正確的 Web Crypto API、有完整的 CORS 與 Origin 驗證、沒有在前端洩漏任何密鑰，OAuth 流程也有完整的 state 驗證。**主要需要關注的是 D1 在高並發下的 Rate Limit 計數一致性**。

---

## 3. 如何加快 CI/CD 流程

### 現況分析

目前唯一的 CI/CD 流程是 `.github/workflows/deploy-cloudflare-pages.yml`，每次 push 到 `main` 就會：

1. `checkout`
2. `setup-node@v6`（含 npm 快取）
3. `npm ci --workspaces=false`（安裝根目錄 devDependencies）
4. `npm run build:cloudflare`（建置全部 4 個 app）
5. `node scripts/deploy-cloudflare-pages.mjs`（部署到 Cloudflare Pages）

**主要瓶頸**：步驟 4（全量建置）是最大的時間消耗，即使只改了 StrokeTrainer 的一個文字，仍會重新建置全部 4 個 app。

---

### 3.1 利用 Turborepo Remote Cache

**問題**：`turbo.json` 的 `build` task 有設定 `outputs`，但 CI 中使用的是 `npm run build:cloudflare`（呼叫自訂的 `build-apps.mjs` 腳本），**完全繞過了 Turborepo 的快取機制**。

**建議（選項 A，推薦）**：啟用 Turborepo Remote Cache（Vercel 免費方案）

```yaml
- name: Build all apps
  run: npx turbo run build --filter=...[HEAD^1]
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

**建議（選項 B）**：在 GitHub Actions 中快取 Turbo 快取目錄

```yaml
- name: Cache Turbo
  uses: actions/cache@v4
  with:
    path: .turbo
    key: turbo-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-${{ github.sha }}
    restore-keys: |
      turbo-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}-
      turbo-${{ runner.os }}-
```

#### 預期效益

| 場景 | 目前 | 改善後 |
|---|---|---|
| 只改 StrokeTrainer | 全部 4 app 重建 | 僅重建 StrokeTrainer |
| 只改 `packages/ui` | 全部 4 app 重建 | 重建所有 dependent app（正確） |
| 無任何變更（重跑） | 全部重建 | Remote Cache 命中，接近 0 建置時間 |

---

### 3.2 拆分建置與部署為獨立並行 Job

**建議**：拆成 `build-*` + `deploy` 兩個 job，讓 4 個 app 的建置工作並行執行：

```yaml
jobs:
  build-hub:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: npm }
      - run: npm ci --workspaces=false
      - run: npm run build:hub
      - uses: actions/upload-artifact@v4
        with: { name: hub-dist, path: apps/rehabtrainerhub/out }

  build-stroke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: npm }
      - run: npm ci --workspaces=false
      - run: npm run build:stroke
      - uses: actions/upload-artifact@v4
        with: { name: stroke-dist, path: apps/stroketrainer/dist }

  # build-vision、build-brain 同理

  deploy:
    needs: [build-hub, build-stroke, build-vision, build-brain]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v4
      - run: node scripts/deploy-cloudflare-pages.mjs
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          # ...
```

#### 預期時間改善

| 方案 | 預估總時間 |
|---|---|
| 現況（單一 job 順序建置） | ~12–18 分鐘 |
| 並行 Job 方案 | ~5–8 分鐘（取決於最慢的 app） |

---

### 3.3 加入變更偵測（跳過未修改的 App）

**建議**：使用 `dorny/paths-filter` Action 偵測哪些 app 有變動，動態決定哪些 build job 需要執行：

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      stroke: ${{ steps.filter.outputs.stroke }}
      vision: ${{ steps.filter.outputs.vision }}
      brain: ${{ steps.filter.outputs.brain }}
      hub: ${{ steps.filter.outputs.hub }}
    steps:
      - uses: actions/checkout@v7
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            stroke:
              - 'apps/stroketrainer/**'
              - 'packages/ui/**'
            vision:
              - 'apps/visiontrainer/**'
              - 'packages/ui/**'
            brain:
              - 'apps/braintrainer/**'
              - 'packages/ui/**'
            hub:
              - 'apps/rehabtrainerhub/**'
              - 'packages/ui/**'

  build-stroke:
    needs: changes
    if: needs.changes.outputs.stroke == 'true'
    # ...
```

---

### 3.4 分離 Lint/Type-check 與 Build/Deploy 流程

**建議**：在 PR 階段加入獨立的靜態分析 workflow，避免在部署 workflow 中混入非必要的驗證步驟：

```yaml
# .github/workflows/ci.yml（建議新增）
on: [pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: npm }
      - run: npm ci --workspaces=false
      - run: npx tsc --noEmit -p apps/stroketrainer/tsconfig.json
      - run: npx tsc --noEmit -p apps/visiontrainer/tsconfig.json
      - run: npx tsc --noEmit -p apps/braintrainer/tsconfig.json
```

---

## 4. 在不影響 UI 體驗的前提下降低記憶體消耗

### 背景：重量級依賴

本專案在前端引入了多個佔用大量記憶體的函式庫：

| 函式庫 | 用途 | 記憶體特性 |
|---|---|---|
| `@tensorflow/tfjs` v4 | KNN 分類器（手勢辨識） | 初始化後佔用 50–200 MB（視模型大小） |
| `three.js` v0.184 | 3D 渲染 | WebGL context 佔用 GPU + CPU 記憶體 |
| `pixi.js` v8 | 2D 遊戲渲染（VoiceDefender、GestureBattler 等） | WebGL context、Texture cache |
| `vosk-browser` | 語音識別 | 載入後約 30–80 MB（模型 zip） |
| `@mediapipe/tasks-vision` | 視覺手勢偵測 | WASM 模組約 10–30 MB |

---

### 4.1 Pixi.js Application WebGL Context 洩漏防護

**問題**：`VoiceDefenderGame.tsx`（2,263 行）與 `GestureBattlerGame.tsx`、`DrawingTowerDefenseGame.tsx` 等大型遊戲檔案，每次進入/離開遊戲頁面都需要正確地創建並銷毀 `pixi.js` 的 `Application` 實例（WebGL context）。WebGL context 若沒有明確 `app.destroy(true, true)` 就離開，瀏覽器有硬性限制（通常 8–16 個），超過會靜默失效。

**建議**：確認每個使用 Pixi.js 的 useEffect 都有完整的 cleanup：

```ts
useEffect(() => {
  const app = new Application();
  // ...初始化

  return () => {
    app.destroy(true, { children: true, texture: true }); // 釋放所有 texture
  };
}, []);
```

---

### 4.2 TensorFlow.js 延遲初始化與 Tensor 釋放

**問題**：`@tensorflow/tfjs` 套件體積龐大（`manualChunks` 已拆為 `tensorflow-runtime` chunk），若使用者不玩手勢遊戲，TF.js 的初始化記憶體仍可能被提前佔用。

**建議**：確保 TensorFlow 相關邏輯只在明確需要時才初始化 backend，並在遊戲結束後呼叫 `tf.disposeVariables()` 釋放未使用的 Tensor：

```ts
// 只在遊戲開始時才初始化
async function initTfBackend() {
  await tf.setBackend('webgl');
  await tf.ready();
}

// 遊戲結束時釋放
function cleanupTf() {
  tf.disposeVariables();
  tf.engine().reset();
}
```

---

### 4.3 Vosk 語音模型的 Blob URL 管理

**位置**：`apps/stroketrainer/src/pages/training/voskModelCache.ts`

**現況**：`getCachedModelUrl` 回傳的 `CachedModelUrl` 物件包含 `url`（ObjectURL）與 `revoke()`。若呼叫方在遊戲結束時沒有呼叫 `revoke()`，`URL.createObjectURL()` 產生的 Blob URL 和對應的記憶體會在整個 session 中持續佔用。

**建議**：在 `VoiceDefenderGame.tsx` 的 cleanup 函數中確保呼叫 `cachedModelUrl.revoke()`：

```ts
useEffect(() => {
  let cachedUrl: CachedModelUrl | null = null;

  async function loadModel() {
    cachedUrl = await getCachedModelUrl(/* ... */);
    // 使用 cachedUrl.url
  }

  loadModel();

  return () => {
    cachedUrl?.revoke(); // ← 確保在元件卸載時釋放 Blob URL
  };
}, []);
```

---

### 4.4 大型遊戲元件的 Code Splitting 精緻化

**現況**：`VoiceDefenderGame.tsx`（90 KB）、`DrawingTowerDefenseGame.tsx`（76 KB）、`GestureBattlerGame.tsx`（54 KB）皆已透過 `React.lazy()` 動態載入，這是非常好的起點。

**進一步優化**：`voiceDefenderVocabulary.ts` 與 `voiceDefenderSpeechMatching.ts` 仍作為靜態 import，可將這些資料以動態 import 形式在遊戲真正開始時才載入：

```ts
// 在 VoiceDefenderGame 內部，僅在使用者點擊「開始遊戲」時才載入
const handleStart = async () => {
  const { createDefaultVoiceVocabulary } = await import('./voiceDefenderVocabulary');
  // ...
};
```

---

### 4.5 CSS 體積優化

**現況**：
- `packages/ui/src/components/TrainerApp.css`：2,019 行（41 KB）
- `apps/stroketrainer/src/index.css`：52 KB
- `apps/rehabtrainerhub/app/globals.css`：42 KB

**建議**：在 CI 建置時加入 PurgeCSS 掃描，移除在元件中從未出現的 selector：

```ts
// vite.config.ts（僅 production build）
import { purgeCSSPlugin } from '@fullhuman/postcss-purgecss';

css: {
  postcss: {
    plugins: mode === 'production'
      ? [purgeCSSPlugin({ content: ['./src/**/*.tsx', './index.html'] })]
      : [],
  },
}
```

---

### 4.6 記憶體消耗改善預估

| 優化項目 | 預估記憶體節省 | 影響使用者體驗 |
|---|---|---|
| Pixi.js WebGL Context 正確釋放 | 30–80 MB（每次進出遊戲） | 無，反而改善多次進出遊戲的穩定性 |
| TF.js `disposeVariables` | 50–150 MB（手勢遊戲結束後） | 無 |
| Vosk Blob URL `revoke()` | 30–80 MB（語音模型大小） | 無，語音識別功能維持不變 |
| CSS Purge（移除未使用規則） | 減少 CSS 解析時間（10–30ms） | 無 |
| Vosk vocabulary 動態 import | 減少初始 JS 解析記憶體約 5–10 MB | 極微小延遲（首次開始遊戲時） |

---

## 附錄：重要檔案索引

| 檔案 | 說明 |
|---|---|
| `packages/ui/src/auth/authClient.ts` | 前端 Auth Client 核心邏輯 |
| `packages/ui/src/components/TrainerApp.css` | 共用 CSS（2,019 行） |
| `apps/rehabtrainerhub/functions/_lib/auth.js` | 後端 Auth 共用函式庫 |
| `apps/rehabtrainerhub/functions/api/auth/callback.js` | Google OAuth Callback |
| `apps/rehabtrainerhub/functions/api/auth/password/login.js` | 密碼登入 API |
| `apps/rehabtrainerhub/functions/api/submissions.js` | HTML 安全掃描與提交 API |
| `apps/stroketrainer/src/pages/training/VoiceDefenderGame.tsx` | 最大的遊戲元件（2,263 行） |
| `apps/stroketrainer/src/pages/training/voskModelCache.ts` | Vosk 模型快取工具 |
| `.github/workflows/deploy-cloudflare-pages.yml` | 唯一的 CI/CD Workflow |
| `turbo.json` | Turborepo 任務設定 |
