import type { Metadata } from 'next';
import Link from 'next/link';
import { siteUrls } from '../siteUrls';

export const metadata: Metadata = {
  title: '相關網站',
  description: 'RehabTrainerHub、StrokeTrainer 與 VisionTrainer 的正式網站連結。',
  alternates: {
    canonical: '/links',
  },
};

const relatedSites = [
  {
    name: 'StrokeTrainer',
    title: '中風復健',
    description: '動作、認知與語音復健練習，協助個案在家延續訓練。',
    href: siteUrls.stroke,
  },
  {
    name: 'VisionTrainer',
    title: '視覺復健',
    description: '視覺評估、眼動、閱讀與視覺注意力訓練工具。',
    href: siteUrls.vision,
  },
];

export default function LinksPage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">RH</span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>Related websites</small>
          </span>
        </Link>
        <Link className="secondary-action compact" href="/">回首頁</Link>
      </header>

      <section className="content-page">
        <p className="eyebrow">相關網站</p>
        <h1>RehabTrainerHub 生態系的正式網站。</h1>
        <div className="related-grid">
          {relatedSites.map((site) => (
            <a
              className="related-card"
              href={site.href}
              key={site.name}
              rel="noopener noreferrer"
              target="_blank"
            >
              <p>{site.name}</p>
              <h2>{site.title}</h2>
              <span>{site.description}</span>
              <strong>{site.href.replace('https://', '')}</strong>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
