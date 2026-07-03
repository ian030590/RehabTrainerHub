import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SubmissionForm } from './SubmissionForm';

export const metadata: Metadata = {
  title: '合作投稿',
  description: '投稿治療活動想法或單一 HTML demo。',
  alternates: {
    canonical: '/collaborate',
  },
};

export default function CollaboratePage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/rehabtrainerhub.png" alt="" width={44} height={44} priority />
          </span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>Collaboration</small>
          </span>
        </Link>
        <nav className="header-actions" aria-label="RehabTrainerHub navigation">
          <Link className="nav-link" href="/#programs">工具</Link>
          <Link className="nav-link" href="/#care">安全</Link>
          <Link className="nav-link" href="/education/">衛教</Link>
          <Link className="nav-link" href="/links/">連結</Link>
          <Link className="nav-link is-active" href="/collaborate/">投稿</Link>
        </nav>
      </header>

      <nav className="bottom-nav" aria-label="RehabTrainerHub navigation">
        <Link href="/#programs">工具</Link>
        <Link href="/#care">安全</Link>
        <Link href="/education/">衛教</Link>
        <Link href="/links/">連結</Link>
        <Link className="is-active" href="/collaborate/">投稿</Link>
      </nav>

      <section className="content-page submission-page">
        <p className="eyebrow">合作投稿</p>
        <h1>分享治療活動想法。</h1>
        <p className="content-intro">
          可投稿文字想法，或上傳單一 HTML demo。HTML 通過安全檢查後才會轉送。
        </p>

        <div className="submission-layout">
          <SubmissionForm />

          <aside className="submission-rules" aria-label="投稿規則">
            <h2>投稿規則</h2>
            <ul>
              <li>活動想法會轉成 txt 送出。</li>
              <li>Demo 只接受一個 .html 檔。</li>
              <li>HTML 不可連外、要權限或送資料。</li>
              <li>可疑內容會被擋下，不會轉送。</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
