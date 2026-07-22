import { TrainerNavbar } from '@rehab-trainer/ui/components/TrainerNavbar';
import { useLocation } from 'react-router-dom';
import { useT } from '../i18n';
import { DownloadAllTrainingRecordsCsv } from '../utils/trainingRecords';
import { siteUrls } from '../utils/siteUrls';

const navLinkClass = ({ isActive }: { isActive: boolean }) => `navbar-link ${isActive ? 'active' : ''}`;

export function Navbar() {
  const { lang, t } = useT();
  const location = useLocation();
  const trainingLinkClass = (path: string) => `navbar-link ${location.pathname === path ? 'active' : ''}`;
  return (
    <TrainerNavbar
      brandLabel={t('nav.brand')}
      logoSrc={`${import.meta.env.BASE_URL}assets/logo.svg`}
      logoAlt={t('nav.logoAlt')}
      navItems={[
        { to: '/speech-training', className: () => trainingLinkClass('/speech-training'), label: t('nav.speech') },
        { to: '/comprehension-training', className: () => trainingLinkClass('/comprehension-training'), label: t('nav.comprehension') },
        { to: '/oral-training', className: () => trainingLinkClass('/oral-training'), label: t('nav.oral') },
        { to: '/settings', className: navLinkClass, label: t('nav.settings') },
        { to: '/references', className: navLinkClass, label: t('nav.credits') },
        { to: '/links', className: navLinkClass, label: t('nav.links') },
      ]}
      auth={{ apiBase: siteUrls.hub, appName: 'MouthTrainer', locale: lang === 'en' ? 'en' : 'zh-TW' }}
      download={{ label: t('nav.downloadScores'), noScoresMessage: t('nav.noScores'), errorMessage: t('nav.scoresDownloadError'), onDownload: () => DownloadAllTrainingRecordsCsv(t) }}
      toggleMenuLabel={t('nav.toggleMenu')}
    />
  );
}
