import { createElement, type ChangeEvent } from 'react';
import type { TrainingConfigProps, TrainingRulesProps } from '@rehab-trainer/ui/trainingHostContract';
import { CreateTrainingRunResult } from '@rehab-trainer/training-contracts';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateComponentTrainingSetup } from '../../shared/componentTrainingEngine';
import {
  motorCortexDifficultyOptions,
  motorCortexDrillOptions,
  motorCortexHandChoiceOptions,
  motorCortexRehabConfigBounds,
  motorCortexRehabDefaults,
  type MotorCortexDifficulty,
  type MotorCortexDrill,
  type MotorCortexHandChoice,
  type MotorCortexRehabConfig,
  ValidateMotorCortexRehabConfig,
} from './config';
import type {
  MotorCortexRehabGameProps,
  MotorCortexRehabSessionRecord,
} from '../pages/training/MotorCortexRehabGame';

const manifest = GetTrainingModuleManifest('motor:motor-cortex-rehab');
const copy = {
  zh: {
    settings: '動作追蹤設定', drill: '追蹤模式', difficulty: '難度', duration: '活動時間（秒）', hand: '追蹤手', target: '目標大小比例', speed: '速度比例', rules: '活動規則',
    body: '以手部動作追蹤目標並維持穩定。鏡頭與模型只在開始活動後載入。', any: '任一手', left: '左手', right: '右手', beginner: '入門', intermediate: '進階', advanced: '挑戰',
  },
  en: {
    settings: 'Movement tracking settings', drill: 'Tracking mode', difficulty: 'Difficulty', duration: 'Activity duration (seconds)', hand: 'Tracking hand', target: 'Target size scale', speed: 'Speed scale', rules: 'How to play',
    body: 'Track the target with your hand and hold it steady. Camera and model loading starts only after the activity begins.', any: 'Any hand', left: 'Left hand', right: 'Right hand', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
  },
} as const;
type Copy = (typeof copy)[keyof typeof copy];

function DifficultyLabel(value: MotorCortexDifficulty, labels: Copy): string {
  if (value === 'intermediate') return labels.intermediate;
  if (value === 'advanced') return labels.advanced;
  return labels.beginner;
}
function HandLabel(value: MotorCortexHandChoice, labels: Copy): string {
  return value === 'any' ? labels.any : value === 'left' ? labels.left : labels.right;
}
function UpdateConfig(
  value: Readonly<MotorCortexRehabConfig>,
  next: Partial<MotorCortexRehabConfig>,
  onChange: (value: MotorCortexRehabConfig) => void,
  onValidityChange: ((valid: boolean) => void) | undefined,
) {
  const validation = ValidateMotorCortexRehabConfig({ ...value, ...next });
  if (validation.ok) {
    onChange(validation.value);
    onValidityChange?.(true);
  } else onValidityChange?.(false);
}

export function MotorCortexRehabConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<MotorCortexRehabConfig>) {
  const labels = copy[language];
  const numberInput = (key: 'durationSec' | 'targetSizeScale' | 'speedScale') => (
    (event: ChangeEvent<HTMLInputElement>) => UpdateConfig(value, { [key]: Number(event.target.value) }, onChange, onValidityChange)
  );
  return (
    <section aria-labelledby="motor-cortex-native-config-title">
      <h2 id="motor-cortex-native-config-title">{labels.settings}</h2>
      <label>{labels.drill}<select value={value.drill} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(value, { drill: event.target.value as MotorCortexDrill }, onChange, onValidityChange)}>
        {motorCortexDrillOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select></label>
      <label>{labels.difficulty}<select value={value.difficulty} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(value, { difficulty: event.target.value as MotorCortexDifficulty }, onChange, onValidityChange)}>
        {motorCortexDifficultyOptions.map((option) => <option key={option} value={option}>{DifficultyLabel(option, labels)}</option>)}
      </select></label>
      <label>{labels.duration}<input
        max={motorCortexRehabConfigBounds.durationSec.max}
        min={motorCortexRehabConfigBounds.durationSec.min}
        onChange={numberInput('durationSec')}
        type="number"
        value={value.durationSec}
      /></label>
      <label>{labels.hand}<select value={value.handChoice} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(value, { handChoice: event.target.value as MotorCortexHandChoice }, onChange, onValidityChange)}>
        {motorCortexHandChoiceOptions.map((option) => <option key={option} value={option}>{HandLabel(option, labels)}</option>)}
      </select></label>
      <label>{labels.target}<input
        max={motorCortexRehabConfigBounds.targetSizeScale.max}
        min={motorCortexRehabConfigBounds.targetSizeScale.min}
        onChange={numberInput('targetSizeScale')}
        step={0.05}
        type="number"
        value={value.targetSizeScale}
      /></label>
      <label>{labels.speed}<input
        max={motorCortexRehabConfigBounds.speedScale.max}
        min={motorCortexRehabConfigBounds.speedScale.min}
        onChange={numberInput('speedScale')}
        step={0.05}
        type="number"
        value={value.speedScale}
      /></label>
    </section>
  );
}

export function MotorCortexRehabRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return <section aria-labelledby="motor-cortex-native-rules-title"><h2 id="motor-cortex-native-rules-title">{labels.rules}</h2><p>{labels.body}</p></section>;
}

export const motorCortexRehabSetup = CreateComponentTrainingSetup<
  MotorCortexRehabConfig,
  MotorCortexRehabSessionRecord,
  MotorCortexRehabGameProps
>({
  manifest,
  defaultConfig: motorCortexRehabDefaults,
  validateConfig: ValidateMotorCortexRehabConfig,
  ConfigPanel: MotorCortexRehabConfigPanel,
  RulesPanel: MotorCortexRehabRulesPanel,
  loadComponent: async () => {
    const [{ MotorCortexRehabGame }, { LanguageProvider }] = await Promise.all([
      import('../pages/training/MotorCortexRehabGame'),
      import('../i18n'),
    ]);
    return function MotorCortexRehabNativeRuntime(props: MotorCortexRehabGameProps) {
      return createElement(LanguageProvider, null, createElement(MotorCortexRehabGame, props));
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
    trialCount: result?.Event_Records.length ?? 0,
    score: result?.Successful_Reps,
    metrics: {
      successfulReps: result?.Successful_Reps ?? 0,
      interruptedHolds: result?.Interrupted_Holds ?? 0,
      accuracyPercent: result?.Accuracy_Percent ?? 0,
      handVisiblePercent: result?.Hand_Visible_Percent ?? 0,
    },
  }),
});

export default motorCortexRehabSetup;
