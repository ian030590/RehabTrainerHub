CREATE TABLE IF NOT EXISTS developer_games (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  developer_display_name TEXT NOT NULL DEFAULT '居家訓練網開發者',
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'suspended')),
  active_release_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_developer_games_owner_updated
  ON developer_games(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_developer_games_status_updated
  ON developer_games(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS game_releases (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  version TEXT NOT NULL,
  submitted_developer_name TEXT NOT NULL,
  submitted_title TEXT NOT NULL,
  submitted_summary TEXT NOT NULL DEFAULT '',
  submitted_category TEXT NOT NULL DEFAULT 'general',
  artifact_type TEXT NOT NULL
    CHECK (artifact_type IN ('html', 'zip')),
  entry_path TEXT NOT NULL DEFAULT 'index.html',
  status TEXT NOT NULL
    CHECK (status IN ('blocked', 'pending_review', 'publishing', 'approved', 'rejected', 'revoked')),
  content_sha256 TEXT NOT NULL,
  package_bytes INTEGER NOT NULL,
  uncompressed_bytes INTEGER NOT NULL,
  file_count INTEGER NOT NULL,
  jspsych_version TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  files_json TEXT NOT NULL,
  scan_summary_json TEXT NOT NULL,
  publication_lease_id TEXT,
  reviewer_user_id TEXT,
  review_note TEXT,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (game_id, version),
  FOREIGN KEY (game_id) REFERENCES developer_games(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_game_releases_status_submitted
  ON game_releases(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_releases_game_created
  ON game_releases(game_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_release_files (
  release_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  quarantine_key TEXT NOT NULL,
  PRIMARY KEY (release_id, path),
  FOREIGN KEY (release_id) REFERENCES game_releases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_scan_findings (
  id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  severity TEXT NOT NULL
    CHECK (severity IN ('block', 'review', 'info')),
  code TEXT NOT NULL,
  file_path TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (release_id) REFERENCES game_releases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_scan_findings_release_severity
  ON game_scan_findings(release_id, severity, code);

CREATE TABLE IF NOT EXISTS game_runs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  user_id TEXT,
  client_run_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  score REAL,
  duration_ms INTEGER,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (release_id, client_run_id),
  FOREIGN KEY (game_id) REFERENCES developer_games(id) ON DELETE RESTRICT,
  FOREIGN KEY (release_id) REFERENCES game_releases(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_game_runs_user_created
  ON game_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_runs_game_created
  ON game_runs(game_id, created_at DESC);
