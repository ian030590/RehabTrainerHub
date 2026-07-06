import { TrainerNavbar } from '@rehab-trainer/ui/components/TrainerNavbar';
import { downloadAllTrainingRecordsCsv } from '../utils/trainingRecords';
import { useT } from '../i18n';
import { siteUrls } from '../utils/siteUrls';

const navLinkClass = ({ isActive }: { isActive: boolean }) => `navbar-link ${isActive ? 'active' : ''}`;

export function Navbar() {
  const { lang, t } = useT();

  return (
    <TrainerNavbar
      brandLabel={t('nav.brand')}
      logoSrc={`${import.meta.env.BASE_URL}assets/logo.svg`}
      logoAlt="Vision Trainer Logo"
      navItems={[
        { to: '/', end: true, className: navLinkClass, label: t('nav.trainingList') },
        { to: '/assessment', className: navLinkClass, label: t('nav.assessment') },
        { to: '/settings', className: navLinkClass, label: t('nav.settings') },
        { to: '/credits', className: navLinkClass, label: t('nav.credits') },
        { to: '/links', className: navLinkClass, label: t('nav.links') },
      ]}
      auth={{
        apiBase: import.meta.env.VITE_AUTH_API_BASE || siteUrls.hub,
        appName: 'VisionTrainer',
        locale: lang === 'en' ? 'en' : 'zh-TW',
      }}
      download={{
        label: t('nav.downloadScores'),
        noScoresMessage: t('nav.noScores'),
        errorMessage: t('nav.scoresDownloadError'),
        onDownload: () => downloadAllTrainingRecordsCsv(t),
      }}
    />
  );
}
