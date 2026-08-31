import { createElement, type ChangeEvent } from 'react';
import type { TrainingConfigProps, TrainingRulesProps } from '@rehab-trainer/ui/trainingHostContract';
import { CreateTrainingRunResult } from '@rehab-trainer/training-contracts';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateComponentTrainingSetup } from '../../shared/componentTrainingEngine';
import {
  tongueCatchConfigBounds,
  tongueCatchDefaults,
  type TongueCatchConfig,
  ValidateTongueCatchConfig,
} from './config';
import type {
  SessionResult,
  TongueCatchGameProps,
} from '../pages/training/TongueCatchGame';

const manifest = GetTrainingModuleManifest('mouth:tongue-catch');
const copy = {
  zh: {
    settings: '舌頭接果實設定', sensitivity: '辨識敏感度', growth: '舌頭成長速度', duration: '活動時間（秒）', speed: '果實速度', spawn: '生成間隔（秒）', edge: '邊緣機率（%）', opacity: '鏡頭透明度', rules: '活動規則', body: '依提示移動舌頭接住果實。鏡頭、模型與分類器只在開始活動後載入。',
  },
  en: {
    settings: 'Tongue Catch settings', sensitivity: 'Recognition sensitivity', growth: 'Tongue growth speed', duration: 'Activity duration (seconds)', speed: 'Apple speed', spawn: 'Spawn interval (seconds)', edge: 'Edge chance (%)', opacity: 'Camera opacity', rules: 'How to play', body: 'Move your tongue to catch falling apples. Camera, model and classifier loading starts only after the activity begins.',
  },
} as const;

function UpdateConfig(
  value: Readonly<TongueCatchConfig>,
  next: Partial<TongueCatchConfig>,
  onChange: (value: TongueCatchConfig) => void,
  onValidityChange: ((valid: boolean) => void) | undefined,
) {
  const validation = ValidateTongueCatchConfig({ ...value, ...next });
  if (validation.ok) {
    onChange(validation.value);
    onValidityChange?.(true);
  } else onValidityChange?.(false);
}

export function TongueCatchConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<TongueCatchConfig>) {
  const labels = copy[language];
  const update = (key: keyof TongueCatchConfig, scale = 1) => (
    (event: ChangeEvent<HTMLInputElement>) => UpdateConfig(value, { [key]: Number(event.target.value) / scale }, onChange, onValidityChange)
  );
  return (
    <section aria-labelledby="tongue-catch-native-config-title">
      <h2 id="tongue-catch-native-config-title">{labels.settings}</h2>
      <label>{labels.sensitivity}<input max={tongueCatchConfigBounds.sensitivity.max * 100} min={tongueCatchConfigBounds.sensitivity.min * 100} onChange={update('sensitivity', 100)} type="number" value={Math.round(value.sensitivity * 100)} /></label>
      <label>{labels.growth}<input max={tongueCatchConfigBounds.growthRate.max} min={tongueCatchConfigBounds.growthRate.min} onChange={update('growthRate')} type="number" value={value.growthRate} /></label>
      <label>{labels.duration}<input max={tongueCatchConfigBounds.durationSec.max} min={tongueCatchConfigBounds.durationSec.min} onChange={update('durationSec')} type="number" value={value.durationSec} /></label>
      <label>{labels.speed}<input max={tongueCatchConfigBounds.appleSpeed.max} min={tongueCatchConfigBounds.appleSpeed.min} onChange={update('appleSpeed')} type="number" value={value.appleSpeed} /></label>
      <label>{labels.spawn}<input max={tongueCatchConfigBounds.spawnIntervalSec.max} min={tongueCatchConfigBounds.spawnIntervalSec.min} onChange={update('spawnIntervalSec')} step={0.1} type="number" value={value.spawnIntervalSec} /></label>
      <label>{labels.edge}<input max={tongueCatchConfigBounds.edgeChance.max * 100} min={tongueCatchConfigBounds.edgeChance.min * 100} onChange={update('edgeChance', 100)} type="number" value={Math.round(value.edgeChance * 100)} /></label>
      <label>{labels.opacity}<input max={tongueCatchConfigBounds.cameraOpacity.max * 100} min={tongueCatchConfigBounds.cameraOpacity.min * 100} onChange={update('cameraOpacity', 100)} type="number" value={Math.round(value.cameraOpacity * 100)} /></label>
    </section>
  );
}

export function TongueCatchRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return <section aria-labelledby="tongue-catch-native-rules-title"><h2 id="tongue-catch-native-rules-title">{labels.rules}</h2><p>{labels.body}</p></section>;
}

export const tongueCatchSetup = CreateComponentTrainingSetup<
  TongueCatchConfig,
  SessionResult,
  TongueCatchGameProps
>({
  manifest,
  defaultConfig: tongueCatchDefaults,
  validateConfig: ValidateTongueCatchConfig,
  ConfigPanel: TongueCatchConfigPanel,
  RulesPanel: TongueCatchRulesPanel,
  loadComponent: async () => {
    const [{ TongueCatchGame }, { LanguageProvider }] = await Promise.all([
      import('../pages/training/TongueCatchGame'),
      import('../i18n'),
    ]);
    return function TongueCatchNativeRuntime(props: TongueCatchGameProps) {
      return createElement(LanguageProvider, null, createElement(TongueCatchGame, props));
    };
  },
  buildComponentProps: ({ config, context, controls }) => ({
    onExit: controls.onAborted,
    hostControl: {
      autoStart: true,
      config,
      onAborted: controls.onAborted,
      onCompleted: controls.onCompleted,
      onStarted: controls.onStarted,
      registerControls: controls.registerControls,
      signal: context.signal,
      skipUserGuard: true,
    },
  }),
  summarize: ({ status, startedAt, endedAt, result }) => CreateTrainingRunResult({
    moduleId: manifest.id,
    moduleVersion: manifest.implementationVersion,
    status,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Math.max(0, endedAt - startedAt),
    trialCount: result?.Apple_Results.length ?? 0,
    score: result?.Score,
    metrics: {
      score: result?.Score ?? 0,
      missed: result?.Missed ?? 0,
      averageHoldSeconds: result?.Average_Hold_Seconds ?? 0,
    },
  }),
});

export default tongueCatchSetup;
