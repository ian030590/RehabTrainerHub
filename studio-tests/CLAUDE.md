# Studio Tests — Claude Instructions

This folder is the quality assurance layer for the Claude Code Game Studios skill/agent
framework. It is self-contained and separate from any game project.

## Key files

| File | Purpose |
|------|---------|
| `catalog.yaml` | Master registry for all 74 skills and 35 agents. Contains category, spec path, and last-test tracking fields. Always read this first when running any test command. |
| `quality-rubric.md` | Category-specific pass/fail metrics. Read the matching `###` section for the skill's category when running `/skill-test category`. |
| `skills/[category]/[name].md` | Behavioral spec for a skill — 5 or more test cases + protocol compliance assertions. |
| `agents/[tier]/[name].md` | Behavioral spec for an agent — 5 or more test cases + protocol compliance assertions. |
| `templates/skill-test-spec.md` | Template for writing new skill spec files. |
| `templates/agent-test-spec.md` | Template for writing new agent spec files. |
| `results/` | Written by `/skill-test spec` when results are saved. Not gitignored — add it to `.gitignore` to keep results out of commits. |

## Path conventions

- Skill specs: `studio-tests/skills/[category]/[name].md`
- Agent specs: `studio-tests/agents/[tier]/[name].md`
- Catalog: `studio-tests/catalog.yaml`
- Rubric: `studio-tests/quality-rubric.md`

The `spec:` field in `catalog.yaml` is the authoritative path for each skill/agent spec.
Always read it rather than guessing the path.

## Skill categories

```
gate        → gate-check
review      → design-review, architecture-review, review-all-gdds
authoring   → design-system, quick-design, architecture-decision, art-bible,
              create-architecture, ux-design, ux-review
readiness   → story-readiness, story-done
pipeline    → create-epics, create-stories, dev-story, create-control-manifest,
              propagate-design-change, map-systems, vertical-slice
analysis    → consistency-check, balance-check, content-audit, studio-code-review,
              tech-debt, scope-check, estimate, perf-profile, asset-audit,
              studio-security-audit, test-evidence-review, test-flakiness
team        → team-combat, team-narrative, team-audio, team-level, team-ui,
              team-qa, team-release, team-polish, team-live-ops
sprint      → sprint-plan, sprint-status, milestone-review, retrospective,
              changelog, patch-notes
utility     → all remaining skills
```

## Agent tiers

```
directors      → creative-director, technical-director, producer, art-director
leads          → lead-programmer, narrative-director, audio-director, game-designer,
                 systems-designer, level-designer, qa-lead
specialists    → gameplay-programmer, engine-programmer, network-programmer,
                 ai-programmer, tools-programmer, ui-programmer, ux-designer,
                 technical-artist, sound-designer, performance-analyst, prototyper,
                 writer, world-builder
engine         → web-game-specialist
operations     → devops-engineer, release-manager, live-ops-designer,
                 community-manager, analytics-engineer, economy-designer,
                 localization-lead
qa             → qa-tester, security-engineer, accessibility-specialist
```

A tier is the directory a spec lives in. The rubric category is the agent's
`category:` in `catalog.yaml` and can differ: `security-engineer` and
`accessibility-specialist` sit in `qa/` but are rated as `specialist`.

## Workflow for testing a skill or agent

1. Read `catalog.yaml` to get the `spec:` path and `category:` — from the
   `skills:` entry for a skill, the `agents:` entry for an agent
2. Read the skill at `.claude/skills/[name]/SKILL.md` and every file in its
   `references/` folder, or the agent at `.claude/agents/[name].md`
3. Read the project `AGENTS.md`, `CLAUDE.md` and the files it imports with `@`;
   `AGENTS.md` wins on conflict. A Codex worker does not inherit the conversation:
   its complete brief supplies the applicable rules and context (for example a
   redirect in `coordination-rules.md`), which count as the skill's or agent's own
4. Read the spec at the `spec:` path
5. Evaluate the spec's Static Assertions, each case's assertions, and its
   Protocol Compliance list
6. Offer to write results to `results/` and update `catalog.yaml`

## Codex worker assertions

Apply these assertions to every skill and agent spec, including its fixtures and
templates. The mechanism is defined in [the worker protocol](../.claude/docs/codex-workers.md).

- [ ] Team members run as Codex workers via `.claude/scripts/codex-agent.sh`;
  a delegating skill grants `Bash(bash .claude/scripts/codex-agent.sh *)` in
  `allowed-tools`. Claude Code Agent Teams are not used in this repo.
  Expected command: `bash .claude/scripts/codex-agent.sh <agent-name> --sandbox read-only --task-file <brief-path>`.
- [ ] The orchestrator writes complete briefs under
  `production/session-state/codex-briefs/` and passes `--task-file <brief-path>`
  (or stdin). Briefs contain the task, context, applicable rules, file scope,
  previous results when relevant, and the return contract; no conversation is inherited.
- [ ] Pure review or analysis returning text runs with `--sandbox read-only`
  (the default). An agent whose `tools:` lacks Write/Edit always runs read-only.
  `--sandbox workspace-write` requires the brief to authorize a return-contract
  path inside the skill's bounded write exception, or a file set the user approved.
- [ ] A worker returns drafts, questions and "May I write" requests in its report.
  The orchestrator asks the user via `AskUserQuestion`; after a yes it reruns
  the worker with the previous result, the decision and the authorized file scope.
  A worker awaiting approval does not write or treat elapsed time as approval.
  A brief that already authorizes a bounded artifact does not require a repeat
  per-write question inside that scope.
- [ ] A worker needing another specialist names the agent and the question in
  its report. The orchestrator runs that agent; workers never start other agents.
- [ ] A retry reruns the Codex worker with the previous result and the correction
  in its brief; workers cannot be resumed or sent messages.
- [ ] Independent workers run via Bash with `run_in_background: true`; the
  orchestrator waits for every completion notification and reads every result.
  Workers that write the same files never run at the same time.
- [ ] After a workspace-write run, the wrapper runs `.claude/scripts/write-guard.sh`
  on changed files and checks the return-contract artifact; the orchestrator
  also inspects `git status` and the diff. Claude Code write hooks do not see worker writes.
- [ ] A missing return-contract artifact fails the run: wrapper exit 4 and
  "the file its return contract named is not on disk". It is never reported done.
- [ ] Agent frontmatter `model`, `effort`, `maxTurns`, `disallowedTools`,
  `skills` and `memory` are Claude Code metadata that do not apply to Codex
  workers. Literal frontmatter checks still test the definition; Codex uses its
  configured model, `tools:` only determines the sandbox, and required skill
  instructions are supplied in the complete brief rather than automatically preloaded.

## Fixture defaults

Every skill spec has a `## Fixture Defaults` section above its cases. A case's
sandbox project starts from this `project.yaml` block:

```yaml
modes:
  rigor: minimal            # → workflow minimal, docs.density terse, qa.level minimal,
                            #   story_granularity coarse, review_mode solo, team.size individual
  automation: collaborative
```

- A setting the case's Fixture names wins over the block, and an explicit
  sub-knob (`modes.workflow`, `modes.review_mode`, `qa.level`, …) wins over the
  `rigor` preset (`.claude/docs/config-resolution.md` § Defaults).
- A case that says `project.yaml` sets no `modes` keys, or that there is no
  `project.yaml`, runs without the block: it tests the unset defaults.
- There is no `project.local.yaml` unless the case names one.
- A case whose expected behaviour changes with a setting pins that setting in
  its own Fixture, with the reason — e.g. `modes.workflow: standard` (pinned:
  unset resolves to minimal, which recommends the next build instead of a
  sprint).

The block is pinned so that a change to the framework's defaults cannot
silently change what a case tests. A spec may set a different default in its
own section when most of its cases need one.

## Workflow for improving a skill

Use `/skill-improve [name]`. It handles the full loop:
test → diagnose → propose fix → rewrite → retest → keep or revert.

## Spec validity note

Specs in this folder assert the **correct** behavior, not whatever a skill or agent
does today. A failing assertion means the skill or agent is wrong until shown
otherwise: fix it and re-run, and never weaken an assertion just so it passes.
Specs can be wrong too — when one asserts behavior that is itself incorrect,
correct the spec toward the right behavior, not toward what the skill currently does.

## This folder is deletable

Nothing in `.claude/` imports from here, and every other CCGS skill and agent works
without it — but `/skill-test` and `/skill-improve` read it by path. Without it,
`/skill-test static` still works, `/skill-test spec` and `/skill-test category`
stop working, `/skill-test audit` reports that no catalog exists, and
`/skill-improve` skips its category checks (the table in `README.md` has the detail).
