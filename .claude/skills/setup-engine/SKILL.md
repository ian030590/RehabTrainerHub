---
name: setup-engine
description: "Configure RehabTrainerHub's web toolchain from package declarations and lockfile, and refresh its local version reference."
argument-hint: "web | refresh | upgrade"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(bash .claude/scripts/codex-agent.sh *), AskUserQuestion, Bash(bash "*/.claude/skills/setup-engine/../../hooks/yaml-helper.sh" resolve_config *)
model: sonnet
---

# Engine Setup

!`bash "${CLAUDE_SKILL_DIR}/../../hooks/yaml-helper.sh" resolve_config --keys engine,engine_values,specialists,workflow`

AGENTS.md and root CLAUDE.md win over framework defaults. Read
[the repository workflow](../../docs/rehab-game-team.md) and
[the worker protocol](../../docs/codex-workers.md).

This install supports **web only**: Vite + TypeScript game workspaces.
`web-game-specialist` is the only installed engine specialist. Godot, Unity
and Unreal are unsupported here: explain that limitation, leave files untouched
and never run missing engine roles.

## 1. Parse Arguments

No args or `web` selects the existing web toolchain. `refresh` refreshes the
local snapshot. `upgrade` proposes a scoped dependency migration; never choose
newer versions automatically. A requested version must match local evidence
or be reported as a proposed change.

Every NEW game at minimal, standard and full requires
`design/gdd/<gameId>.md` with the six exact headings in rehab-game-team.md.
A game brief can precede it but cannot replace it. Existing-game exemptions
are held by the repo's frozen CI list.

## 2. Confirm Scope

Read `references/2-guided-mode.md`. Reuse known decisions and authorization.

## 3. Read Installed Versions

Read `references/3-version.md`. Use root/game package.json and package-lock.json,
never WebSearch to determine installed versions.

## 4. Preserve Repository Instructions

Read `references/4-claude-md-stack.md`. Never replace root CLAUDE.md with an
upstream Technology Stack or engine import template.

## 5. Update the Legacy Mirror

Read `references/5-technical-preferences.md`.

## 5.5 Update project.yaml

Read `references/5.5-project-yaml.md`. Preserve unrelated keys and never seed
rigor-fronted knobs.

## 6. Assess API Knowledge

Read `references/6-knowledge-gap.md`.

## 7. Refresh Reference Docs

Read `references/7-reference-docs.md`. Write
`docs/engine-reference/web/VERSION.md` from local evidence.

## 7.5 Verify the Workspace

Read `references/7.5-scaffold.md`. New-game creation is a separate authorized
game-team TDD task.

## 8. Verify Configuration

Read `references/8-verify.md`.

## 9. Check the Engine Role

Read `.claude/agents/web-game-specialist.md`. It must cover version awareness,
workspace isolation, private MessageChannel, sandbox, lifecycle and approval.
Propose any definition edit with its exact path.

Claude runs delegated roles with
`bash .claude/scripts/codex-agent.sh web-game-specialist --sandbox read-only --task-file <brief-path>`.
Only an authorized artifact/file set permits workspace-write. Inspect git status,
diff and wrapper write-guard/return-contract checks after such runs.
Workers return questions and specialist requests in their report and never
start workers. Codex sessions perform the role themselves.

## 10. Refresh

Repeat sections 3, 5, 5.5, 7 and 8 from current package files. Show changed facts.
No network release lookup, dependency install or upgrade.

## 11. Upgrade

Read `references/11-upgrade.md`. Published bytes remain immutable.

## 12. Output

Read `references/12-output-summary.md`. Use COMPLETE only for verified setup.

## Guardrails

Show drafts before a "May I write" question when scope is not already authorized.
A worker returns the question to its caller. Preserve existing user edits.
Do not commit, push, publish, deploy, install packages or alter platform
capabilities during setup. Versions and migrations need evidence.
