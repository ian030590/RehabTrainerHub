import assert from 'node:assert/strict';
import test from 'node:test';
import { HashPassword, VerifySignedValue } from '../../../_lib/auth.js';
import { onRequestPost as login } from './login.js';

const email = 'victim@example.test';
const password = 'fake-correct-password';
const passwordHash = await HashPassword(password);

function CreateFixture(t) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-06T00:00:00Z').getTime() });
  const rows = new Map();
  const account = { id: 'fake-user', email, password_hash: passwordHash,
    subject_id: '00000000-0000-4000-8000-000000000001' };
  const env = {
    AUTH_SESSION_SECRET: 'fake-login-test-secret-0123456789',
    REHAB_DB: {
      prepare(sql) {
        let bindings = [];
        return {
          bind(...values) { bindings = values; return this; },
          async first() {
            if (/INSERT INTO rate_limits/i.test(sql)) {
              const [key, resetAt] = bindings;
              const row = { count: (rows.get(key)?.count || 0) + 1, reset_at: resetAt };
              rows.set(key, row);
              return row;
            }
            if (/FROM password_accounts/i.test(sql)) return bindings[0] === email ? account : null;
            if (/SELECT subject_id FROM app_users/i.test(sql)) {
              return bindings[0] === account.id ? { subject_id: account.subject_id } : null;
            }
            throw new Error('Unexpected fixture query.');
          },
          async run() {
            if (/CREATE (TABLE|INDEX) IF NOT EXISTS|DELETE FROM rate_limits/i.test(sql)) {
              return { success: true };
            }
            throw new Error('Unexpected fixture write.');
          },
        };
      },
    },
  };
  return { env, account };
}

async function Login(fixture, ip, attemptedPassword = 'fake-wrong-password', attemptedEmail = email) {
  const request = new Request('https://trainerhub.cc/api/auth/password/login', {
    method: 'POST',
    headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ email: attemptedEmail, password: attemptedPassword }),
  });
  return login({ request, env: fixture.env });
}

async function TenFailedAttempts(t, fixture, ip) {
  for (let index = 0; index < 10; index += 1) {
    if (index === 5) t.mock.timers.tick(61000);
    const response = await Login(fixture, ip, undefined, ' Victim@EXAMPLE.test ');
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Invalid email or password.' });
  }
}

test('password login succeeds from another IP after ten failed attempts against the account', async t => {
  const fixture = CreateFixture(t);
  await TenFailedAttempts(t, fixture, '203.0.113.10');
  const response = await Login(fixture, '203.0.113.11', password);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.id, fixture.account.id);
  assert.equal((await VerifySignedValue(body.token, fixture.env.AUTH_SESSION_SECRET)).sub, fixture.account.id);
  assert.match(response.headers.get('Set-Cookie'), /HttpOnly/);
});

test('password login limits the eleventh attempt from the same email and IP within fifteen minutes', async t => {
  const fixture = CreateFixture(t);
  const ip = '203.0.113.20';
  await TenFailedAttempts(t, fixture, ip);
  t.mock.timers.tick(61000);
  const response = await Login(fixture, ip, password);
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: 'Too many requests.' });
  assert.equal(Number(response.headers.get('Retry-After')), 15 * 60 - 122);
  assert.equal((await Login(fixture, '203.0.113.21', password)).status, 200);
  t.mock.timers.tick(15 * 60 * 1000);
  assert.equal((await Login(fixture, ip, password)).status, 200);
});

for (const attemptedEmail of [email, 'unknown@example.test']) {
  test(`password login bounds distributed guessing to one hundred attempts per hour for ${attemptedEmail}`, async t => {
    const fixture = CreateFixture(t);
    const subnet = attemptedEmail === email ? '198.51.100' : '192.0.2';
    for (let index = 1; index <= 100; index += 1) {
      const response = await Login(fixture, `${subnet}.${index}`, undefined, attemptedEmail);
      assert.equal(response.status, 401, `Attempt ${index} must reach password verification.`);
    }
    const response = await Login(fixture, `${subnet}.101`, password, attemptedEmail.toUpperCase());
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), { error: 'Too many requests.' });
    assert.equal(Number(response.headers.get('Retry-After')), 60 * 60);
    t.mock.timers.tick(60 * 60 * 1000);
    assert.equal((await Login(fixture, `${subnet}.101`, password, attemptedEmail)).status,
      attemptedEmail === email ? 200 : 401);
  });
}

test('password login retains the six attempts per minute IP limit across accounts', async t => {
  const fixture = CreateFixture(t);
  for (let index = 0; index < 6; index += 1) {
    assert.equal((await Login(fixture, '203.0.113.30', undefined, `unknown${index}@example.test`)).status, 401);
  }
  const response = await Login(fixture, '203.0.113.30', password);
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: 'Too many requests.' });
  assert.equal(Number(response.headers.get('Retry-After')), 60);
});

test('password login still requires Turnstile when enabled', async t => {
  const fixture = CreateFixture(t);
  fixture.env.TURNSTILE_REQUIRED = '1';
  const response = await Login(fixture, '203.0.113.40', password);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Human verification failed.' });
});
