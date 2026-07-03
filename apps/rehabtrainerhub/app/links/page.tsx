import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { siteUrls } from '../siteUrls';

export const metadata: Metadata = {
  title: '相關網站',
  description: 'StrokeTrainer 與 VisionTrainer 入口。',
  alternates: {
    canonical: '/links',
  },
};

const relatedSites = [
  {
    name: 'StrokeTrainer',
    title: '中風復健練習',
    description: '中風後想練動作、認知或說話，先開這個。',
    items: ['動作協調', '注意力記憶', '口腔語音'],
    action: '開啟中風復健',
    href: siteUrls.stroke,
  },
  {
    name: 'VisionTrainer',
    title: '視覺訓練練習',
    description: '想練看字、閱讀或眼動，開這個。',
    items: ['視覺搜尋', '閱讀眼動', '對比辨識'],
    action: '開啟視覺訓練',
    href: siteUrls.vision,
  },
];

export default function LinksPage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/rehabtrainerhub.png" alt="" width={44} height={44} priority />
          </span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>Related websites</small>
          </span>
        </Link>
        <nav className="header-actions" aria-label="RehabTrainerHub navigation">
          <Link className="nav-link" href="/#programs">工具</Link>
          <Link className="nav-link" href="/#care">安全</Link>
          <Link className="nav-link" href="/education/">衛教</Link>
          <Link className="nav-link is-active" href="/links/">連結</Link>
          <Link className="nav-link" href="/collaborate/">投稿</Link>
        </nav>
      </header>

      <nav className="bottom-nav" aria-label="RehabTrainerHub navigation">
        <Link href="/#programs">工具</Link>
        <Link href="/#care">安全</Link>
        <Link href="/education/">衛教</Link>
        <Link className="is-active" href="/links/">連結</Link>
        <Link href="/collaborate/">投稿</Link>
      </nav>

      <section className="content-page">
        <p className="eyebrow">相關網站</p>
        <h1>選你要用的工具。</h1>
        <p className="content-intro">
          不確定時，先選中風復健。視覺或閱讀困難，再選視覺訓練。
        </p>
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
              <ul className="related-points">
                {site.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <span className="related-action">{site.action}</span>
              <strong>{site.href.replace('https://', '')}</strong>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
