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

export function TrainingConfigRangeField({
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
    <label className="training-range-field" htmlFor={inputId}>
      <span className="training-range-field-header">
        <span className="training-range-field-label">{label}</span>
        <output className="training-range-field-value" htmlFor={inputId}>{valueLabel}</output>
      </span>
      {description && <span className="training-range-field-description">{description}</span>}
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
        <span className="training-range-field-scale" aria-hidden="true">
          {scaleLabels.map((scaleLabel, index) => <span key={index}>{scaleLabel}</span>)}
        </span>
      )}
    </label>
  );
}
