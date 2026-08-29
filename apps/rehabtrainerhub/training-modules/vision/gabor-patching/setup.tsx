import type { ChangeEvent } from 'react';
import type { TrainingConfigProps, TrainingRulesProps } from '@rehab-trainer/ui/trainingHostContract';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateVisionTimelineSetup } from '../createTimelineSetup';
import { SummarizeVisionTrainingRun } from '../utils/trainingRunResult';
import type { TrialData } from '../pages/training/types';

type GaborDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface GaborPatchingConfig extends Record<string, unknown> {
  difficulty: GaborDifficulty;
  durationSec: number;
  maxSpots: number;
}

const manifest = GetTrainingModuleManifest('vision:gabor-patching');
const defaultConfig: Readonly<GaborPatchingConfig> = Object.freeze({
  difficulty: 'beginner',
  durationSec: 60,
  maxSpots: 10,
});
const copy = {
  zh: {
    settings: 'Gabor 刺激設定', difficulty: '難度', duration: '秒數', spots: '最多刺激數', rules: '玩法',
    body: '依照畫面提示完成 Gabor 刺激活動。', beginner: '初階', intermediate: '中階', advanced: '進階',
  },
  en: {
    settings: 'Gabor activity settings', difficulty: 'Difficulty', duration: 'Seconds', spots: 'Maximum spots', rules: 'How to play',
    body: 'Complete the Gabor stimulus activity by following the on-screen prompts.', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
  },
} as const;

function IsDifficulty(value: unknown): value is GaborDifficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}

export function ValidateGaborPatchingConfig(input: unknown):
  | { ok: true; value: GaborPatchingConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!IsDifficulty(source.difficulty)) issues.push(Issue('difficulty'));
  if (!IsBoundedInteger(source.durationSec, 5, 600)) issues.push(Issue('durationSec'));
  if (!IsBoundedInteger(source.maxSpots, 1, 60)) issues.push(Issue('maxSpots'));
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: Object.freeze({
    difficulty: source.difficulty as GaborDifficulty,
    durationSec: source.durationSec as number,
    maxSpots: source.maxSpots as number,
  }) };
}

function IsBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function Issue(path: string) {
  return { path, code: 'invalid', messageKey: `training.gaborPatching.config.${path}` };
}

export function GaborPatchingConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<GaborPatchingConfig>) {
  const labels = copy[language];
  const update = (key: keyof GaborPatchingConfig, next: unknown) => {
    const validation = ValidateGaborPatchingConfig({ ...value, [key]: next });
    if (validation.ok) {
      onChange(validation.value);
      onValidityChange?.(true);
    } else onValidityChange?.(false);
  };
  return (
    <section aria-labelledby="gabor-config-title">
      <h2 id="gabor-config-title">{labels.settings}</h2>
      <label>{labels.difficulty}
        <select value={value.difficulty} onChange={(event: ChangeEvent<HTMLSelectElement>) => update('difficulty', event.target.value)}>
          <option value="beginner">{labels.beginner}</option>
          <option value="intermediate">{labels.intermediate}</option>
          <option value="advanced">{labels.advanced}</option>
        </select>
      </label>
      <label>{labels.duration}
        <input min={5} max={600} type="number" value={value.durationSec} onChange={(event: ChangeEvent<HTMLInputElement>) => update('durationSec', Number(event.target.value))} />
      </label>
      <label>{labels.spots}
        <input min={1} max={60} type="number" value={value.maxSpots} onChange={(event: ChangeEvent<HTMLInputElement>) => update('maxSpots', Number(event.target.value))} />
      </label>
    </section>
  );
}

export function GaborPatchingRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return <section aria-labelledby="gabor-rules-title"><h2 id="gabor-rules-title">{labels.rules}</h2><p>{labels.body}</p></section>;
}

export const gaborPatchingSetup = CreateVisionTimelineSetup<GaborPatchingConfig>({
  manifest,
  defaultConfig,
  validateConfig: ValidateGaborPatchingConfig,
  ConfigPanel: GaborPatchingConfigPanel,
  RulesPanel: GaborPatchingRulesPanel,
  preload: async () => {
    await Promise.all([
      import('../experiment/timelines/gaborPatchingTimeline'),
      import('../utils/pixiPool'),
    ]);
  },
  buildTimeline: async ({ config, jsPsych }) => {
    const { BuildGaborPatchingTimeline } = await import('../experiment/timelines/gaborPatchingTimeline');
    return BuildGaborPatchingTimeline({
      difficulty: config.difficulty,
      jsPsych: jsPsych as never,
      gabor: { durationSec: config.durationSec, maxSpots: config.maxSpots },
    });
  },
  summarize: ({ status, startedAt, endedAt, values }) => SummarizeVisionTrainingRun({
    moduleId: manifest.id,
    moduleVersion: manifest.implementationVersion,
    status,
    startedAt,
    endedAt,
    trials: values as TrialData[],
  }),
  onDispose: async () => {
    const { DestroyPixiTrainingRuntime } = await import('../utils/pixiPool');
    DestroyPixiTrainingRuntime(manifest.id);
  },
});

export default gaborPatchingSetup;
