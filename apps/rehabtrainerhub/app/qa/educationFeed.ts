export const educationFeedUrl = 'https://ian.trainerhub.cc/rss.xml';

// The personal site also publishes 數位學習／AI應用 posts; only these tags are 衛教.
export const educationCategories = ['中風復健', '視覺復健', '動作復健', '認知復健'];

const allowedArticleHosts = new Set(['ian.trainerhub.cc', 'ian030590.trainerhub.cc']);

const xmlEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

export interface EducationLink {
  title: string;
  summary: string;
  url: string;
  categories: string[];
  authorName: string;
  publishedAt: string;
}

function DecodeXmlText(value: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(value);
  if (cdata) return cdata[1].trim();
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] !== '#') return xmlEntities[name.toLowerCase()] ?? entity;
    const codePoint = name[1].toLowerCase() === 'x'
      ? Number.parseInt(name.slice(2), 16)
      : Number.parseInt(name.slice(1), 10);
    return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
  }).trim();
}

function ReadTags(block: string, name: string): string[] {
  const pattern = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g');
  return Array.from(block.matchAll(pattern), (match) => DecodeXmlText(match[1]));
}

function ReadArticleUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedArticleHosts.has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function ReadPublishedAt(value: string): string {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
}

export function ParseEducationFeed(xml: string): EducationLink[] {
  const links: EducationLink[] = [];
  const seenUrls = new Set<string>();
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const categories = ReadTags(item, 'category')
      .filter((category) => educationCategories.includes(category));
    if (categories.length === 0) continue;
    const url = ReadArticleUrl(ReadTags(item, 'link')[0] ?? '');
    const title = ReadTags(item, 'title')[0] ?? '';
    if (!url || !title || seenUrls.has(url)) continue;
    seenUrls.add(url);
    // RSS 2.0 author is "email (display name)"; only the name is shown.
    const author = /\(([^)\s]+)/.exec(ReadTags(item, 'author')[0] ?? '');
    links.push({
      title,
      summary: ReadTags(item, 'description')[0] ?? '',
      url,
      categories,
      authorName: author?.[1] ?? '',
      publishedAt: ReadPublishedAt(ReadTags(item, 'pubDate')[0] ?? ''),
    });
  }
  return links;
}

export async function FetchEducationLinks(signal?: AbortSignal): Promise<EducationLink[]> {
  const response = await fetch(educationFeedUrl, {
    headers: { Accept: 'application/rss+xml, application/xml' },
    signal,
  });
  if (!response.ok) throw new Error(`Education feed returned ${response.status}`);
  return ParseEducationFeed(await response.text());
}

export async function LoadEducationLinks(): Promise<EducationLink[]> {
  try {
    return await FetchEducationLinks(AbortSignal.timeout(10_000));
  } catch (error) {
    // The rest of the static QA page remains available when the personal site
    // is down; the browser retries the feed and build logs expose the gap.
    console.warn('Could not prerender education links:', error);
    return [];
  }
}
