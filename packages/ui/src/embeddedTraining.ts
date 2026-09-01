export const hubTrainingCompleteMessageType = 'rehab-trainer:training-complete' as const;
export const hubTrainingActiveMessageType = 'rehab-trainer:training-active' as const;
export const hubTrainingExitMessageType = 'rehab-trainer:training-exit' as const;
export const hubTrainingReadyMessageType = 'rehab-trainer:training-ready' as const;
export const hubTrainingConfigureMessageType = 'rehab-trainer:training-configure' as const;
export const hubGameSettingsSchema = 'rehab-trainer.game-settings/v1' as const;
export const hubGameSettingsMessageType = 'rehab-trainer:game-settings' as const;

export interface HubGameSettingsMessage {
  schema: typeof hubGameSettingsSchema;
  type: typeof hubGameSettingsMessageType;
  gameId: string;
  sessionNonce: string;
  settings: Record<string, string | number | boolean>;
}

export interface HubTrainingCompleteMessage {
  type: typeof hubTrainingCompleteMessageType;
}

export interface HubTrainingActiveMessage {
  type: typeof hubTrainingActiveMessageType;
  active: boolean;
}

export interface HubTrainingExitMessage {
  type: typeof hubTrainingExitMessageType;
}

export interface HubTrainingReadyMessage {
  type: typeof hubTrainingReadyMessageType;
}

export interface HubTrainingConfigureMessage {
  type: typeof hubTrainingConfigureMessageType;
}

type HubTrainingMessage =
  | HubTrainingCompleteMessage
  | HubTrainingActiveMessage
  | HubTrainingExitMessage
  | HubTrainingReadyMessage
  | HubTrainingConfigureMessage;

let hostedGameSettings: Readonly<Record<string, string | number | boolean>> | null = null;
let removeHostedGameSettingsListener: (() => void) | null = null;

export function IsTrustedTrainingFrameMessage(
  event: Pick<MessageEvent<unknown>, 'origin' | 'source'>,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null,
): boolean {
  return event.origin === expectedOrigin
    && expectedSource !== null
    && event.source === expectedSource;
}

export function IsHubOrigin(url: string): boolean {
  try {
    const { hostname, origin, protocol } = new URL(url);
    return origin === 'https://trainerhub.cc'
      || (protocol === 'https:' && hostname.endsWith('.rehabtrainerhub.pages.dev'))
      || (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

export function GetEmbeddedHubOrigin(): string | null {
  if (typeof window === 'undefined'
    || window.self === window.top
    || new URLSearchParams(window.location.search).get('embed') !== 'hub'
    || !IsHubOrigin(document.referrer)) {
    return null;
  }

  return new URL(document.referrer).origin;
}

export function IsEmbeddedHubTraining(): boolean {
  return GetEmbeddedHubOrigin() !== null;
}

export function CreateHubGameSettingsMessage(
  gameId: string,
  sessionNonce: string,
  settings: Record<string, string | number | boolean>,
): HubGameSettingsMessage {
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(gameId)
    || !/^[A-Za-z0-9_-]{32,128}$/.test(sessionNonce)
    || !IsPlainSettings(settings)) {
    throw new TypeError('Invalid hosted game settings message.');
  }
  return {
    schema: hubGameSettingsSchema,
    type: hubGameSettingsMessageType,
    gameId,
    sessionNonce,
    settings: { ...settings },
  };
}

export function InstallHostedGameSettingsReceiver(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (removeHostedGameSettingsListener) return removeHostedGameSettingsListener;
  const expectedOrigin = GetEmbeddedHubOrigin();
  const expectedGameId = GetOfficialGameIdFromPath(window.location.pathname);
  const handleMessage = (event: MessageEvent<unknown>) => {
    if (!expectedOrigin
      || !expectedGameId
      || event.origin !== expectedOrigin
      || event.source !== window.parent
      || !IsHubGameSettingsMessage(event.data, expectedGameId)) return;
    hostedGameSettings = Object.freeze({ ...event.data.settings });
    window.dispatchEvent(new CustomEvent('rehab-trainer:game-settings-ready', {
      detail: hostedGameSettings,
    }));
  };
  window.addEventListener('message', handleMessage);
  removeHostedGameSettingsListener = () => {
    window.removeEventListener('message', handleMessage);
    removeHostedGameSettingsListener = null;
  };
  return removeHostedGameSettingsListener;
}

export function GetHostedGameSettings(): Readonly<Record<string, string | number | boolean>> | null {
  return hostedGameSettings;
}

export function IsHubGameSettingsMessage(
  value: unknown,
  expectedGameId?: string,
): value is HubGameSettingsMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Partial<HubGameSettingsMessage>;
  const requiredKeys = ['schema', 'type', 'gameId', 'sessionNonce', 'settings'];
  const keys = Reflect.ownKeys(value);
  return keys.length === requiredKeys.length
    && keys.every((key) => typeof key === 'string'
      && requiredKeys.includes(key)
      && Object.prototype.propertyIsEnumerable.call(value, key))
    && message.schema === hubGameSettingsSchema
    && message.type === hubGameSettingsMessageType
    && typeof message.gameId === 'string'
    && (!expectedGameId || message.gameId === expectedGameId)
    && typeof message.sessionNonce === 'string'
    && /^[A-Za-z0-9_-]{32,128}$/.test(message.sessionNonce)
    && IsPlainSettings(message.settings);
}

function PostHubTrainingMessage(message: HubTrainingMessage) {
  if (typeof window === 'undefined'
    || window.self === window.top
    || new URLSearchParams(window.location.search).get('embed') !== 'hub') {
    return;
  }

  // The parent Hub verifies both this trainer's origin and iframe window before
  // accepting the message. Use the referrer-derived origin when available, but
  // retain delivery for privacy settings that intentionally omit referrers.
  window.parent.postMessage(message, GetEmbeddedHubOrigin() ?? '*');
}

export function NotifyHubTrainingComplete() {
  PostHubTrainingMessage({ type: hubTrainingCompleteMessageType });
}

export function NotifyHubTrainingActive(active: boolean) {
  PostHubTrainingMessage({ type: hubTrainingActiveMessageType, active });
}

export function NotifyHubTrainingAbort() {
  NotifyHubTrainingActive(false);
  NotifyHubTrainingExit();
}

export function NotifyHubTrainingExit() {
  PostHubTrainingMessage({ type: hubTrainingExitMessageType });
}

export function NotifyHubTrainingReady() {
  PostHubTrainingMessage({ type: hubTrainingReadyMessageType });
}

/**
 * Ask the verified Hub parent to unmount this runtime and show its catalog-owned
 * settings form again. Standalone game PWAs return false and keep their local
 * configuration flow.
 */
export function RequestHubTrainingConfiguration(): boolean {
  if (!IsEmbeddedHubTraining()) return false;
  NotifyHubTrainingActive(false);
  PostHubTrainingMessage({ type: hubTrainingConfigureMessageType });
  return true;
}

export function IsHubTrainingCompleteMessage(value: unknown): value is HubTrainingCompleteMessage {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === hubTrainingCompleteMessageType;
}

export function IsHubTrainingActiveMessage(value: unknown): value is HubTrainingActiveMessage {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === hubTrainingActiveMessageType
    && 'active' in value
    && typeof value.active === 'boolean';
}

export function IsHubTrainingExitMessage(value: unknown): value is HubTrainingExitMessage {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === hubTrainingExitMessageType;
}

export function IsHubTrainingReadyMessage(value: unknown): value is HubTrainingReadyMessage {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === hubTrainingReadyMessageType;
}

export function IsHubTrainingConfigureMessage(value: unknown): value is HubTrainingConfigureMessage {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === hubTrainingConfigureMessageType;
}

function GetOfficialGameIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/games\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    const gameId = decodeURIComponent(match[1]);
    return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(gameId) ? gameId : null;
  } catch {
    return null;
  }
}

function IsPlainSettings(value: unknown): value is Record<string, string | number | boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length <= 64 && keys.every((key) => {
    if (typeof key !== 'string'
      || !Object.prototype.propertyIsEnumerable.call(value, key)
      || !/^[a-z][A-Za-z0-9_.-]{0,63}$/.test(key)
      || /(auth|authorization|birthday|cookie|credential|dob|email|jwt|name|participant|password|phone|secret|session|token|user)/i.test(key)) return false;
    const setting = (value as Record<string, unknown>)[key];
    return typeof setting === 'boolean'
      || (typeof setting === 'string' && setting.length <= 80)
      || (typeof setting === 'number' && Number.isFinite(setting));
  });
}
