-- Additive game-validation control plane. The legacy game_releases.status
-- column remains readable during migration, but new asynchronous validation
-- work records scan, review, and publication axes independently.

CREATE TABLE IF NOT EXISTS game_submissions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  target_version TEXT NOT NULL,
  artifact_type TEXT NOT NULL
    CHECK (artifact_type IN ('html', 'zip')),
  entry_path TEXT NOT NULL DEFAULT 'index.html'
    CHECK (entry_path = 'index.html'),
  artifact_sha256 TEXT NOT NULL,
  package_bytes INTEGER NOT NULL CHECK (package_bytes > 0),
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES developer_games(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_submissions_game_version
  ON game_submissions(game_id, target_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_submissions_owner_created
  ON game_submissions(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_submission_files (
  submission_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL,
  quarantine_key TEXT NOT NULL,
  PRIMARY KEY (submission_id, path),
  FOREIGN KEY (submission_id) REFERENCES game_submissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_scan_runs (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  job_nonce TEXT NOT NULL UNIQUE,
  artifact_sha256 TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  limits_profile TEXT NOT NULL DEFAULT 'uploaded-game-v1',
  status TEXT NOT NULL
    CHECK (status IN ('queued', 'running', 'passed', 'flagged', 'failed')),
  tool_versions_json TEXT NOT NULL DEFAULT '{}',
  report_sha256 TEXT,
  error_code TEXT,
  queued_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (submission_id, attempt),
  FOREIGN KEY (submission_id) REFERENCES game_submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_scan_runs_status_updated
  ON game_scan_runs(status, updated_at ASC);

CREATE TABLE IF NOT EXISTS game_validation_findings (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL,
  disposition TEXT NOT NULL
    CHECK (disposition IN ('hard-block', 'fix-or-manual-review', 'manual-review', 'info')),
  code TEXT NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  column_number INTEGER,
  message_key TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (scan_run_id) REFERENCES game_scan_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_validation_findings_run_disposition
  ON game_validation_findings(scan_run_id, disposition, code);

CREATE TABLE IF NOT EXISTS game_review_requests (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  scan_run_id TEXT NOT NULL,
  requester_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'in_review', 'changes_requested', 'approved', 'rejected')),
  reviewed_by_user_id TEXT,
  review_note TEXT,
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES game_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (scan_run_id) REFERENCES game_scan_runs(id) ON DELETE RESTRICT,
  FOREIGN KEY (requester_user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_game_review_requests_status_updated
  ON game_review_requests(status, updated_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_review_requests_active
  ON game_review_requests(submission_id)
  WHERE status IN ('requested', 'in_review', 'approved');

-- A release can be published only from one immutable submission attempt. The
-- column is nullable for rows created by the pre-migration synchronous flow.
ALTER TABLE game_releases ADD COLUMN submission_id TEXT
  REFERENCES game_submissions(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_releases_submission
  ON game_releases(submission_id)
  WHERE submission_id IS NOT NULL;
