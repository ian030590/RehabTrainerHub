export const subjectIdStorageKey = 'rehabtrainerhub.subject-id.v1';

const subjectIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let memorySubjectId: string | null = null;

export function IsSubjectId(value: unknown): value is string {
  return typeof value === 'string' && subjectIdPattern.test(value);
}

export function GetOrCreateSubjectId(): string {
  if (typeof window === 'undefined') return memorySubjectId ??= crypto.randomUUID();

  try {
    const existing = window.localStorage.getItem(subjectIdStorageKey);
    if (IsSubjectId(existing)) return existing;

    const created = crypto.randomUUID();
    window.localStorage.setItem(subjectIdStorageKey, created);
    const stored = window.localStorage.getItem(subjectIdStorageKey);
    memorySubjectId = IsSubjectId(stored) ? stored : created;
    return memorySubjectId;
  } catch {
    return memorySubjectId ??= crypto.randomUUID();
  }
}
