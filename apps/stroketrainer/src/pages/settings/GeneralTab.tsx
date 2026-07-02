import { useT } from '../../i18n';
import {
  getSetting,
  setSetting,
  markDisplayCalibrated,
  MAX_UI_FONT_SIZE_PX,
  MIN_UI_FONT_SIZE_PX,
  DEFAULT_UI_FONT_SIZE_PX
} from '../../utils/settings';
import { SettingRow } from './SettingRow';

/* ── General Tab ── */
export function GeneralTab({ refresh }: { refresh: () => void }) {
  const { t, lang, setLang } = useT();
  const uiFontSizePx = getSetting('uiFontSizePx');
  const uiFontBold = getSetting('uiFontBold');
  const auditoryFeedbackEnabled = getSetting('auditoryFeedbackEnabled');
  const soundVolume = getSetting('soundVolume');
  const setUiFontSize = (nextSizePx: number) => {
    const clampedSizePx = Math.min(MAX_UI_FONT_SIZE_PX, Math.max(MIN_UI_FONT_SIZE_PX, nextSizePx));
    setSetting('uiFontSizePx', clampedSizePx);
    refresh();
  };
  const setSoundVolume = (nextVolume: number) => {
    const clampedVolume = Math.min(100, Math.max(0, nextVolume));
    setSetting('soundVolume', clampedVolume);
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
            className={`btn btn-sm ${lang === 'zh' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setLang('zh'); refresh(); }}
          >
            {t('settings.language.zh')}
          </button>
          <button
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
            disabled={uiFontSizePx <= MIN_UI_FONT_SIZE_PX}
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
            disabled={uiFontSizePx >= MAX_UI_FONT_SIZE_PX}
            aria-label={t('settings.fontSize.increase')}
            onClick={() => setUiFontSize(uiFontSizePx + 1)}
          >
            {t('settings.fontSize.increase')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => setUiFontSize(DEFAULT_UI_FONT_SIZE_PX)}
          >
            {t('settings.fontSize.reset')}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${uiFontBold ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setSetting('uiFontBold', !uiFontBold);
              refresh();
            }}
          >
            {uiFontBold ? t('settings.fontBold.on') : t('settings.fontBold.off')}
          </button>
        </div>
      </div>

      {/* Viewing Distance */}
      <SettingRow
        title={t('settings.distance.title')}
        desc={t('settings.distance.desc')}
        value={`${getSetting('distanceInCM')} cm`}
        onEdit={(val: string) => {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num >= 10 && num <= 500) {
            setSetting('distanceInCM', num);
            markDisplayCalibrated();
            refresh();
          }
        }}
        editPlaceholder="60"
      />      {/* Sound Toggle */}
      <div className="setting-row">
        <div className="setting-info">
          <h3>{t('settings.sound.title')}</h3>
          <p>{t('settings.sound.desc')}</p>
        </div>
        <div className="font-setting-control sound-setting-control">
          <button
            type="button"
            className={`btn btn-sm ${auditoryFeedbackEnabled ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setSetting('auditoryFeedbackEnabled', !auditoryFeedbackEnabled);
              refresh();
            }}
          >
            {auditoryFeedbackEnabled ? t('settings.sound.on') : t('settings.sound.off')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={soundVolume <= 0}
            aria-label={t('settings.sound.volumeDecrease')}
            onClick={() => setSoundVolume(soundVolume - 10)}
          >
            {t('settings.sound.volumeDecrease')}
          </button>
          <span className="setting-value">
            {t('settings.sound.volumeValue', { value: soundVolume })}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={soundVolume >= 100}
            aria-label={t('settings.sound.volumeIncrease')}
            onClick={() => setSoundVolume(soundVolume + 10)}
          >
            {t('settings.sound.volumeIncrease')}
          </button>
        </div>
      </div>

      {/* Download Prefix */}
      <SettingRow
        title={t('settings.prefix.title')}
        desc={t('settings.prefix.desc')}
        value={getSetting('downloadDirectory') || t('settings.prefix.notSet')}
        onEdit={(val: string) => {
          setSetting('downloadDirectory', val);
          refresh();
        }}
        editPlaceholder={t('settings.prefix.placeholder')}
      />
    </div>
  );
}
