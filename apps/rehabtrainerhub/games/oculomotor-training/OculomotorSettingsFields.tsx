import { GetActiveSettingFields, settingsSections, type OculomotorSettings } from './settings';

// OcuTrain 6676f24 moduleFormFields/bindModuleDialogEvents, adapted to React state.
export function OculomotorSettingsFields({ settings, language, onChange }: {
  settings: OculomotorSettings; language: 'zh' | 'en'; onChange: (settings: OculomotorSettings) => void;
}) {
  const en = language === 'en';
  const locale = en ? 'en' : 'zh-TW';
  const module = String(settings.module);
  const directions = [7, 0, 1, 6, -1, 2, 5, 4, 3];
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const count = arrows.filter((_, index) => settings[`axis${index}Enabled`]).length;
  const visible = new Set(GetActiveSettingFields(settings).map(field => field.key));
  return <>{settingsSections.filter(section => section.id !== 'directions').map(section => <section className="training-setting" key={section.id}>
    <h3>{section.title[locale]}</h3>
    {section.fields.filter(field => visible.has(field.key)).map(field => {
      const value = settings[field.key];
      if (field.key === 'stimulusType') return <fieldset className="oculomotor-stimulus-options" key={field.key}><legend>{field.label[locale]}</legend>
        {field.options!.map(option => <button type="button" key={option.value} data-stim-type={option.value} aria-pressed={value === option.value}
          onClick={() => onChange({ ...settings, stimulusType: option.value })}>{option.label[locale]}</button>)}
      </fieldset>;
      const slider = ['ballArcmin', 'distanceThresholdArcmin'].includes(field.key);
      const suffix = field.key === 'ballArcmin' ? 'ball' : 'threshold';
      const disabled = field.key === `${module}TotalSec` && module !== 'vor' && settings.testMode === 'evaluation';
      return <label key={field.key}>
        {field.label[locale]}
        {field.type === 'list' ? <select name={field.key} value={String(value)} onChange={event => onChange({ ...settings, [field.key]: event.target.value })}>
          {field.options!.map(option => <option key={option.value} value={option.value}>{option.label[locale]}</option>)}
        </select> : <>
          {slider && <><output>{value}' ({(Number(value) / 60).toFixed(2)}°)</output>
            <input id={`slider-${suffix}-arcmin`} type="range" min={field.min} max={field.max} step={field.step} value={Number(value)}
              onChange={event => onChange({ ...settings, [field.key]: Number(event.target.value) })} /></>}
          <input id={slider ? `${suffix}-arcmin` : field.key} name={field.key} type="number" min={field.min} max={field.key.endsWith('TotalSec') ? 1200 : field.max} step={slider ? 1 : field.key.endsWith('Cm') ? 'any' : field.step}
            disabled={disabled} required inputMode="decimal" value={Number.isNaN(value) ? '' : Number(value)}
            onChange={event => {
              const num = slider ? Math.max(field.min!, Math.min(600, Number(event.target.value) || Number(field.default))) : event.target.valueAsNumber;
              onChange({ ...settings, [field.key]: num });
            }} /> {field.unit?.[locale]}
          {disabled && <p>{en ? 'Ignored in Evaluation mode' : '評估模式不使用總時間'}</p>}
          {field.key === 'distanceThresholdArcmin' && <p>{en
            ? 'WebGazer adds 2° measurement-error allowance. A larger five-point validation threshold takes precedence.'
            : 'WebGazer 加上 2° 量測誤差容許值；五點驗證閾值較大時採用驗證值。'}</p>}
        </>}
      </label>;
    })}
  </section>)}
    {module !== 'vor' && <section className="training-setting"><h3>{en ? 'Movement directions' : '移動方向'}</h3>
      <p>{count}/8 {en ? 'directions enabled' : '個方向已啟用'}</p>
      <div className="training-direction-compass-grid">{directions.map(index => index < 0
        ? <button type="button" key="all" data-center-btn aria-label={en ? 'Toggle all directions' : '切換全部方向'} onClick={() => onChange({ ...settings,
          ...Object.fromEntries(arrows.map((_, axis) => [`axis${axis}Enabled`, count !== 8 || axis % 2 === 0])) })}>ALL</button>
        : <button type="button" key={index} data-axis-key={index} aria-pressed={Boolean(settings[`axis${index}Enabled`])}
          onClick={() => { if (!settings[`axis${index}Enabled`] || count > 1) onChange({ ...settings, [`axis${index}Enabled`]: !settings[`axis${index}Enabled`] }); }}>
          {arrows[index]} {settingsSections.find(section => section.id === 'directions')!.fields[index].label[locale]}
        </button>)}</div>
    </section>}
  </>;
}
