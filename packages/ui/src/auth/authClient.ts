export type AuthProvider = 'google';
export type AuthLocale = 'zh-TW' | 'en';
export type HabitStatus = 'none' | 'current' | 'former';
export type HabitInterval = 'week' | 'month';
export type SmokingUnit = 'packs' | 'cigarettes';
export type AlcoholUnit = 'bottles' | 'cans' | 'cups';

export const authChangedEvent = 'rehab-auth-changed';
export const authMessageType = 'rehabtrainerhub-auth-session';

const authTokenKey = 'rehabtrainerhub.auth.token';
const localTrainingStorageKeys = [
  'motor_trainer_training_records_v1',
  'motor_trainer_users',
  'motor_trainer_active_user',
  'vision_trainer_training_records_v1',
  'vision_trainer_training_high_scores_v1',
  'vision_trainer_users',
  'vision_trainer_active_user',
  'brain_trainer_training_records_v1',
  'mouth_trainer_training_records_v1',
  'mouth_trainer_users',
  'mouth_trainer_active_user',
  'mouth_trainer_voice_defender_vocabulary_v1',
  'mouth_trainer_voice_defender_vocabulary_v2',
];
const localTrainingDatabases = [
  'motor-trainer-training-records',
  'vision_trainer_training_records',
];
const localTrainingStorageKeyPrefixes = [
  'mouth_trainer_tongue_settings_',
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
  type: typeof authMessageType;
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

export interface RehabDailyTask {
  id: string;
  title: string;
  current: number;
  target: number;
  completed: boolean;
}

export interface RehabAchievement {
  id: string;
  title: string;
  requiredDays: number;
  achieved: boolean;
}

export interface RehabProgress {
  serverDate: string;
  timeZone: string;
  startedOn: string | null;
  daysSinceStart: number;
  rehabilitationDays: number;
  totalRehabilitationDays: number;
  dailyTasks: RehabDailyTask[];
  achievements: RehabAchievement[];
}

export function GetAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(authTokenKey);
}

export function SetAuthToken(token: string, dispatchEvent = true): void {
  window.localStorage.setItem(authTokenKey, token);
  if (dispatchEvent) window.dispatchEvent(new Event(authChangedEvent));
}

export function ClearAuthToken(): void {
  window.localStorage.removeItem(authTokenKey);
  window.dispatchEvent(new Event(authChangedEvent));
}

export function HasAuthToken(): boolean {
  return Boolean(GetAuthToken());
}

export function GetAuthUserNameFromToken(): string | null {
  const token = GetAuthToken();
  if (!token) return null;

  const [encodedPayload] = token.split('.');
  if (!encodedPayload) return null;

  try {
    const payload = JSON.parse(Base64UrlDecodeUtf8(encodedPayload)) as { name?: unknown; email?: unknown };
    return typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : typeof payload.email === 'string' && payload.email.trim()
        ? payload.email.trim()
        : null;
  } catch {
    return null;
  }
}

function Base64UrlDecodeUtf8(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }

  const percentEncoded = Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
  return decodeURIComponent(percentEncoded);
}

export function NormalizeAuthApiBase(apiBase: string | undefined): string {
  const trimmed = apiBase?.trim() ?? '';
  return trimmed.replace(/\/+$/, '');
}

export function BuildApiUrl(apiBase: string | undefined, path: string): string {
  const normalizedBase = NormalizeAuthApiBase(apiBase);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function GetAuthApiOrigin(apiBase: string | undefined): string | null {
  if (typeof window === 'undefined') return null;
  const normalizedBase = NormalizeAuthApiBase(apiBase);
  try {
    return new URL(normalizedBase || window.location.origin, window.location.origin).origin;
  } catch {
    return null;
  }
}

export function BuildAuthStartUrl(
  provider: AuthProvider,
  options: {
    apiBase?: string;
    locale?: AuthLocale;
    privacyAccepted: boolean;
    returnTo?: string;
  },
): string {
  const returnTo = options.returnTo ?? window.location.href;
  const url = new URL(BuildApiUrl(options.apiBase, '/api/auth/start'), window.location.origin);
  url.searchParams.set('provider', provider);
  url.searchParams.set('returnTo', returnTo);
  url.searchParams.set('privacyAccepted', options.privacyAccepted ? '1' : '0');
  url.searchParams.set('locale', options.locale ?? 'zh-TW');
  return url.toString();
}

export function OpenAuthPopup(url: string): Window | null {
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

export function IsAuthSessionMessage(value: unknown): value is AuthSessionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message.type === authMessageType && typeof message.token === 'string';
}

export async function FetchCurrentAuthUser(apiBase?: string): Promise<AuthUser | null> {
  const token = GetAuthToken();
  if (!token) return null;

  const response = await fetch(BuildApiUrl(apiBase, '/api/auth/me'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    ClearAuthToken();
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to load auth session. Status ${response.status}`);
  }

  const payload = await response.json() as { user?: AuthUser };
  return payload.user ?? null;
}

export async function FetchSharedAuthSession(apiBase?: string): Promise<SharedAuthSession | null> {
  const response = await fetch(BuildApiUrl(apiBase, '/api/auth/session'), {
    credentials: 'include',
  });

  if (response.status === 401) return null;

  if (!response.ok) {
    throw new Error(`Unable to load shared auth session. Status ${response.status}`);
  }

  const payload = await response.json() as Partial<SharedAuthSession>;
  return payload.token && payload.user ? { token: payload.token, user: payload.user } : null;
}

export async function LogoutAuthSession(apiBase?: string): Promise<void> {
  try {
    await fetch(BuildApiUrl(apiBase, '/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    await ClearLocalTrainerData();
    ClearAuthToken();
  }
}

export async function ClearLocalTrainerData(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    for (const key of localTrainingStorageKeys) {
      window.localStorage.removeItem(key);
    }
    const keys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    );
    for (const key of keys) {
      if (!key) continue;
      if (localTrainingStorageKeyPrefixes.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Best-effort shared-device cleanup; logout must still clear the auth token.
  }
  await Promise.allSettled(localTrainingDatabases.map(DeleteIndexedDatabase));
}

function DeleteIndexedDatabase(name: string): Promise<void> {
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

async function ParseAuthSessionResponse(response: Response, fallbackMessage: string): Promise<SharedAuthSession> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage}. Status ${response.status}`);
  }

  const payload = await response.json() as Partial<SharedAuthSession>;
  if (!payload.token || !payload.user) {
    throw new Error(`${fallbackMessage}. Missing session payload.`);
  }

  return { token: payload.token, user: payload.user };
}

export async function RegisterPasswordAccount(
  apiBase: string | undefined,
  payload: PasswordAccountRegisterPayload,
): Promise<void> {
  const response = await fetch(BuildApiUrl(apiBase, '/api/auth/password/register'), {
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

export async function LoginPasswordAccount(
  apiBase: string | undefined,
  payload: PasswordAccountLoginPayload,
): Promise<SharedAuthSession> {
  const response = await fetch(BuildApiUrl(apiBase, '/api/auth/password/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return ParseAuthSessionResponse(response, 'Unable to sign in');
}

export async function SaveAuthProfile(apiBase: string | undefined, profile: RehabProfile): Promise<AuthUser> {
  const token = GetAuthToken();
  if (!token) throw new Error('Cannot save profile without an auth token.');

  const response = await fetch(BuildApiUrl(apiBase, '/api/auth/profile'), {
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

export async function SaveRemoteTrainingRecord(
  apiBase: string | undefined,
  payload: RemoteTrainingRecordPayload,
): Promise<boolean> {
  const token = GetAuthToken();
  if (!token) return false;

  const response = await fetch(BuildApiUrl(apiBase, '/api/records'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    ClearAuthToken();
    return false;
  }

  if (!response.ok) {
    throw new Error(`Unable to save remote training record. Status ${response.status}`);
  }

  return true;
}

export async function GetRemoteTrainingRecords(
  apiBase: string | undefined,
  appId: string,
): Promise<RemoteTrainingRecord[] | null> {
  const token = GetAuthToken();
  if (!token) return null;

  const url = new URL(BuildApiUrl(apiBase, '/api/records'), window.location.origin);
  url.searchParams.set('appId', appId);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    ClearAuthToken();
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to load remote training records. Status ${response.status}`);
  }

  const payload = await response.json() as { records?: RemoteTrainingRecord[] };
  return payload.records ?? [];
}

export async function FetchRehabProgress(apiBase?: string): Promise<RehabProgress | null> {
  const token = GetAuthToken();
  if (!token) return null;

  const response = await fetch(BuildApiUrl(apiBase, '/api/progress'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    ClearAuthToken();
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to load rehabilitation progress. Status ${response.status}`);
  }

  return response.json() as Promise<RehabProgress>;
}
