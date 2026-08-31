import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const priorMigrationNames = [
  '0001_auth_records.sql',
  '0002_password_accounts.sql',
  '0003_rate_limits.sql',
  '0004_remove_retired_motor_records.sql',
  '0005_verified_training_dates.sql',
  '0006_therapist_admin_articles.sql',
  '0007_game_platform.sql',
  '0008_game_run_sessions.sql',
];
const [priorMigrations, recordSummaryMigration] = await Promise.all([
  Promise.all(priorMigrationNames.map((name) => (
    readFile(new URL(`../../migrations/${name}`, import.meta.url), 'utf8')
  ))),
  readFile(new URL('../../migrations/0009_training_record_summaries.sql', import.meta.url), 'utf8'),
]);

const insertLegacyRecordSql = `
  INSERT INTO training_records (
    id, user_id, app_id, module_id, saved_at, payload_json, created_at, updated_at
  ) VALUES (?, 'migration-user', ?, ?, '2026-08-25T00:00:00.000Z', ?,
    '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z')
`;

test('record summary migration canonicalizes existing and cutover-window writes', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(priorMigrations.join('\n'));
  db.prepare(`
    INSERT INTO app_users (id, created_at, updated_at)
    VALUES ('migration-user', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z')
  `).run();

  const gazeSamples = Array.from({ length: 3000 }, (_, index) => ([
    index * 100,
    320,
    240,
    330,
    245,
    11.2,
    4.8,
    0,
    0,
  ]));
  const existingVisionPayload = {
    id: 'existing-vision',
    savedAt: '2026-08-25T00:00:00.000Z',
    moduleId: 'oculomotor-training',
    results: [
      { trial_type: 'webgazer-init-camera', camera_started: true },
      { trial_type: 'webgazer-calibrate', calibration_points: 18 },
      {
        trial_type: 'pixi-oculomotor-training',
        mean_target_distance_px: 11.2,
        target_distance_sd_px: 2.4,
        time_to_first_fixation_ms: 310,
        average_pupil_size_px: 4.8,
        blink_count: 2,
        gaze_sample_count: gazeSamples.length,
        gaze_samples: gazeSamples,
      },
      {
        trial_type: 'timeline-tail',
        preserved: { boolean: true, number: 7, nullable: null },
        gaze_samples: [[1, 2, 3]],
      },
      'preserve-string',
      true,
      false,
      null,
      42,
      2.5,
      [1, 'nested-array'],
    ],
  };
  const insertBeforeMigration = db.prepare(insertLegacyRecordSql);
  insertBeforeMigration.run(
    'existing-vision',
    'visiontrainer',
    'oculomotor-training',
    JSON.stringify(existingVisionPayload),
  );
  insertBeforeMigration.run(
    'existing-motor',
    'motortrainer',
    'upper-limb-training',
    JSON.stringify({ id: 'existing-motor', results: [{ score: 8 }] }),
  );
  insertBeforeMigration.run(
    'existing-invalid-json',
    'visiontrainer',
    'oculomotor-training',
    '{invalid-json',
  );
  const validPayloadWithoutGaze = {
    id: 'existing-no-gaze',
    results: [{ trial_type: 'webgazer-validate', valid: true }],
  };
  insertBeforeMigration.run(
    'existing-no-gaze',
    'visiontrainer',
    'oculomotor-training',
    JSON.stringify(validPayloadWithoutGaze),
  );

  assert.doesNotThrow(() => db.exec(recordSummaryMigration));

  const existingVision = db.prepare(`
    SELECT app_id, runtime_id, payload_json, summary_json
    FROM training_records
    WHERE id = 'existing-vision'
  `).get();
  assert.equal(existingVision.app_id, 'rehabtrainerhub');
  assert.equal(existingVision.runtime_id, 'vision');
  assert.equal(JSON.parse(existingVision.payload_json).results[2].gaze_samples.length, 3000);

  const existingSummary = JSON.parse(existingVision.summary_json);
  assert.equal(existingSummary.results.length, existingVisionPayload.results.length);
  assert.deepEqual(existingSummary.results[0], existingVisionPayload.results[0]);
  assert.deepEqual(existingSummary.results[1], existingVisionPayload.results[1]);
  assert.equal(existingSummary.results[2].mean_target_distance_px, 11.2);
  assert.equal(existingSummary.results[2].target_distance_sd_px, 2.4);
  assert.equal(existingSummary.results[2].time_to_first_fixation_ms, 310);
  assert.equal(existingSummary.results[2].average_pupil_size_px, 4.8);
  assert.equal(existingSummary.results[2].blink_count, 2);
  assert.equal(existingSummary.results[2].gaze_sample_count, 3000);
  assert.equal(existingSummary.results[2].gaze_samples, undefined);
  assert.equal(existingSummary.results[2].gaze_samples_omitted, true);
  assert.deepEqual(existingSummary.results[3].preserved, {
    boolean: true,
    number: 7,
    nullable: null,
  });
  assert.equal(existingSummary.results[3].gaze_samples, undefined);
  assert.equal(existingSummary.results[3].gaze_samples_omitted, true);
  assert.deepEqual(existingSummary.results.slice(4), existingVisionPayload.results.slice(4));
  assert.ok(Buffer.byteLength(existingVision.summary_json, 'utf8') < 32 * 1024);

  assert.deepEqual(
    { ...db.prepare(`
      SELECT app_id, runtime_id
      FROM training_records
      WHERE id = 'existing-motor'
    `).get() },
    { app_id: 'rehabtrainerhub', runtime_id: 'motor' },
  );
  assert.equal(
    db.prepare("SELECT summary_json FROM training_records WHERE id = 'existing-invalid-json'").get()
      .summary_json,
    null,
  );
  const noGazeRow = db.prepare(`
    SELECT payload_json, summary_json
    FROM training_records
    WHERE id = 'existing-no-gaze'
  `).get();
  assert.deepEqual(JSON.parse(noGazeRow.payload_json), validPayloadWithoutGaze);
  assert.equal(noGazeRow.summary_json, null);

  // Simulate writes from the old Pages API after migration 0009 has been
  // applied but before the new API bundle is deployed. That API does not send
  // runtime_id or summary_json.
  const insertDuringCutover = db.prepare(insertLegacyRecordSql);
  const legacyRuntimeCases = [
    ['cutover-motor', 'motortrainer', 'upper-limb-training', 'motor'],
    ['cutover-brain', 'braintrainer', 'attention-training', 'brain'],
    ['cutover-mouth', 'mouthtrainer', 'oral-training', 'mouth'],
  ];
  for (const [id, legacyAppId, moduleId, expectedRuntimeId] of legacyRuntimeCases) {
    insertDuringCutover.run(
      id,
      legacyAppId,
      moduleId,
      JSON.stringify({ id, moduleId, results: [{ score: 9 }] }),
    );
    assert.deepEqual(
      { ...db.prepare('SELECT app_id, runtime_id FROM training_records WHERE id = ?').get(id) },
      { app_id: 'rehabtrainerhub', runtime_id: expectedRuntimeId },
    );
  }

  const cutoverVisionPayload = {
    id: 'cutover-vision',
    moduleId: 'oculomotor-training',
    results: [
      { trial_type: 'webgazer-init-camera' },
      { trial_type: 'webgazer-calibrate' },
      {
        trial_type: 'pixi-oculomotor-training',
        gaze_sample_count: 2,
        gaze_samples: [[0, 1], [2, 3]],
      },
    ],
  };
  insertDuringCutover.run(
    'cutover-vision',
    'visiontrainer',
    'oculomotor-training',
    JSON.stringify(cutoverVisionPayload),
  );
  const cutoverVision = db.prepare(`
    SELECT app_id, runtime_id, payload_json, summary_json
    FROM training_records
    WHERE id = 'cutover-vision'
  `).get();
  assert.equal(cutoverVision.app_id, 'rehabtrainerhub');
  assert.equal(cutoverVision.runtime_id, 'vision');
  assert.equal(JSON.parse(cutoverVision.payload_json).results[2].gaze_samples.length, 2);
  const cutoverSummary = JSON.parse(cutoverVision.summary_json);
  assert.equal(cutoverSummary.results[0].trial_type, 'webgazer-init-camera');
  assert.equal(cutoverSummary.results[2].gaze_samples, undefined);
  assert.equal(cutoverSummary.results[2].gaze_samples_omitted, true);

  insertDuringCutover.run(
    'cutover-hub',
    'rehabtrainerhub',
    'platform-activity',
    JSON.stringify({ id: 'cutover-hub', results: [{ score: 1 }] }),
  );
  assert.deepEqual(
    { ...db.prepare(`
      SELECT app_id, runtime_id
      FROM training_records
      WHERE id = 'cutover-hub'
    `).get() },
    { app_id: 'rehabtrainerhub', runtime_id: 'hub' },
  );

  // A canonical write from the new API already supplies runtime_id and its own
  // summary. The compatibility trigger must leave both untouched.
  const canonicalSummary = JSON.stringify({ source: 'new-api', results: [] });
  db.prepare(`
    INSERT INTO training_records (
      id, user_id, app_id, runtime_id, module_id, saved_at, payload_json,
      summary_json, created_at, updated_at
    ) VALUES (
      'canonical-vision', 'migration-user', 'rehabtrainerhub', 'vision',
      'oculomotor-training', '2026-08-25T00:00:00.000Z', ?, ?,
      '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z'
    )
  `).run(JSON.stringify(cutoverVisionPayload), canonicalSummary);
  assert.deepEqual(
    { ...db.prepare(`
      SELECT app_id, runtime_id, summary_json
      FROM training_records
      WHERE id = 'canonical-vision'
    `).get() },
    {
      app_id: 'rehabtrainerhub',
      runtime_id: 'vision',
      summary_json: canonicalSummary,
    },
  );

  assert.equal(
    db.prepare('SELECT COUNT(*) AS total FROM training_records WHERE runtime_id IS NULL').get().total,
    0,
  );
  assert.equal(
    db.prepare(`
      SELECT COUNT(*) AS total
      FROM training_records
      WHERE app_id IN ('motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer')
    `).get().total,
    0,
  );

  db.close();
});
