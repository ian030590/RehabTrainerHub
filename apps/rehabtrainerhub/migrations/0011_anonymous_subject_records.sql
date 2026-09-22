DROP TRIGGER IF EXISTS trg_training_records_canonicalize_after_insert;

ALTER TABLE training_records RENAME TO training_records_before_subjects;

CREATE TABLE training_records (
  id TEXT PRIMARY KEY,
  subject_id TEXT,
  user_id TEXT,
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
  verified_training_date TEXT,
  runtime_id TEXT,
  summary_json TEXT,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

INSERT INTO training_records (
  id, subject_id, user_id, app_id, module_id, game_id, saved_at,
  training_date, difficulty, user_name, payload_json, created_at, updated_at,
  verified_training_date, runtime_id, summary_json
)
SELECT
  id, NULL, user_id, app_id, module_id, game_id, saved_at,
  training_date, difficulty, user_name, payload_json, created_at, updated_at,
  verified_training_date, runtime_id, summary_json
FROM training_records_before_subjects;

DROP TABLE training_records_before_subjects;

CREATE INDEX idx_training_records_user_app_saved
  ON training_records(user_id, app_id, saved_at);

CREATE INDEX idx_training_records_user_verified_date
  ON training_records(user_id, verified_training_date);

CREATE INDEX idx_training_records_user_runtime_saved
  ON training_records(user_id, app_id, runtime_id, saved_at, id);

-- Preserve the 0009 cutover compatibility for cached clients and an old
-- Worker that can briefly remain active after this migration is applied.
CREATE TRIGGER trg_training_records_canonicalize_after_insert
AFTER INSERT ON training_records
WHEN NEW.runtime_id IS NULL
  OR NEW.app_id IN ('motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer')
  OR (
    NEW.summary_json IS NULL
    AND (NEW.runtime_id = 'vision' OR NEW.app_id = 'visiontrainer')
    AND NEW.module_id = 'oculomotor-training'
  )
BEGIN
  UPDATE training_records
  SET app_id = CASE
        WHEN NEW.app_id IN ('motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer')
        THEN 'rehabtrainerhub'
        ELSE NEW.app_id
      END,
      runtime_id = CASE NEW.app_id
        WHEN 'motortrainer' THEN 'motor'
        WHEN 'visiontrainer' THEN 'vision'
        WHEN 'braintrainer' THEN 'brain'
        WHEN 'mouthtrainer' THEN 'mouth'
        ELSE COALESCE(NEW.runtime_id, 'hub')
      END,
      summary_json = CASE
        WHEN (NEW.runtime_id = 'vision' OR NEW.app_id = 'visiontrainer')
          AND NEW.module_id = 'oculomotor-training'
          AND CASE
            WHEN json_valid(NEW.payload_json) THEN
              json_type(NEW.payload_json, '$.results') = 'array'
              AND EXISTS (
                SELECT 1
                FROM json_each(NEW.payload_json, '$.results') AS timeline_item
                WHERE CASE
                  WHEN timeline_item.type = 'object'
                  THEN json_type(timeline_item.value, '$.gaze_samples') = 'array'
                  ELSE 0
                END
              )
            ELSE 0
          END
        THEN json_set(
          NEW.payload_json,
          '$.results',
          json((
            SELECT json_group_array(
              json(CASE
                WHEN timeline_item.type = 'object' THEN
                  CASE
                    WHEN json_type(timeline_item.value, '$.gaze_samples') = 'array'
                    THEN json_set(
                      json_remove(timeline_item.value, '$.gaze_samples'),
                      '$.gaze_samples_omitted',
                      json('true')
                    )
                    ELSE timeline_item.value
                  END
                WHEN timeline_item.type = 'array' THEN timeline_item.value
                WHEN timeline_item.type = 'text' THEN json_quote(timeline_item.value)
                WHEN timeline_item.type = 'null' THEN 'null'
                WHEN timeline_item.type = 'true' THEN 'true'
                WHEN timeline_item.type = 'false' THEN 'false'
                ELSE CAST(timeline_item.value AS TEXT)
              END)
            )
            FROM json_each(NEW.payload_json, '$.results') AS timeline_item
          ))
        )
        ELSE NEW.summary_json
      END
  WHERE id = NEW.id;
END;

-- Rebuild both sides of the run-session foreign key so game_run_sessions can
-- accept a nullable account without leaving game_runs pointed at a renamed
-- legacy table.
ALTER TABLE game_runs RENAME TO game_runs_before_subjects;
ALTER TABLE game_run_sessions RENAME TO game_run_sessions_before_subjects;

CREATE TABLE game_run_sessions (
  id TEXT PRIMARY KEY,
  token_sha256 TEXT NOT NULL UNIQUE,
  subject_id TEXT,
  user_id TEXT,
  game_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  client_run_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES developer_games(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES game_releases(id) ON DELETE CASCADE
);

INSERT INTO game_run_sessions (
  id, token_sha256, subject_id, user_id, game_id, release_id,
  client_run_id, expires_at, created_at
)
SELECT
  id, token_sha256, NULL, user_id, game_id, release_id,
  client_run_id, expires_at, created_at
FROM game_run_sessions_before_subjects;

CREATE TABLE game_runs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  subject_id TEXT,
  user_id TEXT,
  client_run_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  score REAL,
  duration_ms INTEGER,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  run_session_id TEXT REFERENCES game_run_sessions(id) ON DELETE SET NULL,
  result_source TEXT NOT NULL DEFAULT 'legacy_client_reported'
    CHECK (result_source IN ('legacy_client_reported', 'sandbox_client_reported')),
  UNIQUE (release_id, client_run_id),
  FOREIGN KEY (game_id) REFERENCES developer_games(id) ON DELETE RESTRICT,
  FOREIGN KEY (release_id) REFERENCES game_releases(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

INSERT INTO game_runs (
  id, game_id, release_id, subject_id, user_id, client_run_id, completed,
  score, duration_ms, result_json, created_at, run_session_id, result_source
)
SELECT
  id, game_id, release_id, NULL, user_id, client_run_id, completed,
  score, duration_ms, result_json, created_at, run_session_id, result_source
FROM game_runs_before_subjects;

DROP TABLE game_runs_before_subjects;
DROP TABLE game_run_sessions_before_subjects;

CREATE INDEX idx_game_run_sessions_expiry
  ON game_run_sessions(expires_at);

CREATE INDEX idx_game_run_sessions_user_created
  ON game_run_sessions(user_id, created_at DESC);

CREATE INDEX idx_game_runs_user_created
  ON game_runs(user_id, created_at DESC);

CREATE INDEX idx_game_runs_game_created
  ON game_runs(game_id, created_at DESC);

CREATE UNIQUE INDEX idx_game_runs_run_session
  ON game_runs(run_session_id)
  WHERE run_session_id IS NOT NULL;
