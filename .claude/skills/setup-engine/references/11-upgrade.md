# /setup-engine: Upgrade Proposal

Read proposed versions, current declarations and exact lockfile entries.
Review primary migration docs, affected APIs, lifecycle, rollback and tests.
Present the complete file set for approval. Never select latest automatically.

After authorization follow AGENTS.md TDD and lockfile policy, build/test affected
games and relevant gates. New published bytes require game version bumps,
publisher dry-run and fresh owner approval of exact version/contentSha256.
Setup does not publish, deploy, push or commit.
