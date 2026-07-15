import { defaultSiteUrls, normalizeSiteUrl } from '@rehab-trainer/ui/siteUrls';

export const siteUrls = {
  hub: normalizeSiteUrl(
    process.env.NEXT_PUBLIC_REHABTRAINERHUB_URL || process.env.NEXT_PUBLIC_SITE_URL,
    defaultSiteUrls.hub,
  ),
  stroke: normalizeSiteUrl(process.env.NEXT_PUBLIC_STROKETRAINER_URL, defaultSiteUrls.stroke),
  vision: normalizeSiteUrl(process.env.NEXT_PUBLIC_VISIONTRAINER_URL, defaultSiteUrls.vision),
  brain: normalizeSiteUrl(process.env.NEXT_PUBLIC_BRAINTRAINER_URL, defaultSiteUrls.brain),
};
