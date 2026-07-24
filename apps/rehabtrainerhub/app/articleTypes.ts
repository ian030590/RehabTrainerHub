export type ArticleStatus = 'draft' | 'published';

export interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  coverImageUrl: string | null;
  status: ArticleStatus;
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ArticleCard = Omit<Article, 'content'>;

export interface ArticleInput {
  slug?: string;
  title: string;
  summary?: string;
  content: string;
  category?: string;
  coverImageUrl?: string | null;
  status: ArticleStatus;
}

export interface ArticleListResponse {
  articles: ArticleCard[];
  nextCursor: string | null;
}

export interface ArticleDetailResponse {
  article: Article;
}
