ALTER TABLE training_records ADD COLUMN verified_training_date TEXT;

UPDATE training_records
SET verified_training_date = substr(created_at, 1, 10)
WHERE verified_training_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_training_records_user_verified_date
  ON training_records(user_id, verified_training_date);
