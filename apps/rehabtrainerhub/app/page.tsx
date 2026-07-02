import Image from 'next/image';
import Link from 'next/link';
import { GlobalPortalLinks } from '@rehab-trainer/ui/components/GlobalPortalLinks';

const apps = [
  {
    id: 'stroke',
    title: '中風復健',
    name: 'StrokeTrainer',
    description: '動作、認知與語音練習，協助個案在家中延續復健活動。',
    href: '/StrokeTrainer/',
    image: '/assets/stroke-logo.png',
    tags: ['動作訓練', '認知訓練', '語音訓練'],
  },
  {
    id: 'vision',
    title: '視覺復健',
    name: 'VisionTrainer',
    description: '視力評估、眼動訓練、閱讀訓練與視覺注意力練習。',
    href: '/VisionTrainer/',
    image: '/assets/vision-logo.png',
    tags: ['視覺評估', '眼動訓練', '校正工具'],
  },
];

const educationCards = [
  {
    title: '復健個案',
    text: '用清楚的入口快速開始練習，降低在不同網址間切換的負擔。',
  },
  {
    title: '家屬與照護者',
    text: '從同一平台協助設定使用者、校正畫面與理解每個小遊戲目的。',
  },
  {
    title: '職能治療師',
    text: '將平台作為居家復健處方入口，依個案狀況選擇合適模組。',
  },
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">RH</span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>Home rehabilitation games</small>
          </span>
        </Link>
        <GlobalPortalLinks current="hub" />
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">居家復健入口平台</p>
          <h1>把中風復健與視覺復健整合到同一個入口。</h1>
          <p>
            RehabTrainerHub 將分散的復健小遊戲整合為單一平台，讓個案、家屬與治療師能更容易找到合適的訓練工具。
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="/StrokeTrainer/">開始中風復健</a>
            <a className="secondary-action" href="/VisionTrainer/">開始視覺復健</a>
          </div>
        </div>
        <div className="hero-panel" aria-label="平台狀態">
          <span>2</span>
          <strong>復健子系統</strong>
          <p>以 monorepo 維護，集中累積 SEO 權重與部署設定。</p>
        </div>
      </section>

      <section className="app-section" aria-labelledby="apps-title">
        <div className="section-heading">
          <p className="eyebrow">Training Apps</p>
          <h2 id="apps-title">選擇今天要練習的系統</h2>
        </div>
        <div className="app-grid">
          {apps.map((app) => (
            <article className="app-card" key={app.id}>
              <div className="app-image">
                <Image src={app.image} alt="" width={180} height={120} priority />
              </div>
              <div className="app-body">
                <p>{app.name}</p>
                <h3>{app.title}</h3>
                <span>{app.description}</span>
                <div className="tags">
                  {app.tags.map((tag) => <em key={tag}>{tag}</em>)}
                </div>
              </div>
              <a className="app-link" href={app.href}>進入 {app.name}</a>
            </article>
          ))}
        </div>
      </section>

      <section className="education-section" aria-labelledby="education-title">
        <div className="section-heading">
          <p className="eyebrow">Education</p>
          <h2 id="education-title">誰適合使用</h2>
        </div>
        <div className="education-grid">
          {educationCards.map((card) => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
        <Link className="text-link" href="/education/">查看衛教與使用說明</Link>
      </section>
    </main>
  );
}
