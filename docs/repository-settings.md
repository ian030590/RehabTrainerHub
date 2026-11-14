# Repository Settings

## GitHub

- Default branch: `main`
- CI: `.github/workflows/ci.yml` 並行執行七項 gate；遊戲架構拆成 types／tests，合計八個 matrix job。PR 使用與部署相同的 paths filter，另支援手動執行與 `workflow_call`
- Local validation: `npm run test:ci` 執行完整七項 gate；安裝套件不設定 Git hook。`npm run test:uiux-browser` 需要 Brave 與相應 build，只在本機手動執行
- Cloudflare deploy: `.github/workflows/deploy-cloudflare-pages.yml`
- Package manager: root `package.json` 指定的 npm
- Validation: `npm run build`
- Cloudflare build: `npm run build:cloudflare`

GitHub Actions 的部署 workflow 以 `verify` job 呼叫共用 `ci.yml`，與 `deployment_scope` 並行；`deploy` 必須等待兩者成功且 scope 要求部署，才執行 `build:cloudflare:only` 與部署。main push 保留既有 paths filter，純文件推送不觸發。測試 job 使用 `fetch-depth: 1`；部署範圍與 runtime asset 差異判斷仍需完整歷史。

驗收：`check-game-directory-architecture.test.mjs` 比對 `test:ci` 與共用 matrix 展開後的每項命令及測試檔案，分片不得漏跑或重複；另確認 hook 目錄、安裝程式與 prepare 已移除。部署與 scope 測試驗證 `verify` 相依關係及既有安全條件。Next `.next/cache` 與 `.turbo/cache` 以 lockfile、來源及公開建置設定摘要為 key；Turbo 只接受完整 key，Cloudflare out／dist 不列為 Actions 快取路徑。

## Cloudflare Pages

正式部署為 Workers `trainerhub`／`trainerhubgames`（見 `docs/workers-migration-report.md`）。下表兩個 Pages 專案已於 2026-10-19 刪除；只有 repo variable `CLOUDFLARE_DEPLOY_TARGET=pages` 時，部署流程才會重新建立並部署它們。

| Project | Role | Output |
| --- | --- | --- |
| `rehabtrainerhub` | Hub、API、各自獨立的同源官方遊戲 | `apps/rehabtrainerhub/out` |
| `trainerhub-user-games` | 無 auth／D1 的第三方遊戲隔離執行器 | `apps/usergamerunner/dist` |

`apps/rehabtrainerhub/games/{gameId}` 是每款官方遊戲的來源根目錄。Hub build
輸出到 `/games/{gameId}/`；每款遊戲有自己的 settings、manifest、service worker
與 PWA scope。`training-runtimes/{motor,vision,brain,mouth}` 只保留為既有程式碼的
建置相容 adapter，不會產生或發布 `/runtimes/*`。

## Secrets 與 variables

部署需要 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、
`AUTH_SESSION_SECRET`、`AUTH_STATE_SECRET`、`GOOGLE_CLIENT_ID`、
`GOOGLE_CLIENT_SECRET`；啟用 Turnstile 時另設 `TURNSTILE_SECRET_KEY`。

部署 Workers 時，`CLOUDFLARE_API_TOKEN` 需要 Workers 角色 `Admin`（產品層級）與 zone
`trainerhub.cc` 的 Workers Routes Edit。Cloudflare 規定建立新 Worker 需要產品層級
`Admin`；`Editor`（舊 Workers Scripts Edit 的對應角色）只能部署已存在的 Worker。
`trainerhub`、`trainerhubgames` 都建立後，可改成只對這兩個 Worker 的 `Editor`。

公開 variables 包含 `TURNSTILE_SITE_KEY`、`TURNSTILE_REQUIRED`、
`TURNSTILE_RECORDS_REQUIRED`、`CF_WEB_ANALYTICS_TOKEN`、
`R2_AI_ASSET_BUCKET`、`AI_ASSET_BASE_URL` 與 `ASSET_PUBLIC_BASE_URL`。

伺服器端訪客紀錄另由 `ANONYMOUS_RECORDS_ENABLED` 控制。production 啟用匿名寫入時，
`ANONYMOUS_RECORDS_ENABLED` 與 `TURNSTILE_RECORDS_REQUIRED` 必須同時為 `1`；部署程序先
套用 D1 migration，再同步旗標。`ANONYMOUS_RECORDS_ENABLED` 只同步到 Hub Pages Functions，
不得輸出到前端或 `usergamerunner`；發生濫用、資料安全或寫入異常時將它改回 `0`。

## Domains 與退役流程

- `trainerhub.cc` 是 Worker `trainerhub` 的 custom domain，DNS 記錄由 Cloudflare 依 Worker 管理。config 有一般 route 時，wrangler deploy 會以 config 取代 Worker 的全部 routes；config 只有 custom domain 時不會動既有 routes，要刪除須另用 Cloudflare API。回退方式見搬遷報告第 6 節。
- Runner 正式網址為 `trainerhubgames.rainbowh9490.workers.dev`，與 `trainerhub.cc` 分開，禁止使用 `trainerhub.cc` 子網域。
- 四個退役 trainer 子網域（`motor`、`vision`、`brain`、`mouth.trainerhub.cc`）與舊 `motortrainer`、`visiontrainer`、
  `braintrainer`、`mouthtrainer` Pages projects 已完全移除，沒有 DNS 記錄、Worker route 或 301 設定。
- 只在 Pages 部署流程（`CLOUDFLARE_DEPLOY_TARGET=pages`）中，`scripts/sync-cloudflare-pages-domains.mjs` 在 Hub 部署完成後
  把 `trainerhub.cc` 加到 Hub 的 Pages project。此流程需要 Pages Write 權限。

唯一 sitemap 是 `https://trainerhub.cc/sitemap.xml`；不得重新建立 trainer
sitemap、canonical、manifest、相關網站頁或 auth origin。
