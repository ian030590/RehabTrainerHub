import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSessionForUser } from '../../_lib/auth.js';
import { CreateRawDataEnvironment } from '../../_lib/rawDataTestFixtures.mjs';
import { onRequestPut as updateProfile } from './profile.js';

const userId = 'fake-profile-user';
const profile = {
  ageRange: '40-49', gender: 'woman', nationality: 'Taiwan',
  chronicDiagnoses: ['centralNervousSystem', 'metabolic'],
  smokingStatus: 'current', smokingFrequency: { interval: 'week', amount: '1', unit: 'packs' },
  alcoholStatus: 'none',
};

function CreateFixture(t) {
  const fixture = CreateRawDataEnvironment();
  t.after(() => fixture.sqlite.close());
  fixture.sqlite.prepare(`INSERT INTO app_users (id, email, subject_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)`).run(userId, 'profile@example.test',
    '00000000-0000-4000-8000-000000000002', '2026-11-06T00:00:00Z', '2026-11-06T00:00:00Z');
  return fixture;
}

async function UpdateProfile(fixture, body, headers = {}) {
  const token = await CreateSessionForUser(fixture.env, { id: userId });
  return updateProfile({ env: fixture.env, request: new Request('https://trainerhub.cc/api/auth/profile', {
    method: 'PUT', headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`, ...headers }, body,
  }) });
}

for (const declaredLength of [false, true]) {
  test(`profile rejects a body over sixteen KiB without writing (Content-Length: ${declaredLength})`, async t => {
    const fixture = CreateFixture(t);
    const before = fixture.sqlite.prepare('SELECT * FROM app_users WHERE id = ?').get(userId);
    const body = JSON.stringify({ ...profile, padding: '字'.repeat(6000) });
    const response = await UpdateProfile(fixture, body,
      declaredLength ? { 'Content-Length': String(Buffer.byteLength(body)) } : {});
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: 'Profile payload is too large.' });
    assert.deepEqual(fixture.sqlite.prepare('SELECT * FROM app_users WHERE id = ?').get(userId), before);
  });
}

test('profile stores each allowed chronic diagnosis once and discards unknown values', async t => {
  const fixture = CreateFixture(t);
  const response = await UpdateProfile(fixture, JSON.stringify({ ...profile,
    chronicDiagnoses: ['metabolic', 'metabolic', 'unknown', 'centralNervousSystem', null,
      'centralNervousSystem', 'developmental', 'psychotic', 'neurotic', 'neurotic'],
  }));
  assert.equal(response.status, 200);
  const stored = fixture.sqlite.prepare('SELECT chronic_diagnoses_json, profile_json FROM app_users WHERE id = ?').get(userId);
  const expected = ['metabolic', 'centralNervousSystem', 'developmental', 'psychotic', 'neurotic'];
  assert.deepEqual(JSON.parse(stored.chronic_diagnoses_json), expected);
  assert.deepEqual(JSON.parse(stored.profile_json).chronicDiagnoses, expected);
});

test('profile accepts a normal update and preserves completion and frequency fields', async t => {
  const fixture = CreateFixture(t);
  const response = await UpdateProfile(fixture, JSON.stringify(profile));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.profileCompleted, true);
  const stored = fixture.sqlite.prepare('SELECT * FROM app_users WHERE id = ?').get(userId);
  assert.deepEqual(JSON.parse(stored.profile_json), profile);
  assert.deepEqual(JSON.parse(stored.smoking_frequency_json), profile.smokingFrequency);
  assert.equal(stored.alcohol_frequency_json, null);
  assert.ok(stored.profile_completed_at);
});

test('profile rejects malformed JSON with the existing generic error and no writes', async t => {
  const fixture = CreateFixture(t);
  const response = await UpdateProfile(fixture, '{');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid profile payload.' });
  assert.equal(fixture.sqlite.prepare('SELECT profile_json FROM app_users WHERE id = ?').get(userId).profile_json, null);
});
