import type { Metadata } from 'next';
import { hubLocalName } from './hubBrand';
import { seoImage } from './seo';

const notFoundTitle = `找不到頁面 | ${hubLocalName}`;
const notFoundDescription = '找不到您要求的居家訓練網頁面。';

export const metadata: Metadata = {
  title: '找不到頁面',
  description: notFoundDescription,
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: notFoundTitle,
    description: notFoundDescription,
    siteName: hubLocalName,
    locale: 'zh_TW',
    type: 'website',
    images: [seoImage],
  },
  twitter: {
    card: 'summary',
    title: notFoundTitle,
    description: notFoundDescription,
    images: [seoImage.url],
  },
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
