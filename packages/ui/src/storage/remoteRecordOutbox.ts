import type { RemoteTrainingRecordPayload } from '../auth/authClient';

export const remoteTrainingRecordOutboxDatabaseName = 'rehabtrainerhub.remote-record-outbox';

const storeName = 'records';
const maximumPendingRecords = 25;
export const remoteTrainingRecordOutboxRetentionMs = 30 * 24 * 60 * 60 * 1000;

export interface PendingRemoteTrainingRecord {
  apiBase?: string;
  createdAt: string;
  key: string;
  payload: RemoteTrainingRecordPayload;
  subjectId: string;
  userId: string | null;
}

export async function PutPendingRemoteTrainingRecord(
  item: Omit<PendingRemoteTrainingRecord, 'createdAt' | 'key'>,
): Promise<void> {
  const database = await OpenOutbox();
  if (!database) return;
  const key = `${item.apiBase ?? ''}:${item.payload.record.id}`;
  const existing = await ReadOne(database, key);
  await RunTransaction(database, 'readwrite', (store) => store.put({
    ...item,
    createdAt: existing?.createdAt || new Date().toISOString(),
    key,
  }));
  await PrunePendingRemoteTrainingRecords(database, await ReadAll(database));
  database.close();
}

export async function ReadPendingRemoteTrainingRecords(): Promise<PendingRemoteTrainingRecord[]> {
  const database = await OpenOutbox();
  if (!database) return [];
  const records = await PrunePendingRemoteTrainingRecords(database, await ReadAll(database));
  database.close();
  return records;
}

export async function DeletePendingRemoteTrainingRecord(key: string): Promise<void> {
  const database = await OpenOutbox();
  if (!database) return;
  await RunTransaction(database, 'readwrite', (store) => store.delete(key));
  database.close();
}

function OpenOutbox(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(remoteTrainingRecordOutboxDatabaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function ReadAll(database: IDBDatabase): Promise<PendingRemoteTrainingRecord[]> {
  return new Promise((resolve) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as PendingRemoteTrainingRecord[]);
    request.onerror = () => resolve([]);
  });
}

function ReadOne(
  database: IDBDatabase,
  key: string,
): Promise<PendingRemoteTrainingRecord | undefined> {
  return new Promise((resolve) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as PendingRemoteTrainingRecord | undefined);
    request.onerror = () => resolve(undefined);
  });
}

export function IsPendingRemoteTrainingRecordFresh(
  createdAt: string,
  now = Date.now(),
): boolean {
  const createdAtMs = Date.parse(createdAt);
  return Number.isFinite(createdAtMs)
    && now - createdAtMs <= remoteTrainingRecordOutboxRetentionMs;
}

async function PrunePendingRemoteTrainingRecords(
  database: IDBDatabase,
  records: PendingRemoteTrainingRecord[],
): Promise<PendingRemoteTrainingRecord[]> {
  const fresh = records
    .filter((record) => IsPendingRemoteTrainingRecordFresh(record.createdAt))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const retained = fresh.slice(-maximumPendingRecords);
  const retainedKeys = new Set(retained.map((record) => record.key));
  const removed = records.filter((record) => !retainedKeys.has(record.key));
  if (removed.length) {
    await RunTransaction(database, 'readwrite', (store) => {
      removed.forEach((record) => store.delete(record.key));
    });
  }
  return retained;
}

function RunTransaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    action(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
