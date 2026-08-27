import type { PeripheralAttentionScreenGeometry } from '../peripheralAttentionCanvas';
import { TrainingConfigRangeField } from './TrainingConfigRangeField';
import {
  defaultPeripheralAttentionConfigLabels,
  GetPeripheralAttentionConfigLabels,
  type PartialPeripheralAttentionConfigLabels,
  type PeripheralAttentionConfigLabels,
  type PeripheralAttentionTargetAxis,
} from '../i18n/peripheralAttention';

export type { PeripheralAttentionConfigLabels, PeripheralAttentionTargetAxis };
export { defaultPeripheralAttentionConfigLabels, GetPeripheralAttentionConfigLabels };

// Backward-compatibility aliases
export type {
  PartialPeripheralAttentionConfigLabels as PartialUfovConfigLabels,
  PeripheralAttentionConfigLabels as UfovConfigLabels,
  PeripheralAttentionTargetAxis as UfovTargetAxis,
};
export {
  defaultPeripheralAttentionConfigLabels as defaultUfovConfigLabels,
  GetPeripheralAttentionConfigLabels as GetUfovConfigLabels,
};

export interface PeripheralAttentionContrastSliderProps {
  value: number;
  onChange: (value: number) => void;
  labels?: PartialPeripheralAttentionConfigLabels;
  lang?: 'zh' | 'en';
}

export type UfovContrastSliderProps = PeripheralAttentionContrastSliderProps;

export function PeripheralAttentionContrastSlider({
  value,
  onChange,
  labels,
  lang = 'zh',
}: PeripheralAttentionContrastSliderProps) {
  const l = { ...defaultPeripheralAttentionConfigLabels[lang], ...labels };
  return (
    <TrainingConfigRangeField
      label={l.contrastStrength}
      value={value}
      valueLabel={`${value}%`}
      description={l.contrastDesc}
      min={5}
      max={100}
      step={1}
      scaleLabels={[l.contrastLow, l.contrastMid, l.contrastHigh]}
      onValueChange={(nextValue) => onChange(Math.max(5, Math.min(100, nextValue)))}
    />
  );
}

export function UfovContrastSlider(props: PeripheralAttentionContrastSliderProps) {
  return <PeripheralAttentionContrastSlider {...props} />;
}

export interface PeripheralAttentionEccentricitySliderProps {
  value: number;
  onChange: (value: number) => void;
  labels?: PartialPeripheralAttentionConfigLabels;
  lang?: 'zh' | 'en';
}

export type UfovEccentricitySliderProps = PeripheralAttentionEccentricitySliderProps;

export function PeripheralAttentionEccentricitySlider({
  value,
  onChange,
  labels,
  lang = 'zh',
}: PeripheralAttentionEccentricitySliderProps) {
  const l = { ...defaultPeripheralAttentionConfigLabels[lang], ...labels };

  return (
    <TrainingConfigRangeField
      label={l.eccentricityTitle}
      value={value}
      valueLabel={`${value.toFixed(1)}°`}
      min={5}
      max={35}
      step={0.5}
      scaleLabels={[l.eccentricityLow, l.eccentricityMid, l.eccentricityHigh]}
      onValueChange={(nextValue) => onChange(Math.max(5, Math.min(35, nextValue)))}
    />
  );
}

export function UfovEccentricitySlider(props: PeripheralAttentionEccentricitySliderProps) {
  return <PeripheralAttentionEccentricitySlider {...props} />;
}

export interface PeripheralAttentionVehicleAngleSliderProps {
  value: number;
  onChange: (value: number) => void;
  labels?: PartialPeripheralAttentionConfigLabels;
  lang?: 'zh' | 'en';
}

export type UfovVehicleAngleSliderProps = PeripheralAttentionVehicleAngleSliderProps;

export function PeripheralAttentionVehicleAngleSlider({
  value,
  onChange,
  labels,
  lang = 'zh',
}: PeripheralAttentionVehicleAngleSliderProps) {
  const l = { ...defaultPeripheralAttentionConfigLabels[lang], ...labels };

  return (
    <TrainingConfigRangeField
      label={l.vehicleSizeTitle}
      value={value}
      valueLabel={`${value.toFixed(1)}°`}
      min={0.8}
      max={5}
      step={0.1}
      scaleLabels={[l.vehicleSizeSmall, l.vehicleSizeStandard, l.vehicleSizeLarge]}
      onValueChange={(nextValue) => onChange(Math.max(0.8, Math.min(5, nextValue)))}
    />
  );
}

export function UfovVehicleAngleSlider(props: PeripheralAttentionVehicleAngleSliderProps) {
  return <PeripheralAttentionVehicleAngleSlider {...props} />;
}

export interface PeripheralAttentionNineGridCompassProps {
  selectedAxes: PeripheralAttentionTargetAxis[];
  onChange: (axes: PeripheralAttentionTargetAxis[]) => void;
  labels?: PartialPeripheralAttentionConfigLabels;
  lang?: 'zh' | 'en';
}

export type UfovNineGridCompassProps = PeripheralAttentionNineGridCompassProps;

interface CompassCellDef {
  axis?: PeripheralAttentionTargetAxis;
  isCenter?: boolean;
  arrow: string;
  label: string;
}

export function PeripheralAttentionNineGridCompass({
  selectedAxes,
  onChange,
  labels,
  lang = 'zh',
}: PeripheralAttentionNineGridCompassProps) {
  const l = { ...defaultPeripheralAttentionConfigLabels[lang], ...labels };
  const allAxes: PeripheralAttentionTargetAxis[] = [0, 1, 2, 3, 4, 5, 6, 7];
  const isAllSelected = selectedAxes.length === 8;

  const toggleAxis = (axis: PeripheralAttentionTargetAxis) => {
    if (selectedAxes.includes(axis)) {
      if (selectedAxes.length > 1) {
        onChange(selectedAxes.filter((a) => a !== axis));
      }
    } else {
      onChange([...selectedAxes, axis].sort((a, b) => a - b));
    }
  };

  const toggleAll = () => {
    if (isAllSelected) {
      onChange([0]);
    } else {
      onChange([...allAxes]);
    }
  };

  const cells: CompassCellDef[] = [
    { axis: 7, arrow: '↖', label: l.directions[7] },
    { axis: 0, arrow: '↑', label: l.directions[0] },
    { axis: 1, arrow: '↗', label: l.directions[1] },
    { axis: 6, arrow: '←', label: l.directions[6] },
    { isCenter: true, arrow: 'ALL', label: isAllSelected ? l.centerAllActive : l.centerAll },
    { axis: 2, arrow: '→', label: l.directions[2] },
    { axis: 5, arrow: '↙', label: l.directions[5] },
    { axis: 4, arrow: '↓', label: l.directions[4] },
    { axis: 3, arrow: '↘', label: l.directions[3] },
  ];

  const badgeText = l.directionsBadge.replace('{n}', String(selectedAxes.length));

  return (
    <div className="training-direction-compass-container">
      <div className="training-range-field-header">
        <span className="training-range-field-label">{l.directionsTitle}</span>
        <output className="training-range-field-value">{badgeText}</output>
      </div>
      <p className="training-range-field-description">{l.directionsDesc}</p>

      <div className="training-direction-compass-grid">
        {cells.map((cell, index) => {
          if (cell.isCenter) {
            return (
              <button
                key="center-all"
                type="button"
                className={`training-compass-btn training-compass-center ${isAllSelected ? 'active' : ''}`}
                onClick={toggleAll}
                aria-pressed={isAllSelected}
              >
                <span className="training-compass-arrow">{cell.arrow}</span>
                <span className="training-compass-label">{cell.label}</span>
              </button>
            );
          }

          const axis = cell.axis!;
          const isSelected = selectedAxes.includes(axis);
          return (
            <button
              key={`axis-${axis}-${index}`}
              type="button"
              className={`training-compass-btn ${isSelected ? 'active' : ''}`}
              onClick={() => toggleAxis(axis)}
              aria-pressed={isSelected}
            >
              <span className="training-compass-arrow">{cell.arrow}</span>
              <span className="training-compass-label">{cell.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UfovNineGridCompass(props: PeripheralAttentionNineGridCompassProps) {
  return <PeripheralAttentionNineGridCompass {...props} />;
}

export interface PeripheralAttentionGeometryWarningProps {
  geometry: PeripheralAttentionScreenGeometry;
  targetAngle: number;
  labels?: PartialPeripheralAttentionConfigLabels;
  lang?: 'zh' | 'en';
}

export type UfovGeometryWarningProps = PeripheralAttentionGeometryWarningProps;

export function PeripheralAttentionGeometryWarning({
  geometry,
  targetAngle,
  labels,
  lang = 'zh',
}: PeripheralAttentionGeometryWarningProps) {
  if (!geometry.isOverLimit) return null;

  const l = { ...defaultPeripheralAttentionConfigLabels[lang], ...labels };
  const warningText = l.geometryWarning
    .replace('{targetAngle}', targetAngle.toFixed(1))
    .replace('{maxAngle}', geometry.maxVisualAngleDeg.toFixed(1))
    .replace('{suggestedDistance}', geometry.suggestedDistanceCm ? geometry.suggestedDistanceCm.toFixed(1) : '50');

  return (
    <div
      className="training-geo-warning"
      style={{
        marginTop: '12px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-m)',
        border: '1px solid var(--warning, #fbbf24)',
        background: 'rgba(251, 191, 36, 0.12)',
        color: 'var(--warning, #fbbf24)',
        fontSize: '13px',
        lineHeight: 1.5,
      }}
      role="alert"
    >
      {warningText}
    </div>
  );
}

export function UfovGeometryWarning(props: PeripheralAttentionGeometryWarningProps) {
  return <PeripheralAttentionGeometryWarning {...props} />;
}
