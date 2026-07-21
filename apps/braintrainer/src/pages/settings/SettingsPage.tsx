import { useState } from 'react';
import { useT, type Language } from '../../i18n';
import {
  defaultUiFontSizePx,
  maxUiFontSizePx,
  minUiFontSizePx,
  type UiTheme,
  GetSetting,
  SetSetting,
} from '../../utils/settings';

const themes: UiTheme[] = ['light', 'dark', 'contrast'];

export function SettingsPage() {
  const { lang, setLang, t } = useT();
  const [fontSize, setFontSize] = useState(() => GetSetting('uiFontSizePx'));
  const [bold, setBold] = useState(() => GetSetting('uiFontBold'));
  const [theme, setTheme] = useState(() => GetSetting('uiTheme'));
  const [auditoryFeedbackEnabled, setAuditoryFeedbackEnabled] = useState(() => GetSetting('auditoryFeedbackEnabled'));

  const updateLanguage = (nextLang: Language) => {
    setLang(nextLang);
  };

  const updateFontSize = (nextSize: number) => {
    setFontSize(nextSize);
    SetSetting('uiFontSizePx', nextSize);
  };

  const updateBold = (nextBold: boolean) => {
    setBold(nextBold);
    SetSetting('uiFontBold', nextBold);
  };

  const updateTheme = (nextTheme: UiTheme) => {
    setTheme(nextTheme);
    SetSetting('uiTheme', nextTheme);
  };

  const updateAuditoryFeedback = (nextEnabled: boolean) => {
    setAuditoryFeedbackEnabled(nextEnabled);
    SetSetting('auditoryFeedbackEnabled', nextEnabled);
  };

  const resetSettings = () => {
    updateFontSize(defaultUiFontSizePx);
    updateBold(false);
    updateTheme('light');
    updateAuditoryFeedback(true);
  };

  return (
    <main className="page-content" id="main-content">
      <h1 className="section-title fade-in-up" id="settings-title">{t('settings.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('settings.intro')}</p>

      <section className="settings-container" aria-label={t('settings.title')}>
        <div className="setting-row">
          <div className="setting-info">
            <h3>{t('settings.language.title')}</h3>
            <p>{t('settings.language.desc')}</p>
          </div>
          <div className="setting-actions">
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
            <h3>{t('settings.fontSize.title')}</h3>
            <p>
              {t('settings.fontSize.desc')}<br />
              {t('settings.fontBold.desc')}
            </p>
          </div>
          <div className="font-setting-control typography-setting-control">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={fontSize <= minUiFontSizePx}
              aria-label={t('settings.fontSize.decrease')}
              onClick={() => updateFontSize(fontSize - 1)}
            >
              {t('settings.fontSize.decrease')}
            </button>
            <span className="setting-value">
              {t('settings.fontSize.value', { value: fontSize })}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={fontSize >= maxUiFontSizePx}
              aria-label={t('settings.fontSize.increase')}
              onClick={() => updateFontSize(fontSize + 1)}
            >
              {t('settings.fontSize.increase')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => updateFontSize(defaultUiFontSizePx)}
            >
              {t('settings.fontSize.reset')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${bold ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => updateBold(!bold)}
            >
              {bold ? t('settings.fontBold.on') : t('settings.fontBold.off')}
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <h3>{t('settings.theme.title')}</h3>
            <p>{t('settings.theme.desc')}</p>
          </div>
          <div className="segmented-control" role="group" aria-label={t('settings.theme.title')}>
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

        <div className="setting-row">
          <div className="setting-info">
            <h3>{t('settings.sound.title')}</h3>
            <p>{t('settings.sound.desc')}</p>
          </div>
          <div className="setting-actions">
            <button
              type="button"
              className={`btn btn-sm ${auditoryFeedbackEnabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => updateAuditoryFeedback(!auditoryFeedbackEnabled)}
            >
              {auditoryFeedbackEnabled ? t('settings.sound.on') : t('settings.sound.off')}
            </button>
          </div>
        </div>

        <button className="btn btn-secondary reset-button" type="button" onClick={resetSettings}>
          {t('settings.reset')}
        </button>
      </section>
    </main>
  );
}
