# Directory Structure

RehabTrainerHub is an npm workspace / Turborepo monorepo. AGENTS.md and root
CLAUDE.md are authoritative; the repository root is not a game code root.

| Path | Purpose |
|---|---|
| `apps/rehabtrainerhub/games/<gameId>/` | One self-contained Vite/TypeScript game workspace |
| `apps/rehabtrainerhub/app/` | Hub application; outside a game-only task |
| `apps/usergamerunner/` | Sandboxed runner and input proxies; outside a game-only task |
| `packages/` | Platform packages; R2 games must not import these |
| `scripts/check-<gameId>-*.test.mjs` | Game behavior/architecture tests, node:test |
| `design/gdd/<gameId>.md` | Mandatory new-game GDD at every workflow level |
| `docs/architecture/`, `docs/registry/` | Technical decisions and requirement registry |
| `docs/engine-reference/web/VERSION.md` | Local declarations and lockfile resolutions |
| `production/` | Plans, session checkpoints, QA evidence, release preparation |
| `prototypes/` | Throwaway prototypes, outside the code root |
| `.claude/` | Role definitions, skills, hooks and team guidance |
| `.agents/skills/` | Generated Codex adapters; use npm run sync:team-skills |
| `studio-tests/` | Behavioral specs for the team framework, not game tests |

## Code and test roots

| `engine.name` | Code root | Test root |
|---|---|---|
| **web** | `apps/rehabtrainerhub/games/<gameId>/`; new source under its `src/` | `scripts/check-<gameId>-*.test.mjs` (node:test) |

`web-game-specialist` is the only installed engine specialist. Godot, Unity and
Unreal are unsupported in this installation. Existing workspaces may keep their
root-level `main.tsx`, `logic/`, `runtime/` and i18n files; do not move them solely
to match a new-game layout. Hooks resolve the web collection root to
`apps/rehabtrainerhub/games` for scanning; an implementation brief must still
name a specific gameId and approved files. `engine.code_root` and
`engine.test_root` in project.yaml describe the per-game path patterns.

Do not write into `apps/rehabtrainerhub/app`, `apps/usergamerunner`, `packages/`
or another game's workspace unless the task explicitly includes them. Own each
game's assets in its workspace (`public/` for package metadata/previews), keep
prototypes outside it and verify tests are reached by root `test:ci`.
