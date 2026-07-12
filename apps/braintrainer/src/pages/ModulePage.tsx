import { Link } from 'react-router-dom';
import { useT, type TranslationKey } from '../i18n';

export type ModuleId = 'attention' | 'memory' | 'thinking';

interface ModuleDefinition {
  id: ModuleId;
  titleKey: TranslationKey;
  introKey: TranslationKey;
  cards: Array<{
    titleKey: TranslationKey;
    bodyKey: TranslationKey;
    actionKey?: TranslationKey;
    to?: string;
  }>;
}

const modules: ModuleDefinition[] = [
  {
    id: 'attention',
    titleKey: 'module.attention.title',
    introKey: 'module.attention.intro',
    cards: [
      {
        titleKey: 'module.attention.ufov.title',
        bodyKey: 'module.attention.ufov.body',
        actionKey: 'module.attention.ufov.action',
        to: '/attention-training/ufov',
      },
      { titleKey: 'module.attention.card2.title', bodyKey: 'module.attention.card2.body' },
      { titleKey: 'module.attention.card3.title', bodyKey: 'module.attention.card3.body' },
    ],
  },
  {
    id: 'memory',
    titleKey: 'module.memory.title',
    introKey: 'module.memory.intro',
    cards: [
      { titleKey: 'module.memory.card1.title', bodyKey: 'module.memory.card1.body' },
      { titleKey: 'module.memory.card2.title', bodyKey: 'module.memory.card2.body' },
      { titleKey: 'module.memory.card3.title', bodyKey: 'module.memory.card3.body' },
    ],
  },
  {
    id: 'thinking',
    titleKey: 'module.thinking.title',
    introKey: 'module.thinking.intro',
    cards: [
      { titleKey: 'module.thinking.card1.title', bodyKey: 'module.thinking.card1.body' },
      { titleKey: 'module.thinking.card2.title', bodyKey: 'module.thinking.card2.body' },
      { titleKey: 'module.thinking.card3.title', bodyKey: 'module.thinking.card3.body' },
    ],
  },
];

function getModule(moduleId: ModuleId) {
  return modules.find((module) => module.id === moduleId) ?? modules[0];
}

export function ModulePage({ moduleId }: { moduleId: ModuleId }) {
  const { t } = useT();
  const module = getModule(moduleId);

  return (
    <main className="page-content" id="main-content">
      <h1 className="section-title fade-in-up" id="module-title">{t(module.titleKey)}</h1>
      <p className="section-subtitle fade-in-up">{t(module.introKey)}</p>

      <section className="selection-grid content-grid-spaced" aria-label={t(module.titleKey)}>
        {module.cards.map((card, index) => (
          <article
            className={`card selection-card ${card.to ? '' : 'placeholder-card'} fade-in-up`}
            aria-disabled={card.to ? undefined : 'true'}
            key={card.titleKey}
          >
            <span className="card-icon" aria-hidden="true">{index + 1}</span>
            <span className="card-title">{t(card.titleKey)}</span>
            <span className="card-desc">{t(card.bodyKey)}</span>
            <div className="card-action">
              {card.to ? (
                <Link className="btn btn-primary btn-sm" to={card.to}>
                  {t(card.actionKey ?? 'module.openAction')}
                </Link>
              ) : (
                <button className="btn btn-secondary btn-sm" type="button" disabled>
                  {t('module.placeholderAction')}
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
