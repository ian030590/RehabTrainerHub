import { TrainerNavbar } from '@rehab-trainer/ui/components/TrainerNavbar';
import { useLocation } from 'react-router-dom';
import { downloadAllTrainingRecordsCsv } from '../utils/trainingRecords';
import { useT } from '../i18n';
import { siteUrls } from '../utils/siteUrls';

const navLinkClass = ({ isActive }: { isActive: boolean }) => `navbar-link ${isActive ? 'active' : ''}`;

export function Navbar() {
  const { lang, t } = useT();
  const location = useLocation();
  const appName = 'StrokeTrainer';
  const apiBase = siteUrls.hub;
  const locale = lang === 'en' ? 'en' : 'zh-TW';
  const logoSrc = `${import.meta.env.BASE_URL}assets/logo.svg`;
  const activeTrainingModule =
    location.pathname === '/' || location.pathname === '/motor-training'
      ? 'motor-training'
      : location.pathname === '/cognitive-training'
        ? 'cognitive-training'
        : location.pathname === '/speech-training'
          ? 'speech-training'
          : location.pathname === '/training'
            ? (new URLSearchParams(location.search).get('module') || 'motor-training')
            : null;
  const trainingLinkClass = (moduleId: string) => `navbar-link ${activeTrainingModule === moduleId ? 'active' : ''}`;
  const navItems = [
    { to: '/motor-training', className: () => trainingLinkClass('motor-training'), label: t('home.module.motor.title') },
    { to: '/cognitive-training', className: () => trainingLinkClass('cognitive-training'), label: t('home.module.cognitive.title') },
    { to: '/speech-training', className: () => trainingLinkClass('speech-training'), label: t('home.module.speech.title') },
    { to: '/settings', className: navLinkClass, label: t('nav.settings') },
    { to: '/credits', className: navLinkClass, label: t('nav.credits') },
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
        onDownload: () => downloadAllTrainingRecordsCsv(t),
      }}
      toggleMenuLabel={t('nav.toggleMenu')}
    />
  );
}
