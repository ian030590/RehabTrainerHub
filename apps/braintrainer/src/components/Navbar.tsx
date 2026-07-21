import { TrainerNavbar } from '@rehab-trainer/ui/components/TrainerNavbar';
import { DownloadAllTrainingRecordsCsv } from '../utils/trainingRecords';
import { useT } from '../i18n';
import { siteUrls } from '../utils/siteUrls';

const navLinkClass = ({ isActive }: { isActive: boolean }) => `navbar-link ${isActive ? 'active' : ''}`;

export function Navbar() {
  const { lang, t } = useT();
  const appName = 'BrainTrainer';
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const logoSrc = `${import.meta.env.BASE_URL}assets/logo.svg`;
  const navItems = [
    { to: '/attention-training', className: navLinkClass, label: t('nav.attention') },
    { to: '/memory-training', className: navLinkClass, label: t('nav.memory') },
    { to: '/thinking-training', className: navLinkClass, label: t('nav.thinking') },
    { to: '/settings', className: navLinkClass, label: t('nav.settings') },
    { to: '/references', className: navLinkClass, label: t('nav.references') },
    { to: '/links', className: navLinkClass, label: t('nav.links') },
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
