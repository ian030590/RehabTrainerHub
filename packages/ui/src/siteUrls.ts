export const defaultSiteUrls = {
  hub: 'https://trainerhub.cc',
  motor: 'https://motor.trainerhub.cc',
  vision: 'https://vision.trainerhub.cc',
  brain: 'https://brain.trainerhub.cc',
  mouth: 'https://mouth.trainerhub.cc',
} as const;

export type SiteUrlKey = keyof typeof defaultSiteUrls;
export type SiteUrls = typeof defaultSiteUrls;

export function NormalizeSiteUrl(value: string | null | undefined, fallback: string) {
  const url = value?.trim() || fallback;
  return url.replace(/\/+$/, '');
}
