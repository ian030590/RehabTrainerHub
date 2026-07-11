import { ExternalLinkCard } from '@rehab-trainer/ui/components/ExternalLinkCard';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT } from '../i18n';

export function ReferencesPage() {
  const { t } = useT();

  return (
    <main className="page-content" id="main-content">
      <h1 className="section-title fade-in-up">{t('references.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('references.subtitle')}</p>
      <section className="selection-grid content-grid-spaced" aria-label={t('references.title')}>
        <ExternalLinkCard
          href="https://github.com/ian030590/RehabTrainerHub"
          icon={<Icons.Github />}
          title={t('references.repo.title')}
          description={t('references.repo.desc')}
          actionLabel="ian030590/RehabTrainerHub"
          actionIcon={<Icons.Github />}
        />
      </section>
    </main>
  );
}
