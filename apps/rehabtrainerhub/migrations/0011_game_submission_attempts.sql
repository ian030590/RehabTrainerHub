-- Submission attempts are immutable intake records. A developer may submit
-- another attempt for the same unpublished target version, while an approved
-- release remains immutable and uniquely addressable by (game, version).

ALTER TABLE game_submissions ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1
  CHECK (attempt > 0);

ALTER TABLE game_submissions ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_submissions_attempt
  ON game_submissions(game_id, target_version, attempt);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_submissions_idempotency
  ON game_submissions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_submissions_game_version_latest
  ON game_submissions(game_id, target_version, created_at DESC, attempt DESC);

-- A manual reviewer must be able to explain every finding override. Hard
-- blocks are intentionally not representable as an approved override: the
-- API validates the disposition again before inserting these rows.
CREATE TABLE IF NOT EXISTS game_validation_overrides (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  scan_run_id TEXT NOT NULL,
  review_request_id TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  reviewer_user_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('accept', 'dismiss')),
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES game_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (scan_run_id) REFERENCES game_scan_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (review_request_id) REFERENCES game_review_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (finding_id) REFERENCES game_validation_findings(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_user_id) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_validation_overrides_review_finding
  ON game_validation_overrides(review_request_id, finding_id);

CREATE INDEX IF NOT EXISTS idx_game_validation_overrides_finding
  ON game_validation_overrides(finding_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_validation_overrides_submission
  ON game_validation_overrides(submission_id, created_at DESC);

-- Notifications are durable, bounded, and non-sensitive. Delivery is a
-- separate concern so a failed email/push provider can never change review
-- or publication state.
CREATE TABLE IF NOT EXISTS game_platform_notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  release_id TEXT,
  submission_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN (
    'request-changes', 'rejected', 'revoked', 'validation-failed', 'review-requested'
  )),
  payload_json TEXT NOT NULL DEFAULT '{}',
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (recipient_user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES developer_games(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES game_releases(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES game_submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_platform_notifications_recipient
  ON game_platform_notifications(recipient_user_id, delivered_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_platform_notifications_submission
  ON game_platform_notifications(submission_id, created_at DESC);
