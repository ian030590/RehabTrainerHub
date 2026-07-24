import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';
import { siteUrls } from '../siteUrls';
import { EducationArticles } from './EducationArticles';

export const metadata: Metadata = CreateSeoMetadata({
  title: '問答中心與衛教文章',
  description: '閱讀治療師撰寫的復健衛教文章，並了解 Rehab Trainer Hub 的訓練服務。',
  path: '/qa',
});

const trainerLinks = [
  { id: 'motor', name: 'MotorTrainer', description: '上肢動作與手部控制訓練' },
  { id: 'vision', name: 'VisionTrainer', description: '視覺搜尋、眼球運動與視覺認知訓練' },
  { id: 'brain', name: 'BrainTrainer', description: '注意力、記憶與高階認知訓練' },
  { id: 'mouth', name: 'MouthTrainer', description: '口腔與舌部動作訓練' },
] as const;

export default function QuestionsPage() {
  return (
    <main className="qa-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">Questions and answers</p>
        <h1>常見問答</h1>
      </header>

      <section className="about-site-section" aria-labelledby="about-site-title">
        <p className="page-kicker">About Rehab Trainer Hub</p>
        <h2 id="about-site-title">關於這個網站</h2>
        <p>
          Rehab Trainer Hub 是居家復健訓練的整合入口，協助您依需求找到動作、視覺、認知與口腔訓練。
          登入後可保存訓練紀錄、追蹤每日任務與復健進度，並在不同訓練器之間延續使用體驗。
        </p>
      </section>

      <EducationArticles />

      <section className="trainer-links-section" aria-labelledby="trainer-links-title">
        <div className="section-title-row">
          <div>
            <p className="page-kicker">Training services</p>
            <h2 id="trainer-links-title">各訓練器網站</h2>
          </div>
        </div>
        <div className="trainer-link-grid">
          {trainerLinks.map((trainer) => (
            <a
              className={`trainer-link-card trainer-${trainer.id}`}
              href={siteUrls[trainer.id]}
              key={trainer.id}
            >
              <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
              <h3>{trainer.name}</h3>
              <p>{trainer.description}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
