# Technical Preferences

project.yaml is authoritative; this file is the human-readable legacy fallback.
AGENTS.md/CLAUDE.md win over every framework preference. See rehab-game-team.md.

## Engine & Language

- **Engine**: web
- **Language**: TypeScript
- **Rendering**: Game-owned DOM / Canvas / Pixi / Three
- **Physics**: Game-owned logic; no shared physics engine
- **Versions**: Vite 6.4.3 / TypeScript 5.8.3 in the current lockfile; full
  declarations and resolutions: docs/engine-reference/web/VERSION.md
- **Code Root**: apps/rehabtrainerhub/games/<gameId>/ (new source under src/)
- **Test Root**: scripts/check-<gameId>-*.test.mjs

## Input & Platform

- **Target Platforms**: Web, desktop/mobile/tablet browsers and runner PWA
- **Input Methods**: Keyboard/Mouse, Touch; approved input proxies as required
- **Primary Input**: Game-specific; preserve the approved GDD and workspace settings
- **Gamepad Support**: Game-specific; never assume an approved capability
- **Touch Support**: Game-specific; mobile/tablet interactions require tests
- **Platform Notes**: Opaque sandbox, no direct camera/microphone/storage;
  runner proxies own approved media input. Follow AGENTS.md.

## Naming Conventions

- **Classes**: PascalCase (also components and types)
- **Variables**: camelCase (also parameters)
- **Functions**: Named function declarations PascalCase; use*, onRequest* and
  Next.js framework exceptions per scripts/check-identifier-names.mjs
- **Signals/Events**: Existing typed private-channel contract; do not invent a bus
- **Files**: Match purpose and existing workspace conventions
- **Scenes/Prefabs**: Game-owned React/DOM/rendering resources, no native engine scenes
- **Constants**: Follow existing TypeScript conventions and the naming gate
- **Styles**: 2 spaces; CSS variables/theme tokens; no hard-coded colors;
  training-panel semantics, typography and UI contract from AGENTS.md

## Performance Budgets

- **Target Framerate**: Set per game from measured requirements
- **Frame Budget**: Set per game; no invented universal budget
- **Draw Calls**: Set per renderer/game when relevant
- **Memory Ceiling**: Set per game with lifecycle evidence

## Testing

- **Framework**: node:test
- **Minimum Coverage**: Behavior and regression evidence required by AGENTS.md,
  not a blanket percentage
- **Required Tests**: Settings/bounds, tutorial/start/complete, scoring,
  private bridge, save/retry/return, cleanup, i18n and mobile/tablet interactions
- **Entry**: New or modified automated tests must be reached by root test:ci
- **Browser**: Local Brave, node scripts/check-r2-game-browser.mjs --game <gameId> --lobby

## Forbidden Patterns

- R2 games importing packages/ui, platform packages or another game's code/CSS.
- Hub copies of game defaults/validation/rules/runtime.
- Expanded iframe permissions, direct media capture, outbound networking,
  frontend secrets, direct database writes or ordinary window-message results.
- Overwriting published versions or releasing without exact owner approval.

## Allowed Libraries / Addons

Only the game's declared dependencies; see its package.json and the locked
versions in docs/engine-reference/web/VERSION.md. Root availability is not
permission to import a library or add a dependency.

## Architecture Decisions Log

Use docs/architecture/ for applicable ADRs. Existing repo contracts are not
replaced by a framework workflow mode.

## Engine Specialists

- **Primary**: web-game-specialist
- **Language/Code Specialist**: web-game-specialist
- **Shader Specialist**: web-game-specialist
- **UI Specialist**: web-game-specialist
- **Additional Specialists**: none
- **Routing Notes**: The only installed engine specialist; Godot/Unity/Unreal
  are unsupported in this install. Other installed roles report through Claude.

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|---|---|
| Game code (.ts, .tsx, .js) | web-game-specialist |
| Shader / material files | web-game-specialist |
| UI / screen files (.tsx, .css, .html) | web-game-specialist |
| Scene / level data (.json) | web-game-specialist |
| Package/Vite configuration | web-game-specialist |
| General architecture review | web-game-specialist |
