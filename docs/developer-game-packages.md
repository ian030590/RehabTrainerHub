# Developer game package contract

Developer games are ordinary HTML/CSS/JavaScript packages, but the
platform-provided jsPsych 8 runtime must own the experiment lifecycle. PixiJS,
Three.js, or a custom canvas loop may run inside one game-owned jsPsych custom
plugin; renderer state must not be shared with another game.

## Package layout

Uploads are limited to 12 MiB compressed, 24 MiB expanded, 8 MiB per file,
192 files, and 4 MiB of total executable/text source. These conservative
limits keep synchronous quarantine inspection within the Worker memory budget.

Upload a ZIP with this shape:

```text
index.html
settings.json
game.js
styles.css
assets/
  stimulus.png
  correct.wav
```

- ZIP `index.html` must be at the root.
- `settings.json` must be at the root and its `gameId` must match the submitted game slug.
- Use a full semantic version such as `1.0.0` or `1.1.0-beta.1`.
- Paths may contain only ASCII letters, numbers, `.`, `_`, `-`, and `/`.
- Bundle the game's own images, audio, styles, plugins, and other dependencies.
- Submit readable, unminified, unobfuscated source.
- Do not add a manifest or service worker; the platform creates both.
- Do **not** include jsPsych or the TrainerHub Game SDK in the HTML/ZIP.

## Platform-generated settings UI

The Hub reads `settings.json` before it creates the game iframe. The schema
supports the platform's fixed `slider`, `list`, and `checkbox` controls; games
must not duplicate this setup screen inside their own HTML. Localized labels
are required in Traditional Chinese and English.

```json
{
  "schemaVersion": 1,
  "gameId": "example-game",
  "sections": [
    {
      "id": "training",
      "title": { "zh-TW": "活動設定", "en": "Session settings" },
      "fields": [
        {
          "key": "rounds",
          "type": "slider",
          "label": { "zh-TW": "回合數", "en": "Rounds" },
          "default": 10,
          "min": 5,
          "max": 40,
          "step": 5,
          "unit": { "zh-TW": "回合", "en": "rounds" }
        },
        {
          "key": "soundEnabled",
          "type": "checkbox",
          "label": { "zh-TW": "聲音回饋", "en": "Sound feedback" },
          "default": true
        }
      ]
    }
  ]
}
```

The Hub validates selected values against this same schema, packages them as a
plain object, and sends them only after the isolated runner and private channel
are ready. `RunTrainerHubJsPsychGame` exposes the validated object to the game;
do not place personal information, credentials, URLs, or free-text fields in
settings.

## Platform runtime

The isolated runner publishes the reviewed runtime at fixed, root-relative
URLs on its own origin:

```text
/runtime/jspsych-8.2.3.js
/runtime/jspsych-8.2.3.css
/runtime/trainerhub-game-sdk-0.1.0.js
```

Use these exact paths. They are not CDN URLs: the runner build copies jsPsych
from the workspace installation and the SDK from `packages/game-sdk`, verifies
their versions and sizes, and serves them without credentials. Each game's
service worker precaches the runtime for offline use. A future runtime upgrade
uses a new versioned URL so an approved game never silently changes dependency.

The jsPsych browser build exposes `jsPsychModule.initJsPsych`. The SDK is an ES
module. A sandboxed module request has an opaque `Origin: null`, so the runner
serves `/runtime/*` with explicit wildcard CORS, cross-origin resource policy,
JavaScript/CSS MIME types, `nosniff`, immutable caching, and `noindex` headers.

A minimal `index.html` is:

```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="/runtime/jspsych-8.2.3.css" />
    <script src="/runtime/jspsych-8.2.3.js"></script>
  </head>
  <body>
    <script type="module">
      import { RunTrainerHubJsPsychGame } from '/runtime/trainerhub-game-sdk-0.1.0.js';

      async function startGame() {
        await RunTrainerHubJsPsychGame({
          initJsPsych: jsPsychModule.initJsPsych,
          timeline,
          summarize(jsPsych) {
            const trials = jsPsych.data.get();
            return {
              status: 'completed',
              score: trials.filter({ correct: true }).count(),
              trialCount: trials.count(),
            };
          },
        });
      }

      void startGame();
    </script>
  </body>
</html>
```

Define `timeline` before `startGame()` runs. Do not directly top-level `await`
the SDK call: the runner transfers the private bridge port on the iframe's
first `load` event, so module evaluation must be allowed to finish. See the
working [`minimal-game.html`](../packages/game-sdk/examples/minimal-game.html)
sample for a complete custom plugin.

The SDK receives a one-time private `MessagePort` and coordinates `ready`,
`started`, progress, pause/resume, `completed`, `aborted`, and disposal. A
custom renderer belongs inside its plugin's trial and must be destroyed from
the plugin's finish/abort path.

## Result rules

Allowed top-level fields are `status`, `score`, `durationMs`, `trialCount`, and
`metrics`. Metric values may only be finite numbers, booleans, or `null`.
The aggregate payload is limited to 16,000 UTF-8 bytes.

Do not include names, email addresses, account/user/participant identifiers,
birth dates, free text, tokens, cookies, credentials, raw trial records, audio,
images, landmarks, or motion traces. The game does not know which account is
playing; `trainerhub.cc` associates an accepted aggregate result after the
sandbox relay has validated it.

## Unsupported APIs

The package cannot use `fetch`, XHR, WebSocket, EventSource, `sendBeacon`,
service/shared workers, `eval`, `Function`, forms, nested frames, top navigation,
cookies, or external URLs. Camera, microphone, geolocation, payment, USB, and
related permissions are disabled. A package that relies on them will not be
approved even if the browser appears to permit a call during local testing.

The upload scanner explicitly rejects bundled copies of jsPsych and the Game
SDK. It is only triage, not a security boundary; approval still requires human
source review and a play test in an isolated browser profile or disposable VM.

The redistributed jsPsych MIT notice is published at
`/runtime/THIRD_PARTY_NOTICES-0.1.0.txt` on the runner.
