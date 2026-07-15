import { defaultSiteUrls, normalizeSiteUrl } from '@rehab-trainer/ui/siteUrls';

export const siteUrls = {
  hub: normalizeSiteUrl(import.meta.env.VITE_REHABTRAINERHUB_URL, defaultSiteUrls.hub),
  stroke: normalizeSiteUrl(import.meta.env.VITE_STROKETRAINER_URL, defaultSiteUrls.stroke),
  vision: normalizeSiteUrl(import.meta.env.VITE_VISIONTRAINER_URL, defaultSiteUrls.vision),
  brain: normalizeSiteUrl(import.meta.env.VITE_BRAINTRAINER_URL, defaultSiteUrls.brain),
};
