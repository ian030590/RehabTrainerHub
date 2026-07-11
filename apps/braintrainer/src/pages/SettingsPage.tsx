import { useState } from 'react';
import { useT, type Language } from '../i18n';
import {
  DEFAULT_UI_FONT_SIZE_PX,
  MAX_UI_FONT_SIZE_PX,
  MIN_UI_FONT_SIZE_PX,
  type UiTheme,
  getSetting,
  setSetting,
} from '../utils/settings';

const themes: UiTheme[] = ['light', 'dark', 'contrast'];

export function SettingsPage() {
  const { lang, setLang, t } = useT();
  const [fontSize, setFontSize] = useState(() => getSetting('uiFontSizePx'));
  const [bold, setBold] = useState(() => getSetting('uiFontBold'));
  const [theme, setTheme] = useState(() => getSetting('uiTheme'));

  const updateLanguage = (nextLang: Language) => {
    setLang(nextLang);
  };

  const updateFontSize = (nextSize: number) => {
    setFontSize(nextSize);
    setSetting('uiFontSizePx', nextSize);
  };

  const updateBold = (nextBold: boolean) => {
    setBold(nextBold);
    setSetting('uiFontBold', nextBold);
  };

  const updateTheme = (nextTheme: UiTheme) => {
    setTheme(nextTheme);
    setSetting('uiTheme', nextTheme);
  };

  const resetSettings = () => {
    updateFontSize(DEFAULT_UI_FONT_SIZE_PX);
    updateBold(false);
    updateTheme('light');
  };

  return (
    <main className="page-content settings-page" id="main-content">
      <h1 className="section-title fade-in-up" id="settings-title">{t('settings.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('settings.intro')}</p>

      <section className="settings-container" aria-label={t('settings.title')}>
        <div className="setting-row">
          <div className="setting-info">
            <h3>{t('settings.language')}</h3>
          </div>
          <div className="segmented-control" role="group" aria-label={t('settings.language')}>
            <button
              type="button"
              className={`btn btn-sm ${lang === 'zh' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => updateLanguage('zh')}
            >
              {t('settings.language.zh')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => updateLanguage('en')}
            >
              {t('settings.language.en')}
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <h3>{t('settings.fontSize')}</h3>
          </div>
          <div className="range-control">
            <input
              aria-label={t('settings.fontSize')}
              type="range"
              min={MIN_UI_FONT_SIZE_PX}
              max={MAX_UI_FONT_SIZE_PX}
              value={fontSize}
              onChange={(event) => updateFontSize(Number(event.currentTarget.value))}
            />
            <output>{t('settings.fontSizeValue', { size: fontSize })}</output>
          </div>
        </div>

        <label className="setting-row setting-row-clickable">
          <div className="setting-info">
            <h3>{t('settings.bold')}</h3>
            <p>{t('settings.boldDescription')}</p>
          </div>
          <input
            type="checkbox"
            checked={bold}
            onChange={(event) => updateBold(event.currentTarget.checked)}
          />
        </label>

        <div className="setting-row">
          <div className="setting-info">
            <h3>{t('settings.theme')}</h3>
          </div>
          <div className="segmented-control" role="group" aria-label={t('settings.theme')}>
            {themes.map((item) => (
              <button
                type="button"
                className={`btn btn-sm ${theme === item ? 'btn-primary' : 'btn-secondary'}`}
                key={item}
                onClick={() => updateTheme(item)}
              >
                {t(`settings.theme.${item}`)}
              </button>
            ))}
          </div>
        </div>

        <article className="settings-preview card">
          <h3>{t('settings.previewTitle')}</h3>
          <p>{t('settings.previewBody')}</p>
        </article>

        <button className="btn btn-secondary reset-button" type="button" onClick={resetSettings}>
          {t('settings.reset')}
        </button>
      </section>
    </main>
  );
}
