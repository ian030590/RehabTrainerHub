# Repository Settings

## GitHub

- Default branch: `main`
- CI: `.github/workflows/ci.yml`
- Cloudflare deploy: `.github/workflows/deploy-cloudflare-pages.yml`
- Package manager: root `package.json` 指定的 npm
- Validation: `npm run build`
- Cloudflare build: `npm run build:cloudflare`

## Cloudflare Pages

| Project | Role | Output |
| --- | --- | --- |
| `rehabtrainerhub` | Hub、API、四個同源 training runtimes | `apps/rehabtrainerhub/out` |
| `trainerhub-user-games` | 無 auth／D1 的第三方遊戲隔離執行器 | `apps/usergamerunner/dist` |

`apps/rehabtrainerhub/training-runtimes/{motor,vision,brain,mouth}` 由 Hub build
產生到 `/runtimes/*`，不是 Pages project、獨立網站或獨立 PWA。

## Secrets 與 variables

部署需要 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、
`AUTH_SESSION_SECRET`、`AUTH_STATE_SECRET`、`GOOGLE_CLIENT_ID`、
`GOOGLE_CLIENT_SECRET`；啟用 Turnstile 時另設 `TURNSTILE_SECRET_KEY`。

公開 variables 包含 `TURNSTILE_SITE_KEY`、`TURNSTILE_REQUIRED`、
`TURNSTILE_RECORDS_REQUIRED`、`CF_WEB_ANALYTICS_TOKEN`、
`R2_AI_ASSET_BUCKET`、`AI_ASSET_BASE_URL` 與 `ASSET_PUBLIC_BASE_URL`。

## Domains 與退役流程

- `trainerhub.cc` 綁定 `rehabtrainerhub`。
- `trainerhub-user-games.pages.dev` 保持獨立，禁止使用 `trainerhub.cc` 子網域。
- 四個退役 trainer custom domains 綁到 `rehabtrainerhub`，由
  `functions/_middleware.js` 對任何路徑回 301。
- `scripts/sync-cloudflare-pages-domains.mjs` 在 Hub 部署完成後，先清除舊
  `motortrainer`、`visiontrainer`、`braintrainer`、`mouthtrainer` Pages projects
  的非現行 deployments，再解除 custom domains、刪除舊 projects，並將這些
  domains 加到 Hub。此流程需要 Pages Write 權限。

唯一 sitemap 是 `https://trainerhub.cc/sitemap.xml`；不得重新建立 trainer
sitemap、canonical、manifest、相關網站頁或 auth origin。
