import type { ChangeEvent } from 'react';
import type { TrainingConfigProps, TrainingRulesProps } from '@rehab-trainer/ui/trainingHostContract';
import { CreateTrainingRunResult } from '@rehab-trainer/training-contracts';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateComponentTrainingSetup } from '../../shared/componentTrainingEngine';
import {
  everyBallResponseConfigBounds,
  everyBallResponseDefaults,
  everyBallResponseFixationStyleOptions,
  everyBallResponseInputModeOptions,
  everyBallResponseLevelOptions,
  everyBallResponseLevelTrialCounts,
  type EveryBallFixationStyle,
  type EveryBallInputMode,
  type EveryBallLevelId,
  type EveryBallResponseConfig,
  ValidateEveryBallResponseConfig,
} from './config';
import type {
  EveryBallResponsePageProps,
  SessionSummary,
} from '../pages/EveryBallResponsePage';

const manifest = GetTrainingModuleManifest('brain:every-ball-response');
const copy = {
  zh: {
    settings: '每球反應設定', level: '階段', input: '輸入方式', fixation: '注視樣式', trials: '試次', sensitivity: '麥克風敏感度', camera: '鏡頭手勢', microphone: '麥克風', cross: '十字', blank: '空白', rules: '活動規則', body: '保持注視中央目標，依提示做出相應反應。輸入裝置只在開始活動後啟用。',
  },
  en: {
    settings: 'Every Ball Response settings', level: 'Level', input: 'Input mode', fixation: 'Fixation style', trials: 'Trials', sensitivity: 'Microphone sensitivity', camera: 'Camera gesture', microphone: 'Microphone', cross: 'Cross', blank: 'Blank', rules: 'How to play', body: 'Keep your eyes on the central target and respond to the prompt. Input devices activate only after the activity begins.',
  },
} as const;

function UpdateConfig(
  value: Readonly<EveryBallResponseConfig>,
  next: Partial<EveryBallResponseConfig>,
  onChange: (value: EveryBallResponseConfig) => void,
  onValidityChange: ((valid: boolean) => void) | undefined,
) {
  const validation = ValidateEveryBallResponseConfig({ ...value, ...next });
  if (validation.ok) {
    onChange(validation.value);
    onValidityChange?.(true);
  } else onValidityChange?.(false);
}

export function EveryBallResponseConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<EveryBallResponseConfig>) {
  const labels = copy[language];
  return (
    <section aria-labelledby="every-ball-native-config-title">
      <h2 id="every-ball-native-config-title">{labels.settings}</h2>
      <label>{labels.level}<select value={value.levelId} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
        const levelId = Number(event.target.value) as EveryBallLevelId;
        UpdateConfig(value, { levelId, trialCount: everyBallResponseLevelTrialCounts[levelId] }, onChange, onValidityChange);
      }}>
        {everyBallResponseLevelOptions.map((level) => <option key={level} value={level}>{level}</option>)}
      </select></label>
      <label>{labels.input}<select value={value.inputMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(value, { inputMode: event.target.value as EveryBallInputMode }, onChange, onValidityChange)}>
        {everyBallResponseInputModeOptions.map((mode) => <option key={mode} value={mode}>{mode === 'camera' ? labels.camera : labels.microphone}</option>)}
      </select></label>
      <label>{labels.fixation}<select value={value.fixationStyle} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(value, { fixationStyle: event.target.value as EveryBallFixationStyle }, onChange, onValidityChange)}>
        {everyBallResponseFixationStyleOptions.map((style) => <option key={style} value={style}>{style === 'cross' ? labels.cross : labels.blank}</option>)}
      </select></label>
      <label>{labels.trials}<input max={everyBallResponseConfigBounds.trialCount.max} min={everyBallResponseConfigBounds.trialCount.min} onChange={(event: ChangeEvent<HTMLInputElement>) => UpdateConfig(value, { trialCount: Number(event.target.value) }, onChange, onValidityChange)} type="number" value={value.trialCount} /></label>
      <label>{labels.sensitivity}<input max={everyBallResponseConfigBounds.microphoneSensitivity.max * 100} min={everyBallResponseConfigBounds.microphoneSensitivity.min * 100} onChange={(event: ChangeEvent<HTMLInputElement>) => UpdateConfig(value, { microphoneSensitivity: Number(event.target.value) / 100 }, onChange, onValidityChange)} type="number" value={Math.round(value.microphoneSensitivity * 100)} /></label>
    </section>
  );
}

export function EveryBallResponseRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return <section aria-labelledby="every-ball-native-rules-title"><h2 id="every-ball-native-rules-title">{labels.rules}</h2><p>{labels.body}</p></section>;
}

export const everyBallResponseSetup = CreateComponentTrainingSetup<
  EveryBallResponseConfig,
  SessionSummary,
  EveryBallResponsePageProps
>({
  manifest,
  defaultConfig: everyBallResponseDefaults,
  validateConfig: ValidateEveryBallResponseConfig,
  ConfigPanel: EveryBallResponseConfigPanel,
  RulesPanel: EveryBallResponseRulesPanel,
  loadComponent: async () => {
    const module = await import('../pages/EveryBallResponsePage');
    return module.EveryBallResponsePage;
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
    trialCount: result?.total ?? 0,
    score: result?.correct,
    metrics: {
      accuracyPercent: result?.accuracy ?? 0,
      averageRtMs: result?.averageRtMs ?? null,
      misses: result?.misses ?? 0,
      falseAlarms: result?.falseAlarms ?? 0,
      wrongActions: result?.wrongActions ?? 0,
    },
  }),
});

export default everyBallResponseSetup;
