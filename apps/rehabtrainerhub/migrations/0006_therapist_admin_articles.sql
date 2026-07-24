ALTER TABLE app_users
  ADD COLUMN role TEXT NOT NULL DEFAULT 'patient'
  CHECK (role IN ('patient', 'therapist', 'admin'));

CREATE TABLE IF NOT EXISTS therapist_patient_assignments (
  therapist_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  assigned_by_user_id TEXT,
  assigned_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (therapist_id, patient_id),
  CHECK (therapist_id <> patient_id),
  FOREIGN KEY (therapist_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_therapist_patient_assignments_patient
  ON therapist_patient_assignments(patient_id, therapist_id);

CREATE TABLE IF NOT EXISTS education_articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  author_user_id TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (author_user_id) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_education_articles_status_published
  ON education_articles(status, published_at DESC, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_education_articles_author_updated
  ON education_articles(author_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES app_users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_actor_created
  ON admin_audit_events(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_action_created
  ON admin_audit_events(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_records_user_date_app
  ON training_records(user_id, verified_training_date, app_id);

CREATE INDEX IF NOT EXISTS idx_training_records_user_app_verified_date
  ON training_records(user_id, app_id, verified_training_date);

CREATE INDEX IF NOT EXISTS idx_training_records_verified_date_app_user
  ON training_records(verified_training_date, app_id, user_id);

CREATE INDEX IF NOT EXISTS idx_training_records_user_created_at
  ON training_records(user_id, created_at);
