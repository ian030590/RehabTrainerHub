interface NumberPresetSelectorProps {
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
    <div className="number-preset-selector">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          className={`number-preset-button ${value === preset && !customValue ? 'active' : ''}`}
          onClick={() => onPresetSelect(preset)}
        >
          {preset}
        </button>
      ))}
      <input
        className="number-preset-input"
        type="number"
        min={min}
        max={max}
        placeholder={placeholder}
        value={customValue}
        onChange={(event) => onCustomChange(event.target.value)}
      />
    </div>
  );
}
