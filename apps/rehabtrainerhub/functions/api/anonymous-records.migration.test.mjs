import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const migrationNames = [
  '0001_auth_records.sql',
  '0002_password_accounts.sql',
  '0003_rate_limits.sql',
  '0004_remove_retired_motor_records.sql',
  '0005_verified_training_dates.sql',
  '0006_therapist_admin_articles.sql',
  '0007_game_platform.sql',
  '0008_game_run_sessions.sql',
  '0009_training_record_summaries.sql',
  '0010_game_category_tags.sql',
  '0011_anonymous_subject_records.sql',
];
const migrations = await Promise.all(migrationNames.map((name) => (
  readFile(new URL(`../../migrations/${name}`, import.meta.url), 'utf8')
)));

test('anonymous subject migration preserves signed records and permits write-only guest rows', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(migrations.slice(0, -1).join('\n'));
  SeedSignedRecords(db);

  assert.doesNotThrow(() => db.exec(migrations.at(-1)));

  assert.deepEqual(
    { ...db.prepare(`
      SELECT subject_id, user_id, runtime_id
      FROM training_records
      WHERE id = 'legacy-training'
    `).get() },
    { subject_id: null, user_id: 'migration-user', runtime_id: 'motor' },
  );
  assert.deepEqual(
    { ...db.prepare(`
      SELECT subject_id, user_id
      FROM game_run_sessions
      WHERE id = 'legacy-session'
    `).get() },
    { subject_id: null, user_id: 'migration-user' },
  );
  assert.deepEqual(
    { ...db.prepare(`
      SELECT subject_id, user_id, run_session_id
      FROM game_runs
      WHERE id = 'legacy-run'
    `).get() },
    {
      subject_id: null,
      user_id: 'migration-user',
      run_session_id: 'legacy-session',
    },
  );

  for (const tableName of ['training_records', 'game_run_sessions', 'game_runs']) {
    const userIdColumn = db.prepare(`PRAGMA table_info(${tableName})`).all()
      .find((column) => column.name === 'user_id');
    assert.equal(userIdColumn.notnull, 0);
    assert.ok(db.prepare(`PRAGMA table_info(${tableName})`).all()
      .some((column) => column.name === 'subject_id'));
  }

  const subjectId = '550e8400-e29b-41d4-a716-446655440000';
  db.prepare(`
    INSERT INTO training_records (
      id, subject_id, user_id, app_id, runtime_id, module_id, saved_at,
      payload_json, created_at, updated_at
    ) VALUES (
      'guest-training', ?, NULL, 'rehabtrainerhub', 'motor',
      'upper-limb-training', '2026-09-22T00:00:00.000Z', '{}',
      '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z'
    )
  `).run(subjectId);
  db.prepare(`
    INSERT INTO game_run_sessions (
      id, token_sha256, subject_id, user_id, game_id, release_id,
      client_run_id, expires_at, created_at
    ) VALUES (
      'guest-session', 'guest-token-hash', ?, NULL, 'migration-game',
      'migration-release', 'guest-client-run', 2000000000,
      '2026-09-22T00:00:00.000Z'
    )
  `).run(subjectId);
  db.prepare(`
    INSERT INTO game_runs (
      id, game_id, release_id, subject_id, user_id, client_run_id,
      completed, result_json, created_at, run_session_id, result_source
    ) VALUES (
      'guest-run', 'migration-game', 'migration-release', ?, NULL,
      'guest-client-run', 1, '{}', '2026-09-22T00:00:00.000Z',
      'guest-session', 'sandbox_client_reported'
    )
  `).run(subjectId);

  assert.deepEqual(
    { ...db.prepare(`
      SELECT subject_id, user_id
      FROM training_records
      WHERE id = 'guest-training'
    `).get() },
    { subject_id: subjectId, user_id: null },
  );
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);

  db.prepare(`
    INSERT INTO training_records (
      id, user_id, app_id, module_id, saved_at, payload_json, created_at, updated_at
    ) VALUES (
      'cutover-training', 'migration-user', 'motortrainer',
      'upper-limb-training', '2026-09-22T00:00:00.000Z', '{}',
      '2026-09-22T00:00:00.000Z', '2026-09-22T00:00:00.000Z'
    )
  `).run();
  assert.deepEqual(
    { ...db.prepare(`
      SELECT app_id, runtime_id
      FROM training_records
      WHERE id = 'cutover-training'
    `).get() },
    { app_id: 'rehabtrainerhub', runtime_id: 'motor' },
  );
  db.close();
});

function SeedSignedRecords(db) {
  const timestamp = '2026-09-21T00:00:00.000Z';
  db.prepare(`
    INSERT INTO app_users (id, created_at, updated_at)
    VALUES ('migration-user', ?, ?)
  `).run(timestamp, timestamp);
  db.prepare(`
    INSERT INTO training_records (
      id, user_id, app_id, runtime_id, module_id, saved_at, payload_json,
      created_at, updated_at
    ) VALUES (
      'legacy-training', 'migration-user', 'rehabtrainerhub', 'motor',
      'upper-limb-training', ?, '{}', ?, ?
    )
  `).run(timestamp, timestamp, timestamp);
  db.prepare(`
    INSERT INTO developer_games (
      id, slug, owner_user_id, title, status, created_at, updated_at
    ) VALUES (
      'migration-game', 'migration-game', 'migration-user', 'Migration Game',
      'published', ?, ?
    )
  `).run(timestamp, timestamp);
  db.prepare(`
    INSERT INTO game_releases (
      id, game_id, version, submitted_developer_name, submitted_title,
      artifact_type, status, content_sha256, package_bytes, uncompressed_bytes,
      file_count, jspsych_version, files_json, scan_summary_json,
      submitted_at, created_at, updated_at
    ) VALUES (
      'migration-release', 'migration-game', '1.0.0', 'Developer',
      'Migration Game', 'html', 'approved', 'sha256', 1, 1, 1, '8.2.3',
      '[]', '{}', ?, ?, ?
    )
  `).run(timestamp, timestamp, timestamp);
  db.prepare(`
    UPDATE developer_games
    SET active_release_id = 'migration-release'
    WHERE id = 'migration-game'
  `).run();
  db.prepare(`
    INSERT INTO game_run_sessions (
      id, token_sha256, user_id, game_id, release_id, client_run_id,
      expires_at, created_at
    ) VALUES (
      'legacy-session', 'legacy-token-hash', 'migration-user',
      'migration-game', 'migration-release', 'legacy-client-run',
      2000000000, ?
    )
  `).run(timestamp);
  db.prepare(`
    INSERT INTO game_runs (
      id, game_id, release_id, user_id, client_run_id, completed,
      result_json, created_at, run_session_id, result_source
    ) VALUES (
      'legacy-run', 'migration-game', 'migration-release', 'migration-user',
      'legacy-client-run', 1, '{}', ?, 'legacy-session',
      'sandbox_client_reported'
    )
  `).run(timestamp);
}
