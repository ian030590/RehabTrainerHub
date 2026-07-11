export interface SettingsTabItem<T extends string> {
  label: string;
  tab: T;
}

export interface SettingsTabsProps<T extends string> {
  activeTab: T;
  onChange: (tab: T) => void;
  tabs: SettingsTabItem<T>[];
}

export function SettingsTabs<T extends string>({
  activeTab,
  onChange,
  tabs,
}: SettingsTabsProps<T>) {
  return (
    <div className="settings-tabs" role="tablist">
      {tabs.map((item) => (
        <button
          key={item.tab}
          className={`settings-tab ${activeTab === item.tab ? 'active' : ''}`}
          onClick={() => onChange(item.tab)}
          role="tab"
          type="button"
          aria-selected={activeTab === item.tab}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
