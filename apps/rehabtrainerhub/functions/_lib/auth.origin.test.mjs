import assert from 'node:assert/strict';
import { onRequestGet as getRecords } from '../api/records.js';
import { onRequestGet as getSession } from '../api/auth/session.js';
import { AUTH_COOKIE_NAME, createSessionForUser } from './auth.js';

const secret = '0123456789abcdef0123456789abcdef';
const user = {
  id: 'victim-user-id',
  display_name: 'Victim Case',
  email: 'victim@example.test',
  profile_completed_at: '2026-07-12T00:00:00.000Z',
  profile_json: JSON.stringify({ chronicDiagnoses: ['centralNervousSystem'] }),
};
const record = {
  id: 'rec-1',
  savedAt: '2026-07-12T00:00:00.000Z',
  userName: 'Case A',
  moduleId: 'motor-training',
  difficulty: 'beginner',
  results: [{ score: 88 }],
};

const env = {
  AUTH_SESSION_SECRET: secret,
  REHAB_DB: {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              return sql.includes('app_users') ? user : null;
            },
            async all() {
              return { results: [{ payload_json: JSON.stringify(record) }] };
            },
          };
        },
      };
    },
  },
};

const token = await createSessionForUser(env, user);
const cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`;

async function assertSessionStatus(url, origin, expectedStatus, expectedCorsOrigin) {
  const response = await getSession({
    request: new Request(url, {
      headers: {
        Origin: origin,
        Cookie: cookie,
      },
    }),
    env,
  });

  assert.equal(response.status, expectedStatus);
  assert.equal(response.headers.get('access-control-allow-origin'), expectedCorsOrigin);
  return response;
}

await assertSessionStatus(
  'https://rehabtrainerhub.pages.dev/api/auth/session',
  'http://localhost:5173',
  403,
  null,
);

const allowedSession = await assertSessionStatus(
  'https://rehabtrainerhub.pages.dev/api/auth/session',
  'https://stroketrainer.pages.dev',
  200,
  'https://stroketrainer.pages.dev',
);
const allowedSessionBody = await allowedSession.json();
assert.equal(allowedSessionBody.token, token);
assert.equal(allowedSessionBody.user.profile, undefined);

const localDevSession = await assertSessionStatus(
  'http://localhost:3010/api/auth/session',
  'http://localhost:5173',
  200,
  'http://localhost:5173',
);
assert.equal((await localDevSession.json()).token, token);

const blockedRecords = await getRecords({
  request: new Request('https://rehabtrainerhub.pages.dev/api/records?appId=stroketrainer', {
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: `Bearer ${token}`,
    },
  }),
  env,
});
assert.equal(blockedRecords.status, 403);

const allowedRecords = await getRecords({
  request: new Request('https://rehabtrainerhub.pages.dev/api/records?appId=stroketrainer', {
    headers: {
      Origin: 'https://stroketrainer.pages.dev',
      Authorization: `Bearer ${token}`,
    },
  }),
  env,
});
assert.equal(allowedRecords.status, 200);
assert.deepEqual(await allowedRecords.json(), { records: [record] });

console.log('auth origin checks passed');
