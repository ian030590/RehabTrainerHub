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
  return (
    <div className="training-range-control">
      <span className="training-range-value">{customValue || value}</span>
      <input
        className="training-slider"
        type="range"
        min={min}
        max={max}
        step="1"
        aria-label={placeholder}
        value={customValue || value}
        onChange={(event) => onCustomChange(event.target.value)}
      />
    </div>
  );
}
