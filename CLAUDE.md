# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` 是本倉庫的權威規範（TDD、各遊戲版本／發布狀態、安全架構、法規文案、SEO），本檔只整理最常用的指令與整體架構；兩者衝突時以 `AGENTS.md` 為準。各遊戲目前 current 版本與驗收證據看 `docs/releases/*.json` 與對應 `docs/*.md`，不要從記憶推測。

## 工作方式重點

- **測試先行**：先寫能反映使用者行為的測試並確認它因需求未實作而失敗，再改產品碼；只寫讓測試通過的最小實作。不得刪除既有功能或放寬安全檢查來讓測試通過。
- 發布 R2 遊戲（`publish:game`）會直接公開並切換 current，必須先取得擁有者對**精確 version／contentSha256** 的核准。未核准時只用 `--dry-run`。
- **只在 `main` 進行**：commit 後直接 push 到 `main`，不開新的功能分支。舊 `feat/*`、`fix/*` 分支都已併入 `main`，留作歷史紀錄，不刪除也不再推送（見 `AGENTS.md`「分支政策」）。
- `main` push 會觸發 Pages 自動部署（純文件變更不會）。若變更把新遊戲登記進 `officialGameReleases.json`，須先完成該版核准與 R2 發布，再 push；不要從含未發布遊戲候選的工作樹手動部署 Pages。
- 對外文案遵守台灣醫療法規限制（用「練習／活動／當次紀錄」，不得宣稱治療、診斷、療效）；細節見 `AGENTS.md`。

## 常用指令

```bash
npm install                     # .npmrc 設 workspaces=false（無 symlink 環境）；CI 用 npm ci --workspaces --include-workspace-root
npm run dev:hub                 # Hub 開發伺服器
npm run build:hub               # 建置 Hub + 未遷移遊戲 → apps/rehabtrainerhub/out/
npm run build:gamerunner        # runner 靜態 runtime → apps/usergamerunner/dist/
npm run build                   # 全部 gate + 建置（不發布 R2）
npm --prefix apps/rehabtrainerhub/games/<gameId> run build   # 單獨建置 R2 遊戲 dist/
npm run sync:games              # 修改 games/catalog.ts 或遊戲 workspace 後
```

七項 CI gate（`ci.yml` 與 `deploy-cloudflare-pages.yml` 的 matrix 相同，新增 gate 須兩份同步並更新 `AGENTS.md` CI 節）：

```bash
npm run test:naming
npm run test:pwa
npm run test:game-architecture   # 全部遊戲 tsc + R2 自包含／遷移／教學測試
npm run test:hub-functions       # apps/rehabtrainerhub/functions/**/*.test.mjs
npm run test:gamerunner          # apps/usergamerunner/tests/*.test.mjs
npm run test:entrypoints         # entrypoint、導覽、i18n、training flow、webgazer、game-platform…
npm run test:cloudflare-deploy
```

單一測試：測試都是 Node 內建 `node:test`，直接跑檔案即可，例如
`node --test scripts/check-gabor-patching-migration.test.mjs` 或
`node --test apps/rehabtrainerhub/functions/api/official-game-sessions.test.mjs`。
修改 Cloudflare Function 後另對檔案跑 `node --check <file>`。

其他：
- `npm run test:seo`：SEO／文章預渲染（不在 CI matrix，SEO 變更須本機跑）。
- 本機 Brave 整合（不進 Linux CI，只寫本機 SQLite）：`node scripts/check-r2-game-browser.mjs --game <gameId> --lobby`，常用旗標 `--mobile`、`--tablet`、`--signed-in --english`、`--session-failure`、`--revoke`、`--standalone`；`--remote`／`--production-hub` 才讀正式站。並行 build 時用 `HUB_OUTPUT_ROOT`／`RUNNER_OUTPUT_ROOT` 指向固定輸出副本。
- 發布：`node scripts/publish-official-game.mjs <gameId> --dry-run`（直接呼叫腳本，避免 npm 吞掉旗標）；回退 `--activate-version <ver>`。同遊戲發布／回退不可平行。

## 架構總覽

npm workspace + Turborepo，兩個 Cloudflare Pages app：

- **`apps/rehabtrainerhub`**（`trainerhub.cc`）：Next.js App Router Hub（`app/`）+ Pages Functions（`functions/`：auth/session、`/api/records`、`/api/official-game-sessions`、投稿與審核 API、`_middleware.js`）。綁定 D1 `REHAB_DB`、KV、四個 R2 bucket。D1 migrations 在 `migrations/`。
- **`apps/usergamerunner`**（`trainerhub-user-games.pages.dev`）：隔離執行站，只綁 `rehab-game-releases`（唯讀 GET/HEAD），從 R2 提供遊戲資產、版本化 PWA（`/games/{gameId}/{version}/`）、第三方通訊 bridge（`runtime/`）與相機輸入代理（`/input/hand-tracking-*`、`/input/eye-tracking-*`）。**嚴禁**綁 D1／KV／使用者資料。package CSP 單一來源為 `functions/[[path]].js` 的 `packageContentSecurityPolicy`。
- **`apps/rehabtrainerhub/games/<gameId>/`**：每款遊戲各自是 workspace（Vite entry、runtime、規則、i18n）。目錄登記在 `games/catalog.ts`。
- **`packages/ui/src`**：Hub 共用 UI、auth、storage、訊息協定；`officialGameReleases.json` 登記已遷移 R2 遊戲（名稱、可信 origin，**不含** current 版本）。
- **`packages/game-settings`**：Hub／runner 用的 settings JSON schema 驗證，不是遊戲 SDK。
- **`workers/game-review-issues`**：投稿審核 GitHub Issue Cron Worker，另外部署。

### 三種遊戲流程（不可混用通訊／sandbox 契約）

| 流程 | 設定／結果 UI | 入庫 |
| --- | --- | --- |
| 未遷移官方遊戲（舊流程） | 遊戲提供 `settings.json`／`score.json`，Hub 用 `GameSettingsForm`／`JsonTrainingOverlay`（同源 iframe）；依賴 `@rehab-trainer/ui` 的 `OfficialGameShell` | `/api/records` |
| R2 官方遊戲（自包含） | 遊戲自己呈現設定、教學、成績；Hub 用 `R2GameOverlay`，iframe 在 runner origin、`sandbox="allow-scripts"` | `/api/official-game-sessions` 簽 HMAC token → 私有 MessageChannel → `/api/records` |
| 第三方上傳遊戲 | `PackageGameOverlay`／runner launcher + 版本化 bridge | `/api/game-run-sessions` 一次性 token → `/api/game-runs` |

關鍵不變式：
- **R2 遊戲與新遊戲不得引入 `packages/ui`、平台套件或跨遊戲程式碼**；未遷移遊戲的既有共用依賴不得擴張。
- R2 iframe 永遠 `sandbox="allow-scripts"`，禁止 `allow-same-origin`／`allow-top-navigation`；成果只走 Hub 交給指定 iframe 的私有 MessageChannel，雙方驗證 origin／source、nonce、單調 sequence 與 schema。
- Hub 啟動 R2 遊戲前由後端讀 R2 `official-games/{gameId}/current.json` 與 approved manifest，固定 version／contentSha256；Hub build 對 R2 遊戲只留導向入口，不得攜帶其 bundle／JSON，`_middleware.js` 對其舊子資產回 410。
- R2 遊戲以 `public/game.json` 宣告目錄文案、分類與預覽圖；已發布檔案不可覆寫，改動須升版本。
- Hub 不得複製遊戲的 defaults、validation、rules 或 runtime；Pixi／jsPsych／Three／MediaPipe／TensorFlow lifecycle 屬於各遊戲。
- 遷移遊戲依 `docs/r2-game-migration-plan.md` 第 7 節步驟與第 11 節審查單執行。

## 風格

TypeScript、React function components、2 spaces。具名 `function` 宣告用 PascalCase（`use*`、`onRequest*`、Next.js framework functions 例外，見 `scripts/check-identifier-names.mjs`），變數／參數 camelCase。用 CSS variables／theme tokens，禁止硬編碼顏色。`training-panel` 須用語意標籤（`h2`/`h3`/`p`/`ol li`）、字重 ≥700、字級為設定表單 1.15 倍。Commit 採短 Conventional Commit（`feat:`、`fix:`、`chore:`、`docs:`）。
