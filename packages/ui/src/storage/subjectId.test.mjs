import assert from 'node:assert/strict';
import test from 'node:test';

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

function CreateStorage(entries = []) {
  const values = new Map(entries);
  return {
    values,
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
