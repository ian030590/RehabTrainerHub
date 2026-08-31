import { createElement, type ChangeEvent } from 'react';
import type { TrainingConfigProps, TrainingRulesProps } from '@rehab-trainer/ui/trainingHostContract';
import { CreateTrainingRunResult } from '@rehab-trainer/training-contracts';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateComponentTrainingSetup } from '../../shared/componentTrainingEngine';
import {
  gestureBattlerConfigBounds,
  gestureBattlerDefaults,
  gestureBattlerTargetModeOptions,
  type GestureBattlerConfig,
  type GestureBattlerTargetMode,
  ValidateGestureBattlerConfig,
} from './config';
import type {
  GestureBattlerGameProps,
  GestureBattlerSessionRecord,
} from '../pages/training/GestureBattlerGame';

const manifest = GetTrainingModuleManifest('motor:gesture-battler');

const copy = {
  zh: {
    settings: '手勢對戰設定', hp: '敵人生命值', hold: '持續時間（秒）', strictness: '辨識門檻', mode: '目標模式',
    free: '自由', directed: '指定', rules: '活動規則', body: '依畫面提示完成手勢並維持穩定。鏡頭與模型只在開始活動後載入。',
  },
  en: {
    settings: 'Gesture Battler settings', hp: 'Enemy health', hold: 'Hold duration (seconds)', strictness: 'Recognition threshold', mode: 'Target mode',
    free: 'Free', directed: 'Directed', rules: 'How to play', body: 'Perform the prompted gesture and hold it steadily. Camera and model loading starts only after the activity begins.',
  },
} as const;
type Copy = (typeof copy)[keyof typeof copy];

function UpdateConfig(
  value: Readonly<GestureBattlerConfig>,
  next: Partial<GestureBattlerConfig>,
  onChange: (value: GestureBattlerConfig) => void,
  onValidityChange: ((valid: boolean) => void) | undefined,
) {
  const validation = ValidateGestureBattlerConfig({ ...value, ...next });
  if (validation.ok) {
    onChange(validation.value);
    onValidityChange?.(true);
  } else onValidityChange?.(false);
}

export function GestureBattlerConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<GestureBattlerConfig>) {
  const labels = copy[language];
  const updateNumber = (key: 'enemyMaxHp' | 'holdDuration' | 'strictnessThreshold') => (
    (event: ChangeEvent<HTMLInputElement>) => UpdateConfig(
      value, { [key]: Number(event.target.value) }, onChange, onValidityChange,
    )
  );
  return (
    <section aria-labelledby="gesture-battler-native-config-title">
      <h2 id="gesture-battler-native-config-title">{labels.settings}</h2>
      <label>{labels.hp}<input
        max={gestureBattlerConfigBounds.enemyMaxHp.max}
        min={gestureBattlerConfigBounds.enemyMaxHp.min}
        onChange={updateNumber('enemyMaxHp')}
        type="number"
        value={value.enemyMaxHp}
      /></label>
      <label>{labels.hold}<input
        max={gestureBattlerConfigBounds.holdDuration.max}
        min={gestureBattlerConfigBounds.holdDuration.min}
        onChange={updateNumber('holdDuration')}
        step={0.1}
        type="number"
        value={value.holdDuration}
      /></label>
      <label>{labels.strictness}<input
        max={gestureBattlerConfigBounds.strictnessThreshold.max}
        min={gestureBattlerConfigBounds.strictnessThreshold.min}
        onChange={updateNumber('strictnessThreshold')}
        step={0.05}
        type="number"
        value={value.strictnessThreshold}
      /></label>
      <label>{labels.mode}<select value={value.targetMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(
        value, { targetMode: event.target.value as GestureBattlerTargetMode }, onChange, onValidityChange,
      )}>
        {gestureBattlerTargetModeOptions.map((mode) => <option key={mode} value={mode}>{mode === 'free' ? labels.free : labels.directed}</option>)}
      </select></label>
    </section>
  );
}

export function GestureBattlerRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels: Copy = copy[language];
  return <section aria-labelledby="gesture-battler-native-rules-title"><h2 id="gesture-battler-native-rules-title">{labels.rules}</h2><p>{labels.body}</p></section>;
}

export const gestureBattlerSetup = CreateComponentTrainingSetup<
  GestureBattlerConfig,
  GestureBattlerSessionRecord,
  GestureBattlerGameProps
>({
  manifest,
  defaultConfig: gestureBattlerDefaults,
  validateConfig: ValidateGestureBattlerConfig,
  ConfigPanel: GestureBattlerConfigPanel,
  RulesPanel: GestureBattlerRulesPanel,
  loadComponent: async () => {
    const [{ GestureBattlerGame }, { LanguageProvider }] = await Promise.all([
      import('../pages/training/GestureBattlerGame'),
      import('../i18n'),
    ]);
    return function GestureBattlerNativeRuntime(props: GestureBattlerGameProps) {
      return createElement(LanguageProvider, null, createElement(GestureBattlerGame, props));
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
    trialCount: result?.Cast_Records.length ?? 0,
    score: result?.Successful_Casts,
    metrics: {
      successfulCasts: result?.Successful_Casts ?? 0,
      interruptedHolds: result?.Interrupted_Holds ?? 0,
      totalDurationSeconds: result?.Total_Duration_Seconds ?? 0,
    },
  }),
});

export default gestureBattlerSetup;
