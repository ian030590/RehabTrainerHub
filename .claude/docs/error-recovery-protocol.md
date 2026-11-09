# Error Recovery Protocol

Shared procedure for skills that run [Codex workers](codex-workers.md), used by
the `## Error Recovery Protocol` section of each orchestration and review skill.
Two imperatives apply to all of them: **surface a blocked agent immediately, and
produce a partial report.** Each skill's own **Common blockers** list is
skill-specific and is not repeated here.

## Trigger 0 — verify the artifact before reading the response

**Before applying anything below, and before treating a phase as complete: if
the return contract named a path, check that the path exists.** A named
artifact that is not on disk is a FAILED PHASE, no matter how the agent's
response reads.

This trigger exists because the three below are not sufficient. They fire on
BLOCKED, on an error, and on "cannot complete" — and an agent can fail in a way
that is none of those. A parallel agent can do a lot of work and then return a
single fluent preamble — "I'll verify the build infrastructure…" — with no
path, no summary, no BLOCKED item, and **no file written**. Nothing in
steps 1–4 matches that shape. An orchestrator reading the transcript sees a
plausible response and advances, and half a parallel phase disappears with no
signal at all.

Rerun the Codex worker with its previous result and the explicit correction
"you did not honour the return contract; write the named file." Workers cannot
be resumed and do not retain the previous run's context. Include the inputs
needed to finish the work in the new brief.

**A fluent response is not evidence that a phase ran.** The artifact is —
observe the artifact, not the transcript. The rule applies to Codex workers
exactly as it does to skills.

When the path is missing:
1. Do **not** advance the pipeline or summarise the phase as done.
2. Rerun the Codex worker with the previous result and the correction in its
   brief, naming the unmet contract explicitly. "I could not write" is a valid
   answer but silence is not.
3. If the second attempt also produces nothing, treat it as BLOCKED and apply
   steps 1–5 below.

---

If any spawned agent returns BLOCKED, errors, or cannot complete:

1. **Surface immediately** — report "[AgentName]: BLOCKED — [reason]" to the user
   before continuing to dependent phases. The reason names what is missing and
   where it was expected (the path or the input), so the user can supply it.
2. **Assess dependencies** — check whether the blocked agent's output is required
   by subsequent phases. If yes, do not proceed past that dependency point without
   user input.
3. **Claude offers options** via `AskUserQuestion` (workers return questions in their reports):
   - Skip this agent and note the gap in the final report — never fill the skipped agent's section with content of your own
   - Retry with narrower scope
   - Stop here and resolve the blocker first
4. **Always produce a partial report** — output whatever was completed. Never
   discard work because one agent blocked.
5. **A skip does not clear the block.** In a `/team-*` pipeline, choosing "skip
   this agent and note the gap" lets the remaining phases run, but the skipped
   agent's work is missing from what the pipeline delivers: the final verdict is
   BLOCKED, naming the skipped agent and its gap — never COMPLETE.
