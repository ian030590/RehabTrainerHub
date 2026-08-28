import { TrainingSlider } from './TrainingConfigRangeField';

export interface NumberPresetSelectorProps {
  value: number;
  customValue: string;
  presets: readonly number[];
  min: number;
  max: number;
  placeholder: string;
  onPresetSelect: (value: number) => void;
  onCustomChange: (value: string) => void;
}

export function NumberPresetSelector({
  value,
  customValue,
  presets,
  min,
  max,
  placeholder,
  onPresetSelect,
  onCustomChange,
}: NumberPresetSelectorProps) {
  void presets;
  void onPresetSelect;
  const selectedValue = Number(customValue || value);

  return (
    <TrainingSlider
      label={placeholder}
      value={selectedValue}
      min={min}
      max={max}
      step={1}
      onValueChange={(nextValue) => onCustomChange(String(nextValue))}
    />
  );
}
