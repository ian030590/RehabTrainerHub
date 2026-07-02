import { useT } from '../../i18n';

export function CreditsPage() {
  const { t } = useT();

  const credits = [
    {
      titleKey: 'credits.fract10.title',
      descKey: 'credits.fract10.desc',
      repo: 'michaelbach/FrACT10',
      url: 'https://github.com/michaelbach/FrACT10',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      titleKey: 'credits.eyeTraining.title',
      descKey: 'credits.eyeTraining.desc',
      repo: 'styts/eye-training',
      url: 'https://github.com/styts/eye-training',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M16 8l-4 4-4-4" />
        </svg>
      ),
    },
    {
      titleKey: 'credits.foveaflow.title',
      descKey: 'credits.foveaflow.desc',
      repo: 'Jesper-N/foveaflow',
      url: 'https://github.com/Jesper-N/foveaflow',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 3a9 9 0 0 1 9 9" />
          <path d="M21 12a9 9 0 0 1 -9 9" />
          <path d="M12 21a9 9 0 0 1 -9 -9" />
          <path d="M3 12a9 9 0 0 1 9 -9" />
        </svg>
      ),
    },
    {
      titleKey: 'credits.gaborPatching.title',
      descKey: 'credits.gaborPatching.desc',
      repo: 'Fordi/gabor-patching',
      url: 'https://github.com/Fordi/gabor-patching',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
        </svg>
      ),
    },
    {
      titleKey: 'credits.visiontherapy.title',
      descKey: 'credits.visiontherapy.desc',
      repo: 'visiontherapy/visiontherapy.github.io',
      url: 'https://github.com/visiontherapy/visiontherapy.github.io',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="page-content">
      <h1 className="section-title fade-in-up">{t('credits.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('credits.subtitle')}</p>

      <div className="selection-grid" style={{ marginTop: 32 }}>
        {credits.map((c, i) => (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card fade-in-up"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="card-icon">
              {c.icon}
            </div>
            <div className="card-title">{t(c.titleKey as any)}</div>
            <div className="card-desc">
              {t(c.descKey as any)}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              {c.repo}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
