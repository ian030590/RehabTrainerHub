'use client';

import { useEffect, useState } from 'react';
import { useHubReadability } from './HubNavigation';
import { SubmissionForm } from './collaborate/SubmissionForm';

const pageCopy = {
  'zh-TW': {
    education: {
      eyebrow: '衛教資訊',
      title: '在家練習前，先看這 4 件事。',
      intro: '如果不確定自己能不能做，請先詢問醫師或治療師。',
      sections: [
        {
          title: '我可以開始練嗎？',
          items: [
            '請先確認醫師或治療師同意你在家練習。',
            '第一次使用時，建議家人或照顧者在旁協助。',
            '請在光線足夠、椅子穩定的地方使用。',
          ],
        },
        {
          title: '什麼狀況要停止？',
          items: [
            '如果頭暈、疼痛、喘或噁心，請立刻停止。',
            '如果太累或看不懂步驟，也請先停下來。',
            '不舒服沒有改善時，請聯絡醫師或治療師。',
          ],
        },
        {
          title: '中風復健可以練什麼？',
          items: [
            '動作練習：手眼協調、描繪與手勢控制。',
            '認知練習：注意力、反應速度與記憶。',
            '語音練習：發音、口腔動作與聽辨任務。',
          ],
        },
        {
          title: '視覺訓練可以練什麼？',
          items: [
            '視覺搜尋：練習找目標與維持注意力。',
            '閱讀眼動：練習看字、追視與移動視線。',
            '對比辨識：練習分辨深淺與清楚度。',
          ],
        },
      ],
    },
    videos: {
      eyebrow: '衛教影片',
      title: '觀看復健與居家練習影片。',
      intro: '這裡會從 YouTube 頻道載入最新衛教影片。觀看前仍請依醫師或治療師建議選擇內容。',
      loading: '正在載入影片',
      error: '影片暫時無法載入，請稍後再試。',
      empty: '目前沒有可顯示的影片。',
      action: '在 YouTube 開啟',
      published: '發布日期',
      noDescription: '此影片未提供文字說明。',
    },
    collaborate: {
      eyebrow: '合作投稿',
      title: '希望網頁增加活動種類嗎？',
      intro: '你可以透過文字說明想法，也可以直接上傳單一 HTML 檔案。',
      rulesLabel: '投稿規則',
      rules: [
        'HTML可以透過Vibe Coding完成，但需要可以執行',
        '不限治療師皆可參與',
        '活動可行性與治療性會由團隊審核',
        '審核通過者將會透過聯絡方式詢問您期望被網站提起的名稱',
      ],
    },
    privacy: {
      eyebrow: '隱私權政策',
      title: '登入、匿名資料與訓練紀錄的使用說明。',
      intro: [
        '本政策適用於 Rehab Trainer Hub、StrokeTrainer 與 VisionTrainer 的登入、基本資料填寫與訓練紀錄儲存。',
        '本平台以居家復健練習與流程原型為目的，不取代醫師、治療師或其他專業人員的評估。',
      ],
      sections: [
        {
          title: '我們蒐集哪些資料',
          items: [
            '使用 Google 登入時，系統會使用 Google 提供的帳號識別資訊、顯示名稱、電子郵件與頭像建立登入狀態。',
            '登入後會請你填寫匿名基本資料，包含年齡、性別、國籍等。',
            '登入後會請你填寫是否有醫師診斷的慢性病類別，包含中樞神經疾患、新陳代謝疾患、發展性疾患、精神病與精神官能症。',
            '登入後會請你填寫抽菸與喝酒習慣，選項包含無、有、已經戒掉；若選擇有，會記錄每週或每月的數量與單位。',
            '訓練紀錄可能包含使用的工具、模組、難度、訓練時間、分數、互動結果與瀏覽器送出的紀錄內容。',
          ],
        },
        {
          title: '我們如何使用資料',
          items: [
            '登入資料只用於建立登入狀態、辨識同一位使用者與同步訓練紀錄。',
            '匿名基本資料、慢性病類別、抽菸與喝酒習慣用於分組分析復健工具的使用情形與改善服務。',
            '本平台不提供醫療診斷，也不會依填寫內容提供個別醫療建議。',
            '慢性病欄位只應填寫醫師已診斷的狀況；若沒有醫師診斷，請勿自行猜測填寫。',
          ],
        },
        {
          title: '資料儲存位置',
          items: [
            '登入使用時，匿名基本資料與訓練紀錄會儲存在 Rehab Trainer Hub 的 Cloudflare D1 database。',
            '未登入使用時，訓練紀錄只會儲存在目前瀏覽器的 IndexedDB，不會同步到 D1 database。',
            'StrokeTrainer 與 VisionTrainer 的登入流程會連到 Rehab Trainer Hub 的登入 API，並使用同一份登入狀態。',
          ],
        },
        {
          title: '攝影機與本機推論',
          items: [
            '部分 trainer 功能可能使用攝影機或本機 AI 推論進行即時訓練判斷。',
            '除非頁面功能另有明確說明，本平台不會上傳或保存攝影機影像。',
            '若你不想使用攝影機功能，可以不授權攝影機權限，或改用不需要攝影機的訓練項目。',
          ],
        },
        {
          title: '你的選擇',
          items: [
            '你可以選擇不登入並繼續使用支援本機紀錄的功能。',
            '你可以在任一主頁或 trainer 頁面登出；登出後新的紀錄會回到本機 IndexedDB 儲存。',
            '你可以使用瀏覽器設定清除 IndexedDB 本機紀錄。',
          ],
        },
      ],
    },
  },
  en: {
    education: {
      eyebrow: 'Education',
      title: 'Before practicing at home, read these 4 things first.',
      intro: 'If you are not sure whether you can do a practice, ask your physician or therapist first.',
      sections: [
        {
          title: 'Can I start practicing?',
          items: [
            'First confirm that your physician or therapist agrees you can practice at home.',
            'The first time you use it, ask a family member or caregiver to assist nearby.',
            'Use it in a well-lit place with a stable chair.',
          ],
        },
        {
          title: 'When should I stop?',
          items: [
            'Stop immediately if you feel dizzy, painful, short of breath, or nauseated.',
            'Also stop first if you are too tired or cannot understand the steps.',
            'If discomfort does not improve, contact your physician or therapist.',
          ],
        },
        {
          title: 'What can stroke rehabilitation train?',
          items: [
            'Motor practice: hand-eye coordination, tracing, and gesture control.',
            'Cognitive practice: attention, reaction speed, and memory.',
            'Speech practice: articulation, oral movement, and listening tasks.',
          ],
        },
        {
          title: 'What can vision training train?',
          items: [
            'Visual search: finding targets and sustaining attention.',
            'Reading eye movement: seeing text, tracking, and shifting gaze.',
            'Contrast recognition: distinguishing differences in shade and clarity.',
          ],
        },
      ],
    },
    videos: {
      eyebrow: 'Education Videos',
      title: 'Watch rehabilitation and home practice videos.',
      intro: 'This page loads the latest education videos from the YouTube channel. Before watching, still choose content according to your physician or therapist guidance.',
      loading: 'Loading videos',
      error: 'Videos cannot be loaded right now. Please try again later.',
      empty: 'There are no videos to show right now.',
      action: 'Open on YouTube',
      published: 'Published',
      noDescription: 'This video does not include a text description.',
    },
    collaborate: {
      eyebrow: 'Collaboration',
      title: 'Share your theraputic activity ideas.',
      intro: 'You can share your idea with text or upload a single HTML demo file.',
      rulesLabel: 'Submission rules',
      rules: [
        'HTML can be vibe coded, but has to be functional.',
        'Not limited to therapists only.',
        'The therapeutic value and feasibility of the activity will be evaluated by the team.',
        'If your application is approved, we will contact you regarding the name you would like to be published.',
      ],
    },
    privacy: {
      eyebrow: 'Privacy Policy',
      title: 'How login, anonymous data, and training records are used.',
      intro: [
        'This policy applies to login, basic profile entry, and training record storage for Rehab Trainer Hub, StrokeTrainer, and VisionTrainer.',
        'This platform is intended for home rehabilitation practice and workflow prototyping, and does not replace evaluation by a physician, therapist, or other professional.',
      ],
      sections: [
        {
          title: 'What data we collect',
          items: [
            'When signing in with Google, the system uses the account identifier, display name, email, and avatar provided by Google to create your login state.',
            'After signing in, you will be asked to fill in anonymous basic information, including age, gender, and nationality.',
            'After signing in, you will be asked to indicate any physician-diagnosed chronic condition categories, including central nervous system disorders, metabolic disorders, developmental disorders, and psychiatric or neurotic disorders.',
            'After signing in, you will be asked to fill in your smoking and drinking habits. Options include none, yes, or quit; if yes is selected, the weekly or monthly quantity and unit will be recorded.',
            'Training records may include the tools used, modules, difficulty levels, training duration, scores, interaction results, and any record content sent by the browser.',
          ],
        },
        {
          title: 'How we use the data',
          items: [
            'Login data is solely used to establish the login state, identify the same user, and synchronize training records.',
            'Anonymous basic information, chronic condition categories, and smoking and drinking habits are used for group analysis of rehabilitation tool usage and to improve our services.',
            'This platform does not provide medical diagnoses, nor does it provide individual medical advice based on the information provided.',
            'The chronic condition fields should only be filled with conditions diagnosed by a physician; if you have not been diagnosed by a physician, please do not guess.',
          ],
        },
        {
          title: 'Where data is stored',
          items: [
            'When using the service while signed in, anonymous basic information and training records are stored in Rehab Trainer Hub Cloudflare D1 database.',
            'When using the service without signing in, training records are only stored in the current browser IndexedDB and will not be synchronized to the D1 database.',
            'The login flows for StrokeTrainer and VisionTrainer connect to the Rehab Trainer Hub login API and use the same login state.',
          ],
        },
        {
          title: 'Camera and local inference',
          items: [
            'Some trainer features may use a camera or local AI inference for real-time training assessment.',
            'Unless explicitly stated otherwise on the page, this platform does not upload or save camera images.',
            'If you do not wish to use camera features, you can decline camera permissions or switch to training items that do not require a camera.',
          ],
        },
        {
          title: 'Your choices',
          items: [
            'You can choose not to sign in and continue using features that support local records.',
            'You can sign out on any homepage or trainer page; after signing out, new records will revert to local IndexedDB storage.',
            'You can use your browser settings to clear IndexedDB local records.',
          ],
        },
      ],
    },
  },
} as const;

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
