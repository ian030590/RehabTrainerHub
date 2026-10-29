ALTER TABLE app_users ADD COLUMN subject_id TEXT;

CREATE UNIQUE INDEX idx_app_users_subject_id
  ON app_users(subject_id)
  WHERE subject_id IS NOT NULL;
