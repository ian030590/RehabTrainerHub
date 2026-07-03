CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  privacy_accepted_at TEXT,
  profile_completed_at TEXT,
  age_range TEXT,
  gender TEXT,
  nationality TEXT,
  chronic_diagnoses_json TEXT,
  smoking_status TEXT,
  smoking_frequency_json TEXT,
  alcohol_status TEXT,
  alcohol_frequency_json TEXT,
  profile_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_accounts (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  linked_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider, provider_user_id),
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_provider_accounts_user_id
  ON provider_accounts(user_id);

CREATE TABLE IF NOT EXISTS training_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  game_id TEXT,
  saved_at TEXT NOT NULL,
  training_date TEXT,
  difficulty TEXT,
  user_name TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_training_records_user_app_saved
  ON training_records(user_id, app_id, saved_at);
