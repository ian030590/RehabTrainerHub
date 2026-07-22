import { useT } from '../../i18n';
import {
  GetSetting,
  SetSetting,
  MarkDisplayCalibrated,
  maxUiFontSizePx,
  minUiFontSizePx,
  defaultUiFontSizePx
} from '../../utils/settings';
import type { UiTheme } from '../../utils/settings';
import { SettingRow } from './SettingRow';

const themes: UiTheme[] = ['light', 'dark', 'contrast'];

/* ── General Tab ── */
export function GeneralTab({ refresh }: { refresh: () => void }) {
  const { t, lang, setLang } = useT();
  const uiFontSizePx = GetSetting('uiFontSizePx');
  const uiFontBold = GetSetting('uiFontBold');
  const uiTheme = GetSetting('uiTheme');
  const auditoryFeedbackEnabled = GetSetting('auditoryFeedbackEnabled');
  const setUiFontSize = (nextSizePx: number) => {
    const clampedSizePx = Math.min(maxUiFontSizePx, Math.max(minUiFontSizePx, nextSizePx));
    SetSetting('uiFontSizePx', clampedSizePx);
    refresh();
  };

  return (
    <div className="fade-in">
      {/* Language Toggle */}
      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.language.title')}</h3>
          <p>{t('settings.language.desc')}</p>
        </div>
        <div className="setting-actions">
          <button
            type="button"
            className={`btn btn-sm ${lang === 'zh' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setLang('zh'); refresh(); }}
          >
            {t('settings.language.zh')}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setLang('en'); refresh(); }}
          >
            {t('settings.language.en')}
          </button>
        </div>
      </div>

      {/* UI Typography */}
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
            disabled={uiFontSizePx <= minUiFontSizePx}
            aria-label={t('settings.fontSize.decrease')}
            onClick={() => setUiFontSize(uiFontSizePx - 1)}
          >
            {t('settings.fontSize.decrease')}
          </button>
          <span className="setting-value">
            {t('settings.fontSize.value', { value: uiFontSizePx })}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={uiFontSizePx >= maxUiFontSizePx}
            aria-label={t('settings.fontSize.increase')}
            onClick={() => setUiFontSize(uiFontSizePx + 1)}
          >
            {t('settings.fontSize.increase')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setUiFontSize(defaultUiFontSizePx)}
          >
            {t('settings.fontSize.reset')}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${uiFontBold ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              SetSetting('uiFontBold', !uiFontBold);
              refresh();
            }}
          >
            {uiFontBold ? t('settings.fontBold.on') : t('settings.fontBold.off')}
          </button>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.theme.title')}</h3>
          <p>{t('settings.theme.desc')}</p>
        </div>
        <div className="segmented-control" role="group" aria-label={t('settings.theme.title')}>
          {themes.map((theme) => (
            <button
              type="button"
              className={`btn btn-sm ${uiTheme === theme ? 'btn-primary' : 'btn-secondary'}`}
              key={theme}
              onClick={() => {
                SetSetting('uiTheme', theme);
                refresh();
              }}
            >
              {t(`settings.theme.${theme}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Viewing Distance */}
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

      {/* Sound Toggle */}
      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.sound.title')}</h3>
          <p>{t('settings.sound.desc')}</p>
        </div>
        <div className="setting-actions">
          <button
            type="button"
            className={`btn btn-sm ${auditoryFeedbackEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              SetSetting('auditoryFeedbackEnabled', !auditoryFeedbackEnabled);
              refresh();
            }}
          >
            {auditoryFeedbackEnabled ? t('settings.sound.on') : t('settings.sound.off')}
          </button>
        </div>
      </div>
    </div>
  );
}
