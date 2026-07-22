import { useState } from 'react';
import { useT, type Language } from '../../i18n';
import { defaultUiFontSizePx, GetSetting, maxUiFontSizePx, minUiFontSizePx, SetSetting, type UiTheme } from '../../utils/settings';

const themes: UiTheme[] = ['light', 'dark', 'contrast'];

export function SettingsPage() {
  const { lang, setLang, t } = useT();
  const [fontSize, setFontSize] = useState(() => GetSetting('uiFontSizePx'));
  const [bold, setBold] = useState(() => GetSetting('uiFontBold'));
  const [theme, setTheme] = useState(() => GetSetting('uiTheme'));
  const [auditoryFeedback, setAuditoryFeedback] = useState(() => GetSetting('auditoryFeedbackEnabled'));
  const updateFontSize = (value: number) => { setFontSize(value); SetSetting('uiFontSizePx', value); };

  return (
    <main className="page-content" id="main-content">
      <h1 className="section-title fade-in-up">{t('nav.settings')}</h1>
      <p className="section-subtitle fade-in-up">{lang === 'en' ? 'Set the display and feedback options used throughout MouthTrainer.' : '設定 MouthTrainer 的顯示與回饋選項。'}</p>
      <section className="settings-container" aria-label={t('nav.settings')}>
        <div className="setting-row"><div className="setting-info"><h3>{t('settings.language.title')}</h3><p>{t('settings.language.desc')}</p></div><div className="setting-actions"><button type="button" className={`btn btn-sm ${lang === 'zh' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLang('zh' as Language)}>{t('settings.language.zh')}</button><button type="button" className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLang('en' as Language)}>{t('settings.language.en')}</button></div></div>
        <div className="setting-row"><div className="setting-info"><h3>{t('settings.fontSize.title')}</h3><p>{t('settings.fontSize.desc')}</p></div><div className="font-setting-control typography-setting-control"><button className="btn btn-sm btn-secondary" type="button" disabled={fontSize <= minUiFontSizePx} onClick={() => updateFontSize(fontSize - 1)}>{t('settings.fontSize.decrease')}</button><span className="setting-value">{t('settings.fontSize.value', { value: fontSize })}</span><button className="btn btn-sm btn-secondary" type="button" disabled={fontSize >= maxUiFontSizePx} onClick={() => updateFontSize(fontSize + 1)}>{t('settings.fontSize.increase')}</button><button className="btn btn-sm btn-ghost" type="button" onClick={() => updateFontSize(defaultUiFontSizePx)}>{t('settings.fontSize.reset')}</button><button className={`btn btn-sm ${bold ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => { const next = !bold; setBold(next); SetSetting('uiFontBold', next); }}>{bold ? t('settings.fontBold.on') : t('settings.fontBold.off')}</button></div></div>
        <div className="setting-row"><div className="setting-info"><h3>{t('settings.theme.title')}</h3><p>{t('settings.theme.desc')}</p></div><div className="segmented-control" role="group" aria-label={t('settings.theme.title')}>{themes.map((item) => <button className={`btn btn-sm ${theme === item ? 'btn-primary' : 'btn-secondary'}`} key={item} type="button" onClick={() => { setTheme(item); SetSetting('uiTheme', item); }}>{t(`settings.theme.${item}`)}</button>)}</div></div>
        <div className="setting-row"><div className="setting-info"><h3>{t('settings.sound.title')}</h3><p>{t('settings.sound.desc')}</p></div><div className="setting-actions"><button className={`btn btn-sm ${auditoryFeedback ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => { const next = !auditoryFeedback; setAuditoryFeedback(next); SetSetting('auditoryFeedbackEnabled', next); }}>{auditoryFeedback ? t('settings.sound.on') : t('settings.sound.off')}</button></div></div>
      </section>
    </main>
  );
}
