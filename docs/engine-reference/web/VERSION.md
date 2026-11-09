# RehabTrainerHub Web Toolchain

Last verified: 2026-11-09

Engine: `web`. Language: TypeScript. Primary/code/shader/UI specialist:
`web-game-specialist` (the only installed engine specialist).

This snapshot comes from repository package declarations and package-lock.json,
not release searches. Exact lockfile resolutions differ from declared ranges.
No workspace-local `games/*/node_modules/*` overrides exist in this lockfile.
For any later change, reread the relevant game package and lock entry.

## Build and Runtime Packages

Paths below are relative to `apps/rehabtrainerhub/games/` unless marked root.
`*/package.json` means each of the 55 current game workspace package files.
All exact resolutions are the `packages["node_modules/<package>"].version`
entries in root [package-lock.json](../../../package-lock.json).

| Package | Declared version/range | Locked version | Declaration |
|---|---|---|---|
| vite | ^6.3.5 | 6.4.3 | root package.json devDependencies; */package.json devDependencies |
| typescript | ~5.8.3 | 5.8.3 | root devDependencies; */package.json devDependencies |
| @vitejs/plugin-react | ^4.5.2 | 4.7.0 | root devDependencies; */package.json devDependencies |
| react | ^19.1.0 | 19.3.0 | root dependencies; */package.json dependencies |
| react-dom | ^19.1.0 | 19.3.0 | root dependencies; */package.json dependencies |
| jspsych | 8.2.3 | 8.2.3 | root dependencies; every game except oculomotor-training |
| tone | 15.1.22 | 15.1.22 | */package.json dependencies |
| pixi.js | ^8.18.1 | 8.20.1 | root; asteroid-shield, drawing-defense, every-ball-response, gabor-patching, gesture-battler, moving-card, reading-training, tongue-catch/package.json |
| @jspsych/plugin-html-button-response | ^2.1.0 | 2.1.0 | root; reading-training/package.json |
| three | ^0.184.0 | 0.184.0 | root; seagull-flight/package.json |
| @types/three | ^0.184.1 | 0.184.1 | root devDependencies; seagull-flight/package.json devDependencies |
| qrcode | ^1.5.4 | 1.5.4 | root; hart-chart/package.json |
| @types/qrcode | ^1.5.6 | 1.5.6 | root devDependencies; hart-chart/package.json devDependencies |

The declaration at `schulte-grid/package.json`, for example, owns React,
jsPsych and Tone plus Vite/TypeScript build tooling. It uses DOM buttons for
the grid, not Pixi. A listed library is not a requirement for every game.
Declarations under ranges are not exact dependency pins; the lockfile is the
reproducible resolution. Games must explicitly declare what they import.

## Root Packages for Input Proxies and Legacy Integrations

These are declared in root [package.json](../../../package.json) dependencies.
They are not direct dependencies in the current game workspace package files.
In particular, camera/model execution belongs to approved runner input proxies;
this table never authorizes media permissions inside an R2 game's opaque iframe.

| Package | Declared | Locked |
|---|---|---|
| @mediapipe/tasks-vision | 0.10.35 | 0.10.35 |
| @tensorflow/tfjs | ^4.22.0 | 4.22.0 |
| @tensorflow-models/knn-classifier | ^1.2.6 | 1.2.6 |
| @jspsych/extension-webgazer | ^1.2.0 | 1.2.0 |
| @jspsych/plugin-html-keyboard-response | ^2.2.0 | 2.2.0 |
| @jspsych/plugin-preload | ^2.1.0 | 2.1.0 |
| @jspsych/plugin-webgazer-calibrate | ^2.1.0 | 2.1.0 |
| @jspsych/plugin-webgazer-init-camera | ^2.1.0 | 2.1.0 |
| @jspsych/plugin-webgazer-validate | ^2.1.0 | 2.1.0 |

Vendored model/script bytes have their own recorded hashes and release
contracts. npm versions do not prove those bytes or hardware accuracy; inspect
the game's migration/release record before changing them.

## Supporting Tooling

| Package/tool | Declared | Locked/source |
|---|---|---|
| npm | npm@11.19.0 | root package.json packageManager |
| turbo | ^2.10.2 | 2.10.12; root devDependencies |
| @tonejs/midi | 2.0.28 | 2.0.28; root devDependencies, development conversion only |
| @types/node | ^24.10.2 | 24.13.4; root devDependencies |
| @types/react | ^19.1.4 | 19.3.0; root devDependencies |
| @types/react-dom | ^19.1.5 | 19.3.0; root devDependencies |

Node is not pinned by a root `engines` field; @types/node does not pin the runtime.
Next.js and react-router-dom are platform dependencies, not a game SDK.

## Working Contract

- Code root: `apps/rehabtrainerhub/games/<gameId>/`; new source can live in
  `src/`, while existing root-level Vite entries remain valid.
- Tests: `scripts/check-<gameId>-*.test.mjs` (node:test), reached by root test:ci.
- Build: `npm --prefix apps/rehabtrainerhub/games/<gameId> run build`.
- Local Brave: `node scripts/check-r2-game-browser.mjs --game <gameId> --lobby`.
- Release preparation: `node scripts/publish-official-game.mjs <gameId> --dry-run`.

Check installed types/source before uncertain APIs. Upgrade only within an
authorized, tested migration. Keep assets and dependencies game-local, maintain
`sandbox="allow-scripts"` and private MessageChannel, and never overwrite
published bytes. See [AGENTS.md](../../../AGENTS.md),
[R2 migration §7 and §11](../../r2-game-migration-plan.md) and
[the team guide](../../../.claude/docs/rehab-game-team.md).
