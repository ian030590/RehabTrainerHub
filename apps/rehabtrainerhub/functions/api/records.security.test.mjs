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
      app_id: 'motortrainer',
      payload_json: JSON.stringify(victimRecord),
      module_id: victimRecord.moduleId,
      saved_at: victimRecord.savedAt,
    },
  ]),
};
const victimToken = await CreateSessionForUser(env, victim);
const attackerToken = await CreateSessionForUser(env, attacker);

const anonymousRead = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/records?appId=motortrainer', {
    headers: {
      Origin: 'https://motor.trainerhub.cc',
    },
  }),
  env,
});
assert.equal(anonymousRead.status, 401);

const missingAppId = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/records', {
    headers: {
      Origin: 'https://motor.trainerhub.cc',
      Authorization: `Bearer ${victimToken}`,
    },
  }),
  env,
});
assert.equal(missingAppId.status, 400);

const overwrite = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://motor.trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ appId: 'motortrainer', record: attackerRecord }),
  }),
  env,
});
assert.equal(overwrite.status, 409);

const allowedInsert = await onRequestPost({
  request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://motor.trainerhub.cc',
      Authorization: `Bearer ${attackerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: 'motortrainer',
      record: { ...attackerRecord, id: 'attacker-record-id' },
    }),
  }),
  env,
});
assert.equal(allowedInsert.status, 201);
const insertedPayload = await allowedInsert.json();
assert.match(insertedPayload.record.trainingDate, /^\d{4}-\d{2}-\d{2}$/);
assert.notEqual(insertedPayload.record.savedAt, attackerRecord.savedAt);

const victimRecords = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/records?appId=motortrainer', {
    headers: {
      Origin: 'https://motor.trainerhub.cc',
      Authorization: `Bearer ${victimToken}`,
    },
  }),
  env,
});
assert.deepEqual(await victimRecords.json(), { records: [victimRecord] });

console.log('records security checks passed');

function CreateTrainingRecordsDb(initialRows) {
  const rows = new Map(initialRows.map((row) => [row.id, { ...row }]));

  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              if (/SELECT payload_json FROM training_records/i.test(sql)) {
                const [userId, appId] = args;
                return {
                  results: Array.from(rows.values())
                    .filter((row) => row.user_id === userId && row.app_id === appId)
                    .sort((left, right) => left.saved_at.localeCompare(right.saved_at))
                    .map((row) => ({ payload_json: row.payload_json })),
                };
              }
              return { results: [] };
            },
            async run() {
              if (/INSERT INTO training_records/i.test(sql)) {
                const [
                  id,
                  userId,
                  appId,
                  moduleId,
                  gameId,
                  savedAt,
                  trainingDate,
                  verifiedTrainingDate,
                  difficulty,
                  userName,
                  payloadJson,
                  createdAt,
                  updatedAt,
                ] = args;
                const current = rows.get(id);
                if (current && (current.user_id !== userId || current.app_id !== appId)) {
                  return { success: true, meta: { changes: 0 } };
                }
                rows.set(id, {
                  id,
                  user_id: userId,
                  app_id: appId,
                  module_id: moduleId,
                  game_id: gameId,
                  saved_at: savedAt,
                  training_date: trainingDate,
                  verified_training_date: verifiedTrainingDate,
                  difficulty,
                  user_name: userName,
                  payload_json: payloadJson,
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
