export type GeneralSettingsLanguage = 'zh' | 'en';
export type GeneralSettingsTheme = 'light' | 'dark' | 'contrast';

export interface GeneralSettingsPanelLabels {
  languageTitle: string;
  languageDescription: string;
  chinese: string;
  english: string;
  fontSizeTitle: string;
  fontSizeDescription: string;
  fontBoldDescription: string;
  fontSizeValue: string;
  decreaseFontSize: string;
  increaseFontSize: string;
  resetFontSize: string;
  fontBoldOn: string;
  fontBoldOff: string;
  themeTitle: string;
  themeDescription: string;
  lightTheme: string;
  darkTheme: string;
  contrastTheme: string;
  soundTitle: string;
  soundDescription: string;
  soundOn: string;
  soundOff: string;
  resetSettings?: string;
}

export interface GeneralSettingsPanelProps {
  auditoryFeedbackEnabled: boolean;
  className?: string;
  defaultFontSizePx: number;
  fontBold: boolean;
  fontSizePx: number;
  labels: GeneralSettingsPanelLabels;
  language: GeneralSettingsLanguage;
  maxFontSizePx: number;
  minFontSizePx: number;
  onAuditoryFeedbackChange: (enabled: boolean) => void;
  onFontBoldChange: (enabled: boolean) => void;
  onFontSizeChange: (fontSizePx: number) => void;
  onLanguageChange: (language: GeneralSettingsLanguage) => void;
  onReset?: () => void;
  onThemeChange: (theme: GeneralSettingsTheme) => void;
  theme: GeneralSettingsTheme;
}

const themes: GeneralSettingsTheme[] = ['light', 'dark', 'contrast'];

export function CreateGeneralSettingsPanelLabels(
  t: (key: any, params?: Record<string, string | number>) => string,
  fontSizePx: number,
): GeneralSettingsPanelLabels {
  return {
    languageTitle: t('settings.language.title'),
    languageDescription: t('settings.language.desc'),
    chinese: t('settings.language.zh'),
    english: t('settings.language.en'),
    fontSizeTitle: t('settings.fontSize.title'),
    fontSizeDescription: t('settings.fontSize.desc'),
    fontBoldDescription: t('settings.fontBold.desc'),
    fontSizeValue: t('settings.fontSize.value', { value: fontSizePx }),
    decreaseFontSize: t('settings.fontSize.decrease'),
    increaseFontSize: t('settings.fontSize.increase'),
    resetFontSize: t('settings.fontSize.reset'),
    fontBoldOn: t('settings.fontBold.on'),
    fontBoldOff: t('settings.fontBold.off'),
    themeTitle: t('settings.theme.title'),
    themeDescription: t('settings.theme.desc'),
    lightTheme: t('settings.theme.light'),
    darkTheme: t('settings.theme.dark'),
    contrastTheme: t('settings.theme.contrast'),
    soundTitle: t('settings.sound.title'),
    soundDescription: t('settings.sound.desc'),
    soundOn: t('settings.sound.on'),
    soundOff: t('settings.sound.off'),
    resetSettings: t('settings.reset'),
  };
}

export function GeneralSettingsPanel({
  auditoryFeedbackEnabled,
  className = 'fade-in',
  defaultFontSizePx,
  fontBold,
  fontSizePx,
  labels,
  language,
  maxFontSizePx,
  minFontSizePx,
  onAuditoryFeedbackChange,
  onFontBoldChange,
  onFontSizeChange,
  onLanguageChange,
  onReset,
  onThemeChange,
  theme,
}: GeneralSettingsPanelProps) {
  const setFontSize = (nextSizePx: number) => {
    onFontSizeChange(Math.min(maxFontSizePx, Math.max(minFontSizePx, nextSizePx)));
  };

  return (
    <div className={className}>
      <div className="setting-row">
        <div className="setting-info">
          <h3>{labels.languageTitle}</h3>
          <p>{labels.languageDescription}</p>
        </div>
        <div className="setting-actions">
          <button
            type="button"
            className={`btn btn-sm ${language === 'zh' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onLanguageChange('zh')}
          >
            {labels.chinese}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onLanguageChange('en')}
          >
            {labels.english}
          </button>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <h3>{labels.fontSizeTitle}</h3>
          <p>
            {labels.fontSizeDescription}<br />
            {labels.fontBoldDescription}
          </p>
        </div>
        <div className="font-setting-control typography-setting-control">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={fontSizePx <= minFontSizePx}
            aria-label={labels.decreaseFontSize}
            onClick={() => setFontSize(fontSizePx - 1)}
          >
            {labels.decreaseFontSize}
          </button>
          <span className="setting-value">{labels.fontSizeValue}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={fontSizePx >= maxFontSizePx}
            aria-label={labels.increaseFontSize}
            onClick={() => setFontSize(fontSizePx + 1)}
          >
            {labels.increaseFontSize}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setFontSize(defaultFontSizePx)}
          >
            {labels.resetFontSize}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${fontBold ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onFontBoldChange(!fontBold)}
          >
            {fontBold ? labels.fontBoldOn : labels.fontBoldOff}
          </button>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <h3>{labels.themeTitle}</h3>
          <p>{labels.themeDescription}</p>
        </div>
        <div className="segmented-control" role="group" aria-label={labels.themeTitle}>
          {themes.map((item) => (
            <button
              type="button"
              className={`btn btn-sm ${theme === item ? 'btn-primary' : 'btn-secondary'}`}
              key={item}
              onClick={() => onThemeChange(item)}
            >
              {item === 'light'
                ? labels.lightTheme
                : item === 'dark'
                  ? labels.darkTheme
                  : labels.contrastTheme}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <h3>{labels.soundTitle}</h3>
          <p>{labels.soundDescription}</p>
        </div>
        <div className="setting-actions">
          <button
            type="button"
            className={`btn btn-sm ${auditoryFeedbackEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onAuditoryFeedbackChange(!auditoryFeedbackEnabled)}
          >
            {auditoryFeedbackEnabled ? labels.soundOn : labels.soundOff}
          </button>
        </div>
      </div>

      {onReset && labels.resetSettings && (
        <button className="btn btn-secondary reset-button" type="button" onClick={onReset}>
          {labels.resetSettings}
        </button>
      )}
    </div>
  );
}
