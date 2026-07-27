export const hubTrainingCompleteMessageType = 'rehab-trainer:training-complete' as const;

export interface HubTrainingCompleteMessage {
  type: typeof hubTrainingCompleteMessageType;
}

export function IsHubOrigin(url: string): boolean {
  try {
    const { hostname, origin, protocol } = new URL(url);
    return origin === 'https://trainerhub.cc'
      || origin === 'https://rehabtrainerhub.pages.dev'
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

export function NotifyHubTrainingComplete() {
  if (typeof window === 'undefined'
    || window.self === window.top
    || new URLSearchParams(window.location.search).get('embed') !== 'hub') {
    return;
  }

  const message: HubTrainingCompleteMessage = { type: hubTrainingCompleteMessageType };
  // The parent Hub verifies both this trainer's origin and iframe window before
  // accepting the message. Use the referrer-derived origin when available, but
  // retain delivery for privacy settings that intentionally omit referrers.
  window.parent.postMessage(message, GetEmbeddedHubOrigin() ?? '*');
}

export function IsHubTrainingCompleteMessage(value: unknown): value is HubTrainingCompleteMessage {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && value.type === hubTrainingCompleteMessageType;
}
