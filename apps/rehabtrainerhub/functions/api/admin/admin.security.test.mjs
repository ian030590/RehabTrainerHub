import assert from 'node:assert/strict';
import { CreateSignedValue, authCookieName } from '../../_lib/auth.js';
import { onRequestGet as getOverview } from './overview.js';
import { onRequestGet as getRecords } from './records.js';

const secret = '0123456789abcdef0123456789abcdef';
const users = new Map([
  ['patient-user', {
    id: 'patient-user',
    display_name: 'Regular Patient',
    email: 'regular@example.test',
    role: 'patient',
  }],
  ['patient-assigned', {
    id: 'patient-assigned',
    display_name: '=SUM(1,1)',
    email: 'assigned@example.test',
    role: 'patient',
  }],
  ['therapist-user', {
    id: 'therapist-user',
    display_name: 'Therapist',
    email: 'therapist@example.test',
    role: 'therapist',
  }],
]);
const trainingRow = {
  id: 'record-1',
  patient_id: 'patient-assigned',
  patient_name: '=SUM(1,1)',
  patient_email: 'assigned@example.test',
  app_id: 'motortrainer',
  module_id: 'upper-limb-training',
  game_id: 'drawing-defense',
  training_date: '2026-07-24',
  saved_at: '2026-07-24T01:00:00.000Z',
  difficulty: 'beginner',
  user_name: '@Patient',
  payload_json: JSON.stringify({ score: 88 }),
};
let auditWrites = 0;
const env = {
  AUTH_SESSION_SECRET: secret,
  REHAB_DB: CreateAdminDb(),
};
const patientToken = await CreateSignedValue({ sub: 'patient-user' }, secret, 60);
const therapistToken = await CreateSignedValue({ sub: 'therapist-user' }, secret, 60);

const patientOverview = await getOverview({
  request: AuthorizedRequest('https://trainerhub.cc/api/admin/overview', patientToken),
  env,
});
assert.equal(patientOverview.status, 403);

const therapistOverview = await getOverview({
  request: AuthorizedRequest('https://trainerhub.cc/api/admin/overview', therapistToken),
  env,
});
assert.equal(therapistOverview.status, 200);
assert.deepEqual(await therapistOverview.json(), {
  summary: {
    patientCount: 1,
    recordCount: 1,
    trainingDays: 1,
    latestActivityAt: '2026-07-24T01:00:00.000Z',
  },
  patients: [{
    id: 'patient-assigned',
    displayName: '=SUM(1,1)',
    email: 'assigned@example.test',
    recordCount: 1,
    lastTrainedAt: '2026-07-24T01:00:00.000Z',
  }],
});

const forbiddenPatientRecords = await getRecords({
  request: AuthorizedRequest(
    'https://trainerhub.cc/api/admin/records?patientId=patient-user',
    therapistToken,
  ),
  env,
});
assert.equal(forbiddenPatientRecords.status, 403);

const assignedRecords = await getRecords({
  request: AuthorizedRequest(
    'https://trainerhub.cc/api/admin/records?patientId=patient-assigned&page=1&pageSize=25',
    therapistToken,
  ),
  env,
});
assert.equal(assignedRecords.status, 200);
const recordsPayload = await assignedRecords.json();
assert.equal(recordsPayload.records[0].payload.score, 88);
assert.deepEqual(recordsPayload.pagination, {
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 1,
});

const csvExport = await getRecords({
  request: AuthorizedRequest(
    'https://trainerhub.cc/api/admin/records?patientId=patient-assigned&format=csv&limit=10',
    therapistToken,
  ),
  env,
});
assert.equal(csvExport.status, 200);
const csv = await csvExport.text();
assert.match(csv, /'=SUM\(1,1\)/);
assert.match(csv, /'@Patient/);
assert.equal(auditWrites, 1);

console.log('admin security checks passed');

function AuthorizedRequest(url, token) {
  return new Request(url, {
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: `${authCookieName}=${encodeURIComponent(token)}`,
    },
  });
}

function CreateAdminDb() {
  return {
    prepare(sql) {
      return {
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
        bind(...args) {
          return {
            async first() {
              if (/SELECT id, display_name, email, avatar_url, role\s+FROM app_users/i.test(sql)) {
                return users.get(args[0]) || null;
              }
              if (/FROM therapist_patient_assignments\s+INNER JOIN app_users/i.test(sql)) {
                return args[0] === 'therapist-user' && args[1] === 'patient-assigned'
                  ? { allowed: 1 }
                  : null;
              }
              if (/WITH accessible_patients[\s\S]*COUNT\(DISTINCT accessible_patients\.id\)/i.test(sql)) {
                return {
                  patient_count: 1,
                  record_count: 1,
                  training_days: 1,
                  latest_activity_at: trainingRow.saved_at,
                };
              }
              if (/SELECT COUNT\(\*\) AS total\s+FROM training_records/i.test(sql)) {
                return { total: 1 };
              }
              return null;
            },
            async all() {
              if (/WITH accessible_patients[\s\S]*GROUP BY/i.test(sql)) {
                return {
                  results: [{
                    id: 'patient-assigned',
                    display_name: '=SUM(1,1)',
                    email: 'assigned@example.test',
                    record_count: 1,
                    last_trained_at: trainingRow.saved_at,
                  }],
                };
              }
              if (/FROM training_records\s+INNER JOIN app_users/i.test(sql)) {
                return { results: [trainingRow] };
              }
              return { results: [] };
            },
            async run() {
              if (/INSERT INTO admin_audit_events/i.test(sql)) auditWrites += 1;
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}
