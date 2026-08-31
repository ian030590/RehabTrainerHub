-- Controller attestation is retained separately from the compact scan-run
-- status. This gives administrators a bounded source/dynamic report without
-- making the release row itself mutable or trusted by the executor.

CREATE TABLE IF NOT EXISTS game_scan_reports (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL UNIQUE,
  submission_id TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  report_sha256 TEXT NOT NULL UNIQUE,
  attestation_key_id TEXT NOT NULL,
  attestation_algorithm TEXT NOT NULL CHECK (attestation_algorithm = 'Ed25519'),
  report_json TEXT NOT NULL,
  attestation_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  FOREIGN KEY (scan_run_id) REFERENCES game_scan_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES game_submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_scan_reports_submission
  ON game_scan_reports(submission_id, received_at DESC);
