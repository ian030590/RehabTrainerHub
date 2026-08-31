import { offlinePackLimits } from '@rehab-trainer/training-contracts';

/**
 * Origin-wide offline pack coordinator for official training/game assets.
 *
 * The manager deliberately stores resources in one CacheStorage namespace and
 * keeps a small reference index beside it. A pack can therefore be installed
 * or removed without deleting a shared runtime resource that another pack
 * still needs. Uploaded third-party games never use this API; they keep their
 * isolated runner scope and service worker.
 */

export const offlinePackCacheName = 'rehab-trainer-offline-v1' as const;
export const offlinePackMetadataKey = 'rehab-trainer-offline-packs-v1' as const;
export const offlinePackMetadataSchemaVersion = 1 as const;

const stagingCachePrefix = 'rehab-trainer-offline-staging-v1:';
const legacyOfflineCachePattern = /^rehab-trainer-offline-v0$/;
const indexedDbName = 'rehab-trainer-offline-v1';
const indexedDbStoreName = 'metadata';
const indexedDbRecordKey = 'packs';
const leaseDurationMs = 15 * 60 * 1000;
const maximumOfflinePackResourceCount = offlinePackLimits.maximumResourceCount;
const maximumOfflinePackBytes = offlinePackLimits.maximumTotalBytes;
const sha256Pattern = /^[a-f0-9]{64}$/i;
const packIdPattern = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/i;
const packVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const gameScopePattern = /^\/games\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;
const sharedResourcePrefixes = Object.freeze([
  '/runtimes/',
  '/runtime-assets/',
  '/assets/',
  '/icons/',
]);

export type OfflinePackStatus = 'installing' | 'ready';

export interface OfflinePackResource {
  url: string;
  sha256: string;
  byteSize: number;
  required?: boolean;
}

export interface OfflinePackDescriptor {
  id: string;
  version: string;
  scope: string;
  resources: readonly OfflinePackResource[];
}

export interface OfflinePackProgress {
  completed: number;
  total: number;
  url: string;
}

export interface OfflinePackReference {
  id: string;
  version: string;
  scope: string;
  resources: readonly OfflinePackResource[];
  status: OfflinePackStatus;
  leaseExpiresAt: number | null;
  updatedAt: number;
}

export interface OfflinePackMetadataStore {
  read(): Promise<OfflinePackReference[]>;
  write(packs: readonly OfflinePackReference[]): Promise<void>;
}

export interface OfflinePackManagerOptions {
  cacheStorage?: CacheStorage;
  fetch?: typeof globalThis.fetch;
  metadataStore?: OfflinePackMetadataStore;
  now?: () => number;
}

export interface OfflinePackManager {
  install(
    pack: OfflinePackDescriptor,
    options?: {
      signal?: AbortSignal;
      onProgress?(progress: OfflinePackProgress): void;
    },
  ): Promise<void>;
  verify(pack: Pick<OfflinePackDescriptor, 'id' | 'version' | 'scope' | 'resources'>): Promise<'ready' | 'missing' | 'corrupt'>;
  remove(pack: Pick<OfflinePackDescriptor, 'id' | 'version'>): Promise<void>;
  reconcile(): Promise<void>;
  list(): Promise<readonly OfflinePackReference[]>;
}

export interface OfflinePackMigrationOptions {
  cacheStorage: CacheStorage;
  metadataStore: OfflinePackMetadataStore;
  legacyCacheName: string;
  pack: OfflinePackDescriptor;
  removeLegacyCache?: boolean;
  now?: () => number;
}

export interface OfflinePackMigrationResult {
  status: 'migrated' | 'missing' | 'corrupt' | 'skipped';
  copiedResources: number;
  missingUrls: readonly string[];
  legacyCacheRemoved: boolean;
}

/**
 * The generated offline manifest is deliberately a transport shape rather
 * than the manager's internal reference shape. Keep the conversion here so
 * every UI caller applies the same schema, identity and same-origin checks.
 */
export interface OfflinePackManifestPayload extends OfflinePackDescriptor {
  schemaVersion: typeof offlinePackMetadataSchemaVersion;
  kind: 'official-training-offline-pack';
  packId: string;
  moduleId: string;
}

interface CacheStorageLike {
  open(cacheName: string): Promise<Cache>;
  keys(): Promise<readonly string[]>;
  delete(cacheName: string): Promise<boolean>;
}

interface MetadataRecord {
  schemaVersion: typeof offlinePackMetadataSchemaVersion;
  packs: OfflinePackReference[];
}

/**
 * Create an offline pack manager. The default metadata store uses
 * localStorage when available and otherwise remains process-local (useful for
 * SSR/tests). Callers can inject IndexedDB-backed storage without changing the
 * cache/reference protocol.
 */
export function CreateOfflinePackManager(
  options: OfflinePackManagerOptions = {},
): OfflinePackManager {
  const cacheStorage = options.cacheStorage ?? GetDefaultCacheStorage();
  const fetchResource = options.fetch ?? globalThis.fetch.bind(globalThis);
  const metadataStore = options.metadataStore ?? CreatePersistentMetadataStore();
  const now = options.now ?? (() => Date.now());
  const activeInstallIds = new Set<string>();

  async function Install(
    pack: OfflinePackDescriptor,
    installOptions: {
      signal?: AbortSignal;
      onProgress?(progress: OfflinePackProgress): void;
    } = {},
  ): Promise<void> {
    ValidateOfflinePack(pack);
    const signal = installOptions.signal;
    ThrowIfAborted(signal);
    if (activeInstallIds.has(pack.id)) {
      throw new Error(`Offline pack installation is already leased: ${pack.id}`);
    }
    activeInstallIds.add(pack.id);

    try {
      await InstallInternal(pack, installOptions);
    } finally {
      activeInstallIds.delete(pack.id);
    }
  }

  async function InstallInternal(
    pack: OfflinePackDescriptor,
    installOptions: {
      signal?: AbortSignal;
      onProgress?(progress: OfflinePackProgress): void;
    },
  ): Promise<void> {
    const signal = installOptions.signal;
    ThrowIfAborted(signal);

    const allPacks = await metadataStore.read();
    const previous = allPacks.find((candidate) => candidate.id === pack.id);
    if (previous?.status === 'installing'
      && previous.leaseExpiresAt !== null
      && previous.leaseExpiresAt > now()) {
      throw new Error(`Offline pack installation is already leased: ${pack.id}`);
    }
    AssertNoImmutableResourceConflicts(
      pack,
      allPacks.filter((candidate) => candidate.status === 'ready' && candidate.id !== pack.id),
    );
    const leaseExpiresAt = now() + leaseDurationMs;
    const nextPacks = allPacks.filter((candidate) => candidate.id !== pack.id);
    nextPacks.push({
      ...ClonePack(pack, now()),
      status: 'installing',
      leaseExpiresAt,
      updatedAt: now(),
    });
    await metadataStore.write(nextPacks);

    const stagingName = `${stagingCachePrefix}${EncodeCachePart(pack.id)}:${EncodeCachePart(pack.version)}:${CreateNonce()}`;
    let staging: Cache | null = null;
    try {
      staging = await cacheStorage.open(stagingName);
      const total = pack.resources.length;
      for (const [index, resource] of pack.resources.entries()) {
        ThrowIfAborted(signal);
        const request = CreateRequest(resource.url);
        const response = await fetchResource(request, { cache: 'no-store', credentials: 'omit', signal });
        if (!response.ok || response.type === 'opaque') {
          throw new Error(`Offline pack resource failed: ${resource.url}`);
        }
        const bytes = new Uint8Array(await response.clone().arrayBuffer());
        if (bytes.byteLength !== resource.byteSize) {
          throw new Error(`Offline pack resource size mismatch: ${resource.url}`);
        }
        const digest = await Sha256Hex(bytes);
        if (digest !== resource.sha256.toLowerCase()) {
          throw new Error(`Offline pack resource hash mismatch: ${resource.url}`);
        }
        await staging.put(request, response.clone());
        installOptions.onProgress?.({ completed: index + 1, total, url: resource.url });
      }

      ThrowIfAborted(signal);
      const target = await cacheStorage.open(offlinePackCacheName);
      for (const resource of pack.resources) {
        ThrowIfAborted(signal);
        const cached = await staging.match(CreateRequest(resource.url));
        if (!cached) throw new Error(`Offline pack staging entry disappeared: ${resource.url}`);
        await target.put(CreateRequest(resource.url), cached.clone());
      }

      const readyPacks = (await metadataStore.read()).filter((candidate) => candidate.id !== pack.id);
      readyPacks.push({
        ...ClonePack(pack, now()),
        status: 'ready',
        leaseExpiresAt: null,
        updatedAt: now(),
      });
      await metadataStore.write(readyPacks);
    } catch (error) {
      const current = await metadataStore.read();
      const retained = current.filter((candidate) => candidate.id !== pack.id);
      if (previous && previous.status === 'ready') retained.push(previous);
      await metadataStore.write(retained);
      throw error;
    } finally {
      await cacheStorage.delete(stagingName);
    }
  }

  async function Verify(
    pack: Pick<OfflinePackDescriptor, 'id' | 'version' | 'scope' | 'resources'>,
  ): Promise<'ready' | 'missing' | 'corrupt'> {
    ValidateOfflinePack(pack);
    const references = await metadataStore.read();
    const reference = references.find((candidate) => candidate.id === pack.id);
    if (!reference || reference.status !== 'ready') return 'missing';
    if (reference.version !== pack.version || reference.scope !== pack.scope) return 'corrupt';
    if (!HasMatchingResourceMetadata(reference.resources, pack.resources)) return 'corrupt';
    const cache = await cacheStorage.open(offlinePackCacheName);
    for (const resource of pack.resources) {
      const response = await cache.match(CreateRequest(resource.url));
      if (!response) return 'missing';
      const bytes = new Uint8Array(await response.clone().arrayBuffer());
      if (bytes.byteLength !== resource.byteSize) return 'corrupt';
      if (await Sha256Hex(bytes) !== resource.sha256.toLowerCase()) return 'corrupt';
    }
    return 'ready';
  }

  async function Remove(pack: Pick<OfflinePackDescriptor, 'id' | 'version'>): Promise<void> {
    if (!packIdPattern.test(pack.id) || !packVersionPattern.test(pack.version)) {
      throw new TypeError('Invalid offline pack identity.');
    }
    const references = await metadataStore.read();
    const target = references.find((candidate) => candidate.id === pack.id);
    if (!target || target.version !== pack.version) return;
    const retained = references.filter((candidate) => candidate.id !== pack.id);
    const stillReferenced = new Set(
      retained
        .filter((candidate) => candidate.status === 'ready')
        .flatMap((candidate) => candidate.resources.map((resource) => resource.url)),
    );
    const cache = await cacheStorage.open(offlinePackCacheName);
    for (const resource of target.resources) {
      if (!stillReferenced.has(resource.url)) await cache.delete(CreateRequest(resource.url));
    }
    await metadataStore.write(retained);
  }

  async function Reconcile(): Promise<void> {
    const timestamp = now();
    const references = await metadataStore.read();
    const retained = references.filter((candidate) => (
      candidate.status === 'ready'
      || (candidate.leaseExpiresAt !== null && candidate.leaseExpiresAt > timestamp)
    ));
    await metadataStore.write(retained);

    const cache = await cacheStorage.open(offlinePackCacheName);
    const referencedUrls = new Set(
      retained
        .filter((candidate) => candidate.status === 'ready')
        .flatMap((candidate) => candidate.resources.map((resource) => resource.url)),
    );
    for (const request of await cache.keys()) {
      if (!referencedUrls.has(request.url)) await cache.delete(request);
    }
    for (const cacheName of await cacheStorage.keys()) {
      if (cacheName.startsWith(stagingCachePrefix)) await cacheStorage.delete(cacheName);
    }
  }

  return Object.freeze({
    install: Install,
    verify: Verify,
    remove: Remove,
    reconcile: Reconcile,
    async list() {
      return Object.freeze((await metadataStore.read()).map(CloneReference));
    },
  });
}

/**
 * Migrate one explicitly identified v0 cache into the origin-wide reference
 * set. The caller supplies the current immutable manifest, so a legacy cache
 * is copied only when every URL, byte count and SHA-256 matches that manifest.
 * Unknown cache names are rejected and no cache other than the named v0 cache
 * can be removed. This is intentionally an explicit one-shot operation rather
 * than an automatic sweep: old game scopes must never be guessed from cache
 * names during a service-worker upgrade.
 */
export async function MigrateLegacyOfflineCache({
  cacheStorage,
  metadataStore,
  legacyCacheName,
  pack,
  removeLegacyCache = true,
  now = () => Date.now(),
}: OfflinePackMigrationOptions): Promise<OfflinePackMigrationResult> {
  if (!cacheStorage || !metadataStore || !legacyOfflineCachePattern.test(legacyCacheName)) {
    throw new TypeError('Only the explicitly supported v0 offline cache can be migrated.');
  }
  ValidateOfflinePack(pack);
  const source = await cacheStorage.open(legacyCacheName);
  const sourceResponses: Array<[OfflinePackResource, Response]> = [];
  const missingUrls: string[] = [];
  for (const resource of pack.resources) {
    const response = await source.match(CreateRequest(resource.url));
    if (!response) {
      missingUrls.push(CreateRequest(resource.url).url);
      continue;
    }
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    if (bytes.byteLength !== resource.byteSize
      || await Sha256Hex(bytes) !== resource.sha256.toLowerCase()) {
      return {
        status: 'corrupt',
        copiedResources: 0,
        missingUrls: Object.freeze([]),
        legacyCacheRemoved: false,
      };
    }
    sourceResponses.push([resource, response]);
  }
  if (missingUrls.length > 0) {
    return {
      status: 'missing',
      copiedResources: 0,
      missingUrls: Object.freeze(missingUrls),
      legacyCacheRemoved: false,
    };
  }

  const references = await metadataStore.read();
  AssertNoImmutableResourceConflicts(pack, references.filter((candidate) => candidate.status === 'ready'));
  const target = await cacheStorage.open(offlinePackCacheName);
  const urls = pack.resources.map((resource) => CreateRequest(resource.url).url);
  try {
    for (const [resource, response] of sourceResponses) {
      await target.put(CreateRequest(resource.url), response.clone());
    }
    const retained = references.filter((candidate) => candidate.id !== pack.id);
    retained.push({
      ...ClonePack(pack, now()),
      status: 'ready',
      leaseExpiresAt: null,
      updatedAt: now(),
    });
    await metadataStore.write(retained);
  } catch (error) {
    const referencedByOtherPack = new Set(
      references
        .filter((candidate) => candidate.status === 'ready' && candidate.id !== pack.id)
        .flatMap((candidate) => candidate.resources.map((resource) => CreateRequest(resource.url).url)),
    );
    for (const url of urls) {
      if (!referencedByOtherPack.has(url)) await target.delete(CreateRequest(url));
    }
    throw error;
  }

  let legacyCacheRemoved = false;
  if (removeLegacyCache) legacyCacheRemoved = await cacheStorage.delete(legacyCacheName);
  return {
    status: 'migrated',
    copiedResources: sourceResponses.length,
    missingUrls: Object.freeze([]),
    legacyCacheRemoved,
  };
}

export function ValidateOfflinePack(pack: Pick<OfflinePackDescriptor, 'id' | 'version' | 'scope' | 'resources'>): void {
  if (!packIdPattern.test(pack.id)) throw new TypeError('Offline pack id is invalid.');
  if (!packVersionPattern.test(pack.version)) throw new TypeError('Offline pack version is invalid.');
  if (!gameScopePattern.test(pack.scope)) throw new TypeError('Offline pack scope is invalid.');
  if (!Array.isArray(pack.resources) || pack.resources.length === 0) {
    throw new TypeError('Offline pack must contain at least one resource.');
  }
  if (pack.resources.length > maximumOfflinePackResourceCount) {
    throw new TypeError('Offline pack contains too many resources.');
  }
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const resource of pack.resources) {
    if (!resource || typeof resource.url !== 'string' || !Number.isSafeInteger(resource.byteSize) || resource.byteSize < 0
      || (resource.required !== undefined && typeof resource.required !== 'boolean')) {
      throw new TypeError('Offline pack resource metadata is invalid.');
    }
    totalBytes += resource.byteSize;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maximumOfflinePackBytes) {
      throw new TypeError('Offline pack exceeds the supported size limit.');
    }
    if (!sha256Pattern.test(resource.sha256)) throw new TypeError(`Invalid offline pack hash: ${resource.url}`);
    const url = CreateRequest(resource.url).url;
    if (seen.has(url)) throw new TypeError(`Duplicate offline pack resource: ${url}`);
    seen.add(url);
    const parsed = new URL(url);
    if (!(parsed.pathname.startsWith(pack.scope) || sharedResourcePrefixes.some((prefix) => parsed.pathname.startsWith(prefix)))) {
      throw new TypeError(`Offline pack resource escapes its scope: ${url}`);
    }
  }
}

/**
 * Parse a generated manifest into the narrow descriptor accepted by the
 * cache coordinator. Unknown fields are intentionally discarded at this
 * boundary; callers never pass server JSON directly to cache operations.
 */
export function ParseOfflinePackManifest(
  input: unknown,
  expected: { packId?: string; moduleId?: string } = {},
): OfflinePackDescriptor {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Offline pack manifest must be an object.');
  }
  const candidate = input as Partial<OfflinePackManifestPayload>;
  if (candidate.schemaVersion !== offlinePackMetadataSchemaVersion
    || candidate.kind !== 'official-training-offline-pack'
    || typeof candidate.packId !== 'string'
    || typeof candidate.moduleId !== 'string') {
    throw new TypeError('Offline pack manifest schema is unsupported.');
  }
  if (expected.packId !== undefined && candidate.packId !== expected.packId) {
    throw new TypeError('Offline pack manifest identity does not match the requested game.');
  }
  if (expected.moduleId !== undefined && candidate.moduleId !== expected.moduleId) {
    throw new TypeError('Offline pack manifest module does not match the requested game.');
  }
  const descriptor: OfflinePackDescriptor = {
    id: candidate.packId,
    version: candidate.version as string,
    scope: candidate.scope as string,
    resources: candidate.resources as readonly OfflinePackResource[],
  };
  ValidateOfflinePack(descriptor);
  return Object.freeze({
    ...descriptor,
    resources: Object.freeze(descriptor.resources.map((resource) => Object.freeze({ ...resource }))),
  });
}

export function GetOfflinePackTotalBytes(
  pack: Pick<OfflinePackDescriptor, 'resources'>,
): number {
  return pack.resources.reduce((total, resource) => total + resource.byteSize, 0);
}

let defaultOfflinePackManager: OfflinePackManager | null = null;

/**
 * Use one coordinator per browser realm. This is important for the lobby:
 * multiple cards must still share the same in-flight lease and reference set.
 */
export function GetOfflinePackManager(): OfflinePackManager {
  defaultOfflinePackManager ??= CreateOfflinePackManager();
  return defaultOfflinePackManager;
}

function CreateRequest(value: string): Request {
  let url: URL;
  try {
    url = new URL(value, GetOrigin());
  } catch {
    throw new TypeError(`Invalid offline pack URL: ${value}`);
  }
  if (url.origin !== GetOrigin() || url.username || url.password || url.hash) {
    throw new TypeError(`Offline pack URL must be same-origin: ${value}`);
  }
  return new Request(url.toString(), { method: 'GET', credentials: 'omit' });
}

function GetOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://trainerhub.invalid';
}

function ThrowIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('Offline pack installation was aborted.');
  error.name = 'AbortError';
  throw error;
}

async function Sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function ClonePack(pack: OfflinePackDescriptor, updatedAt = Date.now()): OfflinePackReference {
  return {
    id: pack.id,
    version: pack.version,
    scope: pack.scope,
    resources: pack.resources.map((resource) => ({
      ...resource,
      url: CreateRequest(resource.url).url,
    })),
    status: 'ready',
    leaseExpiresAt: null,
    updatedAt,
  };
}

function AssertNoImmutableResourceConflicts(
  pack: OfflinePackDescriptor,
  readyPacks: readonly OfflinePackReference[],
): void {
  const incoming = new Map(
    pack.resources.map((resource) => [
      CreateRequest(resource.url).url,
      `${resource.byteSize}:${resource.sha256.toLowerCase()}`,
    ]),
  );
  for (const readyPack of readyPacks) {
    for (const resource of readyPack.resources) {
      const incomingIdentity = incoming.get(CreateRequest(resource.url).url);
      if (incomingIdentity === undefined) continue;
      const existingIdentity = `${resource.byteSize}:${resource.sha256.toLowerCase()}`;
      if (incomingIdentity !== existingIdentity) {
        throw new Error(
          `Offline pack resource conflicts with an installed immutable asset: ${resource.url}`,
        );
      }
    }
  }
}

function HasMatchingResourceMetadata(
  storedResources: readonly OfflinePackResource[],
  requestedResources: readonly OfflinePackResource[],
): boolean {
  if (storedResources.length !== requestedResources.length) return false;
  const identity = (resource: OfflinePackResource) => (
    `${CreateRequest(resource.url).url}:${resource.byteSize}:${resource.sha256.toLowerCase()}`
  );
  const stored = storedResources.map(identity).sort();
  const requested = requestedResources.map(identity).sort();
  return stored.every((value, index) => value === requested[index]);
}

function CloneReference(reference: OfflinePackReference): OfflinePackReference {
  return {
    ...reference,
    resources: Object.freeze(reference.resources.map((resource) => Object.freeze({ ...resource }))),
  };
}

function EncodeCachePart(value: string): string {
  return encodeURIComponent(value).replaceAll('%', '_');
}

function CreateNonce(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function GetDefaultCacheStorage(): CacheStorageLike {
  if (typeof caches === 'undefined') throw new Error('CacheStorage is not available.');
  return caches;
}

function CreatePersistentMetadataStore(): OfflinePackMetadataStore {
  if (typeof indexedDB === 'undefined') return CreateLocalStorageMetadataStore();

  const indexedDbStore = CreateIndexedDbMetadataStore();
  const fallbackStore = CreateLocalStorageMetadataStore();
  let useFallback = false;
  return {
    async read() {
      if (useFallback) return fallbackStore.read();
      try {
        return await indexedDbStore.read();
      } catch {
        useFallback = true;
        return fallbackStore.read();
      }
    },
    async write(packs) {
      if (useFallback) {
        await fallbackStore.write(packs);
        return;
      }
      try {
        await indexedDbStore.write(packs);
      } catch {
        useFallback = true;
        await fallbackStore.write(packs);
      }
    },
  };
}

function CreateIndexedDbMetadataStore(): OfflinePackMetadataStore {
  let databasePromise: Promise<IDBDatabase> | null = null;
  const openDatabase = () => {
    databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(indexedDbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(indexedDbStoreName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open offline metadata database.'));
    });
    return databasePromise;
  };

  return {
    async read() {
      const database = await openDatabase();
      return new Promise((resolve, reject) => {
        const request = database
          .transaction(indexedDbStoreName, 'readonly')
          .objectStore(indexedDbStoreName)
          .get(indexedDbRecordKey);
        request.onsuccess = () => resolve(ReadStoredPacks(request.result));
        request.onerror = () => reject(request.error ?? new Error('Unable to read offline metadata.'));
      });
    },
    async write(packs) {
      const database = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(indexedDbStoreName, 'readwrite');
        transaction.objectStore(indexedDbStoreName).put({
          schemaVersion: offlinePackMetadataSchemaVersion,
          packs: packs.map(CloneReference),
        }, indexedDbRecordKey);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Unable to write offline metadata.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Offline metadata transaction aborted.'));
      });
    },
  };
}

function CreateLocalStorageMetadataStore(): OfflinePackMetadataStore {
  let memory: OfflinePackReference[] = [];
  return {
    async read() {
      if (typeof localStorage === 'undefined') return memory.map(CloneReference);
      try {
        const raw = localStorage.getItem(offlinePackMetadataKey);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return ReadStoredPacks(parsed);
      } catch {
        return [];
      }
    },
    async write(packs) {
      memory = packs.map(CloneReference);
      if (typeof localStorage === 'undefined') return;
      const value: MetadataRecord = {
        schemaVersion: offlinePackMetadataSchemaVersion,
        packs: memory,
      };
      localStorage.setItem(offlinePackMetadataKey, JSON.stringify(value));
    },
  };
}

function IsMetadataRecord(value: unknown): value is MetadataRecord {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { schemaVersion?: unknown }).schemaVersion === offlinePackMetadataSchemaVersion
    && Array.isArray((value as { packs?: unknown }).packs);
}

function ReadStoredPacks(value: unknown): OfflinePackReference[] {
  if (!IsMetadataRecord(value)) return [];
  return value.packs
    .filter(IsOfflinePackReference)
    .map(CloneReference);
}

function IsOfflinePackReference(value: unknown): value is OfflinePackReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<OfflinePackReference>;
  if (!packIdPattern.test(String(candidate.id || ''))
    || !packVersionPattern.test(String(candidate.version || ''))
    || (candidate.status !== 'installing' && candidate.status !== 'ready')
    || !Number.isSafeInteger(candidate.updatedAt)
    || !Array.isArray(candidate.resources)) return false;
  if (candidate.status === 'installing'
    && (!Number.isSafeInteger(candidate.leaseExpiresAt) || (candidate.leaseExpiresAt as number) <= 0)) return false;
  if (candidate.status === 'ready' && candidate.leaseExpiresAt !== null) return false;
  try {
    ValidateOfflinePack(candidate as Pick<OfflinePackDescriptor, 'id' | 'version' | 'scope' | 'resources'>);
  } catch {
    return false;
  }
  return true;
}
