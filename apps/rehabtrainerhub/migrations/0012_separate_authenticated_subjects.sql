-- Guest Subject IDs must never be reused on authenticated rows. Historical
-- authenticated rows may contain the pre-cutover browser ID; clear it because
-- there is no reliable way to reconstruct the new account-scoped identifier.
UPDATE training_records
SET subject_id = NULL
WHERE user_id IS NOT NULL AND subject_id IS NOT NULL;

UPDATE game_run_sessions
SET subject_id = NULL
WHERE user_id IS NOT NULL AND subject_id IS NOT NULL;

UPDATE game_runs
SET subject_id = NULL
WHERE user_id IS NOT NULL AND subject_id IS NOT NULL;
