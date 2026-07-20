export interface ReferenceListItem {
  title: string;
  href: string;
  modules: readonly string[];
  description?: string;
  actionLabel?: string;
}

export interface ReferenceListPageLabels {
  githubSection: string;
  literatureSection: string;
  moduleLabel: string;
  githubTypeLabel: string;
  literatureTypeLabel: string;
  emptyLabel?: string;
}

export interface ReferenceListPageProps {
  title: string;
  subtitle: string;
  labels: ReferenceListPageLabels;
  githubItems?: readonly ReferenceListItem[];
  literatureItems?: readonly ReferenceListItem[];
}

function ReferenceSection({
  emptyLabel,
  id,
  items,
  moduleLabel,
  title,
  typeLabel,
}: {
  emptyLabel?: string;
  id: string;
  items: readonly ReferenceListItem[];
  moduleLabel: string;
  title: string;
  typeLabel: string;
}) {
  if (!items.length) {
    return emptyLabel ? (
      <section className="reference-section" aria-labelledby={`${id}-title`}>
        <h2 className="reference-section-title" id={`${id}-title`}>{title}</h2>
        <p className="reference-empty">{emptyLabel}</p>
      </section>
    ) : null;
  }

  return (
    <section className="reference-section" aria-labelledby={`${id}-title`}>
      <h2 className="reference-section-title" id={`${id}-title`}>{title}</h2>
      <ul className="reference-list">
        {items.map((item) => (
          <li className="reference-list-item" key={item.href}>
            <span className="reference-source-type">{typeLabel}</span>
            <a className="reference-item-link" href={item.href} rel="noopener noreferrer" target="_blank">
              {item.title}
            </a>
            {item.description && <p className="reference-item-description">{item.description}</p>}
            {item.actionLabel && <span className="reference-item-action">{item.actionLabel}</span>}
            <div className="reference-modules" aria-label={moduleLabel}>
              <span className="reference-module-label">{moduleLabel}</span>
              <div className="reference-module-list">
                {item.modules.map((moduleName) => (
                  <span className="reference-module-chip" key={moduleName}>{moduleName}</span>
                ))}
              </div>
            </div>
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
}: ReferenceListPageProps) {
  return (
    <main className="shared-page-content shared-reference-page" id="main-content">
      <h1 className="shared-section-title">{title}</h1>
      <p className="shared-section-subtitle">{subtitle}</p>
      <div className="reference-sections">
        <ReferenceSection
          emptyLabel={labels.emptyLabel}
          id="github-references"
          items={githubItems}
          moduleLabel={labels.moduleLabel}
          title={labels.githubSection}
          typeLabel={labels.githubTypeLabel}
        />
        <ReferenceSection
          emptyLabel={labels.emptyLabel}
          id="literature-references"
          items={literatureItems}
          moduleLabel={labels.moduleLabel}
          title={labels.literatureSection}
          typeLabel={labels.literatureTypeLabel}
        />
      </div>
    </main>
  );
}
