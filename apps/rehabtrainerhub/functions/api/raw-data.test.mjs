import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSessionForUser, CreateSignedValue, GetSessionSecret } from '../_lib/auth.js';
import { CreateRawDataEnvironment } from '../_lib/rawDataTestFixtures.mjs';
import { rawCoordinateColumns } from '../../../../packages/ui/src/rawCoordinateRecorder.js';
import { onRequestPost } from './raw-data.js';

function Csv(kind) {
  return rawCoordinateColumns[kind].join(',') + '\n' + rawCoordinateColumns[kind].map((_, index) => index === 0 ? '0' : '1').join(',') + '\n';
}

let ip = 0;
function Post(env, session, options = {}) {
  const kind = options.kind ?? 'hand';
  return onRequestPost({ env, request: new Request('https://trainerhub.cc/api/raw-data', {
    method: 'POST', headers: { Origin: options.origin ?? 'https://trainerhub.cc', 'Content-Type': options.contentType ?? 'text/csv',
      'CF-Connecting-IP': options.ip ?? `192.0.2.${++ip}`,
      'X-Raw-Data': JSON.stringify({ kind, gameId: session.gameId, officialGameVersion: session.version,
        recordId: session.recordId, subjectId: session.subjectId, runSessionToken: session.token, truncated: false, ...options.metadata }),
      ...(options.auth ? { Authorization: `Bearer ${options.auth}` } : {}), ...options.headers },
    body: options.csv ?? Csv(kind in rawCoordinateColumns ? kind : 'head'),
  }) });
}

for (const [kind, gameId, capability] of [['hand', 'motor-cortex-rehab', 'hand-tracking'], ['pose', 'every-ball-response', 'pose-tracking'],
  ['tongue', 'tongue-catch', 'tongue-tracking'], ['head', 'seagull-flight', 'head-tracking']]) {
  test(`${kind}: reviewed official session stores immutable numeric CSV with pseudonymous metadata`, async () => {
    const fixture = CreateRawDataEnvironment(gameId, [capability]);
    try {
      const session = await fixture.session();
      const response = await Post(fixture.env, session, { kind });
      assert.equal(response.status, 201);
      const file = await response.json();
      assert.equal(file.kind, kind);
      assert.equal(file.rows, 1);
      assert.match(file.sha256, /^[0-9a-f]{64}$/);
      const object = fixture.env.RAW_DATA.objects.get(file.key);
      assert.equal(object.text, Csv(kind));
      assert.equal(object.customMetadata.subjectId, session.subjectId);
      assert.equal(object.customMetadata.kind, kind);
      assert.equal(object.customMetadata.recordId, session.recordId);
      assert.equal(object.customMetadata.version, session.version);
      assert.equal(object.customMetadata.rows, '1');
      assert.equal(object.customMetadata.truncated, 'false');
      assert.deepEqual(object.options.onlyIf, { etagDoesNotMatch: '*' });
      assert.match(file.key, new RegExp(`^pending/${kind}/${gameId}/${session.subjectId}/\\d{4}-\\d{2}-\\d{2}/${session.recordId}\\.csv$`));
      assert.equal((await Post(fixture.env, session, { kind })).status, 201);
      assert.equal((await Post(fixture.env, session, { kind, csv: Csv(kind).replace('\n0,1', '\n0,2') })).status, 409);
      assert.equal(fixture.env.RAW_DATA.objects.get(file.key).text, Csv(kind));
    } finally { fixture.sqlite.close(); }
  });
}

test('rejects wrong kind, origin, token, account, CSV text, header, shape, oversize and missing capability', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const session = await fixture.session();
    for (const options of [
      { kind: 'mouse' }, { metadata: { kind: ['hand'] } }, { metadata: { runSessionToken: 'foreign' } }, { metadata: { recordId: crypto.randomUUID() } },
      { metadata: { subjectId: crypto.randomUUID() } }, { metadata: { gameId: 'drawing-defense' } },
      { csv: 't_ms,private\n0,1\n' }, { csv: Csv('hand').replace('\n0,', '\nhello,') },
      { csv: Csv('hand').replace('\n0,', '\nInfinity,') }, { csv: Csv('hand').replace('\n0,', '\n=cmd,') },
      { csv: Csv('hand').replace('\n0,', '\n0x10,') }, { csv: Csv('hand') + '1,2\n' },
      { contentType: 'application/json' }, { metadata: { truncated: 'true' } },
    ]) assert.equal((await Post(fixture.env, session, options)).status, 400, JSON.stringify(options));
    assert.equal((await Post(fixture.env, session, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await Post(fixture.env, session, { auth: 'forged' })).status, 401);
    assert.equal((await Post(fixture.env, session, { headers: { 'Content-Length': String(25 * 1024 * 1024 + 1) } })).status, 413);
    assert.equal((await Post(fixture.env, session, { csv: '0'.repeat(25 * 1024 * 1024 + 1) })).status, 413);
    const foreignToken = await CreateSignedValue({ ...session, purpose: 'game-run' }, GetSessionSecret(fixture.env), 3600);
    assert.equal((await Post(fixture.env, session, { metadata: { runSessionToken: foreignToken } })).status, 400);
    fixture.release.capabilities = [];
    assert.equal((await Post(fixture.env, session)).status, 400);
    assert.equal(fixture.env.RAW_DATA.objects.size, 0);
  } finally { fixture.sqlite.close(); }
});

test('account uploads resolve the account subject, reject other accounts and never use account IDs in keys', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const subjectId = crypto.randomUUID();
    fixture.sqlite.prepare('INSERT INTO app_users(id,display_name,subject_id,created_at,updated_at) VALUES(?,?,?,?,?)')
      .run('account', 'Fixture', subjectId, '', '');
    fixture.sqlite.prepare('INSERT INTO app_users(id,display_name,subject_id,created_at,updated_at) VALUES(?,?,?,?,?)')
      .run('other', 'Fixture', crypto.randomUUID(), '', '');
    const session = await fixture.session('account', subjectId);
    const auth = await CreateSessionForUser(fixture.env, { id: 'account' });
    const other = await CreateSessionForUser(fixture.env, { id: 'other' });
    assert.equal((await Post(fixture.env, session)).status, 400);
    assert.equal((await Post(fixture.env, session, { auth: other })).status, 400);
    const response = await Post(fixture.env, session, { auth, metadata: { subjectId: crypto.randomUUID() } });
    assert.equal(response.status, 201);
    assert.ok((await response.json()).key.includes(`/${subjectId}/`));
    assert.doesNotMatch([...fixture.env.RAW_DATA.objects.keys()].join(''), /account/);
  } finally { fixture.sqlite.close(); }
});

test('storage and release outages are retryable and guest disabling applies', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const session = await fixture.session();
    fixture.env.ANONYMOUS_RECORDS_ENABLED = '0';
    assert.equal((await Post(fixture.env, session)).status, 503);
    fixture.env.ANONYMOUS_RECORDS_ENABLED = '1';
    const bucket = fixture.env.RAW_DATA;
    delete fixture.env.RAW_DATA;
    assert.equal((await Post(fixture.env, session)).status, 503);
    fixture.env.RAW_DATA = bucket;
    fixture.env.RAW_DATA.put = async () => { throw new Error('offline'); };
    assert.equal((await Post(fixture.env, session)).status, 503);
    fixture.env.GAME_RELEASE_BUCKET.get = async () => { throw new Error('offline'); };
    assert.equal((await Post(fixture.env, session)).status, 503);
  } finally { fixture.sqlite.close(); }
});

test('per-subject rate limits and configured human verification reject before storage', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const session = await fixture.session();
    fixture.env.TURNSTILE_RECORDS_REQUIRED = '1';
    assert.equal((await Post(fixture.env, session)).status, 503);
    fixture.env.TURNSTILE_RECORDS_REQUIRED = '0';
    for (let index = 0; index < 24; index++) assert.equal((await Post(fixture.env, session)).status, 201);
    assert.equal((await Post(fixture.env, session)).status, 429);
  } finally { fixture.sqlite.close(); }
});

test('a still-valid session cannot replace archived coordinates with different bytes', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const session = await fixture.session();
    const response = await Post(fixture.env, session);
    assert.equal(response.status, 201);
    const file = await response.json();
    fixture.env.RAW_DATA.objects.delete(file.key);
    assert.equal((await Post(fixture.env, session, { csv: Csv('hand').replace('\n0,1', '\n0,2') })).status, 409);
    assert.equal(fixture.env.RAW_DATA.objects.has(file.key), false);
    assert.equal((await Post(fixture.env, session)).status, 201);
  } finally { fixture.sqlite.close(); }
});
