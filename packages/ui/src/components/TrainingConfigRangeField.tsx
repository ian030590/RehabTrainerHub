import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

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
  ...inputProps
}: TrainingConfigRangeFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label className="training-slider" htmlFor={inputId}>
      <span className="training-slider-header">
        <span className="training-slider-label">{label}</span>
        <output className="training-slider-value" htmlFor={inputId}>{valueLabel}</output>
      </span>
      {description && <span className="training-slider-description">{description}</span>}
      <input
        {...inputProps}
        id={inputId}
        type="range"
        value={value}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue)) {
            onValueChange(nextValue);
          }
        }}
      />
      {scaleLabels && (
        <span className="training-slider-scale" aria-hidden="true">
          {scaleLabels.map((scaleLabel, index) => <span key={index}>{scaleLabel}</span>)}
        </span>
      )}
    </label>
  );
}

/** @deprecated Use TrainingSlider. */
export { TrainingSlider as TrainingConfigRangeField };
export type TrainingSliderProps = TrainingConfigRangeFieldProps;
