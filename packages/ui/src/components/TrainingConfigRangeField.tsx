import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

type RangeAttributeValue = InputHTMLAttributes<HTMLInputElement>['min'];

function ParseRangeNumber(value: RangeAttributeValue, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function FormatScaleNumber(value: number) {
  return String(Number(value.toFixed(6)));
}

export function GetTrainingSliderScaleLabels(
  min: RangeAttributeValue,
  max: RangeAttributeValue,
  step: RangeAttributeValue,
): readonly [ReactNode, ReactNode, ReactNode] {
  const minimum = ParseRangeNumber(min, 0);
  const maximum = ParseRangeNumber(max, 100);
  const increment = Math.abs(ParseRangeNumber(step, 1)) || 1;
  const midpointSteps = Math.round(((maximum - minimum) / 2) / increment);
  const midpoint = Math.min(maximum, Math.max(minimum, minimum + midpointSteps * increment));

  return [
    FormatScaleNumber(minimum),
    FormatScaleNumber(midpoint),
    FormatScaleNumber(maximum),
  ];
}

export interface TrainingSliderFrameProps {
  inputId?: string;
  label: ReactNode;
  valueLabel: ReactNode;
  description?: ReactNode;
  scaleLabels: readonly [ReactNode, ReactNode, ReactNode];
  children: ReactNode;
}

export function TrainingSliderFrame({
  inputId,
  label,
  valueLabel,
  description,
  scaleLabels,
  children,
}: TrainingSliderFrameProps) {
  return (
    <label className="training-slider" htmlFor={inputId}>
      <span className="training-slider-header">
        <span className="training-slider-label">{label}</span>
        <output className="training-slider-value" htmlFor={inputId}>{valueLabel}</output>
      </span>
      <span className="training-slider-control">
        {description && <span className="training-slider-description">{description}</span>}
        {children}
        <span className="training-slider-scale" aria-hidden="true">
          {scaleLabels.map((scaleLabel, index) => <span key={index}>{scaleLabel}</span>)}
        </span>
      </span>
    </label>
  );
}

export interface TrainingConfigRangeFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children' | 'className' | 'onChange' | 'type' | 'value'> {
  label: ReactNode;
  value: number;
  valueLabel?: ReactNode;
  description?: ReactNode;
  scaleLabels?: readonly [ReactNode, ReactNode, ReactNode];
  onValueChange: (value: number) => void;
}

export function TrainingSlider({
  label,
  value,
  valueLabel = value,
  description,
  scaleLabels,
  onValueChange,
  id,
  'aria-label': ariaLabel,
  min,
  max,
  step,
  ...inputProps
}: TrainingConfigRangeFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const resolvedScaleLabels = scaleLabels ?? GetTrainingSliderScaleLabels(min, max, step);

  return (
    <TrainingSliderFrame
      inputId={inputId}
      label={label}
      valueLabel={valueLabel}
      description={description}
      scaleLabels={resolvedScaleLabels}
    >
      <input
        {...inputProps}
        id={inputId}
        className="training-slider-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue)) {
            onValueChange(nextValue);
          }
        }}
      />
    </TrainingSliderFrame>
  );
}

/** @deprecated Use TrainingSlider. */
export { TrainingSlider as TrainingConfigRangeField };
export type TrainingSliderProps = TrainingConfigRangeFieldProps;
