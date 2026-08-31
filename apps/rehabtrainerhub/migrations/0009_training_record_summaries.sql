ALTER TABLE training_records ADD COLUMN runtime_id TEXT;
ALTER TABLE training_records ADD COLUMN summary_json TEXT;

-- The four built-in experiences are runtime categories of trainerhub.cc, not
-- separate applications. Preserve the former app ids only long enough to map
-- existing records to their Hub runtime category.
UPDATE training_records
SET runtime_id = CASE app_id
  WHEN 'motortrainer' THEN 'motor'
  WHEN 'visiontrainer' THEN 'vision'
  WHEN 'braintrainer' THEN 'brain'
  WHEN 'mouthtrainer' THEN 'mouth'
  ELSE 'hub'
END
WHERE runtime_id IS NULL;

-- A jsPsych record contains the complete timeline. Camera initialization,
-- calibration, and validation trials can precede the actual oculomotor trial,
-- so rebuild the whole results array instead of assuming results[0]. Removing
-- every direct gaze_samples array keeps the history payload bounded while
-- retaining trial order, summary metrics, and all other valid JSON values.
UPDATE training_records
SET summary_json = json_set(
  payload_json,
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
    FROM json_each(training_records.payload_json, '$.results') AS timeline_item
  ))
)
WHERE runtime_id = 'vision'
  AND module_id = 'oculomotor-training'
  AND CASE
    WHEN json_valid(payload_json) THEN
      json_type(payload_json, '$.results') = 'array'
      AND EXISTS (
        SELECT 1
        FROM json_each(training_records.payload_json, '$.results') AS timeline_item
        WHERE CASE
          WHEN timeline_item.type = 'object'
          THEN json_type(timeline_item.value, '$.gaze_samples') = 'array'
          ELSE 0
        END
      )
    ELSE 0
  END;

UPDATE training_records
SET app_id = 'rehabtrainerhub'
WHERE app_id IN ('motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer');

-- D1 migrations are intentionally applied before the matching Pages code is
-- deployed. During that cutover window, an old Worker can still insert a
-- legacy app_id without the new runtime_id/summary_json columns. Canonicalize
-- those writes in the database so the new API can see them after deployment.
CREATE TRIGGER IF NOT EXISTS trg_training_records_canonicalize_after_insert
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

CREATE INDEX IF NOT EXISTS idx_training_records_user_runtime_saved
  ON training_records(user_id, app_id, runtime_id, saved_at, id);
