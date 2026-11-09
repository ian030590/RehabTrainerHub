# Agent Coordination Rules

Team members run as [Codex workers](codex-workers.md). Workers report specialist
requests and user questions to Claude, which handles delegation and approval.

1. **Vertical Delegation**: Leadership agents delegate to department leads, who
   delegate to specialists. Never skip a tier for complex decisions.
2. **Horizontal Consultation**: Agents at the same tier may consult each other
   but must not make binding decisions outside their domain.
3. **Conflict Resolution**: When two agents disagree, escalate to the shared
   parent. If no shared parent, escalate to `creative-director` for design
   conflicts or `technical-director` for technical conflicts.
4. **Change Propagation**: When a design change affects multiple domains, the
   `producer` agent coordinates the propagation.
5. **No Unilateral Cross-Domain Changes**: An agent must never modify files
   outside its designated directories without explicit delegation.
6. **Read Design Docs by Section**: A brief names the sections an agent needs
   by heading. Find a heading in a GDD, ADR or the art bible with the Grep
   tool (`^#`, content mode) and Read that range with offset and limit; read a doc
   whole only when the task needs all of it, and say why. `validate-read.sh`
   refuses a whole-file read of a doc over 40 KB.
7. **Nothing Goes Upstream**: Never file, open or comment on an issue or pull
   request in an engine, plugin or vendor repository, even when asked. Write a
   draft (`/bug-report` drafts only) and the user submits it.

## Model Tier Assignment

Read `.claude/docs/model-tiers.md` on demand. It carries the tier table, the
per-skill assignments and the authoring rule.

**Key point:** whether a skill's `model:` is used
depends on how the skill starts. Typed as `/skill-name`: yes, except a `haiku`
pin in auto mode. Started by Claude through the Skill tool: no. Never tell a
user a `haiku` skill saves money; an `opus` skill typed in a Sonnet session
costs more. Agent-side model pins do not apply to Codex workers.

## Codex workers vs Agent Teams

This project uses Codex workers; Claude Code Agent Teams are not used here.

### Codex workers
Claude runs team members through the wrapper described in
[codex-workers.md](codex-workers.md). Each brief is complete and selects an
explicit sandbox; workers return results to Claude.

**When to spawn in parallel**: If two Codex workers' inputs are independent (neither
needs the other's output to begin), run both with Bash `run_in_background: true`
rather than waiting. Example: `/review-all-gdds` **Phase 2** (consistency) and
**Phase 3** (design theory) are independent — spawn both at the same time.
Phase 1 loads the GDDs and both depend on it, so it is the one phase here that
must NOT be parallelised.

### Agent Teams (not used)
Claude Code `TeamCreate` is blocked here. Use Codex workers instead; see
[agent-teams.md](agent-teams.md).

## Parallel Task Protocol

When an orchestration skill spawns multiple independent agents:

1. Run independent workers with Bash `run_in_background: true`; never give concurrent writers the same files
2. Wait for each completion notification, then read every result before dependent phases
3. If any agent is BLOCKED, surface it immediately — do not silently skip
4. Always produce a partial report if some agents complete and others block
