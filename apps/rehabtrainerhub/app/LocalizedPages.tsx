'use client';

import { useEffect, useState } from 'react';
import {
  ReferenceListPage,
  type ReferenceListItem,
  type ReferenceListPageLabels,
} from '@rehab-trainer/ui/components/ReferenceListPage';
import { useHubReadability } from './HubNavigation';
import { SubmissionForm } from './collaborate/SubmissionForm';
import { zhTW, en as enTranslations } from './i18n';
import type { HubLocale } from './i18n/types';

const pageCopy: { [K in HubLocale]: typeof zhTW.pages | typeof enTranslations.pages } = {
  'zh-TW': zhTW.pages,
  en: enTranslations.pages,
};

const youtubeChannelId = 'UCHE7xFZ9I8rJzbrFXA-3L3w';

interface ReferencesCopy {
  title: string;
  subtitle: string;
  labels: ReferenceListPageLabels;
  githubItems: readonly ReferenceListItem[];
  literatureItems: readonly ReferenceListItem[];
}

const referencesCopy: Record<HubLocale, ReferencesCopy> = {
  'zh-TW': {
    title: '參考資料',
    subtitle: '本頁整理各訓練活動使用的參考資料。',
    labels: {
      githubSection: 'GitHub 專案',
      literatureSection: '文獻',
    },
    githubItems: [
      {
        title: 'brownhci/WebGazer',
        href: 'https://github.com/brownhci/WebGazer',
        description: '基於攝影機的視線追蹤 library，作為視線追蹤校正與 PL 視力評估參考。',
        modules: ['VisionTrainer / 視力評估 - PL', 'VisionTrainer / 視線追蹤校正'],
      },
      {
        title: 'michaelbach/FrACT10',
        href: 'https://github.com/michaelbach/FrACT10',
        description: '心理物理視力評估與螢幕校正工具，作為視力評估流程與演算法參考。',
        modules: ['VisionTrainer / 視力評估', 'VisionTrainer / 螢幕校正'],
      },
      {
        title: 'styts/eye-training',
        href: 'https://github.com/styts/eye-training',
        description: '眼球移動與注視練習專案，作為移動卡片訓練互動參考。',
        modules: ['VisionTrainer / 移動卡片訓練'],
      },
      {
        title: 'Jesper-N/foveaflow',
        href: 'https://github.com/Jesper-N/foveaflow',
        description: '多目標追蹤視覺訓練專案，作為眼動訓練目標移動與追蹤設計參考。',
        modules: ['VisionTrainer / 眼動訓練'],
      },
      {
        title: 'Fordi/eyegame',
        href: 'https://github.com/Fordi/eyegame.git',
        description: 'Gabor patch 視覺辨識遊戲，作為蓋伯斑塊練習機制參考。',
        modules: ['VisionTrainer / 蓋伯斑塊練習'],
      },
      {
        title: 'visiontherapy/visiontherapy.github.io',
        href: 'https://github.com/visiontherapy/visiontherapy.github.io',
        description: '視覺治療練習集合，作為哈特圖等視覺訓練內容參考。',
        modules: ['VisionTrainer / 哈特圖訓練'],
      },
      {
        title: 'muthuspark/javascript-games',
        href: 'https://github.com/muthuspark/javascript-games',
        description: '多種網頁小遊戲實作，作為認知小遊戲操作流程與互動模式參考。',
        modules: ['StrokeTrainer / 認知訓練 - 參考認知小遊戲'],
      },
      {
        title: 'antfu/vue-minesweeper',
        href: 'https://github.com/antfu/vue-minesweeper',
        description: '踩地雷遊戲邏輯與版面互動參考。',
        modules: ['StrokeTrainer / 認知訓練 - 踩地雷'],
      },
      {
        title: 'ccoreilly/vosk-browser',
        href: 'https://github.com/ccoreilly/vosk-browser',
        description: '瀏覽器端 Vosk 語音辨識 runtime，用於本機語音模型推論參考。',
        modules: ['StrokeTrainer / 語音訓練 - 語音防衛者'],
      },
      {
        title: 'rbcavanaugh/mainConcept',
        href: 'https://github.com/rbcavanaugh/mainConcept',
        description: '主旨概念分析訓練題材與評分流程，作為主旨概念訓練參考。',
        modules: ['BrainTrainer / 思考訓練 - 主旨概念訓練'],
      },
    ],
    literatureItems: [
      {
        title: 'Schmetterer, L., Scholl, H., Garhöfer, G., Janeschitz-Kriegl, L., Corvi, F., Sadda, S. R., & Medeiros, F. A. (2023). Endpoints for clinical trials in ophthalmology. Progress in Retinal and Eye Research, 97, 101160. https://doi.org/10.1016/j.preteyeres.2022.101160',
        href: 'https://doi.org/10.1016/j.preteyeres.2022.101160',
        description: '眼科臨床試驗終點指標綜述，作為視力評估參考文獻。',
        modules: ['VisionTrainer / 視力評估'],
      },
    ],
  },
  en: {
    title: 'References',
    subtitle: 'References used across training activities.',
    labels: {
      githubSection: 'GitHub Projects',
      literatureSection: 'Literature',
    },
    githubItems: [
      {
        title: 'brownhci/WebGazer',
        href: 'https://github.com/brownhci/WebGazer',
        description: 'Webcam-based eye tracking library used as a reference for gaze calibration and PL visual assessment.',
        modules: ['VisionTrainer / Visual Assessment - PL', 'VisionTrainer / WebGazer Calibration'],
      },
      {
        title: 'michaelbach/FrACT10',
        href: 'https://github.com/michaelbach/FrACT10',
        description: 'Psychophysical visual acuity assessment and screen calibration tool used as a reference for assessment flow and algorithms.',
        modules: ['VisionTrainer / Visual Assessment', 'VisionTrainer / Screen Calibration'],
      },
      {
        title: 'styts/eye-training',
        href: 'https://github.com/styts/eye-training',
        description: 'Eye movement and fixation training project used as an interaction reference for Moving Card Training.',
        modules: ['VisionTrainer / Moving Card Training'],
      },
      {
        title: 'Jesper-N/foveaflow',
        href: 'https://github.com/Jesper-N/foveaflow',
        description: 'Multiple-object tracking vision training project used as a reference for target movement and tracking design.',
        modules: ['VisionTrainer / Oculomotor Training'],
      },
      {
        title: 'Fordi/eyegame',
        href: 'https://github.com/Fordi/eyegame.git',
        description: 'Gabor patch visual recognition game used as a reference for the Gabor Patching training mechanic.',
        modules: ['VisionTrainer / Gabor Patching'],
      },
      {
        title: 'visiontherapy/visiontherapy.github.io',
        href: 'https://github.com/visiontherapy/visiontherapy.github.io',
        description: 'Vision therapy exercise collection used as a reference for Hart Chart and related vision training content.',
        modules: ['VisionTrainer / Hart Chart Training'],
      },
      {
        title: 'muthuspark/javascript-games',
        href: 'https://github.com/muthuspark/javascript-games',
        description: 'Collection of browser mini-game implementations used as a reference for cognitive mini-game flow and interaction patterns.',
        modules: ['StrokeTrainer / Cognitive Training - reference mini-games'],
      },
      {
        title: 'antfu/vue-minesweeper',
        href: 'https://github.com/antfu/vue-minesweeper',
        description: 'Minesweeper game logic and board interaction reference.',
        modules: ['StrokeTrainer / Cognitive Training - Minesweeper'],
      },
      {
        title: 'ccoreilly/vosk-browser',
        href: 'https://github.com/ccoreilly/vosk-browser',
        description: 'Browser Vosk speech-recognition runtime used as a reference for local speech model inference.',
        modules: ['StrokeTrainer / Speech Training - Voice Defender'],
      },
      {
        title: 'rbcavanaugh/mainConcept',
        href: 'https://github.com/rbcavanaugh/mainConcept',
        description: 'Main-concept analysis materials and scoring workflow used as a reference for Main Concept Training.',
        modules: ['BrainTrainer / Thinking Training - Main Concept Training'],
      },
    ],
    literatureItems: [
      {
        title: 'Schmetterer, L., Scholl, H., Garhöfer, G., Janeschitz-Kriegl, L., Corvi, F., Sadda, S. R., & Medeiros, F. A. (2023). Endpoints for clinical trials in ophthalmology. Progress in Retinal and Eye Research, 97, 101160. https://doi.org/10.1016/j.preteyeres.2022.101160',
        href: 'https://doi.org/10.1016/j.preteyeres.2022.101160',
        description: 'Review of ophthalmology clinical-trial endpoints used as a visual assessment literature reference.',
        modules: ['VisionTrainer / Visual Assessment'],
      },
    ],
  },
};

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

export function ReferencesContent() {
  const { locale } = useHubReadability();
  const copy = referencesCopy[locale];

  return (
    <ReferenceListPage
      githubItems={copy.githubItems}
      labels={copy.labels}
      literatureItems={copy.literatureItems}
      subtitle={copy.subtitle}
      title={copy.title}
      variant="hub"
    />
  );
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
