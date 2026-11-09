
> **RehabTrainerHub new-game requirement:** AGENTS.md/CLAUDE.md take precedence.
> Every NEW game needs `design/gdd/<gameId>.md` at minimal, standard and full,
> with `## Summary`, `## Overview`, `## Detailed Design`, `## Edge Cases`,
> `## Dependencies`, `## Acceptance Criteria` and substantive content.
> A game brief or optional system GDD never replaces it. Tier omissions below
> apply only to additional system documents; see `.claude/docs/rehab-game-team.md`.
# /prototype — Phase 2: Load Concept Context

> Part of `/prototype`. `SKILL.md` names when to read this file; the settings it
> resolved and the rules under its later headings still apply here.

## Phase 2: Load Concept Context

Read `design/gdd/game-concept.md` — or `design/game-brief.md`, the one-page brief
that replaces it at `rigor: minimal` — if either exists. Read it by section: find the
headings you need with the Grep tool (pattern `^#`, content mode) and Read those
ranges with offset and limit. Extract:
- Core fantasy (what the player is supposed to feel)
- Core loop (the moment-to-moment action being tested)

Determine the engine and language in use: read `engine.name` and
`engine.language` from `project.yaml`. For each field, if its key is absent or
empty (including when `project.yaml` has no `engine:` block), fall back to
`CLAUDE.md` and `.claude/docs/technical-preferences.md`. Treat a
`[TO BE CONFIGURED]` value as not set.

---
