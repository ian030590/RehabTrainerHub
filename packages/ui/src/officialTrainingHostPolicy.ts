import type { TrainingCapability, TrainingModuleManifest } from '@rehab-trainer/training-contracts';
import { defaultSiteUrls } from './siteUrls';

export type OfficialIframeFeature =
  | 'autoplay'
  | 'camera'
  | 'microphone'
  | 'fullscreen'
  | 'gamepad';

export const officialTrainingHostRoutePrefix = '/official-training-host' as const;

export interface OfficialHostIframePolicy {
  src: string;
  sandboxTokens: readonly ['allow-scripts', 'allow-same-origin'];
  featureAllowlist: Readonly<Record<OfficialIframeFeature, "'self'" | "'none'">>;
  allowFullscreen: boolean;
  referrerPolicy: 'no-referrer';
}

export interface OfficialHostIframePolicyOptions {
  origin?: string;
  routePrefix?: string;
}

const capabilityForFeature: Readonly<Record<OfficialIframeFeature, TrainingCapability | 'audio'>> = {
  autoplay: 'audio',
  camera: 'camera',
  microphone: 'microphone',
  fullscreen: 'fullscreen',
  gamepad: 'gamepad',
};

export function CreateOfficialHostIframePolicy(
  manifest: Pick<TrainingModuleManifest, 'id' | 'capabilities'>,
  options: OfficialHostIframePolicyOptions = {},
): OfficialHostIframePolicy {
  const [domain, slug] = manifest.id.split(':');
  const origin = NormalizeOrigin(options.origin || defaultSiteUrls.hub);
  const routePrefix = NormalizeRoutePrefix(options.routePrefix || officialTrainingHostRoutePrefix);
  const capabilitySet = new Set(manifest.capabilities);
  const featureAllowlist = Object.fromEntries(
    (Object.keys(capabilityForFeature) as OfficialIframeFeature[]).map((feature) => [
      feature,
      capabilitySet.has(capabilityForFeature[feature]) ? "'self'" : "'none'",
    ]),
  ) as Readonly<Record<OfficialIframeFeature, "'self'" | "'none'">>;

  return Object.freeze({
    src: `${origin}${routePrefix}/${encodeURIComponent(domain)}/${encodeURIComponent(slug)}/`,
    sandboxTokens: ['allow-scripts', 'allow-same-origin'] as const,
    featureAllowlist,
    allowFullscreen: capabilitySet.has('fullscreen'),
    referrerPolicy: 'no-referrer',
  });
}

function NormalizeOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported origin protocol.');
    return url.origin;
  } catch {
    throw new TypeError('Official training host origin must be an absolute HTTP(S) URL.');
  }
}

function NormalizeRoutePrefix(value: string): string {
  const normalized = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(normalized)) {
    throw new TypeError('Official training host route prefix contains unsupported characters.');
  }
  return `/${normalized}`;
}
