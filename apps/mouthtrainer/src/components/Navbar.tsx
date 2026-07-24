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
        { to: '/comprehension-training', label: t('nav.comprehension') },
        { to: '/oral-training', label: t('nav.oral') },
        { to: '/settings', label: t('nav.settings') },
        { to: '/references', label: t('nav.credits') },
        { to: '/links', label: t('nav.links') },
      ]}
      auth={{
        apiBase: siteUrls.hub,
        appName: 'MouthTrainer',
        locale: lang === 'en' ? 'en' : 'zh-TW',
        turnstileAuthRequired: import.meta.env.VITE_TURNSTILE_AUTH_REQUIRED === '1',
        turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
      }}
      download={{ label: t('nav.downloadScores'), noScoresMessage: t('nav.noScores'), errorMessage: t('nav.scoresDownloadError'), onDownload: () => DownloadAllTrainingRecordsCsv(t) }}
      toggleMenuLabel={t('nav.toggleMenu')}
    />
  );
}
