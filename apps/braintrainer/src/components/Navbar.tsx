import { TrainerNavbar } from '@rehab-trainer/ui/components/TrainerNavbar';
import { DownloadAllTrainingRecordsCsv } from '../utils/trainingRecords';
import { useT } from '../i18n';
import { siteUrls } from '../utils/siteUrls';

export function Navbar() {
  const { lang, t } = useT();
  const appName = 'BrainTrainer';
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const logoSrc = `${import.meta.env.BASE_URL}assets/logo.svg`;
  const navItems = [
    { to: '/attention-training', label: t('nav.attention') },
    { to: '/memory-training', label: t('nav.memory') },
    { to: '/thinking-training', label: t('nav.thinking') },
    { to: '/settings', label: t('nav.settings') },
    { to: '/references', label: t('nav.references') },
    { to: '/links', label: t('nav.links') },
  ];

  return (
    <TrainerNavbar
      brandLabel={t('nav.brand')}
      logoSrc={logoSrc}
      logoAlt={t('nav.logoAlt')}
      navItems={navItems}
      auth={{
        apiBase,
        appName,
        locale,
      }}
      download={{
        label: t('nav.downloadScores'),
        noScoresMessage: t('nav.noScores'),
        errorMessage: t('nav.scoresDownloadError'),
        onDownload: () => DownloadAllTrainingRecordsCsv(t),
      }}
      toggleMenuLabel={t('nav.toggleMenu')}
    />
  );
}
