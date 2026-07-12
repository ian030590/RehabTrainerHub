export type AuthProvider = 'google';
export type AuthLocale = 'zh-TW' | 'en';
export type HabitStatus = 'none' | 'current' | 'former';
export type HabitInterval = 'week' | 'month';
export type SmokingUnit = 'packs' | 'cigarettes';
export type AlcoholUnit = 'bottles' | 'cans' | 'cups';

export const AUTH_CHANGED_EVENT = 'rehab-auth-changed';
export const AUTH_MESSAGE_TYPE = 'rehabtrainerhub-auth-session';

const AUTH_TOKEN_KEY = 'rehabtrainerhub.auth.token';
const LOCAL_TRAINING_STORAGE_KEYS = [
  'stroke_trainer_training_records_v1',
  'stroke_trainer_users',
  'stroke_trainer_active_user',
  'vision_trainer_training_records_v1',
  'vision_trainer_training_high_scores_v1',
  'vision_trainer_users',
  'vision_trainer_active_user',
  'brain_trainer_training_records_v1',
];
const LOCAL_TRAINING_DATABASES = [
  'stroke-trainer-training-records',
  'vision_trainer_training_records',
];

export interface HabitFrequency<Unit extends string> {
  interval: HabitInterval;
  amount: string;
  unit: Unit;
}

export interface RehabProfile {
  ageRange: string;
  gender: string;
  nationality: string;
  chronicDiagnoses: string[];
  smokingStatus: HabitStatus;
  smokingFrequency?: HabitFrequency<SmokingUnit>;
  alcoholStatus: HabitStatus;
  alcoholFrequency?: HabitFrequency<AlcoholUnit>;
}

export interface AuthUser {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  profileCompleted: boolean;
  privacyAcceptedAt?: string;
  profile?: RehabProfile;
}

export interface AuthSessionMessage {
  type: typeof AUTH_MESSAGE_TYPE;
  token: string;
  user: AuthUser;
}

export interface SharedAuthSession {
  token: string;
  user: AuthUser;
}

export interface PasswordAccountRegisterPayload {
  displayName: string;
  email: string;
  password: string;
  privacyAccepted: boolean;
}

export interface PasswordAccountLoginPayload {
  email: string;
  password: string;
}

export interface RemoteTrainingRecord {
  id: string;
  savedAt: string;
  userName: string;
  moduleId: string;
  difficulty?: string;
  gameId?: string;
  trainingDate?: string;
}

export interface RemoteTrainingRecordPayload {
  appId: string;
  record: RemoteTrainingRecord;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string, dispatchEvent = true): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (dispatchEvent) window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

export function getAuthUserNameFromToken(): string | null {
  const token = getAuthToken();
  if (!token) return null;

  const [encodedPayload] = token.split('.');
  if (!encodedPayload) return null;

  try {
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { name?: unknown; email?: unknown };
    return typeof payload.name === 'string' && payload.name.trim()
      ? payload.name
      : typeof payload.email === 'string' && payload.email.trim()
        ? payload.email
        : null;
  } catch {
    return null;
  }
}

export function normalizeAuthApiBase(apiBase: string | undefined): string {
  const trimmed = apiBase?.trim() ?? '';
  return trimmed.replace(/\/+$/, '');
}

export function buildApiUrl(apiBase: string | undefined, path: string): string {
  const normalizedBase = normalizeAuthApiBase(apiBase);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function getAuthApiOrigin(apiBase: string | undefined): string | null {
  if (typeof window === 'undefined') return null;
  const normalizedBase = normalizeAuthApiBase(apiBase);
  try {
    return new URL(normalizedBase || window.location.origin, window.location.origin).origin;
  } catch {
    return null;
  }
}

export function buildAuthStartUrl(
  provider: AuthProvider,
  options: {
    apiBase?: string;
    locale?: AuthLocale;
    privacyAccepted: boolean;
    returnTo?: string;
  },
): string {
  const returnTo = options.returnTo ?? window.location.href;
  const url = new URL(buildApiUrl(options.apiBase, '/api/auth/start'), window.location.origin);
  url.searchParams.set('provider', provider);
  url.searchParams.set('returnTo', returnTo);
  url.searchParams.set('privacyAccepted', options.privacyAccepted ? '1' : '0');
  url.searchParams.set('locale', options.locale ?? 'zh-TW');
  return url.toString();
}

export function openAuthPopup(url: string): Window | null {
  const width = 560;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  return window.open(
    url,
    'rehabtrainerhub-auth',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
}

export function isAuthSessionMessage(value: unknown): value is AuthSessionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message.type === AUTH_MESSAGE_TYPE && typeof message.token === 'string';
}

export async function fetchCurrentAuthUser(apiBase?: string): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) return null;

  const response = await fetch(buildApiUrl(apiBase, '/api/auth/me'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    clearAuthToken();
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to load auth session. Status ${response.status}`);
  }

  const payload = await response.json() as { user?: AuthUser };
  return payload.user ?? null;
}

export async function fetchSharedAuthSession(apiBase?: string): Promise<SharedAuthSession | null> {
  const response = await fetch(buildApiUrl(apiBase, '/api/auth/session'), {
    credentials: 'include',
  });

  if (response.status === 401) return null;

  if (!response.ok) {
    throw new Error(`Unable to load shared auth session. Status ${response.status}`);
  }

  const payload = await response.json() as Partial<SharedAuthSession>;
  return payload.token && payload.user ? { token: payload.token, user: payload.user } : null;
}

export async function logoutAuthSession(apiBase?: string): Promise<void> {
  try {
    await fetch(buildApiUrl(apiBase, '/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    await clearLocalTrainerData();
    clearAuthToken();
  }
}

export async function clearLocalTrainerData(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    for (const key of LOCAL_TRAINING_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Best-effort shared-device cleanup; logout must still clear the auth token.
  }
  await Promise.allSettled(LOCAL_TRAINING_DATABASES.map(deleteIndexedDatabase));
}

function deleteIndexedDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      resolve();
      return;
    }
    const request = window.indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function parseAuthSessionResponse(response: Response, fallbackMessage: string): Promise<SharedAuthSession> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage}. Status ${response.status}`);
  }

  const payload = await response.json() as Partial<SharedAuthSession>;
  if (!payload.token || !payload.user) {
    throw new Error(`${fallbackMessage}. Missing session payload.`);
  }

  return { token: payload.token, user: payload.user };
}

export async function registerPasswordAccount(
  apiBase: string | undefined,
  payload: PasswordAccountRegisterPayload,
): Promise<void> {
  const response = await fetch(buildApiUrl(apiBase, '/api/auth/password/register'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Unable to create account. Status ${response.status}`);
  }
}

export async function loginPasswordAccount(
  apiBase: string | undefined,
  payload: PasswordAccountLoginPayload,
): Promise<SharedAuthSession> {
  const response = await fetch(buildApiUrl(apiBase, '/api/auth/password/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseAuthSessionResponse(response, 'Unable to sign in');
}

export async function saveAuthProfile(apiBase: string | undefined, profile: RehabProfile): Promise<AuthUser> {
  const token = getAuthToken();
  if (!token) throw new Error('Cannot save profile without an auth token.');

  const response = await fetch(buildApiUrl(apiBase, '/api/auth/profile'), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    throw new Error(`Unable to save profile. Status ${response.status}`);
  }

  const payload = await response.json() as { user: AuthUser };
  return payload.user;
}

export async function saveRemoteTrainingRecord(
  apiBase: string | undefined,
  payload: RemoteTrainingRecordPayload,
): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  const response = await fetch(buildApiUrl(apiBase, '/api/records'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    clearAuthToken();
    return false;
  }

  if (!response.ok) {
    throw new Error(`Unable to save remote training record. Status ${response.status}`);
  }

  return true;
}

export async function getRemoteTrainingRecords(
  apiBase: string | undefined,
  appId: string,
): Promise<RemoteTrainingRecord[] | null> {
  const token = getAuthToken();
  if (!token) return null;

  const url = new URL(buildApiUrl(apiBase, '/api/records'), window.location.origin);
  url.searchParams.set('appId', appId);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    clearAuthToken();
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to load remote training records. Status ${response.status}`);
  }

  const payload = await response.json() as { records?: RemoteTrainingRecord[] };
  return payload.records ?? [];
}
