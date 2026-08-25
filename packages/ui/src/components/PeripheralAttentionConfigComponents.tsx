import { type ChangeEvent } from 'react';
import type { PeripheralAttentionScreenGeometry } from '../peripheralAttentionCanvas';
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
  const bgVal = Math.round(255 * (1 - value / 100));

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      onChange(Math.max(5, Math.min(100, val)));
    }
  };

  return (
    <div className="training-slider-group">
      <div className="training-slider-header">
        <div className="training-slider-title-row">
          <span className="training-slider-label">{l.contrastStrength}</span>
          <span className="training-slider-badge-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                border: '1px solid #fff',
                backgroundColor: `rgb(${bgVal}, ${bgVal}, ${bgVal})`,
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            {value}%
          </span>
        </div>
        <p className="training-slider-desc">{l.contrastDesc}</p>
      </div>
      <div className="training-slider-wrapper">
        <input
          type="range"
          min="5"
          max="100"
          step="1"
          value={value}
          onChange={handleChange}
          className="training-slider-input"
          aria-label={l.contrastStrength}
        />
        <div className="training-slider-scale">
          <span>{l.contrastLow}</span>
          <span>{l.contrastMid}</span>
          <span>{l.contrastHigh}</span>
        </div>
      </div>
    </div>
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

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!Number.isNaN(val)) {
      onChange(Math.max(5.0, Math.min(35.0, val)));
    }
  };

  return (
    <div className="training-slider-group">
      <div className="training-slider-header">
        <div className="training-slider-title-row">
          <span className="training-slider-label">{l.eccentricityTitle}</span>
          <span className="training-slider-badge-pill">{value.toFixed(1)}°</span>
        </div>
      </div>
      <div className="training-slider-wrapper">
        <input
          type="range"
          min="5.0"
          max="35.0"
          step="0.5"
          value={value}
          onChange={handleChange}
          className="training-slider-input"
          aria-label={l.eccentricityTitle}
        />
        <div className="training-slider-scale">
          <span>{l.eccentricityLow}</span>
          <span>{l.eccentricityMid}</span>
          <span>{l.eccentricityHigh}</span>
        </div>
      </div>
    </div>
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

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!Number.isNaN(val)) {
      onChange(Math.max(0.8, Math.min(5.0, val)));
    }
  };

  return (
    <div className="training-slider-group">
      <div className="training-slider-header">
        <div className="training-slider-title-row">
          <span className="training-slider-label">{l.vehicleSizeTitle}</span>
          <span className="training-slider-badge-pill">{value.toFixed(1)}°</span>
        </div>
      </div>
      <div className="training-slider-wrapper">
        <input
          type="range"
          min="0.8"
          max="5.0"
          step="0.1"
          value={value}
          onChange={handleChange}
          className="training-slider-input"
          aria-label={l.vehicleSizeTitle}
        />
        <div className="training-slider-scale">
          <span>{l.vehicleSizeSmall}</span>
          <span>{l.vehicleSizeStandard}</span>
          <span>{l.vehicleSizeLarge}</span>
        </div>
      </div>
    </div>
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
      <div className="training-slider-header" style={{ marginBottom: '12px' }}>
        <div className="training-slider-title-row">
          <span className="training-slider-label">{l.directionsTitle}</span>
          <span className="training-slider-badge-pill">{badgeText}</span>
        </div>
        <p className="training-slider-desc">{l.directionsDesc}</p>
      </div>

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
