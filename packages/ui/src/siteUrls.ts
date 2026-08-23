export const defaultSiteUrls = {
  hub: 'https://trainerhub.cc',
} as const;

export type SiteUrlKey = keyof typeof defaultSiteUrls;
export type SiteUrls = typeof defaultSiteUrls;

export function NormalizeSiteUrl(value: string | null | undefined, fallback: string) {
  const url = value?.trim() || fallback;
  return url.replace(/\/+$/, '');
}
