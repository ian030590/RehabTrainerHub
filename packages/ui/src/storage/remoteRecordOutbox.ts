import type { RemoteTrainingRecordPayload } from '../auth/authClient';

export const remoteTrainingRecordOutboxDatabaseName = 'rehabtrainerhub.remote-record-outbox';

const storeName = 'records';
const maximumPendingRecords = 25;

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
  await RunTransaction(database, 'readwrite', (store) => store.put({
    ...item,
    createdAt: new Date().toISOString(),
    key,
  }));
  const records = await ReadAll(database);
  const expired = records
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, Math.max(0, records.length - maximumPendingRecords));
  if (expired.length) {
    await RunTransaction(database, 'readwrite', (store) => {
      expired.forEach((record) => store.delete(record.key));
    });
  }
  database.close();
}

export async function ReadPendingRemoteTrainingRecords(): Promise<PendingRemoteTrainingRecord[]> {
  const database = await OpenOutbox();
  if (!database) return [];
  const records = await ReadAll(database);
  database.close();
  return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
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
