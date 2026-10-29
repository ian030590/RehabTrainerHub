// The blog also publishes 數位學習／AI應用 posts; only these tags are 衛教.
export const educationCategories = ['中風復健', '視覺復健', '動作復健', '認知復健'];
export const educationFeedProxyPath = '/api/education-feed';
const productionFeedUrl = 'https://trainerhub.cc/api/education-feed';

export interface EducationLink {
  title: string;
  summary: string;
  url: string;
  categories: string[];
  authorName: string;
  publishedAt: string;
}

function IsPlainText(value: unknown): value is string {
  return typeof value === 'string' && value === value.replace(/\s+/g, ' ').trim()
    && !/<\/?[a-z][^>]*>|<!--/i.test(value);
}

function ValidateEducationLinks(body: unknown): EducationLink[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || !('links' in body) || !Array.isArray(body.links)) throw new Error('Invalid education feed response');
  const links: EducationLink[] = [];
  for (const item of body.links) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || !IsPlainText(item.title) || !item.title || !IsPlainText(item.summary)
      || Array.from(item.summary).length > 160 || typeof item.authorName !== 'string'
      || typeof item.publishedAt !== 'string' || typeof item.url !== 'string'
      || !Array.isArray(item.categories) || !item.categories.every((category: unknown) => typeof category === 'string')) continue;
    const categories = educationCategories.filter(category => item.categories.includes(category));
    if (!categories.length) continue;
    if (item.publishedAt) {
      const date = new Date(item.publishedAt);
      if (Number.isNaN(date.getTime()) || date.toISOString() !== item.publishedAt) continue;
    }
    try {
      const url = new URL(item.url);
      if (!['https:', 'http:'].includes(url.protocol) || url.host !== 'blog.trainerhub.cc'
        || url.username || url.password) continue;
      url.protocol = 'https:';
      links.push({
        title: item.title, summary: item.summary, url: url.href, categories,
        authorName: item.authorName, publishedAt: item.publishedAt,
      });
    } catch {
      continue;
    }
  }
  links.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const seenUrls = new Set<string>();
  return links.filter(link => {
    if (seenUrls.has(link.url)) return false;
    seenUrls.add(link.url);
    return true;
  });
}

async function ReadEducationLinks(url: string, signal?: AbortSignal): Promise<EducationLink[]> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`Education feed returned ${response.status}`);
  return ValidateEducationLinks(await response.json());
}

export async function FetchEducationLinks(signal?: AbortSignal): Promise<EducationLink[]> {
  return ReadEducationLinks(educationFeedProxyPath, signal);
}

export async function LoadEducationLinks(): Promise<EducationLink[]> {
  try {
    return await ReadEducationLinks(productionFeedUrl, AbortSignal.timeout(10_000));
  } catch (error) {
    // Builds have no Blogger key; the browser retries when production is unavailable or still serves RSS.
    console.warn('Could not prerender education links:', error);
    return [];
  }
}
