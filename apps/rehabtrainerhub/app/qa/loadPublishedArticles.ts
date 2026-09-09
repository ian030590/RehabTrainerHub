import type { Article, ArticleDetailResponse, ArticleListResponse } from '../articleTypes';
import { siteUrls } from '../siteUrls';

export async function LoadPublishedArticles(): Promise<Article[]> {
  const articles: Article[] = [];
  const visited = new Set<string>();
  let cursor = '';
  try {
    do {
      if (visited.has(cursor)) throw new Error('Repeated article pagination cursor');
      visited.add(cursor);
      const response = await fetch(`${siteUrls.hub}/api/articles?cursor=${encodeURIComponent(cursor)}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Article list returned ${response.status}`);
      const page = await response.json() as ArticleListResponse;
      if (!Array.isArray(page.articles)) throw new Error('Invalid article list');
      for (const card of page.articles) {
        if (card.status !== 'published') continue;
        const detail = await fetch(`${siteUrls.hub}/api/articles/${encodeURIComponent(card.slug)}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!detail.ok) throw new Error(`Article detail returned ${detail.status}`);
        const { article } = await detail.json() as ArticleDetailResponse;
        if (article.status === 'published' && typeof article.content === 'string') articles.push(article);
      }
      cursor = page.nextCursor ?? '';
    } while (cursor);
  } catch (error) {
    // The rest of the static QA page remains available during an API outage.
    // The client retries the public list; build logs explicitly expose the gap.
    console.warn('Could not prerender every published article:', error);
  }
  return articles;
}
