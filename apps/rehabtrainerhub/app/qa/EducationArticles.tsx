'use client';

import { useEffect, useState } from 'react';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { FetchEducationLinks, type EducationLink } from './educationFeed';

type LoadStatus = 'ready' | 'error';

function FormatPublishedDate(value: string, locale: 'zh-TW' | 'en'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Feed dates are Taiwan local dates; a fixed zone keeps prerender and browser in step.
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Taipei',
  }).format(date);
}

export function EducationArticles({ initialArticles }: { initialArticles: EducationLink[] }) {
  const { language, t } = useHubLanguage();
  const [articles, setArticles] = useState(initialArticles);
  const [status, setStatus] = useState<LoadStatus>('ready');
  const [requestKey, setRequestKey] = useState(0);
  const copy = GetHubUiCopy(language).educationArticles;

  useEffect(() => {
    const controller = new AbortController();
    void FetchEducationLinks(controller.signal)
      .then((links) => {
        if (controller.signal.aborted) return;
        setArticles(links);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('Unable to refresh education links.', error);
        if (initialArticles.length === 0) setStatus('error');
      });
    return () => controller.abort();
  }, [initialArticles.length, requestKey]);

  return (
    <section className="education-articles-section" aria-labelledby="education-articles-title">
      <header className="section-title-row">
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h2 id="education-articles-title">{copy.title}</h2>
        </div>
        {status === 'ready' && articles.length > 0 && <p>{t('educationArticles.count', { count: articles.length })}</p>}
      </header>
      <p className="education-articles-source">{copy.sourceNote}</p>

      {status === 'error' && (
        <div className="education-articles-state is-error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <div>
            <h3>{copy.loadErrorTitle}</h3>
            <p>{copy.loadErrorBody}</p>
          </div>
          <button onClick={() => setRequestKey((current) => current + 1)} type="button">
            {copy.reload}
          </button>
        </div>
      )}

      {status === 'ready' && articles.length === 0 && (
        <div className="education-articles-state">
          <span className="material-symbols-outlined" aria-hidden="true">article</span>
          <div>
            <h3>{copy.emptyTitle}</h3>
            <p>{copy.emptyBody}</p>
          </div>
        </div>
      )}

      {status === 'ready' && articles.length > 0 && (
        <ul className="education-article-list">
          {articles.map((article) => (
            <EducationArticleItem article={article} key={article.url} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EducationArticleItem({ article }: { article: EducationLink }) {
  const { language, locale } = useHubLanguage();
  const { educationArticles, educationArticle: copy } = GetHubUiCopy(language);
  const categoryLabels: Record<string, string> = educationArticles.categories;

  return (
    <li className="education-article-item">
      <div className="education-article-meta">
        {article.categories.map((category) => (
          <span key={category}>{categoryLabels[category] ?? category}</span>
        ))}
      </div>
      <h3>
        <a href={article.url} rel="noopener" target="_blank">
          {article.title}
          <span className="sr-only"> {copy.opensInNewTab}</span>
          <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
        </a>
      </h3>
      {article.summary && <p className="education-article-summary">{article.summary}</p>}
      {(article.authorName || article.publishedAt) && (
        <p className="education-article-author">
          {article.authorName && (
            <>
              {copy.author}:{' '}
              {article.authorName === '蔡泓恩' ? (
                <a href="#professional-background">{article.authorName}</a>
              ) : article.authorName}
            </>
          )}
          {article.authorName && article.publishedAt && ' · '}
          {article.publishedAt && (
            <>
              {copy.published}:{' '}
              <time dateTime={article.publishedAt}>
                {FormatPublishedDate(article.publishedAt, locale)}
              </time>
            </>
          )}
        </p>
      )}
    </li>
  );
}
