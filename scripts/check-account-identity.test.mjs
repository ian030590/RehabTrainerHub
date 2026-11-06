import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const helperUrl = new URL('../packages/ui/src/auth/identityGuard.ts', import.meta.url);
const adminPath = 'apps/rehabtrainerhub/app/admin/AdminDashboard.tsx';
const progressPath = 'apps/rehabtrainerhub/app/progress/ProgressDashboard.tsx';
const releasePath = 'apps/rehabtrainerhub/app/admin/GameReleaseManager.tsx';
const authPath = 'packages/ui/src/auth/authClient.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

async function IdentityHelper() {
  assert.ok(existsSync(helperUrl), 'Private actions need a shared identity guard.');
  return import(helperUrl.href);
}

function LoadAction(path, name, dependencies) {
  const source = read(path);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function Visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) initializer = node.initializer;
    ts.forEachChild(node, Visit);
  }
  Visit(ast);
  assert.ok(initializer, `${name} must remain testable.`);
  const code = ts.transpileModule(`const action = ${initializer.getText(ast)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${code}\nreturn action;`)(...Object.values(dependencies));
}

function PrivateActionFixture() {
  let token = 'fake-account-a-token';
  const controller = new AbortController();
  const changes = [];
  const dependencies = {
    GetAuthToken: () => token,
    CreateIdentityGuard: (readToken, signal) => {
      const owner = readToken();
      return () => Boolean(owner) && owner === readToken() && !signal?.aborted;
    },
    privateActionsRef: { current: controller },
    filters: {}, gazeCursor: 'fake-cursor', gazeLoading: false,
    DownloadFile: () => changes.push('download'),
    setIsDownloading() {}, setRecordsError() {}, setRecordsNotice() {},
    setGazeBusy() {}, setGazeError() {}, setGazeArchived() {}, setGazeLoading() {},
    setGazeFiles: () => changes.push('files'), setGazeCursor: () => changes.push('cursor'),
    setBusyId() {}, setError() {},
  };
  return {
    dependencies, controller, changes,
    Switch: () => { token = 'fake-account-b-token'; },
    Logout: () => { token = null; },
  };
}

test('identity guard discards switched, logged-out, guest and unmounted private actions', async () => {
  const { CreateIdentityGuard } = await IdentityHelper();
  let token = 'fake-account-a-token';
  const controller = new AbortController();
  const isCurrent = CreateIdentityGuard(() => token, controller.signal);
  assert.equal(isCurrent(), true);
  token = 'fake-account-b-token';
  assert.equal(isCurrent(), false);
  token = null;
  assert.equal(isCurrent(), false);
  const isGuest = CreateIdentityGuard(() => token);
  assert.equal(isGuest(), false);
  token = 'fake-account-a-token';
  controller.abort();
  assert.equal(isCurrent(), false);
});

test('identity epoch preserves guest sign-in and resets only when leaving a known account', async () => {
  const { NextIdentityEpoch } = await IdentityHelper();
  assert.equal(NextIdentityEpoch(0, null, null), 0);
  assert.equal(NextIdentityEpoch(0, null, 'account-a'), 0);
  assert.equal(NextIdentityEpoch(0, 'account-a', 'account-a'), 0);
  assert.equal(NextIdentityEpoch(0, 'account-a', 'account-b'), 1);
  assert.equal(NextIdentityEpoch(1, 'account-b', null), 2);
  assert.equal(NextIdentityEpoch(2, null, 'account-c'), 2);
});

test('admin CSV finishing after account switch is never downloaded', async () => {
  const fixture = PrivateActionFixture();
  const action = LoadAction(adminPath, 'downloadCsv', {
    ...fixture.dependencies,
    FetchAdminRecordsCsv: async () => {
      fixture.Switch();
      return { blob: new Blob(['fake-private-csv']), filename: 'fake.csv' };
    },
  });
  await action();
  assert.equal(fixture.changes.length, 0, 'A late staff CSV must not reach the next account.');
});

test('late gaze pagination never appends the previous account files', async () => {
  const fixture = PrivateActionFixture();
  const action = LoadAction(progressPath, 'loadMoreGazeFiles', {
    ...fixture.dependencies,
    fetch: async () => ({ ok: true, json: async () => {
      fixture.Switch();
      return { records: [{ recordId: 'fake-private-record' }], cursor: 'fake-next' };
    } }),
  });
  await action();
  assert.equal(fixture.changes.length, 0, 'A late gaze page must not update the next account.');
});

for (const interruption of ['account switch', 'unmount']) {
  test(`gaze CSV body finishing after ${interruption} is never downloaded`, async () => {
    const fixture = PrivateActionFixture();
    const action = LoadAction(progressPath, 'downloadGazeCsv', {
      ...fixture.dependencies,
      fetch: async () => ({ ok: true, blob: async () => {
        if (interruption === 'unmount') fixture.controller.abort();
        else fixture.Switch();
        return new Blob(['fake-private-eye-csv']);
      } }),
      URL: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} },
      document: { createElement: () => ({ click: () => fixture.changes.push('download'), remove() {} }), body: { appendChild() {} } },
      window: { setTimeout() {} },
    });
    await action('fake-record');
    assert.equal(fixture.changes.length, 0, 'A late gaze body must not trigger a download.');
  });
}

test('quarantine artifact finishing after logout is never downloaded', async () => {
  const fixture = PrivateActionFixture();
  const action = LoadAction(releasePath, 'downloadArtifact', {
    ...fixture.dependencies,
    DownloadAdminGameReleaseArtifact: async () => {
      fixture.Logout();
      return { blob: new Blob(['fake-private-package']), filename: 'fake.zip' };
    },
  });
  await action({ id: 'fake-release' });
  assert.equal(fixture.changes.length, 0, 'A late quarantine package must not reach the next account.');
});

test('Hub keys route children by the account epoch while retaining pathname transitions', () => {
  const source = read('apps/rehabtrainerhub/app/HubNavigation.tsx');
  assert.ok(/const previousUserId = identityIdRef.current;/.test(source)
    && /NextIdentityEpoch\(epoch, previousUserId, nextUserId\)/.test(source), 'Hub must advance an identity epoch from the previous identity.');
  assert.ok(/key=\{[^}]*identityEpoch[^}]*\}/.test(source), 'Hub route children must remount after leaving a known identity.');
  assert.ok(source.includes('pathname') && /onAuthChange=\{handleAuthChange\}/.test(source));
});

test('Hub also observes identity changes while its account menu is unmounted during training', () => {
  const source = read('apps/rehabtrainerhub/app/HubNavigation.tsx');
  assert.ok(/addEventListener\('storage', handleStorage\)/.test(source)
    && /addEventListener\(authChangedEvent, handleStoredIdentity\)/.test(source), 'Hub must reset private pages when the header AuthPanel is absent.');
});

test('staff records and exports guard their sinks and react to identity and role', () => {
  const source = read(adminPath);
  assert.ok(/if \(!isCurrentIdentity\(\)\) return;\s*setRecords\(nextRecords\)/.test(source), 'Staff records need a current-identity check before setRecords.');
  assert.ok(/\[activeTab, filters, isStaff, page, recordsKey, user\?\.id, role\]/.test(source), 'Staff record requests must depend on user id and role.');
  assert.ok(/if \(!isCurrentIdentity\(\)\) return;\s*DownloadFile\(csv/.test(source), 'Staff CSV exports need an identity check immediately before download.');
  assert.ok(/FetchAdminRecordsCsv\(filters, controller.signal\)/.test(source));
});

test('gaze pagination and blob downloads guard their sinks and abort on identity cleanup', () => {
  const source = read(progressPath);
  assert.ok(/if \(!isCurrentIdentity\(\)\) return;\s*setGazeFiles\(\(current\)/.test(source), 'Gaze pagination needs a check after JSON parsing.');
  assert.ok(/await response.blob\(\);\s*if \(!isCurrentIdentity\(\)\) return;/.test(source), 'Gaze downloads need a check after reading the response body.');
  assert.ok(/signal: controller.signal/.test(source) && /return \(\) => controller.abort\(\)/.test(source));
});

test('quarantine downloads guard the sink and forward an abort signal to AdminFetch', () => {
  const source = read(releasePath);
  assert.ok(/if \(!isCurrentIdentity\(\)\) return;\s*DownloadFile\(artifact/.test(source), 'Quarantine downloads need an identity check immediately before download.');
  const api = read('apps/rehabtrainerhub/app/admin/adminApi.ts').split('export async function DownloadAdminGameReleaseArtifact')[1];
  assert.ok(/signal\?: AbortSignal/.test(api) && /\{ signal \}/.test(api), 'Quarantine artifact requests must be abortable.');
});

test('developer submission refuses a draft under a different stored identity', () => {
  const source = read('apps/rehabtrainerhub/app/developer/DeveloperPortal.tsx');
  assert.ok(/GetAuthUserIdFromToken\(GetAuthToken\(\)\) !== user\?\.id/.test(source), 'A developer draft must be bound to the displayed account before submission.');
  assert.ok(/if \(!isCurrentIdentity\(\)\) return;\s*setMessage\(response/.test(source), 'Late developer submission results must be discarded.');
});

test('profile drafts reload on cross-tab token changes and carry their owner to save', () => {
  const source = read('packages/ui/src/components/AuthPanel.tsx');
  assert.ok(/addEventListener\('storage', handleStorage\)/.test(source), 'AuthPanel must observe cross-tab identity changes.');
  assert.ok(/event.key === authTokenKey/.test(source));
  assert.ok(/setProfile\(CreateEmptyProfile\(\)\)/.test(source), 'Leaving a profile owner must clear the old medical draft.');
  assert.ok(/SaveAuthProfile\(apiBase, cleanedProfile, user.id\)/.test(source), 'Profile saves must carry the displayed draft owner.');
});

test('logout cancels the cookie-session reload triggered by clearing the token', async () => {
  let generation = 0;
  let restored = false;
  const action = LoadAction('packages/ui/src/components/AuthPanel.tsx', 'handleLogout', {
    cancelLoadUser: () => { generation += 1; },
    applyLoadedUser() {},
    ClearAuthToken: () => {
      const startedGeneration = generation;
      void Promise.resolve().then(() => { if (generation === startedGeneration) restored = true; });
    },
    LogoutAuthSession: () => new Promise(() => {}),
    apiBase: undefined,
  });
  action();
  await Promise.resolve();
  assert.equal(restored, false, 'Logout must not reload the old cookie session before the server logout completes.');
});

function LoadAuthClient(tokenState) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(authPath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dependencies = {
    CreateRuntimeStorageNamespace: () => ({}), IsSubjectId: () => false,
  };
  const fakeWindow = { localStorage: { getItem: () => tokenState.value, removeItem: () => { tokenState.value = null; } }, dispatchEvent() {} };
  new Function('require', 'module', 'exports', 'window', 'fetch', code)(() => dependencies, module, module.exports, fakeWindow, tokenState.Fetch);
  return module.exports;
}

function FakeToken(userId) {
  return Buffer.from(JSON.stringify({ sub: userId })).toString('base64url') + '.fake-signature';
}

test('profile save rejects the previous account draft before sending any request', async () => {
  let writes = 0;
  const auth = LoadAuthClient({ value: FakeToken('account-b'), Fetch: async () => {
    writes += 1;
    return Response.json({ user: { id: 'account-b' } });
  } });
  await assert.rejects(() => auth.SaveAuthProfile(undefined, {}, 'account-a'), /Unable to save profile/);
  assert.equal(writes, 0);
});

test('profile save discards an old response if the token changes while reading JSON', async () => {
  const state = { value: FakeToken('account-a') };
  state.Fetch = async () => ({ ok: true, json: async () => {
    state.value = FakeToken('account-b');
    return { user: { id: 'account-a' } };
  } });
  const auth = LoadAuthClient(state);
  await assert.rejects(() => auth.SaveAuthProfile(undefined, {}, 'account-a'), /Unable to save profile/);
});

test('a late auth rejection cannot clear the next account token', async () => {
  const state = { value: FakeToken('account-a') };
  state.Fetch = async () => { state.value = FakeToken('account-b'); return { status: 401 }; };
  const auth = LoadAuthClient(state);
  await auth.FetchCurrentAuthUser();
  assert.equal(state.value, FakeToken('account-b'), 'An old auth request must not log out the new account.');
});
