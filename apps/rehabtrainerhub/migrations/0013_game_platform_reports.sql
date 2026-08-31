-- User reports for published third-party games. Reports never change a
-- release directly; an administrator must review and use the existing revoke
-- lease flow when a report is substantiated.
CREATE TABLE IF NOT EXISTS game_platform_reports (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  reporter_user_id TEXT,
  reason TEXT NOT NULL
    CHECK (reason IN ('safety', 'copyright', 'privacy', 'content', 'other')),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved', 'rejected')),
  resolution_note TEXT,
  resolved_by_user_id TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES developer_games(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES game_releases(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_game_platform_reports_status_created
  ON game_platform_reports(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_game_platform_reports_release_created
  ON game_platform_reports(release_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_platform_reports_active_reporter
  ON game_platform_reports(release_id, reporter_user_id, reason)
  WHERE status IN ('open', 'in_review') AND reporter_user_id IS NOT NULL;
