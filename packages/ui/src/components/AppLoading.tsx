export interface AppLoadingProps {
  label: string;
}

export function AppLoading({ label }: AppLoadingProps) {
  return (
    <div className="app-loading" role="status" aria-busy="true" aria-live="polite">
      <div className="app-loading-skeleton" aria-hidden="true">
        <span className="app-loading-indicator" />
        <span className="app-loading-skeleton-copy">
          <span className="app-loading-skeleton-line app-loading-skeleton-line-title" />
          <span className="app-loading-skeleton-line" />
          <span className="app-loading-skeleton-line app-loading-skeleton-line-short" />
        </span>
      </div>
      <p className="app-loading-text">{label}</p>
    </div>
  );
}
