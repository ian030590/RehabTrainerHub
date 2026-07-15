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

Register this exact callback URL in the Google Cloud Console OAuth client's
**Authorized redirect URIs**:

```text
https://trainerhub.cc/api/auth/callback
```

StrokeTrainer, VisionTrainer, and BrainTrainer still use this same Hub callback
because their login popup starts from `https://trainerhub.cc/api/auth/start`.
Adding only the trainer site URLs, such as `https://stroke.trainerhub.cc` or
`https://vision.trainerhub.cc`, does not satisfy Google's `redirect_uri` check.

The production auth base URL is `https://trainerhub.cc`. If `AUTH_BASE_URL` is
set manually, it must also be the Hub origin, not an individual trainer origin.

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

No public URL variables are required for production. The deployment sync script writes the canonical public URLs automatically.

## Cloudflare Pages Environment Sync

GitHub Actions runs `scripts/sync-cloudflare-auth-env.mjs` during deployment:

- Every Pages project receives shared client auth config with the canonical public URLs.
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

Shared auth client code uses `https://trainerhub.cc`.

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
