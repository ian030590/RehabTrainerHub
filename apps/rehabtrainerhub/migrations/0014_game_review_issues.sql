-- Keep existing game IDs, release files, result rows, and the 39 legacy runtimes.
ALTER TABLE game_releases ADD COLUMN review_digest TEXT;
ALTER TABLE game_releases ADD COLUMN change_notes TEXT NOT NULL DEFAULT '';

CREATE TABLE game_review_issues (
  release_id TEXT PRIMARY KEY REFERENCES game_releases(id) ON DELETE RESTRICT,
  review_digest TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  repository_id INTEGER,
  issue_number INTEGER,
  issue_node_id TEXT,
  issue_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (repository_id, issue_number),
  CHECK (status != 'ready' OR (review_digest IS NOT NULL AND repository_id IS NOT NULL
    AND issue_number IS NOT NULL AND issue_node_id IS NOT NULL AND issue_url IS NOT NULL))
);

CREATE TABLE game_review_issue_jobs (
  id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES game_releases(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('create_issue', 'sync_issue')),
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  lease_until INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_game_review_issue_jobs_due ON game_review_issue_jobs(status, next_attempt_at, lease_until);

-- Existing pending submissions must acquire a version ticket before publication.
-- The worker computes and pins their review digest before contacting GitHub.
INSERT INTO game_review_issues (release_id, created_at, updated_at)
SELECT id, submitted_at, updated_at FROM game_releases
WHERE status IN ('pending_review', 'blocked', 'publishing');
INSERT INTO game_review_issue_jobs (id, release_id, kind, dedupe_key, created_at, updated_at)
SELECT 'create:' || release_id, release_id, 'create_issue', 'create:' || release_id, created_at, updated_at
FROM game_review_issues;
