export interface AppLoadingProps {
  label: string;
}

export function AppLoading({ label }: AppLoadingProps) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      aria-live="polite"
      className="app-loading"
      role="status"
    >
      <span className="app-loading-indicator" aria-hidden="true" />
    </div>
  );
}
