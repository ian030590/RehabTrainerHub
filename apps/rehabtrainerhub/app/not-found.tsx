import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '找不到頁面',
  description: '找不到您要求的居家訓練網頁面。',
};

export default function NotFoundPage() {
  return (
    <main className="empty-page" id="main-content">
      <p className="page-kicker">404</p>
      <h1>找不到頁面</h1>
      <p>這個網址不存在或頁面已經移動。</p>
      <a href="/">返回訓練大廳</a>
    </main>
  );
}
