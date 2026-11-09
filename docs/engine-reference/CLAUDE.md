# Engine Reference Directory (`docs/engine-reference/`)

When authoring or editing files in this directory, follow these standards.

## Engine Reference (`docs/engine-reference/`)

Version-pinned engine API snapshots. **Always check here before using any
engine API** — the LLM's training data predates the pinned engine version.

Current engine: `web`, matching `engine.name` in `project.yaml`. Read
`docs/engine-reference/web/VERSION.md` for package declarations and exact lockfile
resolutions. `web-game-specialist` is the only installed engine specialist;
Godot, Unity and Unreal references are not installed here.
