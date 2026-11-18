export const options = {
  traffic: ['lead-only', 'light', 'busy'],
  scenario: ['plain', 'swerve-away', 'out-and-back', 'mixed'],
  speedKmh: [80, 90, 100, 110],
  leadType: ['sedan', 'suv', 'ev', 'sport'],
  ownType: ['sedan', 'suv', 'ev', 'sport'],
  road: ['dry', 'wet'],
} as const;

export type Settings = { [K in keyof typeof options]: (typeof options)[K][number] };
export type Scenario = Exclude<Settings['scenario'], 'mixed'>;
export const defaults: Settings = {
  traffic: 'lead-only', scenario: 'plain', speedKmh: 100, leadType: 'sedan', ownType: 'sedan', road: 'dry',
};

export function RestoreSettings(saved: Record<string, unknown>): Settings {
  return Object.fromEntries(Object.entries(options).map(([key, values]) => [
    key, values.some(value => value === saved[key]) ? saved[key] : defaults[key as keyof Settings],
  ])) as Settings;
}

export const defaultSettings = defaults;

export function ValidateSettings(settings: Settings) {
  return Object.entries(options).every(([key, values]) =>
    values.some(value => value === settings[key as keyof Settings]));
}
