export const hubTrainingCompleteMessageType = 'rehab-trainer:training-complete' as const;
export const hubTrainingActiveMessageType = 'rehab-trainer:training-active' as const;
export const hubTrainingExitMessageType = 'rehab-trainer:training-exit' as const;
export const hubTrainingReadyMessageType = 'rehab-trainer:training-ready' as const;

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

type HubTrainingMessage =
  | HubTrainingCompleteMessage
  | HubTrainingActiveMessage
  | HubTrainingExitMessage
  | HubTrainingReadyMessage;

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
