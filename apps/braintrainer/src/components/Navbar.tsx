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
      logoAlt={t('nav.logoAlt')}
      navItems={[
        { to: '/attention-training', className: navLinkClass, label: t('nav.attention') },
        { to: '/memory-training', className: navLinkClass, label: t('nav.memory') },
        { to: '/thinking-training', className: navLinkClass, label: t('nav.thinking') },
        { to: '/settings', className: navLinkClass, label: t('nav.settings') },
      ]}
      auth={{
        apiBase: import.meta.env.VITE_AUTH_API_BASE || siteUrls.hub,
        appName: 'BrainTrainer',
        locale: lang === 'en' ? 'en' : 'zh-TW',
      }}
      download={{
        label: t('nav.downloadScores'),
        noScoresMessage: t('nav.noScores'),
        errorMessage: t('nav.scoresDownloadError'),
        onDownload: () => downloadAllTrainingRecordsCsv(t),
      }}
      toggleMenuLabel={t('nav.toggleMenu')}
    />
  );
}
