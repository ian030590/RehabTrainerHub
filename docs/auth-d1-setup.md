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
npx --yes wrangler@4 d1 migrations apply rehab_db --config apps/rehabtrainerhub/wrangler.toml --remote
```

## OAuth callback

Google Cloud Console 只登記：

```text
https://trainerhub.cc/api/auth/callback
```

正式 `AUTH_BASE_URL` 必須是 `https://trainerhub.cc`。四個退役 trainer domain
不得加入 OAuth redirect URI 或 `AUTH_ALLOWED_ORIGINS`。

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
