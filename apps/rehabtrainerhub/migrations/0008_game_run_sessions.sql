CREATE TABLE IF NOT EXISTS game_run_sessions (
  id TEXT PRIMARY KEY,
  token_sha256 TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  client_run_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES developer_games(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES game_releases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_run_sessions_expiry
  ON game_run_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_game_run_sessions_user_created
  ON game_run_sessions(user_id, created_at DESC);

ALTER TABLE game_runs ADD COLUMN run_session_id TEXT
  REFERENCES game_run_sessions(id) ON DELETE SET NULL;

ALTER TABLE game_runs ADD COLUMN result_source TEXT NOT NULL
  DEFAULT 'legacy_client_reported'
  CHECK (result_source IN ('legacy_client_reported', 'sandbox_client_reported'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_runs_run_session
  ON game_runs(run_session_id)
  WHERE run_session_id IS NOT NULL;
