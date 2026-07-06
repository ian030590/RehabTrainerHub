'use client';

import { useEffect, useState } from 'react';
import { useHubReadability } from './HubNavigation';
import { SubmissionForm } from './collaborate/SubmissionForm';
import { zhTW, en as enTranslations } from './i18n';
import type { HubLocale } from './i18n/types';

const pageCopy: { [K in HubLocale]: typeof zhTW.pages | typeof enTranslations.pages } = {
  'zh-TW': zhTW.pages,
  en: enTranslations.pages,
};

const youtubeChannelId = 'UCHE7xFZ9I8rJzbrFXA-3L3w';

type YoutubeVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  url: string;
};

type VideoStatus = 'loading' | 'success' | 'error';

export function EducationContent() {
  const { locale } = useHubReadability();
  const copy = pageCopy[locale].education;

  return (
    <section className="content-page">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="content-intro">{copy.intro}</p>
      <div className="education-list">
        {copy.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export function VideosContent() {
  const { locale } = useHubReadability();
  const copy = pageCopy[locale].videos;
  const [status, setStatus] = useState<VideoStatus>('loading');
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);

  useEffect(() => {
    let ignore = false;

    fetch(`/api/youtube-videos?channelId=${youtubeChannelId}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load videos.')))
      .then((data: { videos?: YoutubeVideo[] }) => {
        if (ignore) return;
        setVideos(data.videos ?? []);
        setStatus('success');
      })
      .catch(() => {
        if (!ignore) setStatus('error');
      });

    return () => {
      ignore = true;
    };
  }, []);

  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <section className="content-page">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="content-intro">{copy.intro}</p>

      {status === 'loading' && <p className="video-status">{copy.loading}</p>}
      {status === 'error' && <p className="video-status is-error">{copy.error}</p>}
      {status === 'success' && videos.length === 0 && <p className="video-status">{copy.empty}</p>}

      <div className="video-grid">
        {videos.map((video) => (
          <article className="video-card" key={video.id}>
            <div className="video-frame">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                src={`https://www.youtube.com/embed/${video.id}`}
                title={video.title}
              />
            </div>
            <div className="video-copy">
              <p className="video-meta">
                {copy.published} {dateFormatter.format(new Date(video.publishedAt))}
              </p>
              <h2>{video.title}</h2>
              <p>{video.description || copy.noDescription}</p>
              <a className="video-link" href={video.url} rel="noopener noreferrer" target="_blank">
                {copy.action}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LinksContent() {
  return <VideosContent />;
}

export function CollaborateContent() {
  const { locale } = useHubReadability();
  const copy = pageCopy[locale].collaborate;

  return (
    <section className="content-page submission-page">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="content-intro">{copy.intro}</p>

      <div className="submission-layout">
        <SubmissionForm />

        <aside className="submission-rules" aria-label={copy.rulesLabel}>
          <h2>{copy.rulesLabel}</h2>
          <ul>
            {copy.rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export function PrivacyContent() {
  const { locale } = useHubReadability();
  const copy = pageCopy[locale].privacy;

  return (
    <section className="content-page">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      {copy.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

      <div className="education-list">
        {copy.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>
                  <p>{item}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
