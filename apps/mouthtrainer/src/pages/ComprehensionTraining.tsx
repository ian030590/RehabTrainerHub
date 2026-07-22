import { useT } from '../i18n';

export function ComprehensionTraining() {
  const { t } = useT();

  return (
    <main className="page-content mouth-coming-soon" id="main-content">
      <h1 className="section-title fade-in-up">{t('mouth.comprehension.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('mouth.comprehension.subtitle')}</p>
      <section className="training-panel">
        <h2>{t('mouth.comprehension.title')}</h2>
        <p>{t('mouth.comprehension.body')}</p>
      </section>
    </main>
  );
}
