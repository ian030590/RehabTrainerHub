# Codex workers

Claude supervises the game team; each delegated role runs as a non-interactive
Codex CLI worker. "Spawn `<agent>`" means run `<agent>` as a Codex worker with
`.claude/scripts/codex-agent.sh`. Claude Code Agent Teams (`TeamCreate`) are not
used in this repo.

From the repo root, write a complete brief with the Write tool to a file under
`production/session-state/codex-briefs/` (gitignored), then run:

```bash
bash .claude/scripts/codex-agent.sh game-designer --sandbox read-only --task-file production/session-state/codex-briefs/design.md
```

Stdin is also supported:

```bash
bash .claude/scripts/codex-agent.sh game-designer --sandbox read-only < production/session-state/codex-briefs/design.md
```

Use `--dry-run` to print the worker path, resolved command, project root, sandbox,
agent file and complete prompt without running anything. Skill frontmatter grants
the wrapper with `Bash(bash .claude/scripts/codex-agent.sh *)`.

The compatibility inventory reports `COUNT: codex-workers codex-agent` for
references to `codex-agent.sh`; its `subagents` family still inventories Claude
Code's own constructs. Counts are observations, never verdicts.

## Briefs and sandbox choice

- Default to `--sandbox read-only` for review or analysis returned as text.
- Use `--sandbox workspace-write` only when the brief authorizes a return-contract
  path under the skill's bounded write exception, or a file set the user approved.
  An agent whose `tools:` lacks Write/Edit always runs read-only.
- A worker does not inherit the conversation. Include the task, relevant decisions,
  inputs, authorized paths, constraints and report format. Name any skill to read.
- Preserve the return-contract phrase ``Write your full output to `<path>` `` in
  briefs. The wrapper checks the first concrete path named by that phrase,
  skipping placeholders containing `[]`, `<>` or `{}`.

## Working with the supervisor

1. Workers cannot ask the user. Return drafts, decisions needing approval and the
   exact "May I write" question in the report, then stop. Claude asks through
   `AskUserQuestion` and, after a yes, runs the worker again with that approval.
2. Workers cannot start other agents. Name the specialist and the question in the
   report; Claude runs that specialist. The wrapper refuses nested worker runs.
3. Workers cannot be resumed or receive `SendMessage`. Rerun the Codex worker
   with the previous result and the correction in its complete brief.
4. For independent work, use Bash `run_in_background: true`, wait for every
   completion notification, then read each result. Never run two workers that
   write the same files at the same time.
5. Agent frontmatter `model`, `effort`, `maxTurns`, `disallowedTools`, `skills`
   and `memory` are Claude Code settings and do not apply to workers. Codex uses
   its configured model. `tools:` is honoured only through the sandbox rule above.

Claude Code's `SubagentStart`/`SubagentStop`, `agent_type`,
`agent_transcript_path`, `CLAUDE_CODE_SUBAGENT_MODEL`,
`CLAUDE_CODE_SUBAGENT_MODEL_FORCE` and `subagentPromptCacheTtl` describe Claude
Code features; they do not control Codex workers. `TaskCreate`, `TaskGet`,
`TaskList` and `TaskUpdate` remain Claude's task-list tools.

## Checks after each run

Claude Code write hooks do not see worker writes. The wrapper appends invocation
and completion records to `production/session-logs/agent-audit.log` when session
state is enabled, using `timestamp | codex | event`. Logging failures never fail
the worker run. The repo does not register the Claude Code start/stop hooks or
the session-stop spawn tally.

After a workspace-write run the wrapper compares git porcelain status before
and after, then runs `write-guard.sh --root . check <path> --agent <name>
--existed yes|no` for each new or changed status line. Observations are printed
to stderr with `codex-agent: write-guard:` and never change the exit status.
Limitation: a file already modified before the run and modified again with the
same status line is not detected. Concurrent changes can also be attributed to
the run; keep write scopes separate.

Claude inspects the warnings, `git status` and the diff after every
workspace-write run, and checks the return-contract artifact before marking the
phase done. A missing artifact triggers the error-recovery protocol even if the
worker's report sounds complete. See [error recovery](error-recovery-protocol.md).

Codex protects `.agents/` as read-only inside a `workspace-write` sandbox, so
workers running `npm run sync:team-skills` get `EPERM`.
After a worker changes `.claude/skills/**` (including frontmatter `name` or
`description`, or a skill folder rename), the orchestrating Claude session must
run `npm run sync:team-skills` before `npm run test:game-architecture`.

| Exit | Meaning |
| --- | --- |
| 0 | Worker succeeded, or dry run completed |
| 2 | Invalid arguments, unknown agent, empty brief or missing worker setup |
| 3 | A worker tried to start another agent |
| 4 | Worker exited 0 but its named artifact is missing |
| Other | Worker's exit status, preserved |

The worker defaults to `$HOME/.claude/hooks/ClaudeBrainCodexHands/codex-worker.cjs`.
Set `CODEX_WORKER` to override it. The wrapper pipes the composed prompt to
`node <worker> --cwd <project-root> --sandbox <mode>` and streams its output;
Git Bash paths are converted with `cygpath -w` for native Node on Windows.

## Codex sessions

When Codex itself runs a team skill, it performs the delegated roles itself by
reading `.claude/agents/<agent>.md`, one role at a time. It never calls
`codex-agent.sh`; the wrapper refuses inside a worker.
