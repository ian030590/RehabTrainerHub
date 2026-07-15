# Auth and D1 Setup

RehabTrainerHub uses the Hub Pages project as the central auth API for:

- Google OAuth login
- Anonymous profile collection after login
- Signed-in training record storage in Cloudflare D1

StrokeTrainer, VisionTrainer, and future Pages apps call the Hub API with a bearer token. If there is no token, records stay in each browser's IndexedDB.

The Hub also sets a first-party session cookie. Other sites try to restore that shared Hub session on load, and the login popup can reuse the same Hub session when browser third-party cookie rules block silent restoration.

## Cloudflare D1

The production D1 database has been created:

```text
name: rehabtrainerhub
database_id: 0f4e6bb2-cf41-4051-ad74-19bb501fe9dd
region: APAC
```

Deployments apply migrations automatically before publishing Pages. To apply them manually:

```bash
npx --yes wrangler@4 d1 migrations apply rehabtrainerhub --config apps/rehabtrainerhub/wrangler.toml --remote
```

## OAuth Redirect URI

Register this callback URL in the Google Cloud Console OAuth client:

```text
https://trainerhub.cc/api/auth/callback
```

Register the production callback and set `AUTH_BASE_URL=https://trainerhub.cc`.

## GitHub Actions Secrets

Set these GitHub Actions secrets in the repository or in the `cloudflare-pages` environment:

```text
AUTH_SESSION_SECRET=<random 32+ character secret>
AUTH_STATE_SECRET=<random 32+ character secret>
GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth client secret>
```

`AUTH_SESSION_SECRET` and `AUTH_STATE_SECRET` are app-owned random signing secrets. They are not Google values. Generate long random strings and keep them only in GitHub Actions secrets or Cloudflare environment variables.

## GitHub Actions Variables

Recommended repository or `cloudflare-pages` environment variables:

```text
AUTH_API_BASE=https://trainerhub.cc
REHABTRAINERHUB_URL=https://trainerhub.cc
STROKETRAINER_URL=https://stroke.trainerhub.cc
VISIONTRAINER_URL=https://vision.trainerhub.cc
BRAINTRAINER_URL=https://brain.trainerhub.cc
AUTH_ALLOWED_ORIGINS=https://trainerhub.cc,https://stroke.trainerhub.cc,https://vision.trainerhub.cc,https://brain.trainerhub.cc
```

`AUTH_ALLOWED_ORIGINS` is optional when the deploy script defaults match the canonical domains, but setting it explicitly keeps production auth behavior auditable.

## Cloudflare Pages Environment Sync

GitHub Actions runs `scripts/sync-cloudflare-auth-env.mjs` during deployment:

- Every Pages project receives shared client auth config:
  `AUTH_API_BASE`, `NEXT_PUBLIC_AUTH_API_BASE`, `NEXT_PUBLIC_REHABTRAINERHUB_URL`, `VITE_AUTH_API_BASE`, and `VITE_REHABTRAINERHUB_URL`.
- The Hub project additionally receives:
  `AUTH_BASE_URL`, `AUTH_ALLOWED_ORIGINS`, `AUTH_SESSION_SECRET`, `AUTH_STATE_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.
- D1 migrations are applied for projects that define `database_name` and `migrations_dir` in `wrangler.toml`.
- New Pages apps are discovered from `apps/*/wrangler.toml`, so they are included without editing the workflow.
- GitHub Actions is the source of truth. The sync uses `wrangler pages secret bulk`, so Cloudflare Pages values are overwritten with the current GitHub Actions secrets and variables on each deployment.

For local or manual sync:

```bash
AUTH_SESSION_SECRET=<secret> AUTH_STATE_SECRET=<secret> GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret> node scripts/sync-cloudflare-auth-env.mjs
```

The runtime code can fall back to `AUTH_SESSION_SECRET` if `AUTH_STATE_SECRET` is absent, but the CI/CD sync script requires both secrets so production deployments stay explicit.

## Trainer And Future App Environment Variables

Shared auth client code should use:

```text
VITE_AUTH_API_BASE=https://trainerhub.cc
NEXT_PUBLIC_AUTH_API_BASE=https://trainerhub.cc
```

## Privacy and Profile Fields

Privacy policy URL:

```text
https://trainerhub.cc/privacy/
```

The first login shows a privacy notice before OAuth starts. After OAuth returns, the profile form asks for:

- Age range
- Gender
- Nationality
- Physician-diagnosed chronic condition categories
- Smoking habit and frequency when applicable
- Alcohol habit and frequency when applicable

The chronic condition form explicitly reminds users not to guess or self-diagnose without a physician diagnosis.
