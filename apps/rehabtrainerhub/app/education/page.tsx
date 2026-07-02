import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '衛教與使用說明',
  description: '了解 StrokeTrainer 與 VisionTrainer 各類居家復健小遊戲的目的、適用情境與使用注意事項。',
};

const sections = [
  {
    title: '使用前提醒',
    items: [
      '請在安全、光線充足、可穩定操作滑鼠或觸控螢幕的環境中使用。',
      '若出現疼痛、頭暈、明顯疲勞或不適，應立即停止並諮詢專業人員。',
      '本平台不能取代醫師、職能治療師或視光相關專業評估。',
    ],
  },
  {
    title: '中風復健小遊戲',
    items: [
      '動作訓練聚焦手眼協調、描繪與手勢控制。',
      '認知訓練聚焦注意力、反應速度、工作記憶與問題解決。',
      '語音訓練提供發音與口腔動作練習情境。',
    ],
  },
  {
    title: '視覺復健小遊戲',
    items: [
      '視覺評估模組協助紀錄視力與對比敏感度練習結果。',
      '眼動與閱讀訓練可調整速度、大小、背景與難度。',
      '開始訓練前建議完成螢幕尺寸與觀看距離校正。',
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
          <Link className="secondary-action compact" href="/">回首頁</Link>
          <Link className="secondary-action compact" href="/links/">相關網站</Link>
        </nav>
      </header>

      <section className="content-page">
        <p className="eyebrow">衛教資訊</p>
        <h1>在家練習前，先確認目的與安全界線。</h1>
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
