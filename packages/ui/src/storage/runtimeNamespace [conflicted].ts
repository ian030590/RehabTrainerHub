export type HubRuntimeNamespaceId = 'motor' | 'vision' | 'brain' | 'mouth';

export interface RuntimeStorageNamespace {
  storagePrefix: string;
  activeUserChangedEvent: string;
  settingsChangedEvent: string;
  trainingRecordsChangedEvent: string;
  trainingRecordsDatabaseName: string;
}

interface LegacyLocalStorageMigrationOptions {
  canonicalPrefix: string;
  legacyPrefixes: readonly string[];
  suffixRenames?: Readonly<Record<string, string>>;
  mergeJsonArraySuffixes?: readonly string[];
  mergeJsonObjectSuffixes?: readonly string[];
}

interface LegacyIndexedDbMigrationOptions {
  indexedDb: IDBFactory;
  legacyDatabaseNames: readonly string[];
  storeName: string;
  writeRecords: (records: readonly unknown[]) => Promise<void>;
}

interface LegacyIndexedDbRecords {
  databaseName: string;
  records: unknown[];
}

export function CreateRuntimeStorageNamespace(
  runtimeId: HubRuntimeNamespaceId,
): RuntimeStorageNamespace {
  const base = `rehabtrainerhub.${runtimeId}`;
  return {
    storagePrefix: `${base}.`,
    activeUserChangedEvent: `${base}.active-user-changed`,
    settingsChangedEvent: `${base}.settings-changed`,
    trainingRecordsChangedEvent: `${base}.training-records-changed`,
    trainingRecordsDatabaseName: `${base}.training-records`,
  };
}

/**
 * Moves retired standalone-runtime keys into the Hub-owned runtime namespace.
 * Canonical values win on ordinary conflicts. Record/user arrays and high-score
 * objects are merged so a partially completed migration cannot discard data.
 */
export function MigrateLegacyLocalStorageNamespace({
  canonicalPrefix,
  legacyPrefixes,
  suffixRenames = {},
  mergeJsonArraySuffixes = [],
  mergeJsonObjectSuffixes = [],
}: LegacyLocalStorageMigrationOptions): void {
  if (typeof window === 'undefined') return;

  const mergeArraySuffixes = new Set(mergeJsonArraySuffixes);
  const mergeObjectSuffixes = new Set(mergeJsonObjectSuffixes);

  try {
    const storage = window.localStorage;
    const legacyKeys = Array.from(
      { length: storage.length },
      (_, index) => storage.key(index),
    ).filter((key): key is string => Boolean(key));

    for (const legacyKey of legacyKeys) {
      const legacyPrefix = legacyPrefixes.find((prefix) => legacyKey.startsWith(prefix));
      if (!legacyPrefix) continue;

      const legacySuffix = legacyKey.slice(legacyPrefix.length);
      const canonicalSuffix = suffixRenames[legacySuffix] ?? legacySuffix;
      const canonicalKey = `${canonicalPrefix}${canonicalSuffix}`;
      const legacyValue = storage.getItem(legacyKey);
      if (legacyValue === null) continue;

      const canonicalValue = storage.getItem(canonicalKey);
      let valueToStore: string | null = canonicalValue === null ? legacyValue : null;

      if (canonicalValue !== null && canonicalValue !== legacyValue) {
        if (mergeArraySuffixes.has(canonicalSuffix)) {
          valueToStore = MergeJsonArrays(canonicalValue, legacyValue);
        } else if (mergeObjectSuffixes.has(canonicalSuffix)) {
          valueToStore = MergeJsonObjects(canonicalValue, legacyValue);
        }
      }

      if (valueToStore !== null) {
        storage.setItem(canonicalKey, valueToStore);
      }

      const migratedValue = storage.getItem(canonicalKey);
      if (migratedValue === legacyValue || valueToStore !== null) {
        storage.removeItem(legacyKey);
      }
    }
  } catch (error) {
    console.warn('Unable to finish legacy runtime storage migration.', error);
  }
}

/**
 * Copies records out of retired runtime databases before deleting them. A
 * failed copy leaves the source database untouched so the next launch retries.
 */
export async function MigrateLegacyIndexedDbRecords({
  indexedDb,
  legacyDatabaseNames,
  storeName,
  writeRecords,
}: LegacyIndexedDbMigrationOptions): Promise<void> {
  for (const databaseName of legacyDatabaseNames) {
    try {
      const legacyData = await ReadLegacyIndexedDbRecords(indexedDb, databaseName, storeName);
      if (!legacyData) continue;

      if (legacyData.records.length > 0) {
        await writeRecords(legacyData.records);
      }
      await DeleteIndexedDb(indexedDb, legacyData.databaseName);
    } catch (error) {
      console.warn(`Unable to migrate legacy runtime database ${databaseName}.`, error);
    }
  }
}

function MergeJsonArrays(canonicalValue: string, legacyValue: string): string | null {
  try {
    const canonicalItems: unknown = JSON.parse(canonicalValue);
    const legacyItems: unknown = JSON.parse(legacyValue);
    if (!Array.isArray(canonicalItems) || !Array.isArray(legacyItems)) return null;

    const mergedItems = new Map<string, unknown>();
    for (const item of [...legacyItems, ...canonicalItems]) {
      mergedItems.set(GetJsonArrayItemIdentity(item), item);
    }
    return JSON.stringify([...mergedItems.values()]);
  } catch {
    return null;
  }
}

function MergeJsonObjects(canonicalValue: string, legacyValue: string): string | null {
  try {
    const canonicalObject: unknown = JSON.parse(canonicalValue);
    const legacyObject: unknown = JSON.parse(legacyValue);
    if (!IsPlainObject(canonicalObject) || !IsPlainObject(legacyObject)) return null;
    return JSON.stringify({ ...legacyObject, ...canonicalObject });
  } catch {
    return null;
  }
}

function GetJsonArrayItemIdentity(item: unknown): string {
  if (IsPlainObject(item) && typeof item.id === 'string') return `id:${item.id}`;
  return `value:${JSON.stringify(item)}`;
}

function IsPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ReadLegacyIndexedDbRecords(
  indexedDb: IDBFactory,
  databaseName: string,
  storeName: string,
): Promise<LegacyIndexedDbRecords | null> {
  return new Promise((resolve, reject) => {
    let createdDuringProbe = false;
    const request = indexedDb.open(databaseName);

    request.onupgradeneeded = (event) => {
      if (event.oldVersion !== 0) return;
      createdDuringProbe = true;
      request.transaction?.abort();
    };
    request.onerror = () => {
      if (createdDuringProbe) {
        resolve(null);
        return;
      }
      reject(request.error ?? new Error(`Unable to open legacy database ${databaseName}.`));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.close();
        resolve(null);
        return;
      }

      const transaction = database.transaction(storeName, 'readonly');
      const recordsRequest = transaction.objectStore(storeName).getAll();
      let records: unknown[] = [];
      recordsRequest.onsuccess = () => {
        records = recordsRequest.result as unknown[];
      };
      recordsRequest.onerror = () => {
        database.close();
        reject(recordsRequest.error ?? new Error(`Unable to read legacy database ${databaseName}.`));
      };
      transaction.oncomplete = () => {
        database.close();
        resolve({ databaseName, records });
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error(`Unable to read legacy database ${databaseName}.`));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error ?? new Error(`Reading legacy database ${databaseName} was aborted.`));
      };
    };
    request.onblocked = () => reject(new Error(`Opening legacy database ${databaseName} was blocked.`));
  });
}

function DeleteIndexedDb(indexedDb: IDBFactory, databaseName: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDb.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
