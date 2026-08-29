import type { ChangeEvent } from 'react';
import type { TrainingConfigProps, TrainingRulesProps } from '@rehab-trainer/ui/trainingHostContract';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateVisionTimelineSetup } from '../createTimelineSetup';
import { SummarizeVisionTrainingRun } from '../utils/trainingRunResult';
import type { TrialData } from '../pages/training/types';

type ReadingDifficulty = 'beginner' | 'intermediate' | 'advanced';
type ReadingLanguage = 'zh' | 'en';

export interface ReadingTrainingConfig extends Record<string, unknown> {
  difficulty: ReadingDifficulty;
  language: ReadingLanguage;
  wps: number;
  crowding: number;
  contrast: number;
}

const manifest = GetTrainingModuleManifest('vision:reading-training');
const defaultConfig: Readonly<ReadingTrainingConfig> = Object.freeze({
  difficulty: 'beginner',
  language: 'zh',
  wps: 4,
  crowding: 1,
  contrast: 0,
});
const copy = {
  zh: {
    settings: '閱讀活動設定', difficulty: '難度', language: '內容語言', wps: '每秒字數', crowding: '擁擠程度', contrast: '對比參數', rules: '玩法',
    body: '閱讀快速呈現的內容，再回答畫面上的問題。', beginner: '初階', intermediate: '中階', advanced: '進階', zh: '繁體中文', en: 'English',
  },
  en: {
    settings: 'Reading activity settings', difficulty: 'Difficulty', language: 'Story language', wps: 'Words per second', crowding: 'Crowding', contrast: 'Contrast parameter', rules: 'How to play',
    body: 'Read the rapidly presented story, then answer the on-screen questions.', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', zh: 'Traditional Chinese', en: 'English',
  },
} as const;

function IsDifficulty(value: unknown): value is ReadingDifficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}

function IsLanguage(value: unknown): value is ReadingLanguage {
  return value === 'zh' || value === 'en';
}

function IsBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function IsBoundedNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function ValidateReadingTrainingConfig(input: unknown):
  | { ok: true; value: ReadingTrainingConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!IsDifficulty(source.difficulty)) issues.push(Issue('difficulty'));
  if (!IsLanguage(source.language)) issues.push(Issue('language'));
  if (!IsBoundedNumber(source.wps, 1, 20)) issues.push(Issue('wps'));
  if (!IsBoundedInteger(source.crowding, 1, 5)) issues.push(Issue('crowding'));
  if (!IsBoundedNumber(source.contrast, 0, 2)) issues.push(Issue('contrast'));
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: Object.freeze({
    difficulty: source.difficulty as ReadingDifficulty,
    language: source.language as ReadingLanguage,
    wps: source.wps as number,
    crowding: source.crowding as number,
    contrast: source.contrast as number,
  }) };
}

function Issue(path: string) {
  return { path, code: 'invalid', messageKey: `training.reading.config.${path}` };
}

export function ReadingTrainingConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<ReadingTrainingConfig>) {
  const labels = copy[language];
  const update = (key: keyof ReadingTrainingConfig, next: unknown) => {
    const validation = ValidateReadingTrainingConfig({ ...value, [key]: next });
    if (validation.ok) {
      onChange(validation.value);
      onValidityChange?.(true);
    } else onValidityChange?.(false);
  };
  return (
    <section aria-labelledby="reading-config-title">
      <h2 id="reading-config-title">{labels.settings}</h2>
      <label>{labels.difficulty}
        <select value={value.difficulty} onChange={(event: ChangeEvent<HTMLSelectElement>) => update('difficulty', event.target.value)}>
          <option value="beginner">{labels.beginner}</option><option value="intermediate">{labels.intermediate}</option><option value="advanced">{labels.advanced}</option>
        </select>
      </label>
      <label>{labels.language}
        <select value={value.language} onChange={(event: ChangeEvent<HTMLSelectElement>) => update('language', event.target.value)}>
          <option value="zh">{labels.zh}</option><option value="en">{labels.en}</option>
        </select>
      </label>
      <label>{labels.wps}<input min={1} max={20} step={0.5} type="number" value={value.wps} onChange={(event: ChangeEvent<HTMLInputElement>) => update('wps', Number(event.target.value))} /></label>
      <label>{labels.crowding}<input min={1} max={5} type="number" value={value.crowding} onChange={(event: ChangeEvent<HTMLInputElement>) => update('crowding', Number(event.target.value))} /></label>
      <label>{labels.contrast}<input min={0} max={2} step={0.1} type="number" value={value.contrast} onChange={(event: ChangeEvent<HTMLInputElement>) => update('contrast', Number(event.target.value))} /></label>
    </section>
  );
}

export function ReadingTrainingRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return <section aria-labelledby="reading-rules-title"><h2 id="reading-rules-title">{labels.rules}</h2><p>{labels.body}</p></section>;
}

export const readingTrainingSetup = CreateVisionTimelineSetup<ReadingTrainingConfig>({
  manifest,
  defaultConfig,
  validateConfig: ValidateReadingTrainingConfig,
  ConfigPanel: ReadingTrainingConfigPanel,
  RulesPanel: ReadingTrainingRulesPanel,
  preload: async () => {
    await Promise.all([
      import('../experiment/timelines/readingTimeline'),
      import('../utils/pixiPool'),
    ]);
  },
  buildTimeline: async ({ config, jsPsych }) => {
    const [{ BuildReadingTimeline }, { getRandomStory }] = await Promise.all([
      import('../experiment/timelines/readingTimeline'),
      import('../pages/training/reading/stories'),
    ]);
    return BuildReadingTimeline({
      difficulty: config.difficulty,
      jsPsych: jsPsych as never,
      reading: {
        wps: config.wps,
        crowding: config.crowding,
        contrast: config.contrast,
        story: getRandomStory(config.language) ?? undefined,
      },
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

export default readingTrainingSetup;
