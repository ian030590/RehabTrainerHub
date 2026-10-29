import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { CreateRuntimeStorageNamespace } from './runtimeNamespace.ts';

const storageKey = 'rehabtrainerhub.subject-id.v1';

test('reuses a valid browser subject identifier without exposing it through UI state', async () => {
  const existing = '550e8400-e29b-41d4-a716-446655440000';
  const storage = CreateStorage([[storageKey, existing]]);
  SetWindow(storage);
  const { GetOrCreateSubjectId } = await FreshSubjectModule();

  assert.equal(GetOrCreateSubjectId(), existing);
  assert.equal(GetOrCreateSubjectId(), existing);
  assert.deepEqual([...storage.values.entries()], [[storageKey, existing]]);
});

test('replaces a malformed stored value with a cryptographically random UUID v4', async () => {
  const storage = CreateStorage([[storageKey, 'sequential-or-user-controlled']]);
  SetWindow(storage);
  const { GetOrCreateSubjectId, IsSubjectId } = await FreshSubjectModule();

  const subjectId = GetOrCreateSubjectId();
  assert.equal(IsSubjectId(subjectId), true);
  assert.equal(storage.values.get(storageKey), subjectId);
});

test('keeps a stable in-memory UUID when localStorage is unavailable', async () => {
  SetWindow({
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  });
  const { GetOrCreateSubjectId, IsSubjectId } = await FreshSubjectModule();

  const first = GetOrCreateSubjectId();
  assert.equal(IsSubjectId(first), true);
  assert.equal(GetOrCreateSubjectId(), first);
});

test('uses a separate stable UUID namespace for authenticated records', async () => {
  const guest = '550e8400-e29b-41d4-a716-446655440000';
  const storage = CreateStorage([[storageKey, guest]]);
  SetWindow(storage);
  const {
    GetOrCreateAuthenticatedSubjectId,
    GetOrCreateSubjectId,
    IsSubjectId,
  } = await FreshSubjectModule();

  const authenticated = GetOrCreateAuthenticatedSubjectId('account-1');
  assert.equal(IsSubjectId(authenticated), true);
  assert.notEqual(authenticated, GetOrCreateSubjectId());
  assert.equal(GetOrCreateAuthenticatedSubjectId('account-1'), authenticated);
  assert.notEqual(GetOrCreateAuthenticatedSubjectId('account-2'), authenticated);
  assert.equal(storage.values.get('rehabtrainerhub.auth-subject-id.v1.account-1'), authenticated);
});

test('keeps the guest ID across reloads and server account assignment on two devices', async () => {
  const accountSubjectId = crypto.randomUUID();
  const firstStorage = CreateStorage();
  SetWindow(firstStorage);
  const first = await FreshSubjectModule();
  const guestId = first.GetOrCreateSubjectId();
  first.GetOrCreateAuthenticatedSubjectId('account/1');
  first.SetAccountSubjectId('account/1', accountSubjectId);
  assert.equal(first.GetOrCreateAuthenticatedSubjectId('account/1'), accountSubjectId);
  assert.equal(firstStorage.getItem('rehabtrainerhub.auth-subject-id.v1.account%2F1'), accountSubjectId);
  assert.equal(first.GetOrCreateSubjectId(), guestId);
  const reloaded = await FreshSubjectModule();
  assert.equal(reloaded.GetOrCreateSubjectId(), guestId);
  assert.equal(reloaded.GetOrCreateAuthenticatedSubjectId('account/1'), accountSubjectId);

  SetWindow(CreateStorage());
  const second = await FreshSubjectModule();
  assert.notEqual(second.GetOrCreateAuthenticatedSubjectId('account/1'), accountSubjectId);
  second.SetAccountSubjectId('account/1', accountSubjectId);
  assert.equal(second.GetOrCreateAuthenticatedSubjectId('account/1'), accountSubjectId);
});

test('rejects invalid account assignments without changing either stored identity', async () => {
  const storage = CreateStorage();
  SetWindow(storage);
  const subject = await FreshSubjectModule();
  assert.equal(typeof subject.SetAccountSubjectId, 'function');
  const guestId = subject.GetOrCreateSubjectId();
  const accountId = subject.GetOrCreateAuthenticatedSubjectId('account-1');
  for (const invalid of ['', 'user-id', null, 123, crypto.randomUUID().toUpperCase()]) {
    assert.throws(() => subject.SetAccountSubjectId('account-1', invalid));
  }
  assert.throws(() => subject.SetAccountSubjectId('  ', crypto.randomUUID()));
  assert.equal(subject.GetOrCreateSubjectId(), guestId);
  assert.equal(subject.GetOrCreateAuthenticatedSubjectId('account-1'), accountId);
});

test('keeps server account IDs in memory when storage is blocked and clears them on logout', async () => {
  SetWindow({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  const subject = await FreshSubjectModule();
  const guestId = subject.GetOrCreateSubjectId();
  const accountId = crypto.randomUUID();
  subject.SetAccountSubjectId('account-1', accountId);
  assert.equal(subject.GetOrCreateAuthenticatedSubjectId('account-1'), accountId);
  subject.ClearAccountSubjectIds();
  assert.notEqual(subject.GetOrCreateAuthenticatedSubjectId('account-1'), accountId);
  assert.equal(subject.GetOrCreateSubjectId(), guestId);
});

test('uses the server account ID when reads work but overwriting an old device ID is blocked', async () => {
  const storage = CreateStorage([['rehabtrainerhub.auth-subject-id.v1.account-1', crypto.randomUUID()]]);
  storage.setItem = () => { throw new Error('quota'); };
  SetWindow(storage);
  const subject = await FreshSubjectModule();
  const accountSubject = crypto.randomUUID();
  subject.SetAccountSubjectId('account-1', accountSubject);
  assert.equal(subject.GetOrCreateAuthenticatedSubjectId('account-1'), accountSubject);
});

test('auth responses cache the server account subject and logout keeps only the guest identity', async (context) => {
  const storage = CreateStorage([['rehabtrainerhub.auth.token', 'test-token']]);
  SetWindow(storage);
  window.dispatchEvent = () => {};
  const subject = await FreshSubjectModule();
  const guestId = subject.GetOrCreateSubjectId();
  const source = await readFile(new URL('../auth/authClient.ts', import.meta.url), 'utf8');
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)((path) => {
    if (path.endsWith('/subjectId')) return subject;
    if (path.endsWith('/runtimeNamespace')) return { CreateRuntimeStorageNamespace };
    return {};
  }, module, module.exports);
  const auth = module.exports;
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let user;
  for (const receive of [
    () => auth.FetchCurrentAuthUser(),
    () => auth.FetchSharedAuthSession(),
    () => auth.LoginPasswordAccount(undefined, {}),
    () => auth.SaveAuthProfile(undefined, {}),
    () => auth.RegisterPasswordAccount(undefined, {}),
    () => auth.SetAuthToken('test-token', false, user),
  ]) {
    const subjectId = crypto.randomUUID();
    user = { id: 'account-1', subjectId };
    globalThis.fetch = async () => Response.json({ token: 'test-token', user });
    await receive();
    assert.equal(subject.GetOrCreateAuthenticatedSubjectId(user.id), subjectId);
    assert.equal(subject.GetOrCreateSubjectId(), guestId);
  }
  await auth.ClearLocalTrainerData();
  assert.equal(storage.getItem('rehabtrainerhub.auth-subject-id.v1.account-1'), null);
  assert.notEqual(subject.GetOrCreateAuthenticatedSubjectId(user.id), user.subjectId);
  assert.equal(subject.GetOrCreateSubjectId(), guestId);
});

test('package sessions cache the server subject and use it for the result save', async (context) => {
  SetWindow(CreateStorage());
  const subject = await FreshSubjectModule();
  const source = await readFile(new URL('../../../../apps/rehabtrainerhub/app/train/PackageGameOverlay.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('PackageGameOverlay.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    && ['CreateGameRunSession', 'IsGameRunSessionResponse', 'SaveGameResult'].includes(node.name?.text));
  const code = ts.transpileModule(functions.map(node => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let token = 'account-token';
  const globals = {
    BuildApiUrl: (_, path) => `https://trainerhub.cc${path}`,
    GetAuthToken: () => token,
    GetAuthUserIdFromToken: () => 'account-1',
    CreateRemoteTrainingRecordVerificationToken: async () => undefined,
    ...subject,
  };
  const overlay = new Function(...Object.keys(globals), `${code}\nreturn { CreateGameRunSession, SaveGameResult };`)(...Object.values(globals));
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const subjectId = crypto.randomUUID();
  const response = { subjectId, runSession: { token: 'a'.repeat(64), expiresAt: '2026-12-01T00:00:00.000Z' } };
  globalThis.fetch = async () => Response.json(response);
  const session = await overlay.CreateGameRunSession('release-test', 'client-run');
  assert.equal(session.subjectId, subjectId);
  assert.equal(subject.GetOrCreateAuthenticatedSubjectId('account-1'), subjectId);
  let savedBody;
  globalThis.fetch = async (_, options) => { savedBody = JSON.parse(options.body); return Response.json({ ok: true }); };
  await overlay.SaveGameResult('release-test', 'client-run', session, { status: 'completed' });
  assert.equal(savedBody.subjectId, subjectId);
  assert.equal(savedBody.runSessionToken, response.runSession.token);
  globalThis.fetch = async () => { token = 'another-account'; return Response.json(response); };
  await assert.rejects(() => overlay.CreateGameRunSession('release-test', 'client-run'));
});

function CreateStorage(entries = []) {
  const values = new Map(entries);
  return {
    values,
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function SetWindow(localStorage) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
  });
}

function FreshSubjectModule() {
  return import(`./subjectId.ts?test=${crypto.randomUUID()}`);
}
