import assert from 'node:assert/strict';
import { CreateSessionForUser } from '../_lib/auth.js';
import { onRequestGet, onRequestPost } from './records.js';

const secret = '0123456789abcdef0123456789abcdef';
const victim = { id: 'victim-user-id', display_name: 'Victim Case' };
const attacker = { id: 'attacker-user-id', display_name: 'Attacker Case' };
const victimRecord = {
  id: 'shared-record-id',
  savedAt: '2026-07-12T00:00:00.000Z',
  userName: 'Victim Case',
  moduleId: 'upper-limb-training',
  difficulty: 'beginner',
  results: [{ score: 88 }],
};
const victimVisionRecord = {
  ...victimRecord,
  id: 'victim-vision-record-id',
  moduleId: 'moving-card',
  results: [{ score: 77 }],
};
const attackerRecord = {
  ...victimRecord,
  userName: 'Attacker Case',
  results: [{ score: 0 }],
};
const env = {
  AUTH_SESSION_SECRET: secret,
  REHAB_DB: CreateTrainingRecordsDb([
    {
      id: victimRecord.id,
      user_id: victim.id,
      app_id: 'rehabtrainerhub',
      runtime_id: 'motor',
      payload_json: JSON.stringify(victimRecord),
      module_id: victimRecord.moduleId,
      saved_at: victimRecord.savedAt,
    },
    {
      id: victimVisionRecord.id,
      user_id: victim.id,
      app_id: 'rehabtrainerhub',
      runtime_id: 'vision',
      payload_json: JSON.stringify(victimVisionRecord),
      module_id: victimVisionRecord.moduleId,
      saved_at: '2026-07-12T00:01:00.000Z',
    },
  ]),
};
const victimToken = await CreateSessionForUser(env, victim);
const attackerToken = await CreateSessionForUser(env, attacker);

const anonymousRead = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=motor', {
    headers: {
      Origin: 'https://trainerhub.cc',
    },
  }),
  env,
});
assert.equal(anonymousRead.status, 401);

const missingAppId = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/records?runtimeId=motor', {
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${victimToken}`,
    },
  }),
  env,
});
assert.equal(missingAppId.status, 400);

const legacyAppId = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'motortrainer',
      runtimeId: 'motor',
      record: { ...attackerRecord, id: 'legacy-app-record-id' },
    }),
  }),
  env,
});
assert.equal(legacyAppId.status, 400);

const missingRuntimeId = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      record: { ...attackerRecord, id: 'missing-runtime-record-id' },
    }),
  }),
  env,
});
assert.equal(missingRuntimeId.status, 400);

const mismatchedRuntimeModule = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'motor',
      record: {
        ...attackerRecord,
        id: 'mismatched-runtime-module-record-id',
        moduleId: 'moving-card',
      },
    }),
  }),
  env,
});
assert.equal(mismatchedRuntimeModule.status, 400);

const overwrite = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'motor',
      record: attackerRecord,
    }),
  }),
  env,
});
assert.equal(overwrite.status, 409);

const allowedInsert = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'motor',
      record: { ...attackerRecord, id: 'attacker-record-id' },
    }),
  }),
  env,
});
assert.equal(allowedInsert.status, 201);
const insertedPayload = await allowedInsert.json();
assert.match(insertedPayload.record.trainingDate, /^\d{4}-\d{2}-\d{2}$/);
assert.notEqual(insertedPayload.record.savedAt, attackerRecord.savedAt);

const crossModuleOverwrite = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'motor',
      record: {
        ...attackerRecord,
        id: 'attacker-record-id',
        moduleId: 'lower-limb-training',
      },
    }),
  }),
  env,
});
assert.equal(crossModuleOverwrite.status, 409);

const eyeTrackingColumns = [
  't_ms',
  'gaze_x',
  'gaze_y',
  'target_x',
  'target_y',
  'distance_px',
  'pupil_size_px_estimate',
  'blink_event',
  'fixation_segment',
];
const eyeTrackingSamples = Array.from({ length: 3000 }, (_, index) => ([
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
const allowedEyeTrackingRecord = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'vision',
      record: {
        ...attackerRecord,
        id: 'eye-tracking-record-id',
        moduleId: 'oculomotor-training',
        results: [{
          trial_type: 'pixi-oculomotor-training',
          gaze_sample_columns: eyeTrackingColumns,
          gaze_sample_count: eyeTrackingSamples.length,
          gaze_samples: eyeTrackingSamples,
        }],
      },
    }),
  }),
  env,
});
assert.equal(allowedEyeTrackingRecord.status, 201);

const summarizedEyeTrackingRecords = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=vision', {
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
    },
  }),
  env,
});
assert.equal(summarizedEyeTrackingRecords.status, 200);
const summarizedEyeTrackingPayload = await summarizedEyeTrackingRecords.json();
assert.equal(summarizedEyeTrackingPayload.records.length, 1);
assert.equal(summarizedEyeTrackingPayload.records[0].results[0].gaze_sample_count, 3000);
assert.equal(summarizedEyeTrackingPayload.records[0].results[0].gaze_samples, undefined);
assert.equal(summarizedEyeTrackingPayload.records[0].results[0].gaze_samples_omitted, true);

const detailedEyeTrackingRecords = await onRequestGet({
  request: new Request(
    'https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=vision&includeGazeSamples=1&limit=5',
    {
      headers: {
        Origin: 'https://trainerhub.cc',
        Authorization: `Bearer ${attackerToken}`,
      },
    },
  ),
  env,
});
assert.equal(detailedEyeTrackingRecords.status, 200);
const detailedEyeTrackingPayload = await detailedEyeTrackingRecords.json();
assert.equal(detailedEyeTrackingPayload.records[0].results[0].gaze_samples.length, 3000);

const excessiveDetailedPageSize = await onRequestGet({
  request: new Request(
    'https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=vision&includeGazeSamples=1&limit=6',
    {
      headers: {
        Origin: 'https://trainerhub.cc',
        Authorization: `Bearer ${attackerToken}`,
      },
    },
  ),
  env,
});
assert.equal(excessiveDetailedPageSize.status, 400);

const rawGazeForMotorRuntime = await onRequestGet({
  request: new Request(
    'https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=motor&includeGazeSamples=1',
    {
      headers: {
        Origin: 'https://trainerhub.cc',
        Authorization: `Bearer ${attackerToken}`,
      },
    },
  ),
  env,
});
assert.equal(rawGazeForMotorRuntime.status, 400);

const nonCanonicalGazeRecord = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'vision',
      record: {
        ...attackerRecord,
        id: 'non-canonical-gaze-record-id',
        moduleId: 'reading-training',
        results: [{
          gaze_samples: [[1, 2]],
          nested: { gaze_samples: [[3, 4]] },
        }],
      },
    }),
  }),
  env,
});
assert.equal(nonCanonicalGazeRecord.status, 201);

const summarizedNonCanonicalRecords = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=vision', {
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
    },
  }),
  env,
});
assert.equal(summarizedNonCanonicalRecords.status, 200);
const summarizedNonCanonicalPayload = await summarizedNonCanonicalRecords.json();
const summarizedNonCanonicalRecord = summarizedNonCanonicalPayload.records.find(
  (record) => record.id === 'non-canonical-gaze-record-id',
);
assert.ok(summarizedNonCanonicalRecord);
assert.equal(summarizedNonCanonicalRecord.results[0].gaze_samples, undefined);
assert.equal(summarizedNonCanonicalRecord.results[0].gaze_samples_omitted, true);
assert.equal(summarizedNonCanonicalRecord.results[0].nested.gaze_samples, undefined);
assert.equal(summarizedNonCanonicalRecord.results[0].nested.gaze_samples_omitted, true);

const oversizedNonEyeTrackingRecord = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'vision',
      record: {
        ...attackerRecord,
        id: 'oversized-non-eye-record-id',
        moduleId: 'reading-training',
        results: [{ raw: 'x'.repeat(40 * 1024) }],
      },
    }),
  }),
  env,
});
assert.equal(oversizedNonEyeTrackingRecord.status, 413);

const oversizedFakeEyeTrackingRecord = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'vision',
      record: {
        ...attackerRecord,
        id: 'oversized-fake-eye-record-id',
        moduleId: 'oculomotor-training',
        results: [{
          trial_type: 'pixi-oculomotor-training',
          gaze_sample_columns: eyeTrackingColumns,
          gaze_sample_count: 0,
          gaze_samples: [],
          extra: 'x'.repeat(40 * 1024),
        }],
      },
    }),
  }),
  env,
});
assert.equal(oversizedFakeEyeTrackingRecord.status, 413);

const oversizedSecondResultRecord = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'vision',
      record: {
        ...attackerRecord,
        id: 'oversized-second-result-record-id',
        moduleId: 'oculomotor-training',
        results: [{
          trial_type: 'pixi-oculomotor-training',
          gaze_sample_columns: eyeTrackingColumns,
          gaze_sample_count: 0,
          gaze_samples: [],
        }, { raw: 'x'.repeat(40 * 1024) }],
      },
    }),
  }),
  env,
});
assert.equal(oversizedSecondResultRecord.status, 413);

const malformedEyeTrackingRecord = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'vision',
      record: {
        ...attackerRecord,
        id: 'malformed-eye-tracking-record-id',
        moduleId: 'oculomotor-training',
        results: [{
          trial_type: 'pixi-oculomotor-training',
          gaze_sample_columns: eyeTrackingColumns,
          gaze_sample_count: 1000,
          gaze_samples: Array.from({ length: 1000 }, () => (
            ['not-a-time', 0, 0, 0, 0, 0, null, 0, 0]
          )),
        }],
      },
    }),
  }),
  env,
});
assert.equal(malformedEyeTrackingRecord.status, 413);

const oversizedPayload = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'motor',
      record: {
        ...attackerRecord,
        id: 'oversized-record-id',
        results: [{ raw: 'x'.repeat(600 * 1024) }],
      },
    }),
  }),
  env,
});
assert.equal(oversizedPayload.status, 413);

const overlongModule = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'rehabtrainerhub',
      runtimeId: 'motor',
      record: {
        ...attackerRecord,
        id: 'invalid-module-record-id',
        moduleId: 'm'.repeat(121),
      },
    }),
  }),
  env,
});
assert.equal(overlongModule.status, 400);

const victimRecords = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=motor', {
    headers: {
      Origin: 'https://trainerhub.cc',
      Authorization: `Bearer ${victimToken}`,
    },
  }),
  env,
});
assert.deepEqual(await victimRecords.json(), { records: [victimRecord] });

const victimVisionRecords = await onRequestGet({
  request: new Request(
    'https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=vision',
    {
      headers: {
        Origin: 'https://trainerhub.cc',
        Authorization: `Bearer ${victimToken}`,
      },
    },
  ),
  env,
});
assert.deepEqual(await victimVisionRecords.json(), { records: [victimVisionRecord] });

const victimMotorCount = await onRequestGet({
  request: new Request(
    'https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=motor&count=1',
    {
      headers: {
        Origin: 'https://trainerhub.cc',
        Authorization: `Bearer ${victimToken}`,
      },
    },
  ),
  env,
});
assert.deepEqual(await victimMotorCount.json(), { count: 1 });

const victimVisionCount = await onRequestGet({
  request: new Request(
    'https://trainerhub.cc/api/records?appId=rehabtrainerhub&runtimeId=vision&count=1',
    {
      headers: {
        Origin: 'https://trainerhub.cc',
        Authorization: `Bearer ${victimToken}`,
      },
    },
  ),
  env,
});
assert.deepEqual(await victimVisionCount.json(), { count: 1 });

console.log('records security checks passed');

function CreateTrainingRecordsDb(initialRows) {
  const rows = new Map(initialRows.map((row) => [row.id, { ...row }]));
  const rateLimits = new Map();

  return {
    prepare(sql) {
      return {
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
        bind(...args) {
          return {
            async all() {
              if (/SELECT[\s\S]+payload_json[\s\S]+FROM training_records/i.test(sql)) {
                const [userId, appId, runtimeId] = args;
                const readsSummary = /COALESCE\(summary_json, payload_json\)/i.test(sql);
                return {
                  results: Array.from(rows.values())
                    .filter((row) => (
                      row.user_id === userId
                      && row.app_id === appId
                      && row.runtime_id === runtimeId
                    ))
                    .sort((left, right) => left.saved_at.localeCompare(right.saved_at))
                    .map((row) => {
                      if (
                        readsSummary
                        && row.payload_json.length > 32 * 1024
                        && !row.summary_json
                      ) {
                        throw new Error('Summary query attempted to materialize an oversized raw payload.');
                      }
                      return {
                        payload_json: readsSummary
                          ? row.summary_json ?? row.payload_json
                          : row.payload_json,
                        id: row.id,
                        saved_at: row.saved_at,
                      };
                    }),
                };
              }
              return { results: [] };
            },
            async first() {
              if (/INSERT INTO rate_limits/i.test(sql)) {
                const [key, resetAt] = args;
                const current = rateLimits.get(key);
                const row = {
                  count: Number(current?.count || 0) + 1,
                  reset_at: resetAt,
                };
                rateLimits.set(key, row);
                return row;
              }
              if (/SELECT COUNT\(\*\) AS total[\s\S]+FROM training_records/i.test(sql)) {
                const [userId, appId, runtimeId] = args;
                const total = Array.from(rows.values()).filter((row) => (
                  row.user_id === userId
                  && row.app_id === appId
                  && row.runtime_id === runtimeId
                )).length;
                return { total };
              }
              return null;
            },
            async run() {
              if (/INSERT INTO training_records/i.test(sql)) {
                const [
                  id,
                  userId,
                  appId,
                  runtimeId,
                  moduleId,
                  gameId,
                  savedAt,
                  trainingDate,
                  verifiedTrainingDate,
                  difficulty,
                  userName,
                  payloadJson,
                  summaryJson,
                  createdAt,
                  updatedAt,
                ] = args;
                const current = rows.get(id);
                if (
                  current
                  && (
                    current.user_id !== userId
                    || current.app_id !== appId
                    || current.runtime_id !== runtimeId
                    || current.module_id !== moduleId
                  )
                ) {
                  return { success: true, meta: { changes: 0 } };
                }
                rows.set(id, {
                  id,
                  user_id: userId,
                  app_id: appId,
                  runtime_id: runtimeId,
                  module_id: moduleId,
                  game_id: gameId,
                  saved_at: savedAt,
                  training_date: trainingDate,
                  verified_training_date: verifiedTrainingDate,
                  difficulty,
                  user_name: userName,
                  payload_json: payloadJson,
                  summary_json: summaryJson,
                  created_at: current?.created_at ?? createdAt,
                  updated_at: updatedAt,
                });
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}
