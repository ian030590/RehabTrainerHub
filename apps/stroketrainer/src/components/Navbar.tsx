import { TrainerNavbar } from '@rehab-trainer/ui/components/TrainerNavbar';
import { useLocation } from 'react-router-dom';
import { downloadAllTrainingRecordsCsv } from '../utils/trainingRecords';
import { useT } from '../i18n';
import { siteUrls } from '../utils/siteUrls';

const navLinkClass = ({ isActive }: { isActive: boolean }) => `navbar-link ${isActive ? 'active' : ''}`;

export function Navbar() {
  const { lang, t } = useT();
  const location = useLocation();
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

  return (
    <TrainerNavbar
      brandLabel={t('nav.brand')}
      logoSrc={`${import.meta.env.BASE_URL}assets/logo.svg`}
      logoAlt="Stroke Trainer Logo"
      navItems={[
        { to: '/motor-training', className: () => trainingLinkClass('motor-training'), label: t('home.module.motor.title') },
        { to: '/cognitive-training', className: () => trainingLinkClass('cognitive-training'), label: t('home.module.cognitive.title') },
        { to: '/speech-training', className: () => trainingLinkClass('speech-training'), label: t('home.module.speech.title') },
        { to: '/settings', className: navLinkClass, label: t('nav.settings') },
        { to: '/credits', className: navLinkClass, label: t('nav.credits') },
        { to: '/links', className: navLinkClass, label: t('nav.links') },
      ]}
      auth={{
        apiBase: import.meta.env.VITE_AUTH_API_BASE || siteUrls.hub,
        appName: 'StrokeTrainer',
        locale: lang === 'en' ? 'en' : 'zh-TW',
      }}
      download={{
        label: t('nav.downloadScores'),
        backupReminder: t('nav.scoresBackupReminder'),
        noScoresMessage: t('nav.noScores'),
        errorMessage: lang === 'en'
          ? 'Unable to read saved training scores. Please try again.'
          : '無法讀取已儲存的訓練成績，請稍後再試。',
        onDownload: () => downloadAllTrainingRecordsCsv(t),
      }}
    />
  );
}
