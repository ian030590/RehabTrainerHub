export interface ReferenceListItem {
  title: string;
  href: string;
  modules: readonly string[];
  description?: string;
}

export interface ReferenceListPageLabels {
  githubSection: string;
  literatureSection: string;
  emptyLabel?: string;
}

export interface ReferenceListPageProps {
  title: string;
  subtitle: string;
  labels: ReferenceListPageLabels;
  githubItems?: readonly ReferenceListItem[];
  literatureItems?: readonly ReferenceListItem[];
  variant?: 'trainer' | 'hub';
}

export function formatReferenceModuleChip(tabName: string, moduleName: string) {
  return `{${tabName}-${moduleName}}`;
}

function ReferenceSection({
  emptyLabel,
  items,
  kind,
  title,
}: {
  emptyLabel?: string;
  kind: 'github' | 'literature';
  items: readonly ReferenceListItem[];
  title: string;
}) {
  const titleId = `${kind}-references-title`;

  if (!items.length) {
    return emptyLabel ? (
      <section className={`reference-section reference-section-${kind}`} aria-labelledby={titleId}>
        <h2 className="reference-section-title" id={titleId}>{title}</h2>
        <p className="reference-empty">{emptyLabel}</p>
      </section>
    ) : null;
  }

  return (
    <section className={`reference-section reference-section-${kind}`} aria-labelledby={titleId}>
      <h2 className="reference-section-title" id={titleId}>{title}</h2>
      <ul className="reference-list">
        {items.map((item) => (
          <li className="reference-list-item" key={item.href}>
            <a className="reference-item-link" href={item.href} rel="noopener noreferrer" target="_blank">
              <span className="reference-item-title">{item.title}</span>
              {item.description && <p className="reference-item-description">{item.description}</p>}
              {item.modules.length > 0 && (
                <div className="reference-modules">
                  <div className="reference-module-list">
                    {item.modules.map((moduleName) => (
                      <span className="reference-module-chip" key={moduleName}>{moduleName}</span>
                    ))}
                  </div>
                </div>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReferenceListPage({
  githubItems = [],
  labels,
  literatureItems = [],
  subtitle,
  title,
  variant = 'trainer',
}: ReferenceListPageProps) {
  const isHub = variant === 'hub';

  return (
    <main
      className={isHub
        ? 'content-page shared-reference-page hub-reference-page'
        : 'shared-page-content shared-reference-page trainer-reference-page'}
      id="main-content"
    >
      <h1 className={isHub ? undefined : 'shared-section-title'}>{title}</h1>
      <p className={isHub ? 'content-intro' : 'shared-section-subtitle'}>{subtitle}</p>
      <div className="reference-sections">
        <ReferenceSection
          emptyLabel={labels.emptyLabel}
          kind="github"
          items={githubItems}
          title={labels.githubSection}
        />
        <ReferenceSection
          emptyLabel={labels.emptyLabel}
          kind="literature"
          items={literatureItems}
          title={labels.literatureSection}
        />
      </div>
    </main>
  );
}
