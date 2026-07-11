import { NavLink } from 'react-router-dom';
import { useT, type TranslationKey } from '../i18n';

export type ModuleId = 'attention' | 'memory' | 'thinking';

interface ModuleDefinition {
  id: ModuleId;
  path: string;
  navKey: TranslationKey;
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  introKey: TranslationKey;
  cards: Array<{
    titleKey: TranslationKey;
    bodyKey: TranslationKey;
  }>;
}

const modules: ModuleDefinition[] = [
  {
    id: 'attention',
    path: '/attention-training',
    navKey: 'nav.attention',
    eyebrowKey: 'module.attention.eyebrow',
    titleKey: 'module.attention.title',
    introKey: 'module.attention.intro',
    cards: [
      { titleKey: 'module.attention.card1.title', bodyKey: 'module.attention.card1.body' },
      { titleKey: 'module.attention.card2.title', bodyKey: 'module.attention.card2.body' },
      { titleKey: 'module.attention.card3.title', bodyKey: 'module.attention.card3.body' },
    ],
  },
  {
    id: 'memory',
    path: '/memory-training',
    navKey: 'nav.memory',
    eyebrowKey: 'module.memory.eyebrow',
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
    path: '/thinking-training',
    navKey: 'nav.thinking',
    eyebrowKey: 'module.thinking.eyebrow',
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
    <main className="page-content brain-page" id="main-content">
      <h1 className="section-title fade-in-up" id="module-title">{t(module.titleKey)}</h1>
      <p className="section-subtitle fade-in-up">{t(module.introKey)}</p>

      <nav className="settings-tabs brain-tabs" aria-label={t('tabs.label')} role="tablist">
        {modules.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            role="tab"
            aria-selected={item.id === module.id}
            className={({ isActive }) => `settings-tab ${isActive ? 'active' : ''}`}
          >
            {t(item.navKey)}
          </NavLink>
        ))}
      </nav>

      <section className="selection-grid content-grid-spaced" aria-label={t(module.titleKey)}>
        {module.cards.map((card, index) => (
          <article className="card selection-card placeholder-card fade-in-up" aria-disabled="true" key={card.titleKey}>
            <span className="card-icon" aria-hidden="true">{index + 1}</span>
            <span className="status-pill">{t('module.status')}</span>
            <span className="card-title">{t(card.titleKey)}</span>
            <span className="card-desc">{t(card.bodyKey)}</span>
            <button className="btn btn-secondary btn-sm placeholder-action" type="button" disabled>
              {t('module.placeholderAction')}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
