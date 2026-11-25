export type HubLocale = 'zh-TW' | 'en';
export type HubLabel = Readonly<Record<HubLocale, string>>;
export type ActivityFeatureLabels = Readonly<Record<'content' | 'characteristics' | 'waysToPlay', string>>;
