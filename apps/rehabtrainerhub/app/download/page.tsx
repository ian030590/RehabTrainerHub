import type { Metadata } from 'next';
import { CreatePageJsonLd, CreateSeoMetadata, SerializeJsonLd } from '../seo';
import { DownloadContent } from './DownloadContent';

const pageName = '下載程式';
const pageDescription = '將居家訓練網安裝到電腦、iPhone 或 Android 裝置。';

export const metadata: Metadata = CreateSeoMetadata({
  title: pageName,
  description: pageDescription,
  path: '/download',
});

export default function DownloadPage() {
  return (
    <>
      <script
        id="download-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: SerializeJsonLd(CreatePageJsonLd({
            name: pageName,
            description: pageDescription,
            path: '/download',
          })),
        }}
      />
      <DownloadContent />
    </>
  );
}
