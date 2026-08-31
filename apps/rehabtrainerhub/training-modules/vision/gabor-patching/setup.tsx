import { TrainingConfigSection } from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingSlider } from '@rehab-trainer/ui/components/TrainingConfigRangeField';
import {
  TrainingSetupChoiceGrid,
  TrainingSetupPanel,
  TrainingSetupRulesPanel,
} from '@rehab-trainer/ui/components/TrainingSetupPanel';
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
  actions,
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
    <TrainingSetupPanel actions={actions} title={labels.settings}>
      <TrainingConfigSection title={labels.difficulty} wide>
        <TrainingSetupChoiceGrid
          choices={[
            { label: labels.beginner, value: 'beginner' },
            { label: labels.intermediate, value: 'intermediate' },
            { label: labels.advanced, value: 'advanced' },
          ]}
          columns={3}
          onValueChange={(difficulty) => update('difficulty', difficulty)}
          value={value.difficulty}
        />
      </TrainingConfigSection>
      <TrainingSlider
        label={labels.duration}
        max={600}
        min={5}
        onValueChange={(durationSec) => update('durationSec', durationSec)}
        value={value.durationSec}
      />
      <TrainingSlider
        label={labels.spots}
        max={60}
        min={1}
        onValueChange={(maxSpots) => update('maxSpots', maxSpots)}
        value={value.maxSpots}
      />
    </TrainingSetupPanel>
  );
}

export function GaborPatchingRulesPanel({ language = 'zh', actions }: TrainingRulesProps) {
  const labels = copy[language];
  return <TrainingSetupRulesPanel actions={actions} title={labels.rules}><p>{labels.body}</p></TrainingSetupRulesPanel>;
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
