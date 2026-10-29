import assert from 'node:assert/strict';
import test from 'node:test';
import { authCookieName, CreateSessionForUser, CreateSignedValue, VerifySignedValue } from '../_lib/auth.js';
import { CreateRawDataEnvironment } from '../_lib/rawDataTestFixtures.mjs';
import { officialGameReleases } from '../_lib/officialGames.js';
import { onRequestPost as launchGame } from './official-game-sessions.js';
import { onRequestPost as saveRecord } from './records.js';

const gameId = 'motor-cortex-rehab';
const otherGameId = 'drawing-defense';
const monday = '2026-10-26T00:00:00+08:00';

function CreateFixture(t, now = monday) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(now).getTime() });
  const fixture = CreateRawDataEnvironment();
  t.after(() => fixture.sqlite.close());
  const { env, sqlite } = fixture;
  const releaseBucket = env.GAME_RELEASE_BUCKET;
  env.GAME_RELEASE_BUCKET = { async get(key) {
    const original = await releaseBucket.get(key);
    if (original) return original;
    const release = { ...fixture.release, gameId: otherGameId };
    const value = key === `official-games/${otherGameId}/current.json`
      ? { schemaVersion: 1, gameId: otherGameId, currentVersion: release.version,
        releases: { [release.version]: { contentSha256: release.contentSha256 } } }
      : key === `releases/${otherGameId}/${release.version}/release.json` ? release : null;
    return value && { text: async () => JSON.stringify(value), json: async () => value,
      size: Buffer.byteLength(JSON.stringify(value)) };
  } };
  env.TRAINING_PLANS_ENABLED = '1';
  sqlite.exec('PRAGMA foreign_keys = ON');
  const ids = {};
  for (const [key, role] of [['admin', 'admin'], ['therapist', 'therapist'], ['patient', 'patient'], ['other', 'patient']]) {
    ids[key] = `${key}-${crypto.randomUUID()}`;
    sqlite.prepare(`INSERT INTO app_users (id, role, display_name, email, subject_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(ids[key], role, key === 'admin' ? 'Staff name' : key,
      `${key}@private.invalid`, crypto.randomUUID(), monday, monday);
  }
  sqlite.prepare(`INSERT INTO therapist_patient_assignments (therapist_id, patient_id, assigned_by_user_id, assigned_at, updated_at)
    VALUES (?, ?, ?, ?, ?)`).run(ids.therapist, ids.patient, ids.admin, monday, monday);
  return { ...fixture, ids };
}

async function RequestFor(fixture, path, body, actor, cookie = true, origin = 'https://trainerhub.cc') {
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  if (actor) {
    const token = await CreateSessionForUser(fixture.env, { id: fixture.ids[actor] });
    headers[cookie ? 'Cookie' : 'Authorization'] = cookie ? `${authCookieName}=${token}` : `Bearer ${token}`;
  }
  return new Request(`https://trainerhub.cc/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function PlanInput(fixture, overrides = {}) {
  return { patientId: fixture.ids.patient, title: '本週練習', note: '依清單進行活動',
    items: [{ gameId, weeklyTarget: 1, settings: { difficulty: 'easy', duration: 30, sound: false } }], ...overrides };
}

async function StaffCall(fixture, body, actor = 'admin', patientId = fixture.ids.patient, origin) {
  const route = await import('./admin/training-plans.js');
  const request = await RequestFor(fixture, `admin/training-plans?patientId=${patientId}`, body, actor, true, origin);
  return route[body === undefined ? 'onRequestGet' : 'onRequestPost']({ request, env: fixture.env });
}

async function CreatePlan(fixture, overrides = {}) {
  const response = await StaffCall(fixture, PlanInput(fixture, overrides));
  assert.equal(response.status, 201, await response.clone().text());
  return (await response.json()).plan;
}

async function PlayerCall(fixture, actor = 'patient', query = '') {
  const { onRequestGet } = await import('./training-plans/current.js');
  return onRequestGet({ request: await RequestFor(fixture, `training-plans/current${query}`, undefined, actor, false), env: fixture.env });
}

async function ArchiveCall(fixture, planId, actor = 'admin') {
  const { onRequestPost } = await import('./admin/training-plans/[planId]/archive.js');
  return onRequestPost({ request: await RequestFor(fixture, `admin/training-plans/${planId}/archive`, {}, actor),
    params: { planId }, env: fixture.env });
}

async function Launch(fixture, planItemId, actor = 'patient', requestedGameId = gameId) {
  const request = await RequestFor(fixture, 'official-game-sessions', { gameId: requestedGameId,
    subjectId: crypto.randomUUID(), ...(planItemId === undefined ? {} : { planItemId }) }, actor, false);
  return launchGame({ request, env: fixture.env });
}

async function Save(fixture, session, planFollowed, actor = 'patient') {
  const { gameId } = await VerifySignedValue(session.token, fixture.env.AUTH_SESSION_SECRET);
  const body = { appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId: session.subjectId,
    officialGameVersion: session.version, runSessionToken: session.token,
    ...(planFollowed === undefined ? {} : { planFollowed }),
    record: { id: session.recordId, gameId, moduleId: gameId, config: {},
      score: { schema: 'rehab-trainer.game-score/v1', gameId, summary: { total: 1 }, rounds: [{ points: 1 }] } } };
  return saveRecord({ request: await RequestFor(fixture, 'records', body, actor, false), env: fixture.env });
}

async function Complete(fixture, item, planFollowed = true) {
  const response = await Launch(fixture, item.id);
  assert.equal(response.status, 201, await response.clone().text());
  const session = await response.json();
  const saved = await Save(fixture, session, planFollowed);
  assert.equal(saved.status, 201, await saved.clone().text());
  return session;
}

function Count(fixture, table) {
  return fixture.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

test('0016 follows 0015 and enforces list, item, title and foreign-key constraints', async t => {
  const fixture = CreateFixture(t);
  const { sqlite, ids } = fixture;
  assert.ok(sqlite.prepare('PRAGMA table_info(app_users)').all().some(column => column.name === 'subject_id'));
  assert.equal(sqlite.prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN
    ('training_plans', 'training_plan_items', 'training_plan_completions', 'training_plan_weeks', 'user_titles')`).get().count, 5);
  const plan = await CreatePlan(fixture);
  const insert = sqlite.prepare(`INSERT INTO training_plans (id, patient_user_id, title, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  assert.throws(() => insert.run('duplicate', ids.patient, 'Another', 'active', monday, monday), /UNIQUE/);
  assert.throws(() => insert.run('invalid', ids.other, 'x'.repeat(61), 'active', monday, monday), /CHECK/);
  assert.throws(() => insert.run('invalid', ids.other, 'List', 'deleted', monday, monday), /CHECK/);
  for (const target of [0, 15, 1.5]) assert.throws(() => sqlite.prepare(`INSERT INTO training_plan_items
    (id, plan_id, game_id, weekly_target, sort_order) VALUES ('bad', ?, 'bad-game', ?, 1)`).run(plan.id, target), /CHECK/);
  assert.throws(() => sqlite.prepare(`INSERT INTO training_plan_items (id, plan_id, game_id, weekly_target, sort_order)
    VALUES ('duplicate-game', ?, ?, 1, 1)`).run(plan.id, gameId), /UNIQUE/);
  assert.throws(() => sqlite.prepare(`INSERT INTO user_titles VALUES (?, 'other-title', ?)`).run(ids.patient, monday), /CHECK/);
  sqlite.prepare('UPDATE training_plans SET created_by_user_id = ? WHERE id = ?').run(ids.therapist, plan.id);
  sqlite.prepare('DELETE FROM app_users WHERE id = ?').run(ids.therapist);
  assert.equal(sqlite.prepare('SELECT created_by_user_id FROM training_plans WHERE id = ?').get(plan.id).created_by_user_id, null);
  sqlite.prepare('DELETE FROM app_users WHERE id = ?').run(ids.patient);
  assert.equal(Count(fixture, 'training_plans'), 0);
  assert.equal(Count(fixture, 'training_plan_items'), 0);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
});

test('disabled session hook ignores plan fields without changing official launch behavior', async t => {
  const fixture = CreateFixture(t);
  delete fixture.env.TRAINING_PLANS_ENABLED;
  assert.equal((await Launch(fixture, 'ignored')).status, 201);
});

for (const flag of [undefined, '0', 'true', 1]) {
  test(`disabled flag ${String(flag)} hides all plan routes and ignores session/record plan fields`, async t => {
    const fixture = CreateFixture(t);
    fixture.env.TRAINING_PLANS_ENABLED = flag;
    for (const response of [await StaffCall(fixture), await StaffCall(fixture, PlanInput(fixture)),
      await PlayerCall(fixture), await ArchiveCall(fixture, 'anything')]) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Training plans are not enabled.' });
    }
    const response = await Launch(fixture, { ignored: true });
    assert.equal(response.status, 201);
    const session = await response.json();
    assert.equal(Object.hasOwn(session, 'planSettings'), false);
    assert.equal(Object.hasOwn(await VerifySignedValue(session.token, fixture.env.AUTH_SESSION_SECRET), 'planItemId'), false);
    const claims = await VerifySignedValue(session.token, fixture.env.AUTH_SESSION_SECRET);
    session.token = await CreateSignedValue({ ...claims, planItemId: 'ignored' }, fixture.env.AUTH_SESSION_SECRET, 86400);
    assert.equal((await Save(fixture, session, { ignored: true })).status, 201);
    assert.equal(Count(fixture, 'training_plan_completions'), 0);
  });
}

for (const [actor, patient, status] of [['admin', 'patient', 200], ['admin', 'other', 200],
  ['therapist', 'patient', 200], ['therapist', 'other', 403], ['patient', 'patient', 403], [null, 'patient', 401]]) {
  test(`staff authorization: ${actor} accessing ${patient}`, async t => {
    const fixture = CreateFixture(t);
    assert.equal((await StaffCall(fixture, undefined, actor, fixture.ids[patient])).status, status);
    const created = await StaffCall(fixture, PlanInput(fixture, { patientId: fixture.ids[patient] }), actor);
    assert.equal(created.status, status === 200 ? 201 : status);
    if (created.status === 201) {
      const { plan } = await created.json();
      assert.equal((await ArchiveCall(fixture, plan.id, actor)).status, 200);
    } else {
      const plan = await CreatePlan(fixture, { patientId: fixture.ids[patient] });
      assert.equal((await ArchiveCall(fixture, plan.id, actor)).status, status);
    }
  });
}

test('staff endpoints reject cross-origin cookies, staff targets and unknown patients', async t => {
  const fixture = CreateFixture(t);
  assert.ok([401, 403].includes((await StaffCall(fixture, PlanInput(fixture), 'admin', fixture.ids.patient, 'https://elsewhere.invalid')).status));
  for (const patientId of [fixture.ids.admin, 'missing']) {
    assert.equal((await StaffCall(fixture, undefined, 'admin', patientId)).status, 404);
    assert.equal((await StaffCall(fixture, PlanInput(fixture, { patientId }))).status, 404);
  }
});

test('staff routes use the same origin gate as other admin APIs and write nothing cross-site', async t => {
  const fixture = CreateFixture(t);
  const plan = await CreatePlan(fixture);
  const foreign = 'https://elsewhere.invalid';
  assert.equal((await StaffCall(fixture, undefined, 'admin', fixture.ids.patient, foreign)).status, 403);
  assert.equal((await StaffCall(fixture, PlanInput(fixture, { title: 'cross-site' }), 'admin', fixture.ids.patient, foreign)).status, 403);
  const { onRequestPost } = await import('./admin/training-plans/[planId]/archive.js');
  const archive = await onRequestPost({ request: await RequestFor(fixture, `admin/training-plans/${plan.id}/archive`, {}, 'admin', true, foreign),
    env: fixture.env, params: { planId: plan.id } });
  assert.equal(archive.status, 403);
  assert.deepEqual(fixture.sqlite.prepare('SELECT title, status FROM training_plans').all().map(row => ({ ...row })),
    [{ title: '本週練習', status: 'active' }]);
});

const invalidPlans = [
  ['unknown game', { items: [{ gameId: 'untrusted', weeklyTarget: 1, settings: null }] }],
  ['zero items', { items: [] }],
  ['13 items', { items: Object.keys(officialGameReleases).slice(0, 13).map(gameId => ({ gameId, weeklyTarget: 1, settings: null })) }],
  ['duplicate games', { items: [1, 2].map(() => ({ gameId, weeklyTarget: 1, settings: null })) }],
  ['target zero', { items: [{ gameId, weeklyTarget: 0, settings: null }] }],
  ['target 15', { items: [{ gameId, weeklyTarget: 15, settings: null }] }],
  ['fractional target', { items: [{ gameId, weeklyTarget: 1.5, settings: null }] }],
  ['long title', { title: 'x'.repeat(61) }], ['empty title', { title: '   ' }],
  ['long note', { note: 'x'.repeat(301) }], ['non-string note', { note: false }],
];
for (const settings of [{ userToken: 'secret' }, { 'bad.key': 1 }, { _private: 1 }, { difficulty: { nested: 1 } },
  { difficulty: [] }, { difficulty: null }, { difficulty: '' }, { difficulty: 'x'.repeat(81) },
  { difficulty: 'line\nbreak' }, { difficulty: 1e10 }, Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`field${i}`, i]))]) {
  invalidPlans.push([`invalid settings ${JSON.stringify(settings).slice(0, 35)}`, { items: [{ gameId, weeklyTarget: 1, settings }] }]);
}
for (const [label, overrides] of invalidPlans) {
  test(`plan validation: ${label}`, async t => {
    const fixture = CreateFixture(t);
    assert.equal((await StaffCall(fixture, PlanInput(fixture, overrides))).status, 400);
    assert.equal(Count(fixture, 'training_plans'), 0);
    assert.equal(Count(fixture, 'admin_audit_events'), 0);
  });
}

test('accepts 12 distinct games and target limits, archives previous list and writes audit atomically', async t => {
  const fixture = CreateFixture(t);
  t.mock.method(console, 'error', () => {});
  const first = await CreatePlan(fixture);
  const second = await CreatePlan(fixture, { note: undefined, items: Object.keys(officialGameReleases).slice(0, 12)
    .map((gameId, index) => ({ gameId, weeklyTarget: index === 0 ? 14 : 1, settings: null })) });
  assert.equal(second.items.length, 12);
  assert.equal(second.note, '');
  assert.equal(fixture.sqlite.prepare('SELECT status FROM training_plans WHERE id = ?').get(first.id).status, 'archived');
  assert.equal(Count(fixture, 'admin_audit_events'), 2);
  fixture.sqlite.exec("CREATE TRIGGER fail_plan_audit BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT, 'audit failed'); END");
  assert.equal((await StaffCall(fixture, PlanInput(fixture))).status, 500);
  assert.equal(Count(fixture, 'training_plans'), 2);
  assert.equal(fixture.sqlite.prepare("SELECT id FROM training_plans WHERE status = 'active'").get().id, second.id);
  assert.equal((await ArchiveCall(fixture, second.id)).status, 500);
  assert.equal(fixture.sqlite.prepare("SELECT id FROM training_plans WHERE status = 'active'").get().id, second.id);
});

test('accepts the maximum bounded settings on all twelve items', async t => {
  const fixture = CreateFixture(t);
  const settings = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`field${index}${'x'.repeat(55)}`, '字'.repeat(80)]));
  const plan = await CreatePlan(fixture, { items: Object.keys(officialGameReleases).slice(0, 12)
    .map(gameId => ({ gameId, weeklyTarget: 14, settings })) });
  assert.equal(plan.items.length, 12);
  assert.deepEqual(plan.items[11].settings, settings);
});

test('concurrent list replacement leaves one active list and complete audit events', async t => {
  const fixture = CreateFixture(t);
  const responses = await Promise.all(['First list', 'Second list'].map(title => StaffCall(fixture, PlanInput(fixture, { title }))));
  assert.deepEqual(responses.map(response => response.status), [201, 201]);
  assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS count FROM training_plans WHERE status = 'active'").get().count, 1);
  assert.equal(Count(fixture, 'training_plan_items'), 2);
  assert.equal(Count(fixture, 'admin_audit_events'), 2);
});

test('archive is scoped, audits once and returns an empty current list', async t => {
  const fixture = CreateFixture(t);
  const plan = await CreatePlan(fixture);
  assert.equal((await ArchiveCall(fixture, 'missing')).status, 404);
  assert.equal((await ArchiveCall(fixture, plan.id)).status, 200);
  assert.equal((await ArchiveCall(fixture, plan.id)).status, 404);
  assert.equal(Count(fixture, 'admin_audit_events'), 2);
  assert.deepEqual(await (await PlayerCall(fixture)).json(), { plan: null });
});

test('plan launch is bound to authenticated player, game and active item; plain launch stays unchanged', async t => {
  const fixture = CreateFixture(t);
  const plan = await CreatePlan(fixture);
  for (const [itemId, actor, selectedGame] of [[plan.items[0].id, 'other', gameId], [plan.items[0].id, 'patient', otherGameId],
    [plan.items[0].id, null, gameId], ['missing', 'patient', gameId], [null, 'patient', gameId]]) {
    assert.equal((await Launch(fixture, itemId, actor, selectedGame)).status, 400);
  }
  const response = await Launch(fixture, plan.items[0].id);
  assert.equal(response.status, 201);
  const session = await response.json();
  assert.deepEqual(session.planSettings, plan.items[0].settings);
  assert.equal((await VerifySignedValue(session.token, fixture.env.AUTH_SESSION_SECRET)).planItemId, plan.items[0].id);
  const plain = await (await Launch(fixture)).json();
  assert.equal(Object.hasOwn(plain, 'planSettings'), false);
  await ArchiveCall(fixture, plan.id);
  assert.equal((await Launch(fixture, plan.items[0].id)).status, 400);
  const nullPlan = await CreatePlan(fixture, { items: [{ gameId, weeklyTarget: 1, settings: null }] });
  assert.equal((await (await Launch(fixture, nullPlan.items[0].id)).json()).planSettings, null);
});

test('completions require true, are counted once and retries cannot upgrade unassigned results', async t => {
  const fixture = CreateFixture(t);
  const plan = await CreatePlan(fixture, { items: [{ gameId, weeklyTarget: 2, settings: null }] });
  for (const followed of [false, undefined]) {
    const session = await (await Launch(fixture, plan.items[0].id)).json();
    assert.equal((await Save(fixture, session, followed)).status, 201);
    assert.equal((await Save(fixture, session, true)).status, 200);
  }
  assert.equal(Count(fixture, 'training_plan_completions'), 0);
  const unassigned = await (await Launch(fixture)).json();
  assert.equal((await Save(fixture, unassigned, true)).status, 201);
  assert.equal(Count(fixture, 'training_plan_completions'), 0);
  const session = await Complete(fixture, plan.items[0]);
  const retry = await Save(fixture, session, true);
  assert.deepEqual(await retry.json(), { ok: true, recordId: session.recordId, duplicate: true });
  assert.equal(Count(fixture, 'training_plan_completions'), 1);
  assert.equal(Count(fixture, 'training_plan_weeks'), 0);
  await Complete(fixture, plan.items[0]);
  assert.equal(Count(fixture, 'training_plan_completions'), 2);
  assert.equal(Count(fixture, 'training_plan_weeks'), 1);
  const invalid = await (await Launch(fixture, plan.items[0].id)).json();
  assert.equal((await Save(fixture, invalid, 'true')).status, 400);
});

test('archived lists, foreign or mismatched signed item claims never earn completions', async t => {
  const fixture = CreateFixture(t);
  const plan = await CreatePlan(fixture);
  const session = await (await Launch(fixture, plan.items[0].id)).json();
  await CreatePlan(fixture);
  assert.equal((await Save(fixture, session, true)).status, 201);
  const foreign = await CreatePlan(fixture, { patientId: fixture.ids.other });
  const mismatch = await CreatePlan(fixture, { items: [{ gameId: otherGameId, weeklyTarget: 1, settings: null }] });
  for (const item of [foreign.items[0], mismatch.items[0]]) {
    const session = await (await Launch(fixture)).json();
    const claims = await VerifySignedValue(session.token, fixture.env.AUTH_SESSION_SECRET);
    session.token = await CreateSignedValue({ ...claims, planItemId: item.id }, fixture.env.AUTH_SESSION_SECRET, 86400);
    assert.equal((await Save(fixture, session, true)).status, 201);
  }
  assert.equal(Count(fixture, 'training_plan_completions'), 0);
});

for (const [timeZone, sunday, mondayInstant] of [
  [undefined, '2026-11-01T15:59:00Z', '2026-11-01T16:00:00Z'],
  ['Pacific/Pago_Pago', '2026-11-02T10:59:00Z', '2026-11-02T11:00:00Z'],
]) {
  test(`week boundary uses session issue date and configured zone ${timeZone ?? 'default Taipei'}`, async t => {
    const fixture = CreateFixture(t, sunday);
    if (timeZone) fixture.env.REHAB_TIME_ZONE = timeZone;
    const plan = await CreatePlan(fixture);
    const sundaySession = await (await Launch(fixture, plan.items[0].id)).json();
    t.mock.timers.setTime(new Date(mondayInstant).getTime());
    assert.equal((await Save(fixture, sundaySession, true)).status, 201);
    await Complete(fixture, plan.items[0]);
    const rows = fixture.sqlite.prepare(`SELECT c.week_start, r.verified_training_date FROM training_plan_completions c
      JOIN training_records r ON r.id = c.record_id ORDER BY c.week_start`).all();
    assert.deepEqual(rows.map(row => [row.week_start, row.verified_training_date]), [
      ['2026-10-26', '2026-11-01'], ['2026-11-02', '2026-11-02'],
    ]);
    const { plan: current } = await (await PlayerCall(fixture)).json();
    assert.deepEqual(current.week, { start: '2026-11-02', end: '2026-11-08', achieved: true });
    assert.equal(current.currentStreak, 2);
  });
}

test('every item must reach its target and progress GET exposes only the caller list and display name', async t => {
  const fixture = CreateFixture(t);
  const plan = await CreatePlan(fixture, { items: [{ gameId, weeklyTarget: 1, settings: null },
    { gameId: otherGameId, weeklyTarget: 2, settings: {} }] });
  await Complete(fixture, plan.items[0]);
  assert.equal(Count(fixture, 'training_plan_weeks'), 0);
  const response = await PlayerCall(fixture, 'patient', `?patientId=${fixture.ids.other}`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.plan.assignedBy, 'Staff name');
  assert.deepEqual(data.plan.items.map(item => item.completedThisWeek), [1, 0]);
  assert.equal(data.plan.week.achieved, false);
  assert.equal(data.plan.achievedWeeks, 0);
  assert.equal(data.plan.currentStreak, 0);
  assert.equal(data.plan.weeksToTitle, 6);
  assert.deepEqual(data.plan.titles, []);
  assert.equal(JSON.stringify(data).includes('@private.invalid'), false);
  assert.equal(JSON.stringify(data).includes(fixture.ids.admin), false);
  assert.equal(JSON.stringify(data).includes(fixture.ids.patient), false);
  assert.deepEqual(await (await PlayerCall(fixture, 'other')).json(), { plan: null });
  assert.equal((await PlayerCall(fixture, null)).status, 401);
  const firstOtherSession = await (await Launch(fixture, plan.items[1].id, 'patient', otherGameId)).json();
  assert.equal((await Save(fixture, firstOtherSession, true)).status, 201);
  assert.equal(Count(fixture, 'training_plan_weeks'), 0);
  const secondOtherSession = await (await Launch(fixture, plan.items[1].id, 'patient', otherGameId)).json();
  assert.equal((await Save(fixture, secondOtherSession, true)).status, 201);
  assert.equal(Count(fixture, 'training_plan_weeks'), 1);
  const staff = await (await StaffCall(fixture)).json();
  assert.equal(staff.plan.week.achieved, true);
  assert.equal(staff.plan.achievedWeeks, 1);
});

for (const weeks of [[0, 1, 2, 3, 4, 5], [0, 1, 2, 4, 5, 6]]) {
  test(`six-week title requires consecutive achieved weeks: ${weeks.join(',')}`, async t => {
    const fixture = CreateFixture(t);
    let plan = await CreatePlan(fixture);
    for (const [index, week] of weeks.entries()) {
      t.mock.timers.setTime(new Date(monday).getTime() + week * 7 * 86400000);
      if (index === 3) plan = await CreatePlan(fixture);
      await Complete(fixture, plan.items[0]);
      assert.equal(Count(fixture, 'user_titles'), index === 5 && weeks[3] === 3 ? 1 : 0);
    }
    const { plan: current } = await (await PlayerCall(fixture)).json();
    assert.equal(current.achievedWeeks, 6);
    assert.equal(current.currentStreak, weeks[3] === 3 ? 6 : 3);
    assert.equal(current.weeksToTitle, weeks[3] === 3 ? 0 : 3);
    if (current.titles.length) {
      assert.equal(current.titles[0].id, 'six-week-streak');
      const awardedAt = current.titles[0].awardedAt;
      await Complete(fixture, plan.items[0]);
      assert.equal(Count(fixture, 'user_titles'), 1);
      assert.equal((await (await PlayerCall(fixture)).json()).plan.titles[0].awardedAt, awardedAt);
    }
    t.mock.timers.setTime(new Date(monday).getTime() + (weeks.at(-1) + 1) * 7 * 86400000);
    assert.equal((await (await PlayerCall(fixture)).json()).plan.currentStreak, current.currentStreak);
    t.mock.timers.setTime(new Date(monday).getTime() + (weeks.at(-1) + 2) * 7 * 86400000);
    assert.equal((await (await PlayerCall(fixture)).json()).plan.currentStreak, 0);
  });
}

test('staff history is limited to the last ten archived lists in date order', async t => {
  const fixture = CreateFixture(t);
  for (let index = 0; index < 12; index++) {
    t.mock.timers.setTime(new Date(monday).getTime() + index * 1000);
    await CreatePlan(fixture, { title: `List ${index}` });
  }
  const data = await (await StaffCall(fixture)).json();
  assert.equal(data.archivedPlans.length, 10);
  assert.equal(data.archivedPlans[0].title, 'List 10');
  assert.equal(data.archivedPlans.at(-1).title, 'List 1');
  assert.deepEqual(Object.keys(data.archivedPlans[0]).sort(), ['archivedAt', 'createdAt', 'id', 'title']);
});

test('bookkeeping failure preserves the saved training record and raw CSV', async t => {
  const fixture = CreateFixture(t);
  const plan = await CreatePlan(fixture);
  const session = await (await Launch(fixture, plan.items[0].id)).json();
  fixture.sqlite.exec("CREATE TRIGGER fail_completion BEFORE INSERT ON training_plan_completions BEGIN SELECT RAISE(ABORT, 'bookkeeping failed'); END");
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  assert.equal((await Save(fixture, session, true)).status, 201);
  assert.equal(Count(fixture, 'training_records'), 1);
  assert.equal([...fixture.env.RAW_DATA.objects.keys()].filter(key => key.startsWith('pending/rounds/')).length, 1);
  assert.equal(Count(fixture, 'training_plan_completions'), 0);
  assert.ok(errors.some(args => String(args[0]).includes('training plan')));
  assert.equal((await Save(fixture, session, true)).status, 200);
});
