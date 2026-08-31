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
  actions,
}: TrainingConfigProps<UfovConfig>) {
  const labels = copy[language];
  const update = <T extends keyof UfovConfig>(key: T, next: UfovConfig[T]) => (
    UpdateConfig(value, key, next, onChange, onValidityChange)
  );
  return (
    <TrainingSetupPanel actions={actions} title={labels.settings}>
      <TrainingConfigSection title={labels.subtest} wide>
        <TrainingSetupChoiceGrid
          choices={[
            { label: '1', value: 1 },
            { label: '2', value: 2 },
            { label: '3', value: 3 },
          ]}
          columns={3}
          onValueChange={(subtestId) => update('subtestId', subtestId as SubtestId)}
          value={value.subtestId}
        />
      </TrainingConfigSection>
      <TrainingConfigSection title={labels.mode} wide>
        <TrainingSetupChoiceGrid
          choices={[
            { label: labels.formal, value: 'formal' },
            { label: labels.practice, value: 'practice' },
          ]}
          columns={2}
          onValueChange={(mode) => update('mode', mode as PeripheralAttentionRunMode)}
          value={value.mode}
        />
      </TrainingConfigSection>
      <TrainingSlider
        label={labels.trialCount}
        max={240}
        min={1}
        onValueChange={(trialCount) => update('trialCount', trialCount)}
        value={value.trialCount}
      />
      <TrainingSlider
        label={labels.contrast}
        max={100}
        min={5}
        onValueChange={(contrastPercent) => update('contrastPercent', contrastPercent)}
        value={value.contrastPercent}
      />
      <TrainingSlider
        label={labels.targetAngle}
        max={35}
        min={5}
        onValueChange={(targetVisualAngleDeg) => update('targetVisualAngleDeg', targetVisualAngleDeg)}
        step={0.1}
        value={value.targetVisualAngleDeg}
      />
      <TrainingSlider
        label={labels.vehicleAngle}
        max={5}
        min={0.8}
        onValueChange={(vehicleVisualAngleDeg) => update('vehicleVisualAngleDeg', vehicleVisualAngleDeg)}
        step={0.1}
        value={value.vehicleVisualAngleDeg}
      />
    </TrainingSetupPanel>
  );
}

export function UfovRulesPanel({ language = 'zh', actions }: TrainingRulesProps) {
  const labels = copy[language];
  return <TrainingSetupRulesPanel actions={actions} title={labels.rules}><p>{labels.rulesBody}</p></TrainingSetupRulesPanel>;
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
