# Auth and D1 Setup

RehabTrainerHub uses the Hub Pages project as the central auth API for:

- Google OAuth login
- Facebook OAuth login
- Anonymous profile collection after login
- Signed-in training record storage in Cloudflare D1

StrokeTrainer and VisionTrainer call the Hub API with a bearer token. If there is no token, records stay in each browser's IndexedDB.

## Cloudflare D1

The production D1 database has been created:

```text
name: rehabtrainerhub
database_id: 493ad6de-0e9e-41b2-96a6-6af93c67fce2
region: APAC
```

Apply migrations:

```bash
npx --yes wrangler@4 d1 migrations apply rehabtrainerhub --config apps/rehabtrainerhub/wrangler.toml --remote
```

## OAuth Redirect URI

Register this callback URL in both Google and Facebook developer consoles:

```text
https://rehabtrainerhub.pages.dev/api/auth/callback
```

For custom domains, register the equivalent custom-domain callback and set `AUTH_BASE_URL`.

## Hub Environment Variables

Set these on the `rehabtrainerhub` Cloudflare Pages project:

```text
AUTH_BASE_URL=https://rehabtrainerhub.pages.dev
AUTH_ALLOWED_ORIGINS=https://rehabtrainerhub.pages.dev,https://stroketrainer.pages.dev,https://visiontrainer.pages.dev
AUTH_SESSION_SECRET=<random 32+ character secret>
AUTH_STATE_SECRET=<random 32+ character secret>
GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth client secret>
FACEBOOK_CLIENT_ID=<facebook app id>
FACEBOOK_CLIENT_SECRET=<facebook app secret>
```

`AUTH_SESSION_SECRET` and `AUTH_STATE_SECRET` are app-owned random signing secrets. They are not Google or Facebook values. Generate long random strings and keep them only in Cloudflare environment variables or secrets.

If `AUTH_STATE_SECRET` is omitted, the app falls back to `AUTH_SESSION_SECRET`.

## Trainer Environment Variables

Set this on StrokeTrainer and VisionTrainer only if the auth API is not the default Hub URL:

```text
VITE_AUTH_API_BASE=https://rehabtrainerhub.pages.dev
```

## Privacy and Profile Fields

Privacy policy URL:

```text
https://rehabtrainerhub.pages.dev/privacy/
```

The first login shows a privacy notice before OAuth starts. After OAuth returns, the profile form asks for:

- Age range
- Gender
- Nationality
- Physician-diagnosed chronic condition categories
- Smoking habit and frequency when applicable
- Alcohol habit and frequency when applicable

The chronic condition form explicitly reminds users not to guess or self-diagnose without a physician diagnosis.
