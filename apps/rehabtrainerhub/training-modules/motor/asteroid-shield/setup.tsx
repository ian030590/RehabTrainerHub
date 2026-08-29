import type { ChangeEvent } from 'react';
import type {
  TrainingConfigProps,
  TrainingRulesProps,
} from '@rehab-trainer/ui/trainingHostContract';
import { CreateTrainingRunResult } from '@rehab-trainer/training-contracts';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateComponentTrainingSetup } from '../../shared/componentTrainingEngine';
import {
  asteroidShieldConfigBounds,
  asteroidShieldControlModeOptions,
  asteroidShieldDefaults,
  asteroidShieldDifficultyOptions,
  asteroidShieldHandChoiceOptions,
  type AsteroidShieldConfig,
  type AsteroidShieldControlMode,
  type AsteroidShieldDifficulty,
  type AsteroidShieldHandChoice,
  ValidateAsteroidShieldConfig,
} from './config';
import type {
  AsteroidShieldGameProps,
  AsteroidShieldSessionRecord,
} from '../pages/training/AsteroidShieldGame';

const manifest = GetTrainingModuleManifest('motor:asteroid-shield');

const copy = {
  zh: {
    settings: '小行星防守設定', difficulty: '難度', duration: '活動時間（秒）', hp: '生命值',
    shield: '護盾大小（%）', control: '控制方式', hand: '追蹤手', mouse: '滑鼠', camera: '手勢鏡頭',
    any: '任一手', left: '左手', right: '右手', rules: '活動規則',
    body: '移動護盾阻擋小行星，能量物件可補充分數。手勢模式只在開始活動後啟用鏡頭。',
    beginner: '入門', intermediate: '進階', advanced: '挑戰',
  },
  en: {
    settings: 'Asteroid Shield settings', difficulty: 'Difficulty', duration: 'Activity duration (seconds)', hp: 'Health',
    shield: 'Shield size (%)', control: 'Control mode', hand: 'Tracking hand', mouse: 'Pointer', camera: 'Camera gesture',
    any: 'Any hand', left: 'Left hand', right: 'Right hand', rules: 'How to play',
    body: 'Move the shield to block asteroids and collect energy. Camera mode starts only after the activity begins.',
    beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
  },
} as const;

type Copy = (typeof copy)[keyof typeof copy];

function DifficultyLabel(value: AsteroidShieldDifficulty, labels: Copy): string {
  if (value === 'intermediate') return labels.intermediate;
  if (value === 'advanced') return labels.advanced;
  return labels.beginner;
}

function UpdateConfig(
  value: Readonly<AsteroidShieldConfig>,
  next: Partial<AsteroidShieldConfig>,
  onChange: (value: AsteroidShieldConfig) => void,
  onValidityChange: ((valid: boolean) => void) | undefined,
) {
  const validation = ValidateAsteroidShieldConfig({ ...value, ...next });
  if (validation.ok) {
    onChange(validation.value);
    onValidityChange?.(true);
  } else onValidityChange?.(false);
}

export function AsteroidShieldConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<AsteroidShieldConfig>) {
  const labels = copy[language];
  const updateNumber = (key: 'durationSec' | 'maxHp' | 'shieldSizePercent') => (
    (event: ChangeEvent<HTMLInputElement>) => UpdateConfig(
      value,
      { [key]: Number(event.target.value) },
      onChange,
      onValidityChange,
    )
  );
  return (
    <section aria-labelledby="asteroid-shield-native-config-title">
      <h2 id="asteroid-shield-native-config-title">{labels.settings}</h2>
      <label>{labels.difficulty}
        <select value={value.difficulty} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(
          value, { difficulty: event.target.value as AsteroidShieldDifficulty }, onChange, onValidityChange,
        )}>
          {asteroidShieldDifficultyOptions.map((option) => (
            <option key={option} value={option}>{DifficultyLabel(option, labels)}</option>
          ))}
        </select>
      </label>
      <label>{labels.duration}
        <input
          max={asteroidShieldConfigBounds.durationSec.max}
          min={asteroidShieldConfigBounds.durationSec.min}
          onChange={updateNumber('durationSec')}
          type="number"
          value={value.durationSec}
        />
      </label>
      <label>{labels.hp}
        <input
          max={asteroidShieldConfigBounds.maxHp.max}
          min={asteroidShieldConfigBounds.maxHp.min}
          onChange={updateNumber('maxHp')}
          type="number"
          value={value.maxHp}
        />
      </label>
      <label>{labels.shield}
        <input
          max={asteroidShieldConfigBounds.shieldSizePercent.max}
          min={asteroidShieldConfigBounds.shieldSizePercent.min}
          onChange={updateNumber('shieldSizePercent')}
          type="number"
          value={value.shieldSizePercent}
        />
      </label>
      <label>{labels.control}
        <select value={value.controlMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(
          value, { controlMode: event.target.value as AsteroidShieldControlMode }, onChange, onValidityChange,
        )}>
          {asteroidShieldControlModeOptions.map((option) => (
            <option key={option} value={option}>{option === 'mouse' ? labels.mouse : labels.camera}</option>
          ))}
        </select>
      </label>
      {value.controlMode === 'mediapipe' && (
        <label>{labels.hand}
          <select value={value.handChoice} onChange={(event: ChangeEvent<HTMLSelectElement>) => UpdateConfig(
            value, { handChoice: event.target.value as AsteroidShieldHandChoice }, onChange, onValidityChange,
          )}>
            {asteroidShieldHandChoiceOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'any' ? labels.any : option === 'left' ? labels.left : labels.right}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

export function AsteroidShieldRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return <section aria-labelledby="asteroid-shield-native-rules-title"><h2 id="asteroid-shield-native-rules-title">{labels.rules}</h2><p>{labels.body}</p></section>;
}

export const asteroidShieldSetup = CreateComponentTrainingSetup<
  AsteroidShieldConfig,
  AsteroidShieldSessionRecord,
  AsteroidShieldGameProps
>({
  manifest,
  defaultConfig: asteroidShieldDefaults,
  validateConfig: ValidateAsteroidShieldConfig,
  ConfigPanel: AsteroidShieldConfigPanel,
  RulesPanel: AsteroidShieldRulesPanel,
  loadComponent: async () => {
    const module = await import('../pages/training/AsteroidShieldGame');
    return module.AsteroidShieldGame;
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
    trialCount: result?.Objects_Spawned ?? 0,
    score: result?.Score,
    metrics: {
      objectsSpawned: result?.Objects_Spawned ?? 0,
      objectsBlocked: result?.Objects_Blocked ?? 0,
      shipHits: result?.Ship_Hits ?? 0,
      finalHp: result?.Final_HP ?? null,
      energyCollected: result?.Energy_Collected ?? 0,
    },
  }),
});

export default asteroidShieldSetup;
