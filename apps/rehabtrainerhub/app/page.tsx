import Image from 'next/image';
import Link from 'next/link';
import { siteUrls } from './siteUrls';

const apps = [
  {
    id: 'stroke',
    title: 'Stroke Recovery',
    localTitle: '中風復健',
    name: 'StrokeTrainer',
    description: '結合動作、認知與語音練習，協助中風個案在家中延續每日復健活動。',
    href: siteUrls.stroke,
    image: '/assets/stroke-logo.png',
    action: '開始中風復健',
    iconLabel: 'ST',
  },
  {
    id: 'vision',
    title: 'Vision Training',
    localTitle: '視覺復健',
    name: 'VisionTrainer',
    description: '提供視覺評估、眼動訓練、閱讀訓練與視覺注意力練習，支援清楚的居家操作。',
    href: siteUrls.vision,
    image: '/assets/vision-logo.png',
    action: '開始視覺復健',
    iconLabel: 'VT',
  },
];

const featureCards = [
  {
    title: '清楚易讀',
    text: '高對比文字、穩定版面與大型操作目標，降低視覺與認知負擔。',
  },
  {
    title: '居家可持續',
    text: '把治療師安排的練習轉換為每日可重複執行的簡單入口。',
  },
  {
    title: '正式網址互連',
    text: 'Hub、StrokeTrainer 與 VisionTrainer 以正式網址互相連結，避免使用預覽網址。',
  },
  {
    title: '安全優先',
    text: '使用前提醒、衛教頁與相關網站入口協助照護者先理解練習界線。',
  },
];

export default function HomePage() {
  return (
    <main className="home-page">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/rehabtrainerhub.png" alt="" width={44} height={44} priority />
          </span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>Home rehabilitation, simplified</small>
          </span>
        </Link>
        <nav className="header-actions" aria-label="RehabTrainerHub navigation">
          <a href="#programs">復健計畫</a>
          <a href="#care">居家照護</a>
          <Link href="/education/">衛教資訊</Link>
          <Link href="/links/">相關網站</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">居家復健入口平台</p>
          <h1>把居家復健變得清楚、可持續。</h1>
          <p>
            RehabTrainerHub 整合中風復健與視覺復健工具，讓個案、家屬與治療師能以正式網站入口找到合適的居家訓練。
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#programs">選擇訓練系統</a>
            <Link className="secondary-action" href="/education/">了解使用界線</Link>
          </div>
        </div>
        <div className="hero-panel" aria-label="RehabTrainerHub visual overview">
          <div className="hero-device">
            <div className="device-topbar">
              <span />
              <span />
              <span />
            </div>
            <div className="device-content">
              <Image src="/assets/stroke-logo.png" alt="" width={112} height={74} priority />
              <Image src="/assets/vision-logo.png" alt="" width={112} height={74} priority />
            </div>
          </div>
          <div className="hero-checklist">
            <span>每日練習入口</span>
            <span>正式 Pages 網域</span>
            <span>衛教與安全提醒</span>
          </div>
        </div>
      </section>

      <section className="app-section" id="programs" aria-labelledby="apps-title">
        <div className="section-heading">
          <p className="eyebrow">Targeted Recovery Programs</p>
          <h2 id="apps-title">選擇今天要進入的復健系統</h2>
          <span>兩個子系統各自部署在正式 Cloudflare Pages project，首頁卡片會直接連到對應正式網址。</span>
        </div>
        <div className="app-grid">
          {apps.map((app) => (
            <article className="app-card" key={app.id}>
              <div className="app-icon" aria-hidden="true">{app.iconLabel}</div>
              <div className="app-body">
                <p>{app.name}</p>
                <h3>{app.title}</h3>
                <strong>{app.localTitle}</strong>
                <span>{app.description}</span>
                <div className="app-logo-strip">
                  <Image src={app.image} alt="" width={128} height={82} />
                </div>
              </div>
              <a className="app-link" href={app.href}>{app.action}<span aria-hidden="true">→</span></a>
            </article>
          ))}
        </div>
      </section>

      <section className="care-section" id="care" aria-labelledby="care-title">
        <div className="care-copy">
          <p className="eyebrow">Clinical Care at Home</p>
          <h2 id="care-title">把診間建議延伸到客廳裡。</h2>
          <blockquote>
            穩定、每天可重複的練習，是居家復健能不能延續的關鍵。
          </blockquote>
          <p>
            這個入口網站把複雜的訓練系統整理成清楚的路徑，協助個案先理解目的、照護者協助操作，並讓治療師更容易指定合適的居家練習。
          </p>
        </div>
        <div className="feature-grid">
          {featureCards.map((card, index) => (
            <article className="feature-card" key={card.title}>
              <span aria-hidden="true">{index + 1}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="education-section" aria-labelledby="education-title">
        <div className="section-heading">
          <p className="eyebrow">Guidance</p>
          <h2 id="education-title">開始前先確認安全界線</h2>
          <span>若出現疼痛、頭暈、明顯疲勞或不適，應立即停止並諮詢專業人員。</span>
        </div>
        <div className="section-links">
          <Link className="text-link" href="/education/">查看衛教與使用說明</Link>
          <Link className="text-link" href="/links/">查看相關網站</Link>
        </div>
      </section>
    </main>
  );
}
