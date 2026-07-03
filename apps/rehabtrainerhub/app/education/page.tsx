import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '衛教與使用說明',
  description: '了解居家復健工具的用途與安全提醒。',
};

const sections = [
  {
    title: '我可以開始練嗎？',
    items: [
      '醫師或治療師同意後再練。',
      '第一次請家人陪。',
      '光線要足，椅子要穩。',
    ],
  },
  {
    title: '什麼狀況要停止？',
    items: [
      '頭暈、痛、喘、噁心就停。',
      '太累或看不懂，也先停。',
      '沒有改善，請聯絡專業人員。',
    ],
  },
  {
    title: '中風復健可以練什麼？',
    items: [
      '動作：手眼協調、描繪、手勢。',
      '認知：注意力、反應、記憶。',
      '語音：發音、口腔動作。',
    ],
  },
  {
    title: '視覺訓練可以練什麼？',
    items: [
      '搜尋：找目標。',
      '閱讀：看字與追視。',
      '對比：分辨深淺。',
    ],
  },
];

export default function EducationPage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <Image src="/rehabtrainerhub.png" alt="" width={44} height={44} priority />
          </span>
          <span>
            <strong>RehabTrainerHub</strong>
            <small>Education</small>
          </span>
        </Link>
        <nav className="header-actions" aria-label="RehabTrainerHub navigation">
          <Link className="nav-link" href="/#programs">工具</Link>
          <Link className="nav-link" href="/#care">安全</Link>
          <Link className="nav-link is-active" href="/education/">衛教</Link>
          <Link className="nav-link" href="/links/">連結</Link>
          <Link className="nav-link" href="/collaborate/">投稿</Link>
        </nav>
      </header>

      <nav className="bottom-nav" aria-label="RehabTrainerHub navigation">
        <Link href="/#programs">工具</Link>
        <Link href="/#care">安全</Link>
        <Link className="is-active" href="/education/">衛教</Link>
        <Link href="/links/">連結</Link>
        <Link href="/collaborate/">投稿</Link>
      </nav>

      <section className="content-page">
        <p className="eyebrow">衛教資訊</p>
        <h1>在家練習前，先看這 4 件事。</h1>
        <p className="content-intro">
          不確定能不能做，先問醫師或治療師。
        </p>
        <div className="education-list">
          {sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
