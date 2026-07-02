import { useT } from '../../i18n';

export function LinksPage() {
  const { t } = useT();

  const links = [
    {
      titleKey: 'links.strokeTrainer.title',
      descKey: 'links.strokeTrainer.desc',
      url: 'https://stroketrainer.pages.dev',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="page-content">
      <h1 className="section-title fade-in-up">{t('links.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('links.subtitle')}</p>

      <div className="selection-grid" style={{ marginTop: 32 }}>
        {links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card fade-in-up"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="card-icon">
              {link.icon}
            </div>
            <div className="card-title">{t(link.titleKey as any)}</div>
            <div className="card-desc">
              {t(link.descKey as any)}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              fontSize: 13,
              color: 'var(--accent)',
              fontWeight: 600,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {link.url.replace('https://', '')}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
