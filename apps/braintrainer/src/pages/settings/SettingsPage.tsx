import { useState } from 'react';
import {
  CreateGeneralSettingsPanelLabels,
  GeneralSettingsPanel,
} from '@rehab-trainer/ui/components/GeneralSettingsPanel';
import { useT } from '../../i18n';
import {
  defaultUiFontSizePx,
  maxUiFontSizePx,
  minUiFontSizePx,
  GetSetting,
  SetSetting,
} from '../../utils/settings';

export function SettingsPage() {
  const { lang, setLang, t } = useT();
  const [, setTick] = useState(0);
  const refresh = () => setTick((tick) => tick + 1);
  const fontSize = GetSetting('uiFontSizePx');

  const resetSettings = () => {
    SetSetting('uiFontSizePx', defaultUiFontSizePx);
    SetSetting('uiFontBold', false);
    SetSetting('uiTheme', 'light');
    SetSetting('auditoryFeedbackEnabled', true);
    refresh();
  };

  return (
    <main className="page-content" id="main-content">
      <h1 className="section-title fade-in-up" id="settings-title">{t('settings.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('settings.subtitle')}</p>

      <section className="settings-container" aria-label={t('settings.title')}>
        <GeneralSettingsPanel
          auditoryFeedbackEnabled={GetSetting('auditoryFeedbackEnabled')}
          defaultFontSizePx={defaultUiFontSizePx}
          fontBold={GetSetting('uiFontBold')}
          fontSizePx={fontSize}
          labels={CreateGeneralSettingsPanelLabels(t, fontSize)}
          language={lang}
          maxFontSizePx={maxUiFontSizePx}
          minFontSizePx={minUiFontSizePx}
          onAuditoryFeedbackChange={(enabled) => {
            SetSetting('auditoryFeedbackEnabled', enabled);
            refresh();
          }}
          onFontBoldChange={(enabled) => {
            SetSetting('uiFontBold', enabled);
            refresh();
          }}
          onFontSizeChange={(fontSizePx) => {
            SetSetting('uiFontSizePx', fontSizePx);
            refresh();
          }}
          onLanguageChange={(language) => {
            setLang(language);
            refresh();
          }}
          onReset={resetSettings}
          onThemeChange={(theme) => {
            SetSetting('uiTheme', theme);
            refresh();
          }}
          theme={GetSetting('uiTheme')}
        />
      </section>
    </main>
  );
}
