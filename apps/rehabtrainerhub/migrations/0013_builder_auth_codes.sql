CREATE TABLE IF NOT EXISTS builder_auth_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS builder_auth_codes_expiry ON builder_auth_codes(expires_at);
