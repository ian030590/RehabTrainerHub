import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';

export const metadata: Metadata = CreateSeoMetadata({
  title: '隱私權政策 / Privacy Policy',
  description: '了解居家訓練網對登入、基本資料問卷、醫療史問卷、訓練紀錄、攝影機與本機資料的使用方式。',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <main className="policy-page" id="main-content">
      <h1>隱私權政策</h1>
      <p>Rehab Trainer Hub 僅在提供帳號、訓練紀錄與進度追蹤所需的範圍內處理資料。</p>

      <section>
        <h2>蒐集的資料</h2>
        <ul>
          <li>帳號識別資料，例如顯示名稱、電子郵件與登入服務識別碼。</li>
          <li>使用者主動填寫的基本資料與醫療史問卷。</li>
          <li>訓練模組、完成時間、難度與訓練結果。</li>
        </ul>
      </section>

      <section>
        <h2>資料用途</h2>
        <p>資料用於跨裝置登入、保存訓練紀錄、計算每日任務與連續復健成就，以及改善訓練服務。</p>
      </section>

      <section>
        <h2>裝置權限</h2>
        <p>需要攝影機或麥克風的訓練會由瀏覽器另行要求權限；影像與聲音的即時分析原則上在使用者裝置上執行。</p>
      </section>
    </main>
  );
}
