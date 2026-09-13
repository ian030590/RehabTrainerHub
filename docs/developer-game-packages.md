# Developer game package contract

Developer games are ordinary HTML/CSS/JavaScript packages, but the
platform-provided jsPsych 8 runtime must own the experiment lifecycle. PixiJS,
Three.js, or a custom canvas loop may run inside one game-owned jsPsych custom
plugin; renderer state must not be shared with another game.

## AI-first quick start

The recommended workflow is specification first, then AI-assisted implementation:

1. Install Git, Node.js 22 or later, and npm 11. Repository contributors run
   `npm ci --workspaces --include-workspace-root` from the repository root.
2. Install an AI coding agent. For Codex CLI, follow the current
   [official installation guide](https://learn.chatgpt.com/docs/codex/cli), or
   use the npm option: `npm install -g @openai/codex`.
3. Start `codex` in the repository or standalone game directory. Ask it to read
   `AGENTS.md`, this contract, `packages/game-settings/src/index.js`, and
   `packages/game-sdk/src/index.js` before it edits files.
4. Specify the task demands, stimulus and response sequence, supported input,
   timing, exit behavior, aggregate metrics, and known limitations before
   requesting code. Do not let an agent invent research citations or outcome
   validity.
5. Generate readable source, review every file, complete keyboard and pointer
   playthroughs, verify aggregate results on completion and abort, then submit a
   semantic version through `/developer/`.

The interactive developer page includes a bilingual structured-prompt builder.
Its output separates the third-party package contract from the repository's
built-in game contract and includes security, accessibility, research, and
verification gates.

## Local development foundation

The tools have separate jobs: NVM switches Node.js versions, Node.js supplies
the JavaScript runtime and npm, Git records local history, GitHub hosts the
remote repository, and GitHub CLI (`gh`) authenticates and operates GitHub from
the terminal. This repository requires Node.js 22 or later and pins
`npm@11.19.0` in its root `package.json`.

### Windows 10 or 11

Install Git and GitHub CLI from PowerShell:

```powershell
winget install --id Git.Git -e --source winget
winget install --id GitHub.cli --source winget
```

Download and run `nvm-setup.exe` from the official
[NVM for Windows releases](https://github.com/coreybutler/nvm-windows/releases).
Its maintainers recommend removing any standalone Node.js installation first
to avoid `PATH` conflicts. Reopen PowerShell after installation; `nvm install`
and `nvm use` commonly require an Administrator shell.

```powershell
nvm install lts
nvm use lts
npm install --global npm@11.19.0
```

### macOS, Linux, or WSL

Install Git and GitHub CLI for the operating system first. The
[Git installation guide](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
and [GitHub CLI installation guide](https://github.com/cli/cli#installation)
list current platform-specific options. For example:

```bash
# macOS with Homebrew
brew install git gh

# Ubuntu, Debian, or WSL; install gh from its official guide
sudo apt update
sudo apt install git curl
```

Native macOS, Linux, and WSL use
[nvm-sh](https://github.com/nvm-sh/nvm#installing-and-updating), not NVM for
Windows:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
\. "$HOME/.nvm/nvm.sh"
command -v nvm
nvm install --lts
nvm use --lts
npm install --global npm@11.19.0
```

### Connect GitHub and start the repository

Create a GitHub account, then configure the author metadata Git writes into
commits. Use a GitHub `noreply` address if a private email should not be public.
`gh auth login --web` performs browser authentication and stores its credential
through the available system credential store.

```bash
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR_GITHUB_EMAIL"
gh auth login --web
gh auth status

gh repo clone ian030590/RehabTrainerHub
cd RehabTrainerHub
```

Contributors without upstream write access should fork the repository and work
on a branch in their own fork. Verify the complete local toolchain before
editing:

```bash
node --version  # v22 or later
npm --version   # 11.19.0
git --version
gh --version

npm ci --workspaces --include-workspace-root
npm run test:game-platform
npm run dev:hub
```

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
supports the platform's fixed `slider`, `list`, `checkbox`, and six-digit hex
`color` controls; games must not duplicate this setup screen inside their own
HTML. Localized labels are required in Traditional Chinese and English.

`schemaVersion` is currently `1`. The contract allows at most 16 sections, 64
fields, and 64 KiB of JSON. Section identifiers and field keys must be unique.
Field keys must start with a lowercase ASCII letter and cannot use sensitive
names such as `auth`, `email`, `name`, `participant`, `session`, `token`, or
`user`. Lists contain 2–24 unique string or numeric options. Slider defaults
must fall within their finite `min`/`max` range and align to `step`.

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

## `score.json`: built-in games only

Third-party HTML/ZIP packages do **not** currently include or register
`score.json`. They return bounded aggregates from the Game SDK `summarize()`
callback as described below.

Repository contributors working under
`apps/rehabtrainerhub/games/{gameId}/` must provide both `settings.json` and
`score.json`. The latter uses `rehab-trainer.game-score/v1` and declares how the
Hub projects game-owned numeric/boolean fields into the shared result table,
chart, primary summaries, and data-quality/context summaries. It does not own
scoring formulas, CSS, or executable renderers. See
[`game-score-contract.md`](game-score-contract.md) for its exact field,
presentation, row, numeric, and payload limits.

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

## Activity design, interpretation, and accessibility

Document the primary task demands separately from secondary visual, auditory,
attention, movement, and device-operation demands. Keep the adjustable trial
count, exposure time, interval, stimulus size, randomization, practice trials,
and stopping conditions explicit. For every aggregate metric, document its
formula, unit, denominator, missing-value behavior, and likely confounds.

Referencing a published task does not establish equivalent reliability,
validity, medical-device status, or clinical use. Public copy should describe a
practice activity, stimulus parameters, and a session record. It must not claim
diagnosis, prescription, treatment, functional recovery, or guaranteed effects.

Use semantic HTML and real buttons, visible keyboard focus, keyboard-equivalent
operation, pointer targets of at least 44 by 44 CSS pixels, and reduced-motion
support. Instructions appear before the interaction. A game must provide a
reliable exit path and release event listeners, timers, audio, and renderer
resources on completion or abort.

The redistributed jsPsych MIT notice is published at
`/runtime/THIRD_PARTY_NOTICES-0.1.0.txt` on the runner.
