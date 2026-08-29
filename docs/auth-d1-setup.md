# Auth and D1 Setup

Rehab Trainer Hub 使用同源 Pages Functions 提供 Google OAuth、個人資料與
訓練紀錄 D1 儲存。四個內建 training runtimes 位於 `trainerhub.cc/runtimes/*`，
不再使用跨站 bearer-token 還原或 trainer origin 白名單。

## D1

```text
name: rehab_db
database_id: 0f4e6bb2-cf41-4051-ad74-19bb501fe9dd
region: APAC
```

手動套用 migration：

```bash
pnpm dlx wrangler@4 d1 migrations apply rehab_db --config apps/rehabtrainerhub/wrangler.toml --remote
```

## OAuth callback

Google Cloud Console 只登記：

```text
https://trainerhub.cc/api/auth/callback
```

正式 `AUTH_BASE_URL` 必須是 `https://trainerhub.cc`。四個退役 trainer domain
不得加入 OAuth redirect URI 或 `AUTH_ALLOWED_ORIGINS`。

Google OAuth 用戶端必須建立為「網頁應用程式」，OAuth 同意畫面的 Audience
必須允許實際使用者：正式服務設為 External 並發布至 Production；若仍在 Testing，
每一個登入帳號都必須列入 Test users。若設為 Internal，Google Workspace 網域外帳號
會在本站 callback 之前直接收到 Google 403，Turnstile 通過也不會改變這個限制。
設定名稱與限制以 Google 官方的 [Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en)
及 [Web Server OAuth 2.0](https://developers.google.com/identity/protocols/oauth2/web-server)
文件為準。

部署後若 Google 顯示 403，依序確認：

1. Pages 的 `GOOGLE_CLIENT_ID` 是同一個 Google Cloud 專案內的 Web client，且以
   `.apps.googleusercontent.com` 結尾；不要填 API key、service account 或 client secret。
2. Authorized redirect URI 與 `https://trainerhub.cc/api/auth/callback` 逐字相同。
3. OAuth consent screen 的 User type、Publishing status、Test users 已允許該帳號。
4. `AUTH_BASE_URL` 是 `https://trainerhub.cc`，重新同步 Pages secrets 並部署。

## Deployment secrets

```text
AUTH_SESSION_SECRET=<random 32+ character secret>
AUTH_STATE_SECRET=<random 32+ character secret>
GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth client secret>
TURNSTILE_SECRET_KEY=<optional Cloudflare Turnstile secret>
```

GitHub Actions 是 Pages secrets 的來源；部署時會同步 Hub 環境並自動套用 D1
migrations。隱私權政策固定為 `https://trainerhub.cc/privacy/`。
