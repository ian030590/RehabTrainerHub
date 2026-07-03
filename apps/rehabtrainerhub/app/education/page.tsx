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
          <Link className="nav-link" href="/#apps-title">復健工具</Link>
          <Link className="nav-link" href="/#care-title">安全提醒</Link>
          <Link className="nav-link is-active" href="/education/">衛教資訊</Link>
          <Link className="nav-link" href="/links/">相關連結</Link>
          <Link className="nav-link" href="/collaborate/">合作投稿</Link>
        </nav>
      </header>

      <nav className="bottom-nav" aria-label="RehabTrainerHub navigation">
        <Link href="/#apps-title">復健工具</Link>
        <Link href="/#care-title">安全提醒</Link>
        <Link className="is-active" href="/education/">衛教資訊</Link>
        <Link href="/links/">相關連結</Link>
        <Link href="/collaborate/">合作投稿</Link>
      </nav>

      <section className="content-page">
        <p className="eyebrow">衛教資訊</p>
        <h1>在家練習前，先看這 4 件事。</h1>
        <p className="content-intro">
          如果不確定自己能不能做，請先詢問醫師或治療師。
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
