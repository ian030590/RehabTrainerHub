import assert from 'node:assert/strict';
import { CreateSignedValue, authCookieName } from '../../_lib/auth.js';
import { onRequestGet } from './anonymous-analysis.js';

const secret = '0123456789abcdef0123456789abcdef';
const users = new Map([
  ['admin-user', { id: 'admin-user', display_name: 'Admin', email: 'admin@example.test', role: 'admin' }],
  ['therapist-user', { id: 'therapist-user', display_name: 'Therapist', email: 'therapist@example.test', role: 'therapist' }],
]);
const auditEvents = [];
const env = { AUTH_SESSION_SECRET: secret, REHAB_DB: CreateAnalysisDb() };
const adminToken = await CreateSignedValue({ sub: 'admin-user' }, secret, 60);
const therapistToken = await CreateSignedValue({ sub: 'therapist-user' }, secret, 60);

const anonymousRead = await onRequestGet({
  request: new Request('https://trainerhub.cc/api/admin/anonymous-analysis'),
  env,
});
assert.equal(anonymousRead.status, 401);

const therapistRead = await onRequestGet({
  request: AuthorizedRequest(
    'https://trainerhub.cc/api/admin/anonymous-analysis',
    therapistToken,
  ),
  env,
});
assert.equal(therapistRead.status, 403);

const subjectLookup = await onRequestGet({
  request: AuthorizedRequest(
    'https://trainerhub.cc/api/admin/anonymous-analysis?subjectId=550e8400-e29b-41d4-a716-446655440000',
    adminToken,
  ),
  env,
});
assert.equal(subjectLookup.status, 400);

const upperCaseSubjectLookup = await onRequestGet({
  request: AuthorizedRequest(
    'https://trainerhub.cc/api/admin/anonymous-analysis?SUBJECT_ID=550e8400-e29b-41d4-a716-446655440000',
    adminToken,
  ),
  env,
});
assert.equal(upperCaseSubjectLookup.status, 400);

const aggregate = await onRequestGet({
  request: AuthorizedRequest(
    'https://trainerhub.cc/api/admin/anonymous-analysis?dateFrom=2026-09-01&runtimeId=motor',
    adminToken,
  ),
  env,
});
assert.equal(aggregate.status, 200);
const aggregatePayload = await aggregate.json();
assert.equal(aggregatePayload.scope.subjectIds, 'not-returned');
assert.equal(aggregatePayload.summary.recordCount, 3);
assert.deepEqual(aggregatePayload.byRuntime, [{
  source: 'training_record',
  runtimeId: 'motor',
  recordCount: 3,
  uniqueSubjectCount: 2,
}]);
assert.doesNotMatch(JSON.stringify(aggregatePayload), /subject-id|payload_json|result_json/i);
assert.equal(auditEvents.length, 1);
assert.equal(auditEvents[0].action, 'anonymous_records.analysis');
assert.doesNotMatch(auditEvents[0].metadataJson, /subject/i);

const csvExport = await onRequestGet({
  request: AuthorizedRequest(
    'https://trainerhub.cc/api/admin/anonymous-analysis?format=csv',
    adminToken,
  ),
  env,
});
assert.equal(csvExport.status, 200);
const csv = await csvExport.text();
assert.match(csv, /group_type,group_key,source,record_count,unique_subject_count/);
assert.doesNotMatch(csv, /subject_id|payload_json|result_json|550e8400/i);
assert.equal(auditEvents.length, 2);

console.log('anonymous analysis security checks passed');

function AuthorizedRequest(url, token) {
  return new Request(url, {
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: `${authCookieName}=${encodeURIComponent(token)}`,
    },
  });
}

function CreateAnalysisDb() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/SELECT id, display_name, email, avatar_url, role\s+FROM app_users/i.test(sql)) {
                return users.get(args[0]) || null;
              }
              if (/COUNT\(\*\) AS record_count[\s\S]+COUNT\(DISTINCT subject_id\)/i.test(sql)) {
                return {
                  record_count: 3,
                  subject_count: 2,
                  first_recorded_at: '2026-09-01T00:00:00.000Z',
                  latest_recorded_at: '2026-09-22T00:00:00.000Z',
                };
              }
              if (/INSERT INTO rate_limits/i.test(sql)) return { count: 1, reset_at: 2000000000 };
              return null;
            },
            async all() {
              if (/GROUP BY source, runtime_id/i.test(sql)) {
                return {
                  results: [{
                    source: 'training_record',
                    runtime_id: 'motor',
                    record_count: 3,
                    subject_count: 2,
                  }],
                };
              }
              if (/GROUP BY recorded_date/i.test(sql)) {
                return {
                  results: [{ recorded_date: '2026-09-22', record_count: 3, subject_count: 2 }],
                };
              }
              return { results: [] };
            },
            async run() {
              if (/INSERT INTO admin_audit_events/i.test(sql)) {
                auditEvents.push({
                  action: args[2],
                  metadataJson: args[5],
                });
              }
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };
}
