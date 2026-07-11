function normalizeSiteUrl(value: string | undefined, fallback: string) {
  const url = value?.trim() || fallback;
  return url.replace(/\/+$/, '');
}

export const siteUrls = {
  hub: normalizeSiteUrl(
    process.env.NEXT_PUBLIC_REHABTRAINERHUB_URL || process.env.NEXT_PUBLIC_SITE_URL,
    'https://rehabtrainerhub.pages.dev',
  ),
  stroke: normalizeSiteUrl(process.env.NEXT_PUBLIC_STROKETRAINER_URL, 'https://stroketrainer.pages.dev'),
  vision: normalizeSiteUrl(process.env.NEXT_PUBLIC_VISIONTRAINER_URL, 'https://visiontrainer.pages.dev'),
  brain: normalizeSiteUrl(process.env.NEXT_PUBLIC_BRAINTRAINER_URL, 'https://braintrainer.pages.dev'),
};
