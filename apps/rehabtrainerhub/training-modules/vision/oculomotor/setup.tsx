import type { ChangeEvent } from 'react';
import type {
  TrainingConfigProps,
  TrainingRulesProps,
} from '@rehab-trainer/ui/trainingHostContract';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateVisionTimelineSetup } from '../createTimelineSetup';
import {
  isOculomotorMode,
  isOculomotorPattern,
  oculomotorModes,
  oculomotorPatterns,
} from '../pages/training/oculomotor/presets';
import type {
  OculomotorMode,
  OculomotorPattern,
} from '../pages/training/oculomotor/types';
import {
  SummarizeVisionTrainingRun,
} from '../utils/trainingRunResult';

type OculomotorDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface OculomotorConfig extends Record<string, unknown> {
  difficulty: OculomotorDifficulty;
  mode: OculomotorMode;
  pattern: OculomotorPattern;
  durationSec: number;
}

const manifest = GetTrainingModuleManifest('vision:oculomotor-training');
const defaultConfig: Readonly<OculomotorConfig> = Object.freeze({
  difficulty: 'beginner',
  mode: 'pursuit',
  pattern: 'horizontalSweep',
  durationSec: 30,
});

const copy = {
  zh: {
    settings: '眼動活動設定', difficulty: '難度', mode: '模式', pattern: '路徑', duration: '秒數',
    rules: '玩法', body: '依照移動目標完成眼動活動，過程中保持頭部穩定。', continue: '繼續查看玩法',
    beginner: '初階', intermediate: '中階', advanced: '進階', loading: '正在載入活動…', start: '開始',
  },
  en: {
    settings: 'Eye movement activity settings', difficulty: 'Difficulty', mode: 'Mode', pattern: 'Path', duration: 'Seconds',
    rules: 'How to play', body: 'Follow the moving target while keeping your head still.', continue: 'Continue to rules',
    beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', loading: 'Loading activity…', start: 'Start',
  },
} as const;

const modes: readonly OculomotorMode[] = oculomotorModes.map((mode) => mode.id);
const patterns: readonly OculomotorPattern[] = oculomotorPatterns.map((pattern) => pattern.id);

export function ValidateOculomotorConfig(input: unknown):
  | { ok: true; value: OculomotorConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!IsDifficulty(source.difficulty)) issues.push(Issue('difficulty'));
  if (typeof source.mode !== 'string' || !isOculomotorMode(source.mode)) issues.push(Issue('mode'));
  if (typeof source.pattern !== 'string' || !isOculomotorPattern(source.pattern)) issues.push(Issue('pattern'));
  if (!Number.isFinite(source.durationSec) || !Number.isInteger(source.durationSec)
    || (source.durationSec as number) < 5 || (source.durationSec as number) > 300) {
    issues.push(Issue('durationSec'));
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: Object.freeze({
      difficulty: source.difficulty as OculomotorDifficulty,
      mode: source.mode as OculomotorMode,
      pattern: source.pattern as OculomotorPattern,
      durationSec: source.durationSec as number,
    }),
  };
}

function Issue(path: string) {
  return { path, code: 'invalid', messageKey: `training.oculomotor.config.${path}` };
}

function IsDifficulty(value: unknown): value is OculomotorDifficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}

function UpdateConfig<T extends keyof OculomotorConfig>(
  value: Readonly<OculomotorConfig>,
  key: T,
  next: OculomotorConfig[T],
  onChange: (value: OculomotorConfig) => void,
  onValidityChange: ((valid: boolean) => void) | undefined,
) {
  const validation = ValidateOculomotorConfig({ ...value, [key]: next });
  if (validation.ok) {
    onChange(validation.value);
    onValidityChange?.(true);
  } else {
    onValidityChange?.(false);
  }
}

export function OculomotorConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<OculomotorConfig>) {
  const labels = copy[language];
  const update = <T extends keyof OculomotorConfig>(key: T, next: OculomotorConfig[T]) => (
    UpdateConfig(value, key, next, onChange, onValidityChange)
  );
  return (
    <section aria-labelledby="oculomotor-config-title">
      <h2 id="oculomotor-config-title">{labels.settings}</h2>
      <label>{labels.difficulty}
        <select value={value.difficulty} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          update('difficulty', event.target.value as OculomotorDifficulty);
        }}>
          <option value="beginner">{labels.beginner}</option>
          <option value="intermediate">{labels.intermediate}</option>
          <option value="advanced">{labels.advanced}</option>
        </select>
      </label>
      <label>{labels.mode}
        <select value={value.mode} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          update('mode', event.target.value as OculomotorMode);
        }}>
          {modes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </label>
      <label>{labels.pattern}
        <select value={value.pattern} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          update('pattern', event.target.value as OculomotorPattern);
        }}>
          {patterns.map((pattern) => <option key={pattern} value={pattern}>{pattern}</option>)}
        </select>
      </label>
      <label>{labels.duration}
        <input
          max={300}
          min={5}
          onChange={(event: ChangeEvent<HTMLInputElement>) => update('durationSec', Number(event.target.value))}
          type="number"
          value={value.durationSec}
        />
      </label>
    </section>
  );
}

export function OculomotorRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return <section aria-labelledby="oculomotor-rules-title"><h2 id="oculomotor-rules-title">{labels.rules}</h2><p>{labels.body}</p></section>;
}

export const oculomotorSetup = CreateVisionTimelineSetup<OculomotorConfig>({
  manifest,
  defaultConfig,
  validateConfig: ValidateOculomotorConfig,
  ConfigPanel: OculomotorConfigPanel,
  RulesPanel: OculomotorRulesPanel,
  preload: async () => {
    await Promise.all([
      import('../experiment/timelines/oculomotorTimeline'),
      import('../utils/pixiPool'),
    ]);
  },
  buildTimeline: async ({ config, jsPsych }) => {
    const { BuildOculomotorTimeline } = await import('../experiment/timelines/oculomotorTimeline');
    return BuildOculomotorTimeline({
      difficulty: config.difficulty,
      jsPsych: jsPsych as never,
      oculomotor: {
        mode: config.mode,
        pattern: config.pattern,
        durationSec: config.durationSec,
      },
    });
  },
  summarize: ({ status, startedAt, endedAt, values }) => SummarizeVisionTrainingRun({
    moduleId: manifest.id,
    moduleVersion: manifest.implementationVersion,
    status,
    startedAt,
    endedAt,
    trials: values as Omit<Parameters<typeof SummarizeVisionTrainingRun>[0], 'moduleId' | 'moduleVersion' | 'status' | 'startedAt' | 'endedAt'>['trials'],
  }),
  onDispose: async () => {
    const { DestroyPixiTrainingRuntime } = await import('../utils/pixiPool');
    DestroyPixiTrainingRuntime(manifest.id);
  },
});

export default oculomotorSetup;
