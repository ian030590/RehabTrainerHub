import { TrainingConfigSection } from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingSlider } from '@rehab-trainer/ui/components/TrainingConfigRangeField';
import {
  TrainingSetupChoiceGrid,
  TrainingSetupPanel,
  TrainingSetupRulesPanel,
} from '@rehab-trainer/ui/components/TrainingSetupPanel';
import type {
  TrainingConfigProps,
  TrainingRulesProps,
} from '@rehab-trainer/ui/trainingHostContract';
import {
  GetTrainingModuleManifest,
} from '../../moduleFlowManifest';
import { CreateVisionTimelineSetup } from '../createTimelineSetup';
import { SummarizeVisionTrainingRun } from '../utils/trainingRunResult';
import type { TrialData } from '../pages/training/types';

export type MovingCardDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface MovingCardConfig extends Record<string, unknown> {
  difficulty: MovingCardDifficulty;
  totalRounds: number;
}

const movingCardManifest = GetTrainingModuleManifest('vision:moving-card');

const defaultConfig: Readonly<MovingCardConfig> = Object.freeze({
  difficulty: 'beginner',
  totalRounds: 5,
});

const difficultyOptions: ReadonlyArray<readonly [MovingCardDifficulty, string]> = [
  ['beginner', 'Beginner'],
  ['intermediate', 'Intermediate'],
  ['advanced', 'Advanced'],
];

const copy = {
  zh: {
    settings: '移動卡片設定',
    difficulty: '難度',
    rounds: '回合數',
    rules: '玩法',
    rulesBody: '找出指定字母，再選取相符的移動卡片。',
    continue: '繼續查看玩法',
    loading: '正在載入活動…',
    start: '開始',
    running: '活動進行中。',
    complete: '活動完成。',
    beginner: '初階',
    intermediate: '中階',
    advanced: '進階',
  },
  en: {
    settings: 'Moving Card settings',
    difficulty: 'Difficulty',
    rounds: 'Rounds',
    rules: 'How to play',
    rulesBody: 'Find the target letters while the cards move, then select the matching card.',
    continue: 'Continue to rules',
    loading: 'Loading activity…',
    start: 'Start',
    running: 'Activity in progress.',
    complete: 'Activity complete.',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  },
} as const;

export function ValidateMovingCardConfig(input: unknown):
  | { ok: true; value: MovingCardConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const difficulty = source.difficulty;
  const totalRounds = source.totalRounds;
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!difficultyOptions.some(([value]) => value === difficulty)) {
    issues.push({
      path: 'difficulty',
      code: 'enum',
      messageKey: 'training.movingCard.config.difficulty',
    });
  }
  if (typeof totalRounds !== 'number' || !Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 30) {
    issues.push({
      path: 'totalRounds',
      code: 'range',
      messageKey: 'training.movingCard.config.totalRounds',
    });
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: Object.freeze({
      difficulty: difficulty as MovingCardDifficulty,
      totalRounds: totalRounds as number,
    }),
  };
}

export function MovingCardConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
  actions,
}: TrainingConfigProps<MovingCardConfig>) {
  const labels = copy[language];
  const updateDifficulty = (difficulty: MovingCardDifficulty) => {
    const next = ValidateMovingCardConfig({ ...value, difficulty });
    if (next.ok) {
      onChange(next.value);
      onValidityChange?.(true);
    } else {
      onValidityChange?.(false);
    }
  };
  const updateRounds = (totalRounds: number) => {
    const next = ValidateMovingCardConfig({
      ...value,
      totalRounds,
    });
    if (next.ok) {
      onChange(next.value);
      onValidityChange?.(true);
    } else {
      onValidityChange?.(false);
    }
  };

  return (
    <TrainingSetupPanel actions={actions} title={labels.settings}>
      <TrainingConfigSection title={labels.difficulty} wide>
        <TrainingSetupChoiceGrid
          choices={difficultyOptions.map(([option]) => ({ label: labels[option], value: option }))}
          columns={3}
          onValueChange={updateDifficulty}
          value={value.difficulty}
        />
      </TrainingConfigSection>
      <TrainingSlider
        label={labels.rounds}
        max={30}
        min={1}
        onValueChange={updateRounds}
        value={value.totalRounds}
      />
    </TrainingSetupPanel>
  );
}

export function MovingCardRulesPanel({ onReady, language = 'zh', actions }: TrainingRulesProps) {
  // The host uses the panel's visibility as the rules-visible loading
  // boundary. `onReady` is intentionally not invoked during render because
  // that would make a parent state update part of React's render phase.
  void onReady;
  const labels = copy[language];
  return <TrainingSetupRulesPanel actions={actions} title={labels.rules}><p>{labels.rulesBody}</p></TrainingSetupRulesPanel>;
}

/**
 * The setup chunk deliberately contains no renderer or jsPsych imports. The
 * engine is fetched only after the host has made the rules visible.
 */
export const movingCardSetup = CreateVisionTimelineSetup<MovingCardConfig>({
  manifest: movingCardManifest,
  defaultConfig,
  validateConfig: ValidateMovingCardConfig,
  ConfigPanel: MovingCardConfigPanel,
  RulesPanel: MovingCardRulesPanel,
  preload: async () => {
    await Promise.all([
      import('../experiment/timelines/movingCardTimeline'),
      import('../utils/pixiPool'),
    ]);
  },
  buildTimeline: async ({ config, jsPsych }) => {
    const { BuildMovingCardTimeline } = await import('../experiment/timelines/movingCardTimeline');
    return BuildMovingCardTimeline({
      difficulty: config.difficulty,
      totalRounds: config.totalRounds,
      jsPsych: jsPsych as never,
    });
  },
  summarize: ({ status, startedAt, endedAt, values }) => SummarizeVisionTrainingRun({
    moduleId: movingCardManifest.id,
    moduleVersion: movingCardManifest.implementationVersion,
    status,
    startedAt,
    endedAt,
    trials: values as TrialData[],
  }),
  onDispose: async () => {
    const { DestroyPixiTrainingRuntime } = await import('../utils/pixiPool');
    DestroyPixiTrainingRuntime(movingCardManifest.id);
  },
});

export const loadMovingCardEngine = movingCardSetup.loadEngine;

export default movingCardSetup;
