# Game platform deployment

The game platform has two security zones. They must remain separate in every
environment:

- `https://trainerhub.cc` owns accounts, the catalog, developer submissions,
  review decisions, and result persistence.
- The game runner uses a different registrable domain (for example
  `https://rehab-user-games.com`). The temporary Pages address
  `https://trainerhub-user-games.pages.dev` is also a separate site, but a
  dedicated production domain is preferred.

Never point the runner at `games.trainerhub.cc`, add it to
`AUTH_ALLOWED_ORIGINS`, or give it an auth secret, D1 binding, or quarantine
bucket. `scripts/sync-cloudflare-auth-env.mjs` intentionally excludes the
`gamehost` application role.

## Cloudflare resources

Create two R2 buckets with different purposes:

```text
rehab-game-quarantine  # private uploads, Hub binding only
rehab-game-releases    # immutable approved files, Hub + runner bindings
```

Apply the D1 migration before deploying code that exposes the upload API:

```powershell
pnpm dlx wrangler@4 d1 migrations apply rehab_db --remote --config apps/rehabtrainerhub/wrangler.toml
```

Set `GAME_RUNNER_ORIGIN` on the Hub Pages project to the exact HTTPS origin of
the runner. Do not include a path, query, credentials, wildcard, or trailing
subdomain under `trainerhub.cc`.

The runner project needs only this binding:

```toml
[[r2_buckets]]
binding = "GAME_RELEASE_BUCKET"
bucket_name = "rehab-game-releases"
```

Cloudflare R2 bindings do not express read-only access in `wrangler.toml`.
Keep the runner code and deployment identity minimal, monitor writes to the
release bucket, and never bind the quarantine bucket.

Configure a quarantine retention policy (90 days is the default operational
target) and a scheduled reconciliation job that removes prefixes with no D1
release row. The upload handler best-effort deletes objects when its D1 batch
fails, but storage lifecycle and reconciliation are still required for Worker
termination and partial outage cases. Shorter retention for rejected/blocked
submissions may be added only after preserving the audit metadata required by
your review policy.

## Release flow

1. An authenticated developer uploads one HTML file or a ZIP to the Hub.
2. The Hub rejects unsafe paths, encrypted/symlink/bomb ZIPs, unsupported
   types, external communication, dynamic code, and unreadable source.
3. Extracted files and their SHA-256 values go only to quarantine.
4. An administrator reads every source file, reviews the public title,
   developer name, category, and summary for unsupported medical or outcome
   claims, and tests the game in a disposable VM or isolated browser profile
   with no account session, secrets, personal files, or unrestricted network.
   Never open the raw artifact in a daily-use browser. Keyword scanning is
   triage, not the security boundary.
5. Approval re-reads every quarantined object and verifies its size and hash.
6. The Hub copies that exact version to the immutable release prefix and only
   then switches the catalog's active release.
7. The runner serves only an `approved` release manifest whose files match its
   allowlist. A missing, staging, malformed, or changed object fails closed.

Published prefixes follow this contract:

```text
releases/{gameId}/{semver}/release.json
releases/{gameId}/{semver}/files/index.html
releases/{gameId}/{semver}/files/{assetPath}
```

Do not overwrite approved file objects. Publish a new semantic version.
The small `release.json` status pointer is the exception: emergency revocation
first replaces it with `status: "revoked"`, then clears the active release in
D1 and writes an audit event. The runner rejects that URL immediately on new
online requests; immutable file objects remain for evidence and rollback
investigation.

## Browser isolation

The Hub embeds the trusted runner with exactly `sandbox="allow-scripts"`. The
runner embeds uploaded content with the same sandbox and a response CSP that
blocks fetch-style connections, external resources, workers, nested frames,
objects, and forms. It also requests CSP WebRTC blocking where the browser
implements that directive, while upload triage flags obvious peer-connection
constructors. Neither keyword scanning nor cross-browser WebRTC enforcement is
an absolute network boundary. The upload never receives an account identifier,
cookie, bearer token, or API URL.

Because an opaque sandbox serializes its message origin as `"null"`, the Hub
also requires the exact iframe `contentWindow`, a fresh 32-byte session nonce,
the v1 schema, and increasing sequence numbers. The runner transfers a private,
one-time `MessagePort` to the package. After an ordinary completed first load,
a later navigation loses that port and the runner removes the frame instead of
issuing a new session. Only bounded aggregate results reach the Hub API.

For a signed-in player, the Hub parent also requests a 24-hour, one-time run
session before play. The server stores only the SHA-256 hash of its random token
and binds the session to the authenticated user, current active release, and
client run ID. The raw token remains in the Hub parent: it is never placed in a
runner URL, iframe message, package manifest, or game-facing `MessagePort`.
Result persistence atomically consumes that session by creating the sole run
row allowed to reference it, and rechecks that the release is still approved,
published, and active at write time. A network retry can read the same saved run
but cannot create a second one.

This is an authorization and replay boundary, not score attestation. The
package still computes and reports its own aggregate result, and an authenticated
player controls their browser. Persisted developer-game results are therefore
stored as `sandbox_client_reported` (and exposed to clients as
`client_reported`); do not use them as independently verified clinical,
billing, eligibility, or anti-cheat evidence.

Browsers do not provide a widely reliable CSP directive that prevents an
arbitrary script from initiating its iframe's first self-navigation request.
The one-time port closes on an ordinary post-load navigation and is never
reissued. A package can still navigate synchronously before its first `load`;
in that browser race, the destination may receive the game-facing port. That
port contains no account identifier, cookie, bearer token, API URL, or PII,
and the runner still validates its bounded aggregate messages, but it could be
used to forge that run's result. Automated checks are therefore triage only.
Approval still requires source review plus a play test in a disposable VM or
isolated browser profile with no signed-in accounts or personal data.
Uploaded code can also encode data entered inside the game into a self-navigation
URL before the runner observes the navigation. Do not describe this client-side
architecture as an absolute egress firewall, and tell users never to enter
names, account details, passwords, contact details, or other personal data into
third-party games. An absolute no-egress requirement needs a constrained
declarative runtime or remote execution behind a network firewall, not arbitrary
browser JavaScript.

Camera and microphone access is intentionally unavailable to developer games.
If a future game genuinely needs sensor input, design a platform-owned broker
that returns only derived, non-identifying signals and obtain a separate
security/privacy review. Do not add `allow-same-origin` to uploaded content.

## PWA and indexing

Each approved game version receives its own manifest identity, scope, service
worker, and cache prefix under the runner. The install action must open the
runner URL as a top-level page; `trainerhub.cc` cannot invoke another origin's
install prompt.

The controlled launcher checks the release status every minute and whenever the
browser returns online. Its service worker bypasses the HTTP cache while online
for every allowlisted release URL, then falls back to the precache only when the
network is unavailable. An authoritative 404/410 closes the inner frame, clears
only that release's cache prefix, and unregisters its worker.

This is an online best-effort recall, not a remote kill switch. No web server can
withdraw code from a device that remains offline. A raw `/package/...` document
that was opened directly and is already executing also has no trusted launcher
around it to receive the health result, and its immutable HTTP cache may remain
usable. Incident response must state both limitations and may require users to
reconnect, close the raw document, or remove the installed game.

Every runner response sends `X-Robots-Tag: noindex` and the runner publishes a
disallowing `robots.txt`. Only human-reviewed Hub catalog/editorial pages belong
in the `trainerhub.cc` sitemap. Never add raw execution URLs to a sitemap or
canonical tag.

## Verification

Run these before deployment:

```powershell
node --test apps/rehabtrainerhub/functions/_lib/gamePackages.test.mjs
node --test scripts/check-game-platform.test.mjs
pnpm --filter @rehab-trainer/usergamerunner test
pnpm --filter @rehab-trainer/usergamerunner run build
pnpm run test:hub-functions
pnpm run test:cloudflare-deploy
pnpm run test:seo
```

After deployment, verify that a runner game route and its manifest/service
worker return 200 with `noindex`, that an unapproved version returns 404, and
that the runner origin is absent from all auth CORS/OAuth allowlists.
