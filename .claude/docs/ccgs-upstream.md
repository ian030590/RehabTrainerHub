# CCGS upstream

- Upstream: https://github.com/Donchitos/Claude-Code-Game-Studios
- Version: 1.2.0
- Commit: 05ad7c8 (05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418)
- Installed: 2026-11-09
- License: MIT; see ../CCGS-LICENSE.

RehabTrainerHub games use Vite + TypeScript web workspaces. The following upstream files were not installed:

- Engine specialists: godot-specialist, godot-gdscript-specialist, godot-csharp-specialist, godot-shader-specialist, godot-gdextension-specialist, unity-specialist, unity-dots-specialist, unity-shader-specialist, unity-addressables-specialist, unity-ui-specialist, unreal-specialist, ue-gas-specialist, ue-blueprint-specialist, ue-replication-specialist, ue-umg-specialist. These engine roles do not apply to web games.
- docs/engine-reference/godot/, unity/, and unreal/: engine API references do not apply.
- src/: game source remains in the existing game workspaces.
- Root CLAUDE.md, README.md, CHANGELOG.md, UPGRADING.md, CONTRIBUTING.md, and SECURITY.md: preserve this repository's instructions and documentation. Relevant collaboration and context-management conventions were merged into [rehab-game-team.md](rehab-game-team.md); the temporary upstream root-instruction copy was removed.
- The upstream docs instruction file: split into docs/architecture/CLAUDE.md and docs/engine-reference/CLAUDE.md so unrelated repository documentation does not inherit its rules.
- docs/migration-guide-v1.1.md: this is a fresh framework install.
- production/.gdignore: Godot-only.
- .github/ and .worktreeinclude: retain the existing repository automation and checkout configuration.
- Upstream .gitignore and .gitattributes: merge only the requested local-state entries and scoped LF rules.

Unchanged upstream files retain their committed LF bytes; adapted files also
remain LF. Hooks are registered only when confined to the approved team paths.

## RehabTrainerHub Web Adaptation (2026-11-09)

- 35 installed roles and 74 skills; web-game-specialist is the only engine
  specialist. Engine routing, studio specs and config resolution use `web`.
- project.yaml and the legacy technical-preferences mirror describe TypeScript
  game workspaces, node:test and per-game code/test roots. Rigor-fronted knobs
  remain unseeded. Native engine setup is unsupported in this install.
- /setup-engine reads package declarations and lockfile resolutions into
  docs/engine-reference/web/VERSION.md; it never selects installed versions
  through WebSearch or replaces this repo's root instructions.
- Every new game requires design/gdd/<gameId>.md at every workflow tier,
  including minimal. Existing-game exemptions and CI wiring belong to the
  repo's game-team design check; the entry guide names its exact paths.
- Claude orchestrates Codex workers; Codex sessions use generated .agents/skills
  adapters and perform roles themselves. The worker protocol remains the single
  mechanism reference. AGENTS.md/CLAUDE.md govern TDD, main/push policy,
  self-contained R2 packages, sandbox/private channel, medical copy and exact
  owner-approved version/contentSha256 releases.
