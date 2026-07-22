import { TrainerNavbar } from '@rehab-trainer/ui/components/TrainerNavbar';
import { useT } from '../i18n';
import { DownloadAllTrainingRecordsCsv } from '../utils/trainingRecords';
import { siteUrls } from '../utils/siteUrls';

export function Navbar() {
  const { lang, t } = useT();

  return (
    <TrainerNavbar
      brandLabel={t('nav.brand')}
      logoSrc={`${import.meta.env.BASE_URL}assets/logo.svg`}
      logoAlt={t('nav.logoAlt')}
      navItems={[
        { to: '/speech-training', label: t('nav.speech') },
        { to: '/comprehension-training', label: t('nav.comprehension') },
        { to: '/oral-training', label: t('nav.oral') },
        { to: '/settings', label: t('nav.settings') },
        { to: '/references', label: t('nav.credits') },
        { to: '/links', label: t('nav.links') },
      ]}
      auth={{ apiBase: siteUrls.hub, appName: 'MouthTrainer', locale: lang === 'en' ? 'en' : 'zh-TW' }}
      download={{ label: t('nav.downloadScores'), noScoresMessage: t('nav.noScores'), errorMessage: t('nav.scoresDownloadError'), onDownload: () => DownloadAllTrainingRecordsCsv(t) }}
      toggleMenuLabel={t('nav.toggleMenu')}
    />
  );
}
