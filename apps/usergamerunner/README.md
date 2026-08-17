# User game runner

This Cloudflare Pages project is the untrusted-game execution boundary for
`https://trainerhub.cc`. It deliberately has no authentication, D1 database,
session cookie, API token, or secret binding. Its only binding is the read path
to the published `GAME_RELEASE_BUCKET` R2 bucket.

The production default is `https://trainerhub-user-games.pages.dev`. A custom
domain may be attached later, but it **must use a registrable domain different
from `trainerhub.cc`**. Do not use a host such as `games.trainerhub.cc`, because
that weakens the intended site/cookie boundary.

## Published release contract

The runner reads these immutable keys:

```text
releases/{gameId}/{version}/release.json
releases/{gameId}/{version}/files/{path}
```

`release.json` must be emitted by the trusted review/publish process. The runner
will not serve drafts or arbitrary upload objects.

```json
{
  "schemaVersion": 1,
  "status": "approved",
  "gameId": "example-game",
  "version": "1.0.0",
  "name": "Example game",
  "shortName": "Example",
  "description": "A practice activity",
  "runtime": { "name": "jspsych", "major": 8 },
  "entry": "index.html",
  "files": [
    {
      "path": "index.html",
      "size": 1234,
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "contentType": "text/html"
    }
  ]
}
```

Optional reviewed metadata includes `capabilities`, `contentSha256`, and
`approvedAt`. MIME types served to browsers are derived from the approved path,
not trusted from developer input.

## Routes and bridge

- `/games/{gameId}/{version}/` is the controlled PWA launcher.
- `/games/{gameId}/{version}/manifest.webmanifest` is unique to that release.
- `/games/{gameId}/{version}/sw.js` is scoped to that exact release.
- `/games/{gameId}/{version}/package/{path}` serves only allowlisted files.
- `/runtime/jspsych-8.2.3.js` and `/runtime/jspsych-8.2.3.css` are the pinned
  jsPsych browser runtime and standard styles.
- `/runtime/trainerhub-game-sdk-0.1.0.js` is the pinned platform lifecycle SDK.
- `/runtime/THIRD_PARTY_NOTICES-0.1.0.txt` retains the redistributed jsPsych MIT
  license and attribution.

The build copies these runtime files from the workspace rather than a CDN. It
fails closed if the installed jsPsych or SDK version, expected API marker, file
size, PNG dimensions, or copied digest does not match the controlled contract.
Developer packages reference the versioned root-relative URLs and must not
bundle their own jsPsych or Game SDK copy. `/runtime/*` is static output outside
the R2 package route, so an uploaded game cannot overwrite it.

Sandboxed ES modules request the SDK with an opaque `Origin: null`. Runtime
assets therefore have explicit `Access-Control-Allow-Origin: *` and
`Cross-Origin-Resource-Policy: cross-origin`, along with strict MIME types,
`nosniff`, immutable caching, and `noindex` headers. These assets contain no
account data, credentials, or environment-specific configuration.

The controlled launcher checks its release every minute and on the browser's
`online` event. Every allowlisted service-worker request bypasses the HTTP cache
when online and falls back to the release precache only when unavailable.
Runner security changes must increment the internal cache revision so existing
installations replace their controlled launcher. An authoritative online
`404`/`410` closes the game, clears only that release cache prefix, and
unregisters its worker.

The service worker also precaches the two JavaScript runtimes, jsPsych CSS,
license notice, and controlled 192/512 PNG icons. Each manifest keeps its
game-specific SVG icon and includes the raster icons for broader PWA install
support.

This cannot recall already-downloaded content from a device that remains
offline. It also cannot stop a raw `/package/...` document that is already open
without its trusted launcher; immutable HTTP cache entries may remain usable.
Those are explicit incident-response limitations, not revocation guarantees.

The launcher embeds the entry file using exactly `sandbox="allow-scripts"`.
For Hub embedding, use
`?embed=hub&session={32-128-character URL-safe nonce}`. The Hub must sandbox the
launcher without `allow-same-origin`, so relayed events arrive at the Hub with
the opaque origin `null`. The exact iframe `contentWindow`, session nonce,
schema, monotonically increasing sequence, and bounded aggregate payload must
all match before accepting a message.

On the entry document's first load, the launcher transfers a one-time
`MessagePort` with `trainerhub.host:init`, the ephemeral session id, and the
nonce. All later game/host messages use only that private port. A subsequent
iframe load closes the port and removes the frame instead of initializing the
new document. Games emit the shared `trainerhub.game-platform/v1`
`trainerhub.game:lifecycle` and `trainerhub.game:result` envelopes. The launcher
only relays exact, validated envelopes; it rejects free text, identifiers,
sensitive metric names, replayed sequences, and payloads over 16 KiB. No account
credential or API token is ever sent to the game.

## Local verification

```sh
npm --prefix apps/usergamerunner test
npm --prefix apps/usergamerunner run build
```
