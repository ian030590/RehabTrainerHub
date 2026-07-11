function normalizeSiteUrl(value: string | undefined, fallback: string) {
  const url = value?.trim() || fallback;
  return url.replace(/\/+$/, '');
}

export const siteUrls = {
  hub: normalizeSiteUrl(import.meta.env.VITE_REHABTRAINERHUB_URL, 'https://rehabtrainerhub.pages.dev'),
  stroke: normalizeSiteUrl(import.meta.env.VITE_STROKETRAINER_URL, 'https://stroketrainer.pages.dev'),
  vision: normalizeSiteUrl(import.meta.env.VITE_VISIONTRAINER_URL, 'https://visiontrainer.pages.dev'),
  brain: normalizeSiteUrl(import.meta.env.VITE_BRAINTRAINER_URL, 'https://braintrainer.pages.dev'),
};
