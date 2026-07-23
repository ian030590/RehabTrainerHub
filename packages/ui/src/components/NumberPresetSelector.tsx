import { TrainingConfigOptionGroup } from './TrainingConfigPanel';

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
  return (
    <TrainingConfigOptionGroup className="training-number-preset-grid" columns={4}>
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          className={`training-option ${value === preset && !customValue ? 'active' : ''}`}
          onClick={() => onPresetSelect(preset)}
        >
          <span className="training-option-title">{preset}</span>
        </button>
      ))}
      <label className={`training-option training-option-custom ${customValue ? 'active' : ''}`}>
        <span className="training-option-title">{placeholder}</span>
        <input
          className="training-number-input"
          type="number"
          min={min}
          max={max}
          placeholder={placeholder}
          value={customValue}
          onChange={(event) => onCustomChange(event.target.value)}
        />
      </label>
    </TrainingConfigOptionGroup>
  );
}
