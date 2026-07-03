import type { Metadata } from 'next';
import { HubBottomNav, HubSiteHeader } from '../HubNavigation';
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
      <HubSiteHeader activeKey="submit" brandSubtitle="Collaboration" />
      <HubBottomNav activeKey="submit" />

      <section className="content-page submission-page">
        <p className="eyebrow">合作投稿</p>
        <h1>分享治療活動想法。</h1>
        <p className="content-intro">
          你可以投稿文字想法，也可以上傳單一 HTML demo。HTML 通過安全檢查後才會轉送。
        </p>

        <div className="submission-layout">
          <SubmissionForm />

          <aside className="submission-rules" aria-label="投稿規則">
            <h2>投稿規則</h2>
            <ul>
              <li>活動想法會轉成 txt 送出。</li>
              <li>Demo 只接受一個 .html 檔。</li>
              <li>HTML 不可連外、要求權限或傳送資料。</li>
              <li>可疑內容會被擋下，不會轉送。</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
