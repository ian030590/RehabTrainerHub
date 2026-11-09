# Skill Test Spec: /setup-engine

## Skill Summary

Configures the existing web toolchain from local package declarations and
lockfile evidence, mirrors technical preferences and refreshes web/VERSION.md.
Only web-game-specialist is installed. Other engines are unsupported.
No director gates apply. COMPLETE means verified local setup.

## Static Assertions (Structural)

- [ ] Required frontmatter fields and worker Bash grant are present.
- [ ] Description names local package/lockfile evidence, not release lookup.
- [ ] Has phase headings, COMPLETE and a next-step handoff.
- [ ] AGENTS.md/CLAUDE.md precedence and authorization are explicit.
- [ ] New games require the six exact GDD headings at every workflow level.

## Fixture Defaults

Use the common studio-tests/CLAUDE.md defaults; each case supplies local
package declarations, lockfile entries and authorized scope. No network is needed.

## Test Cases

### Case 1: Web toolchain configuration

**Fixture**: root/game package declarations and exact lockfile entries; no
engine config; existing root AGENTS.md/CLAUDE.md; approved config/doc file set.
**Input**: /setup-engine web

**Expected behavior**: reads local evidence, proposes/updates engine,
specialists and legacy mirror without replacing repository instructions.

**Assertions**:
- [ ] engine.name is web, language TypeScript, primary/code/shader/ui web-game-specialist.
- [ ] Code root is apps/rehabtrainerhub/games/<gameId>/, tests scripts/check-<gameId>-*.test.mjs.
- [ ] No WebSearch for installed versions; ranges and locked versions distinguished.
- [ ] Reads back matching values and reports actual verification.

### Case 2: Unsupported engine request

**Fixture**: configured web repo; no native engine specialist definitions.
**Input**: /setup-engine unity (repeat with godot and unreal)

**Assertions**:
- [ ] Explains this install supports only web; no missing agent is invoked.
- [ ] No engine config, project files or package changes are written.
- [ ] Existing toolchain and user changes are preserved.

### Case 3: Missing or conflicting version evidence

**Fixture**: game range differs from root range; missing or multiple lock resolutions.
**Input**: /setup-engine web

**Assertions**:
- [ ] Reports each relevant declaration/resolution separately.
- [ ] Missing evidence is unresolved, never guessed or replaced with latest.
- [ ] No dependency install or implicit upgrade.

### Case 4: Re-run on a configured project

**Fixture**: engine/specialists/commands blocks exist; user values elsewhere.
**Input**: /setup-engine web

**Assertions**:
- [ ] Reads before edits, updates keys in place, never duplicates blocks.
- [ ] Mirrors only established facts; preserves unrelated values.
- [ ] No modes.review_mode/workflow, docs.density, qa.level,
  modes.story_granularity or team.size is seeded.
- [ ] No root CLAUDE.md Technology Stack/import rewrite.

### Case 5: Refresh from local packages

**Fixture**: changed authorized lockfile; old web/VERSION.md; no network.
**Input**: /setup-engine refresh

**Assertions**:
- [ ] Updates dated declarations/resolutions and ownership paths only.
- [ ] Separates proxy-only MediaPipe/TensorFlow from game dependencies.
- [ ] Does not invent an installed Node pin or model knowledge cutoff.

### Case 6: Minimal new game

**Fixture**: workflow minimal, game brief exists, new gameId with no GDD.
**Input**: /setup-engine web

**Assertions**:
- [ ] Recommends design/gdd/<gameId>.md with Summary, Overview, Detailed Design,
  Edge Cases, Dependencies, Acceptance Criteria before implementation.
- [ ] No native project scaffolding or replacement CI workflow.
- [ ] Framework completion never authorizes an R2 release.

### Case 7: Worker without write authorization

**Fixture**: read-only worker brief; config change would be needed.

**Assertions**:
- [ ] Returns draft and precise May-I-write question for Claude.
- [ ] No direct user prompt, nested worker, resume or unauthorized write.
- [ ] Already-authorized rerun scope is honored without repeat permission.

## Protocol Compliance

- [ ] Common Codex worker assertions in studio-tests/CLAUDE.md apply.
- [ ] Actual checks and unrun checks are distinguished.
- [ ] No commit, push, deployment or publication during setup.

## Coverage Notes

Cases are behavioral specifications for an orchestrating session. Static reading
does not claim a live agent followed them.
