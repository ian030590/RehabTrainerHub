import { useT } from '../i18n';

export function ReferencesPage() {
  const { t } = useT();

  return (
    <main className="page-content" id="main-content">
      <h1 className="section-title fade-in-up">{t('references.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('references.subtitle')}</p>
    </main>
  );
}
