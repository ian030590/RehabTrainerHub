CREATE TABLE training_plans (
  id TEXT PRIMARY KEY,
  patient_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 60),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 300),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE UNIQUE INDEX idx_training_plans_active_patient
  ON training_plans(patient_user_id) WHERE status = 'active';
CREATE INDEX idx_training_plans_patient_history
  ON training_plans(patient_user_id, status, archived_at DESC);

CREATE TABLE training_plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  weekly_target INTEGER NOT NULL CHECK (typeof(weekly_target) = 'integer' AND weekly_target BETWEEN 1 AND 14),
  settings_json TEXT CHECK (settings_json IS NULL OR (json_valid(settings_json) AND json_type(settings_json) = 'object')),
  sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order BETWEEN 0 AND 11),
  UNIQUE (plan_id, game_id),
  UNIQUE (plan_id, sort_order)
);

CREATE TABLE training_plan_completions (
  record_id TEXT PRIMARY KEY REFERENCES training_records(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  plan_item_id TEXT NOT NULL REFERENCES training_plan_items(id) ON DELETE CASCADE,
  patient_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  completed_at TEXT NOT NULL
);
CREATE INDEX idx_training_plan_completions_item_week
  ON training_plan_completions(plan_item_id, week_start);
CREATE INDEX idx_training_plan_completions_patient_week
  ON training_plan_completions(patient_user_id, week_start, plan_id);

CREATE TABLE training_plan_weeks (
  patient_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  plan_id TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  achieved_at TEXT NOT NULL,
  PRIMARY KEY (patient_user_id, week_start)
);
CREATE INDEX idx_training_plan_weeks_plan ON training_plan_weeks(plan_id);

CREATE TABLE user_titles (
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL CHECK (title_id IN ('six-week-streak')),
  awarded_at TEXT NOT NULL,
  PRIMARY KEY (user_id, title_id)
);
