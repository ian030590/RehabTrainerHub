import type { ChangeEvent } from 'react';
import type {
  TrainingConfigProps,
  TrainingRulesProps,
} from '@rehab-trainer/ui/trainingHostContract';
import { GetTrainingModuleManifest } from '../../moduleFlowManifest';
import { CreateTimelineSetup } from '../../shared/createTimelineSetup';
import { SummarizePeripheralAttentionRun } from '../pages/peripheral-attention/peripheralAttentionRunResult';
import type {
  PeripheralAttentionRunMode,
  PeripheralAttentionStopCondition,
  PeripheralAttentionTargetAxis,
  SubtestId,
} from '../pages/peripheral-attention/PeripheralAttentionPage';

export interface UfovConfig extends Record<string, unknown> {
  language: 'zh' | 'en';
  subtestId: SubtestId;
  mode: PeripheralAttentionRunMode;
  trialCount: number;
  targetAxes: readonly PeripheralAttentionTargetAxis[];
  stopCondition: PeripheralAttentionStopCondition;
  contrastPercent: number;
  targetVisualAngleDeg: number;
  vehicleVisualAngleDeg: number;
}

const manifest = GetTrainingModuleManifest('brain:ufov');
const allTargetAxes: readonly PeripheralAttentionTargetAxis[] = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);

const defaultConfig: Readonly<UfovConfig> = Object.freeze({
  language: 'zh',
  subtestId: 1,
  mode: 'formal',
  trialCount: 48,
  targetAxes: allTargetAxes,
  stopCondition: 'adaptive_80',
  contrastPercent: 100,
  targetVisualAngleDeg: 15,
  vehicleVisualAngleDeg: 2.5,
});

const copy = {
  zh: {
    settings: '周邊視野活動設定',
    subtest: '階段',
    mode: '模式',
    trialCount: '試次數',
    contrast: '對比參數（%）',
    targetAngle: '目標視角（度）',
    vehicleAngle: '中央目標視角（度）',
    formal: '正式活動',
    practice: '練習',
    adaptive: '自適應 80%',
    fixed: '固定試次',
    rules: '活動規則',
    rulesBody: '請注視中央目標；依畫面提示先選中央車輛，再選周邊方向。結果是本次活動的刺激參數換算參考值。',
  },
  en: {
    settings: 'Peripheral visual field settings',
    subtest: 'Stage',
    mode: 'Mode',
    trialCount: 'Trials',
    contrast: 'Contrast (%)',
    targetAngle: 'Target visual angle (degrees)',
    vehicleAngle: 'Central target angle (degrees)',
    formal: 'Formal activity',
    practice: 'Practice',
    adaptive: 'Adaptive 80%',
    fixed: 'Fixed trials',
    rules: 'How to play',
    rulesBody: 'Keep your eyes on the central target. Choose the central vehicle, then choose the peripheral direction. Results are stimulus-parameter reference values for this activity.',
  },
} as const;

function IsLanguage(value: unknown): value is UfovConfig['language'] {
  return value === 'zh' || value === 'en';
}

function IsSubtest(value: unknown): value is SubtestId {
  return value === 1 || value === 2 || value === 3;
}

function IsMode(value: unknown): value is PeripheralAttentionRunMode {
  return value === 'instruction' || value === 'practice' || value === 'formal';
}

function IsStopCondition(value: unknown): value is PeripheralAttentionStopCondition {
  return value === 'adaptive_80' || value === 'fixed_trials';
}

function IsBoundedNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function IsBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function IsTargetAxes(value: unknown): value is PeripheralAttentionTargetAxis[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((axis) => Number.isInteger(axis) && axis >= 0 && axis <= 7);
}

function Issue(path: string) {
  return { path, code: 'invalid', messageKey: `training.ufov.config.${path}` };
}

export function ValidateUfovConfig(input: unknown):
  | { ok: true; value: UfovConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!IsLanguage(source.language)) issues.push(Issue('language'));
  if (!IsSubtest(source.subtestId)) issues.push(Issue('subtestId'));
  if (!IsMode(source.mode) || source.mode === 'instruction') issues.push(Issue('mode'));
  if (!IsBoundedInteger(source.trialCount, 1, 240)) issues.push(Issue('trialCount'));
  if (!IsTargetAxes(source.targetAxes)) issues.push(Issue('targetAxes'));
  if (!IsStopCondition(source.stopCondition)) issues.push(Issue('stopCondition'));
  if (!IsBoundedNumber(source.contrastPercent, 5, 100)) issues.push(Issue('contrastPercent'));
  if (!IsBoundedNumber(source.targetVisualAngleDeg, 5, 35)) issues.push(Issue('targetVisualAngleDeg'));
  if (!IsBoundedNumber(source.vehicleVisualAngleDeg, 0.8, 5)) issues.push(Issue('vehicleVisualAngleDeg'));
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: Object.freeze({
      language: source.language as UfovConfig['language'],
      subtestId: source.subtestId as SubtestId,
      mode: source.mode as PeripheralAttentionRunMode,
      trialCount: source.trialCount as number,
      targetAxes: Object.freeze([...(source.targetAxes as PeripheralAttentionTargetAxis[])]),
      stopCondition: source.stopCondition as PeripheralAttentionStopCondition,
      contrastPercent: source.contrastPercent as number,
      targetVisualAngleDeg: source.targetVisualAngleDeg as number,
      vehicleVisualAngleDeg: source.vehicleVisualAngleDeg as number,
    }),
  };
}

function UpdateConfig<T extends keyof UfovConfig>(
  value: Readonly<UfovConfig>,
  key: T,
  next: UfovConfig[T],
  onChange: (value: UfovConfig) => void,
  onValidityChange: ((valid: boolean) => void) | undefined,
) {
  const validation = ValidateUfovConfig({ ...value, [key]: next });
  if (validation.ok) {
    onChange(validation.value);
    onValidityChange?.(true);
  } else {
    onValidityChange?.(false);
  }
}

export function UfovConfigPanel({
  value,
  onChange,
  onValidityChange,
  language = 'zh',
}: TrainingConfigProps<UfovConfig>) {
  const labels = copy[language];
  const update = <T extends keyof UfovConfig>(key: T, next: UfovConfig[T]) => (
    UpdateConfig(value, key, next, onChange, onValidityChange)
  );
  return (
    <section aria-labelledby="ufov-config-title">
      <h2 id="ufov-config-title">{labels.settings}</h2>
      <label>{labels.subtest}
        <select value={value.subtestId} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          update('subtestId', Number(event.target.value) as SubtestId);
        }}>
          <option value="1">1</option><option value="2">2</option><option value="3">3</option>
        </select>
      </label>
      <label>{labels.mode}
        <select value={value.mode} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          update('mode', event.target.value as PeripheralAttentionRunMode);
        }}>
          <option value="formal">{labels.formal}</option>
          <option value="practice">{labels.practice}</option>
        </select>
      </label>
      <label>{labels.trialCount}
        <input min={1} max={240} type="number" value={value.trialCount} onChange={(event: ChangeEvent<HTMLInputElement>) => {
          update('trialCount', Number(event.target.value));
        }} />
      </label>
      <label>{labels.contrast}
        <input min={5} max={100} type="number" value={value.contrastPercent} onChange={(event: ChangeEvent<HTMLInputElement>) => {
          update('contrastPercent', Number(event.target.value));
        }} />
      </label>
      <label>{labels.targetAngle}
        <input min={5} max={35} step={0.1} type="number" value={value.targetVisualAngleDeg} onChange={(event: ChangeEvent<HTMLInputElement>) => {
          update('targetVisualAngleDeg', Number(event.target.value));
        }} />
      </label>
      <label>{labels.vehicleAngle}
        <input min={0.8} max={5} step={0.1} type="number" value={value.vehicleVisualAngleDeg} onChange={(event: ChangeEvent<HTMLInputElement>) => {
          update('vehicleVisualAngleDeg', Number(event.target.value));
        }} />
      </label>
    </section>
  );
}

export function UfovRulesPanel({ language = 'zh' }: TrainingRulesProps) {
  const labels = copy[language];
  return (
    <section aria-labelledby="ufov-rules-title">
      <h2 id="ufov-rules-title">{labels.rules}</h2>
      <p>{labels.rulesBody}</p>
    </section>
  );
}

export const ufovSetup = CreateTimelineSetup<UfovConfig>({
  manifest,
  defaultConfig,
  validateConfig: ValidateUfovConfig,
  ConfigPanel: UfovConfigPanel,
  RulesPanel: UfovRulesPanel,
  preload: async () => {
    await Promise.all([
      import('../pages/peripheral-attention/PeripheralAttentionPage'),
      import('@rehab-trainer/ui/displayTiming'),
    ]);
  },
  buildTimeline: async ({ config, jsPsych, context }) => {
    const [{
      CalculateScreenGeometry,
      GetPeripheralAttentionLabels,
      PeripheralAttentionExperimentPlugin,
      peripheralAttentionDisplayCalibration,
      RegisterPeripheralAttentionAbortSignal,
    }, { MeasureDisplayRefreshRate }] = await Promise.all([
      import('../pages/peripheral-attention/PeripheralAttentionPage'),
      import('@rehab-trainer/ui/displayTiming'),
    ]);
    const measured = await MeasureDisplayRefreshRate({ signal: context.signal });
    const geometry = CalculateScreenGeometry(
      peripheralAttentionDisplayCalibration.screenWidthCm,
      peripheralAttentionDisplayCalibration.screenHeightCm,
      peripheralAttentionDisplayCalibration.viewingDistanceCm,
      config.targetVisualAngleDeg,
      config.vehicleVisualAngleDeg,
    );
    RegisterPeripheralAttentionAbortSignal(jsPsych as never, context.signal);
    return [{
      type: PeripheralAttentionExperimentPlugin,
      labels: GetPeripheralAttentionLabels(context.language ?? config.language),
      refresh_ms: measured.refreshMs,
      refresh_hz: measured.refreshHz,
      refresh_is_60hz_family: measured.is60HzFamily,
      refresh_device_kind: measured.deviceKind,
      config: {
        subtestId: config.subtestId,
        mode: config.mode,
        trialCount: config.trialCount,
        targetAxes: config.targetAxes,
        stopCondition: config.stopCondition,
        contrastPercent: config.contrastPercent,
        targetVisualAngleDeg: config.targetVisualAngleDeg,
        vehicleVisualAngleDeg: config.vehicleVisualAngleDeg,
        geometry,
      },
    }];
  },
  summarize: ({ status, startedAt, endedAt, values }) => {
    const data = values[values.length - 1] as {
      trials?: Parameters<typeof SummarizePeripheralAttentionRun>[0]['trials'];
      results?: Parameters<typeof SummarizePeripheralAttentionRun>[0]['results'];
      invalid_timing_attempt_count?: number;
    } | undefined;
    return SummarizePeripheralAttentionRun({
      moduleId: manifest.id,
      moduleVersion: manifest.implementationVersion,
      status,
      startedAt,
      endedAt,
      trials: data?.trials ?? [],
      results: data?.results ?? [],
      invalidTimingAttemptCount: data?.invalid_timing_attempt_count,
    });
  },
});

export default ufovSetup;
