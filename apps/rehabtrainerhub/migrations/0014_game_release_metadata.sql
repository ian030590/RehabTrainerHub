-- Public provenance for third-party releases. Existing rows are explicitly
-- marked undeclared and cannot be approved again until an administrator has
-- verified the developer's licence statement.
ALTER TABLE game_releases ADD COLUMN license_id TEXT NOT NULL DEFAULT 'not-declared'
  CHECK (license_id IN ('CC-BY-4.0', 'MIT', 'Apache-2.0', 'proprietary', 'not-declared'));

CREATE INDEX IF NOT EXISTS idx_game_releases_license
  ON game_releases(license_id, status);
