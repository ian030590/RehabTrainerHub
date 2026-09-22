export const subjectIdStorageKey = 'rehabtrainerhub.subject-id.v1';

const subjectIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const authenticatedSubjectIdStoragePrefix = 'rehabtrainerhub.auth-subject-id.v1.';
const memorySubjectIds = new Map<string, string>();

export function IsSubjectId(value: unknown): value is string {
  return typeof value === 'string' && subjectIdPattern.test(value);
}

export function GetOrCreateSubjectId(): string {
  return GetOrCreateStoredSubjectId(subjectIdStorageKey, 'guest');
}

export function GetOrCreateAuthenticatedSubjectId(userId: string): string {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return GetOrCreateSubjectId();
  return GetOrCreateStoredSubjectId(
    `${authenticatedSubjectIdStoragePrefix}${encodeURIComponent(normalizedUserId)}`,
    `authenticated:${normalizedUserId}`,
  );
}

export function GetOrCreateSubjectIdForUser(userId: string | null | undefined): string {
  return userId ? GetOrCreateAuthenticatedSubjectId(userId) : GetOrCreateSubjectId();
}

function GetOrCreateStoredSubjectId(storageKey: string, memoryKey: string): string {
  const memorySubjectId = memorySubjectIds.get(memoryKey);
  if (typeof window === 'undefined') {
    if (memorySubjectId) return memorySubjectId;
    const created = crypto.randomUUID();
    memorySubjectIds.set(memoryKey, created);
    return created;
  }

  try {
    const existing = window.localStorage.getItem(storageKey);
    if (IsSubjectId(existing)) return existing;

    const created = crypto.randomUUID();
    window.localStorage.setItem(storageKey, created);
    const stored = window.localStorage.getItem(storageKey);
    const result = IsSubjectId(stored) ? stored : created;
    memorySubjectIds.set(memoryKey, result);
    return result;
  } catch {
    const created = memorySubjectId ?? crypto.randomUUID();
    memorySubjectIds.set(memoryKey, created);
    return created;
  }
}
