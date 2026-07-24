'use client';

import {
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { BuildApiUrl } from '@rehab-trainer/ui/auth/authClient';
import { CardImagePlaceholder } from '@rehab-trainer/ui/components/CardImagePlaceholder';
import type {
  ArticleCard,
  ArticleDetailResponse,
  ArticleListResponse,
} from '../articleTypes';

type LoadStatus = 'loading' | 'ready' | 'error';
type ArticleContentStatus = 'idle' | LoadStatus;

function FormatPublishedDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function EducationArticles() {
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [requestKey, setRequestKey] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setLoadMoreError('');
    void fetch(BuildApiUrl(undefined, '/api/articles'), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load articles. Status ${response.status}`);
        }
        return response.json() as Promise<ArticleListResponse>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setArticles(payload.articles.filter((article) => article.status === 'published'));
        setNextCursor(payload.nextCursor);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Unable to load education articles.', error);
        setStatus('error');
      });
    return () => controller.abort();
  }, [requestKey]);

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadMoreError('');
    try {
      const url = new URL(BuildApiUrl(undefined, '/api/articles'), window.location.origin);
      url.searchParams.set('cursor', nextCursor);
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Unable to load more articles. Status ${response.status}`);
      }
      const payload = await response.json() as ArticleListResponse;
      setArticles((current) => {
        const existingIds = new Set(current.map((article) => article.id));
        return [
          ...current,
          ...payload.articles.filter((article) => (
            article.status === 'published' && !existingIds.has(article.id)
          )),
        ];
      });
      setNextCursor(payload.nextCursor);
    } catch (error) {
      console.warn('Unable to load more education articles.', error);
      setLoadMoreError('無法載入更多文章，請稍後再試。');
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <section className="education-articles-section" aria-labelledby="education-articles-title">
      <div className="section-title-row">
        <div>
          <p className="page-kicker">Patient education</p>
          <h2 id="education-articles-title">治療師衛教專欄</h2>
        </div>
        {status === 'ready' && articles.length > 0 && <p>{articles.length} 篇文章</p>}
      </div>

      {status === 'loading' && (
        <div className="education-articles-state" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">progress_activity</span>
          <p>正在載入衛教文章…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="education-articles-state is-error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <div>
            <h3>暫時無法載入衛教文章</h3>
            <p>請稍後再試，或重新整理這個頁面。</p>
          </div>
          <button onClick={() => setRequestKey((current) => current + 1)} type="button">
            重新載入
          </button>
        </div>
      )}

      {status === 'ready' && articles.length === 0 && (
        <div className="education-articles-state">
          <span className="material-symbols-outlined" aria-hidden="true">article</span>
          <div>
            <h3>衛教文章準備中</h3>
            <p>治療師發布文章後，會以卡片形式顯示在這裡。</p>
          </div>
        </div>
      )}

      {status === 'ready' && articles.length > 0 && (
        <>
          <div className="education-article-grid">
            {articles.map((article) => (
              <EducationArticleCard article={article} key={article.id} />
            ))}
          </div>
          {(nextCursor || loadMoreError) && (
            <div className="education-articles-load-more">
              {loadMoreError && <p role="alert">{loadMoreError}</p>}
              {nextCursor && (
                <button
                  disabled={isLoadingMore}
                  onClick={() => void loadMore()}
                  type="button"
                >
                  {isLoadingMore ? '載入中…' : '載入更多文章'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function EducationArticleCard({ article }: { article: ArticleCard }) {
  const [content, setContent] = useState('');
  const [contentStatus, setContentStatus] = useState<ArticleContentStatus>('idle');
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const loadContent = () => {
    if (contentStatus === 'loading' || contentStatus === 'ready') return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setContentStatus('loading');
    void fetch(
      BuildApiUrl(undefined, `/api/articles/${encodeURIComponent(article.slug)}`),
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load article. Status ${response.status}`);
        }
        return response.json() as Promise<ArticleDetailResponse>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setContent(payload.article.content);
        setContentStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Unable to load education article content.', error);
        setContentStatus('error');
      });
  };

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    if (event.currentTarget.open) loadContent();
  };

  return (
    <article className="education-article-card">
      <div className="education-article-visual">
        {article.coverImageUrl ? (
          <img alt="" loading="lazy" src={article.coverImageUrl} />
        ) : (
          <CardImagePlaceholder />
        )}
      </div>
      <div className="education-article-content">
        <div className="education-article-meta">
          <span>{article.category || '一般衛教'}</span>
          {article.publishedAt && (
            <time dateTime={article.publishedAt}>
              {FormatPublishedDate(article.publishedAt)}
            </time>
          )}
        </div>
        <h3>{article.title}</h3>
        <p className="education-article-summary">{article.summary}</p>
        <p className="education-article-author">撰文：{article.authorName}</p>
        <details onToggle={handleToggle}>
          <summary>
            <span>閱讀文章</span>
            <span className="material-symbols-outlined" aria-hidden="true">expand_more</span>
          </summary>
          <div className="education-article-body">
            {contentStatus === 'loading' && <p role="status">載入文章中…</p>}
            {contentStatus === 'error' && (
              <div className="education-article-load-error" role="alert">
                <p>文章暫時無法載入，請稍後再試。</p>
                <button onClick={loadContent} type="button">重新載入</button>
              </div>
            )}
            {contentStatus === 'ready' && <p>{content}</p>}
          </div>
        </details>
      </div>
    </article>
  );
}
