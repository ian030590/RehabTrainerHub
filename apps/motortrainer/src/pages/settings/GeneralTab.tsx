import {
  CreateGeneralSettingsPanelLabels,
  GeneralSettingsPanel,
} from '@rehab-trainer/ui/components/GeneralSettingsPanel';
import { useT } from '../../i18n';
import {
  GetSetting,
  SetSetting,
  MarkDisplayCalibrated,
  maxUiFontSizePx,
  minUiFontSizePx,
  defaultUiFontSizePx
} from '../../utils/settings';
import { SettingRow } from './SettingRow';

export function GeneralTab({ refresh }: { refresh: () => void }) {
  const { t, lang, setLang } = useT();
  const uiFontSizePx = GetSetting('uiFontSizePx');

  return (
    <div className="fade-in">
      <GeneralSettingsPanel
        auditoryFeedbackEnabled={GetSetting('auditoryFeedbackEnabled')}
        className=""
        defaultFontSizePx={defaultUiFontSizePx}
        fontBold={GetSetting('uiFontBold')}
        fontSizePx={uiFontSizePx}
        labels={CreateGeneralSettingsPanelLabels(t, uiFontSizePx)}
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
        onThemeChange={(theme) => {
          SetSetting('uiTheme', theme);
          refresh();
        }}
        theme={GetSetting('uiTheme')}
      />

      <SettingRow
        title={t('settings.distance.title')}
        desc={t('settings.distance.desc')}
        value={`${GetSetting('distanceInCM')} cm`}
        onEdit={(val: string) => {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num >= 10 && num <= 500) {
            SetSetting('distanceInCM', num);
            MarkDisplayCalibrated();
            refresh();
          }
        }}
        editPlaceholder="60"
      />
    </div>
  );
}
