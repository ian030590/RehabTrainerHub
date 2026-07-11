export interface AppLoadingProps {
  label: string;
}

export function AppLoading({ label }: AppLoadingProps) {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="app-loading-indicator" />
      <div className="app-loading-text">{label}</div>
    </div>
  );
}
