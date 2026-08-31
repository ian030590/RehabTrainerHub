import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CreateRuntimeStorageNamespace,
  MigrateLegacyIndexedDbRecords,
  MigrateLegacyLocalStorageNamespace,
} from '../packages/ui/src/storage/runtimeNamespace.ts';

const repoRoot = resolve(import.meta.dirname, '..');
const runtimeIds = ['motor', 'vision', 'brain', 'mouth'];

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

for (const runtimeId of runtimeIds) {
  const namespace = CreateRuntimeStorageNamespace(runtimeId);
  assert.equal(namespace.storagePrefix, `rehabtrainerhub.${runtimeId}.`);
  assert.equal(namespace.activeUserChangedEvent, `rehabtrainerhub.${runtimeId}.active-user-changed`);
  assert.equal(namespace.settingsChangedEvent, `rehabtrainerhub.${runtimeId}.settings-changed`);
  assert.equal(namespace.trainingRecordsChangedEvent, `rehabtrainerhub.${runtimeId}.training-records-changed`);
  assert.equal(namespace.trainingRecordsDatabaseName, `rehabtrainerhub.${runtimeId}.training-records`);
}

const storage = new MemoryStorage([
  ['vision_trainer_language', 'en'],
  ['vision-trainer-hart_decoder_dock', 'left'],
  ['vision_trainer_training_records_v1', JSON.stringify([{ id: 'legacy', value: 1 }])],
  ['rehabtrainerhub.vision.training_records_v1', JSON.stringify([{ id: 'current', value: 2 }])],
  ['vision_trainer_training_high_scores_v1', JSON.stringify({ legacy: { score: 2 } })],
  ['rehabtrainerhub.vision.training_high_scores_v1', JSON.stringify({ current: { score: 3 } })],
]);
const originalWindow = globalThis.window;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: storage },
});

try {
  MigrateLegacyLocalStorageNamespace({
    canonicalPrefix: 'rehabtrainerhub.vision.',
    legacyPrefixes: ['vision_trainer_', 'vision-trainer-'],
    suffixRenames: { hart_decoder_dock: 'hart.decoderDock' },
    mergeJsonArraySuffixes: ['training_records_v1'],
    mergeJsonObjectSuffixes: ['training_high_scores_v1'],
  });

  assert.equal(storage.getItem('rehabtrainerhub.vision.language'), 'en');
  assert.equal(storage.getItem('rehabtrainerhub.vision.hart.decoderDock'), 'left');
  assert.equal(storage.getItem('vision_trainer_language'), null);
  assert.equal(storage.getItem('vision-trainer-hart_decoder_dock'), null);
  assert.deepEqual(
    JSON.parse(storage.getItem('rehabtrainerhub.vision.training_records_v1'))
      .map((record) => record.id),
    ['legacy', 'current'],
  );
  assert.deepEqual(
    Object.keys(JSON.parse(storage.getItem('rehabtrainerhub.vision.training_high_scores_v1'))).sort(),
    ['current', 'legacy'],
  );
  assert.equal(storage.getItem('vision_trainer_training_records_v1'), null);
  assert.equal(storage.getItem('vision_trainer_training_high_scores_v1'), null);
} finally {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
}

const copiedRecords = [];
const successfulIndexedDb = CreateFakeIndexedDb(new Map([
  ['vision_trainer_training_records', [{ id: 'legacy-record' }]],
]));
await MigrateLegacyIndexedDbRecords({
  indexedDb: successfulIndexedDb.factory,
  legacyDatabaseNames: ['vision_trainer_training_records'],
  storeName: 'records',
  writeRecords: async (records) => copiedRecords.push(...records),
});
assert.deepEqual(copiedRecords, [{ id: 'legacy-record' }]);
assert.deepEqual(successfulIndexedDb.deletedDatabaseNames, ['vision_trainer_training_records']);

const failedIndexedDb = CreateFakeIndexedDb(new Map([
  ['motor-trainer-training-records', [{ id: 'must-survive' }]],
]));
const originalWarn = console.warn;
console.warn = () => {};
try {
  await MigrateLegacyIndexedDbRecords({
    indexedDb: failedIndexedDb.factory,
    legacyDatabaseNames: ['motor-trainer-training-records'],
    storeName: 'records',
    writeRecords: async () => { throw new Error('simulated destination failure'); },
  });
} finally {
  console.warn = originalWarn;
}
assert.deepEqual(failedIndexedDb.deletedDatabaseNames, []);

for (const fixture of [
  'scripts/check-driving-rehab-browser.mjs',
  'scripts/check-oculomotor-webgazer-browser.mjs',
]) {
  const source = readFileSync(resolve(repoRoot, fixture), 'utf8');
  assert.doesNotMatch(source, /vision[_-]trainer/);
  assert.match(source, /rehabtrainerhub\.vision\./);
}

const hartChartSource = readFileSync(resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-modules/vision/pages/training/HartChartPage.tsx',
), 'utf8');
assert.match(hartChartSource, /`\$\{storagePrefix\}hart\.decoderDock`/);
assert.doesNotMatch(hartChartSource, /vision[_-]trainer/);

console.log('Hub runtime storage namespace check passed.');

function CreateFakeIndexedDb(recordsByDatabaseName) {
  const deletedDatabaseNames = [];
  const factory = {
    open(databaseName) {
      const request = {};
      queueMicrotask(() => {
        const records = recordsByDatabaseName.get(databaseName);
        if (!records) {
          request.transaction = { abort() {} };
          request.onupgradeneeded?.({ oldVersion: 0 });
          request.onerror?.();
          return;
        }

        request.result = {
          objectStoreNames: { contains: (storeName) => storeName === 'records' },
          close() {},
          transaction() {
            const transaction = {};
            transaction.objectStore = () => ({
              getAll() {
                const recordsRequest = {};
                queueMicrotask(() => {
                  recordsRequest.result = records;
                  recordsRequest.onsuccess?.();
                  transaction.oncomplete?.();
                });
                return recordsRequest;
              },
            });
            return transaction;
          },
        };
        request.onsuccess?.();
      });
      return request;
    },
    deleteDatabase(databaseName) {
      const request = {};
      queueMicrotask(() => {
        deletedDatabaseNames.push(databaseName);
        request.onsuccess?.();
      });
      return request;
    },
  };
  return { deletedDatabaseNames, factory };
}
