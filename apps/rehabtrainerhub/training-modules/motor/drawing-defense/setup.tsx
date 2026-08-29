import type { ChangeEvent } from 'react';
import type {
  TrainingConfigProps,
  TrainingRulesProps,
} from '@rehab-trainer/ui/trainingHostContract';
import {
  CreateComponentTrainingSetup,
} from '../../shared/componentTrainingEngine';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import {
  drawingDefenseDefaults,
  drawingDefenseConfigBounds,
  drawingDefenseDifficultyOptions,
  type DrawingDefenseConfig,
  type DrawingDefenseDifficulty,
  ValidateDrawingDefenseConfig,
} from './config';
import type { DrawingDefenseSessionRecord } from '../pages/training/DrawingTowerDefenseGame';
import type { DrawingTowerDefenseGameProps } from '../pages/training/DrawingTowerDefenseGame';
import { CreateTrainingRunResult } from '@rehab-trainer/training-contracts';

const manifest = GetTrainingModuleManifest('motor:drawing-defense');

const copy = {
  zh: {
    settings: '繪圖防守設定',
    difficulty: '難度',
    duration: '活動時間（秒）',
    infinite: '不限時',
    hp: '生命值',
    speed: '敵人速度',
    strictness: '辨識嚴格度（%）',
    strokeWait: '筆畫判定延遲（毫秒）',
    beginner: '初階',
    intermediate: '中階',
    advanced: '進階',
    rules: '活動規則',
    rulesBody: '依敵人卡片上的圖形繪圖，消滅敵人並守住防線。結果僅為本次活動紀錄。',
  },
  en: {
    settings: 'Drawing Defense settings',
    difficulty: 'Difficulty',
    duration: 'Activity duration (seconds)',
    infinite: 'No time limit',
    hp: 'Health',
    speed: 'Enemy speed',
    strictness: 'Recognition strictness (%)',
    strokeWait: 'Stroke decision delay (ms)',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    rules: 'How to play',
    rulesBody: 'Draw the shape shown on each enemy card to defeat it and protect the line. Results are records for this activity only.',
  },
} as const;

type DrawingDefenseCopy = (typeof copy)[keyof typeof copy];

function DifficultyLabel(
  value: DrawingDefenseDifficulty,
  labels: DrawingDefenseCopy,
): string {
  if (value === 'Intermediate') return labels.intermediate;
  if (value === 'Advanced') return labels.advanced;
  return labels.beginner;
}

function UpdateConfig(
  value: Readonly<DrawingDefenseConfig>,
  next: Partial<DrawingDefenseConfig>,
  onChange: (value: DrawingDefenseConfig) => void,
  onValidityChange: ((valid: boolean) => void) | undefined,
) {
  const validation = ValidateDrawingDefenseConfig({ ...value, ...next });
  if (validation.ok) {
    onChange(validation.value);
    onValidityChange?.(true);
  } else {
    onValidityChange?.(false);
  }
}

export function DrawingDefenseConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<DrawingDefenseConfig>) {
  const labels = copy[language];
  const updateNumber = (key: keyof DrawingDefenseConfig) => (
    (event: ChangeEvent<HTMLInputElement>) => {
      UpdateConfig(value, { [key]: Number(event.target.value) }, onChange, onValidityChange);
    }
  );
  return (
    <section aria-labelledby="drawing-defense-native-config-title">
      <h2 id="drawing-defense-native-config-title">{labels.settings}</h2>
      <label>
        {labels.difficulty}
        <select
          value={value.difficulty}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            UpdateConfig(
              value,
              { difficulty: event.target.value as DrawingDefenseDifficulty },
              onChange,
              onValidityChange,
            );
          }}
        >
          {drawingDefenseDifficultyOptions.map((option) => (
            <option key={option} value={option}>{DifficultyLabel(option, labels)}</option>
          ))}
        </select>
      </label>
      <label>
        {labels.duration}
        <input
          max={drawingDefenseConfigBounds.gameDurationSec.max}
          min={drawingDefenseConfigBounds.gameDurationSec.min}
          onChange={updateNumber('gameDurationSec')}
          type="number"
          value={value.gameDurationSec ?? ''}
          disabled={value.gameDurationSec === null}
        />
      </label>
      <label>
        <input
          checked={value.gameDurationSec === null}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            UpdateConfig(
              value,
              { gameDurationSec: event.target.checked ? null : drawingDefenseDefaults.gameDurationSec },
              onChange,
              onValidityChange,
            );
          }}
          type="checkbox"
        />
        {labels.infinite}
      </label>
      <label>
        {labels.hp}
        <input max={drawingDefenseConfigBounds.maxHp.max} min={drawingDefenseConfigBounds.maxHp.min} onChange={updateNumber('maxHp')} type="number" value={value.maxHp} />
      </label>
      <label>
        {labels.speed}
        <input max={drawingDefenseConfigBounds.speed.max} min={drawingDefenseConfigBounds.speed.min} onChange={updateNumber('speed')} type="number" value={value.speed} />
      </label>
      <label>
        {labels.strictness}
        <input max={drawingDefenseConfigBounds.strictness.max} min={drawingDefenseConfigBounds.strictness.min} step={5} onChange={updateNumber('strictness')} type="number" value={value.strictness} />
      </label>
      <label>
        {labels.strokeWait}
        <input max={drawingDefenseConfigBounds.strokeWaitMs.max} min={drawingDefenseConfigBounds.strokeWaitMs.min} step={10} onChange={updateNumber('strokeWaitMs')} type="number" value={value.strokeWaitMs} />
      </label>
    </section>
  );
}

export function DrawingDefenseRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return (
    <section aria-labelledby="drawing-defense-native-rules-title">
      <h2 id="drawing-defense-native-rules-title">{labels.rules}</h2>
      <p>{labels.rulesBody}</p>
    </section>
  );
}

export const drawingDefenseSetup = CreateComponentTrainingSetup<
  DrawingDefenseConfig,
  DrawingDefenseSessionRecord,
  DrawingTowerDefenseGameProps
>({
  manifest,
  defaultConfig: drawingDefenseDefaults,
  validateConfig: ValidateDrawingDefenseConfig,
  ConfigPanel: DrawingDefenseConfigPanel,
  RulesPanel: DrawingDefenseRulesPanel,
  loadComponent: async () => {
    const module = await import('../pages/training/DrawingTowerDefenseGame');
    return module.DrawingTowerDefenseGame;
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
    trialCount: result?.Enemies_Spawned ?? 0,
    score: result?.Enemies_Defeated,
    metrics: {
      enemiesSpawned: result?.Enemies_Spawned ?? 0,
      enemiesDefeated: result?.Enemies_Defeated ?? 0,
      hpRemaining: result?.HP_Remaining ?? null,
    },
  }),
});

export default drawingDefenseSetup;
