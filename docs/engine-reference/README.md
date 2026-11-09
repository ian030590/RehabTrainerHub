# Engine Reference Documentation

Last verified: 2026-11-09

RehabTrainerHub uses web games built with Vite and TypeScript. The only installed
engine specialist is web-game-specialist. Read [web/VERSION.md](web/VERSION.md)
before library API work: it records actual declarations, exact lockfile resolutions
and the package paths that own them.

Refresh via /setup-engine web or /setup-engine refresh by reading package.json,
package-lock.json and game workspace packages. Installed versions never come
from WebSearch or model memory. The snapshot distinguishes game dependencies
from root packages used by input proxies/legacy integrations. Each game declares
its own imports; root node_modules availability is insufficient.

Godot, Unity and Unreal API references/specialists were not installed and are
unsupported here. Future API notes must be dated and evidenced with installed
types/source or primary documentation. Do not infer a model knowledge cutoff.
Root AGENTS.md/CLAUDE.md and [the team workflow](../../.claude/docs/rehab-game-team.md)
govern architecture, testing and releases.
