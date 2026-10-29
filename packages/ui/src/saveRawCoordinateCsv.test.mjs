import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import test from 'node:test';

function LoadUploader(fetchImpl, auth) {
  const source = readFileSync(new URL('./saveRawCoordinateCsv.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, require: () => auth, fetch: fetchImpl });
  return exports.SaveRawCoordinateCsv;
}

const file = { kind: 'head', csv: 't_ms,yaw,pitch,roll,face_found\n0,1,2,3,1\n', rows: 1, truncated: false };
const session = { recordId: 'record', token: 'signed-session', version: '2.0.0', subjectId: 'subject' };

test('uploads the fixed CSV body and official session before acknowledging success', async () => {
  const calls = [];
  const upload = LoadUploader(async (url, init) => { calls.push({ url, init }); return { ok: true }; }, {
    GetAuthToken: () => 'account-token', CreateRemoteTrainingRecordVerificationToken: async () => 'human-token',
  });
  await upload(file, session, { token: 'account-token', subjectId: 'subject' }, 'seagull-flight');
  assert.equal(calls[0].url, '/api/raw-data');
  assert.equal(calls[0].init.body, file.csv);
  assert.equal(calls[0].init.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer account-token');
  const metadata = JSON.parse(calls[0].init.headers['X-Raw-Data']);
  assert.deepEqual(metadata, { kind: 'head', gameId: 'seagull-flight', officialGameVersion: '2.0.0',
    recordId: 'record', subjectId: 'subject', runSessionToken: 'signed-session', truncated: false, turnstileToken: 'human-token' });
});

test('upload failures and account changes reject so result saving can retry safely', async () => {
  const auth = { GetAuthToken: () => null, CreateRemoteTrainingRecordVerificationToken: async () => undefined };
  const failing = LoadUploader(async () => ({ ok: false, status: 503 }), auth);
  await assert.rejects(() => failing(file, session, { token: null, subjectId: 'subject' }, 'seagull-flight'));
  let uploaded = false;
  const changed = LoadUploader(async () => { uploaded = true; return { ok: true }; }, { ...auth, GetAuthToken: () => 'other' });
  await assert.rejects(() => changed(file, session, { token: null, subjectId: 'subject' }, 'seagull-flight'));
  assert.equal(uploaded, false);
});
