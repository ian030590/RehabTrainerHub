# Agent Test Spec: web-game-specialist

## Agent Summary

The only installed engine specialist validates RehabTrainerHub's self-contained
Vite/TypeScript R2 games, sandbox/MessageChannel boundary, lifecycle and release
evidence. It reports specialist questions to the orchestrator and has no director gate.

**Domain**: `apps/rehabtrainerhub/games/<gameId>/`, authorized game tests and docs.
**Escalates to**: `lead-programmer`, `technical-director`.
**Delegates to**: no agents directly; names specialists/questions in its report.

## Static Assertions (Structural)

- [ ] `.claude/agents/web-game-specialist.md` exists with name, description,
  `tools: Read, Glob, Grep, Write, Edit, Bash`, `model: inherit`, `maxTurns: 20`.
- [ ] `engine.name: web` resolves primary/code/shader/ui to this installed role.
- [ ] AGENTS.md/CLAUDE.md precedence, workspace scope and TDD are explicit.
- [ ] Version awareness reads local declarations and lockfile, not guessed releases.
- [ ] Scope, release approval boundary and collaboration protocol are explicit.

## Test Cases

### Case 1: In-Domain Request: add a game setting

**Fixture**: a complete GDD, a migrated R2 game, an approved file set.

**Expected behavior**: reads the game and tests; adds a failing behavior test,
implements the minimum, validates settings/tutorial/results and builds the game.

**Assertions**:
- [ ] Tests precede product code; actual failure and final commands are reported.
- [ ] Dependencies, i18n, metadata, runtime and UI stay inside this workspace.
- [ ] New tests are confirmed to run through root `test:ci`.

**Case Verdict**: PASS / FAIL / PARTIAL / NOT ASSESSED

### Case 2: Out-of-Domain Redirect: platform camera permission

**Fixture**: game-only scope; request for direct getUserMedia in the iframe.

**Expected behavior**: explains the approved runner input-proxy boundary and
reports a precise architecture question to technical-director via lead-programmer.

**Assertions**:
- [ ] No direct media capture, permission expansion or runner edits.
- [ ] Names the agent and question for the orchestrator; never starts a worker.

**Case Verdict**: PASS / FAIL / PARTIAL / NOT ASSESSED

### Case 3: Architecture review: forged and replayed results

**Fixture**: text-only review brief; ordinary window-message results are accepted.

**Expected behavior**: reports missing private-channel validation with file evidence.

**Assertions**:
- [ ] Runs read-only; identifies origin/source, nonce, sequence and schema checks.
- [ ] Retains `sandbox="allow-scripts"`; no silent source edits or new gate vocabulary.

**Case Verdict**: PASS / FAIL / PARTIAL / NOT ASSESSED

### Case 4: Conflict Escalation: shared game UI

**Fixture**: proposal to import packages/ui or another game's renderer.

**Expected behavior**: cites AGENTS.md and reports the conflict and a game-local
alternative to lead-programmer/technical-director.

**Assertions**:
- [ ] No platform or cross-game imports; no unilateral architecture override.
- [ ] Reports the question and draft; caller puts it to the user.

**Case Verdict**: PASS / FAIL / PARTIAL / NOT ASSESSED

### Case 5: Context Pass-Through: mobile results cleanup

**Fixture**: complete authorized brief, previous result and correction, zh/en,
390×844 and 820×1180 acceptance conditions.

**Expected behavior**: applies only the scoped correction and checks completion,
cancel/exit/unmount/late initialization cleanup and the local Brave game fixture.

**Assertions**:
- [ ] Uses supplied context; no inherited-conversation assumption or resume call.
- [ ] Reports actual commands; unrun Brave/hardware checks stay NOT ASSESSED.
- [ ] No edits in Hub app, runner, packages or another game's workspace.

**Case Verdict**: PASS / FAIL / PARTIAL / NOT ASSESSED

### Case 6: Release boundary: changed published bytes

**Fixture**: immutable published version, changed bundle, no exact digest approval.

**Expected behavior**: requires a version bump, build and local publisher dry-run;
returns exact version/contentSha256 and review evidence for owner approval.

**Assertions**:
- [ ] Never publishes, overwrites bytes, deploys or pushes on a framework verdict.
- [ ] Medical copy uses practice/activity/session record without efficacy claims.

**Case Verdict**: PASS / FAIL / PARTIAL / NOT ASSESSED

## Protocol Compliance

- [ ] Common Codex worker assertions in `studio-tests/CLAUDE.md` apply.
- [ ] Questions and specialist requests return in the report; no nested agents.
- [ ] Unauthorized writes wait for approval; existing explicit scope is honored.
- [ ] Caller inspects diff and wrapper checks after workspace-write runs.

## Coverage Notes

Behavior cases require an orchestrating session; static inspection does not prove
a live agent followed them. Game-specific CI and Brave fixtures prove game behavior.
