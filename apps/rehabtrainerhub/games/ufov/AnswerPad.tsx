import type { Vehicle } from './logic/ufovSummary';

// The answer icons use the same car and truck outlines as the canvas.
const bodies = {
  car: 'M 21 1.5 L 51 1.5 Q 55.5 1.5 57.8 6.5 L 71.5 38.5 Q 73.5 43.5 68 44.5 L 66.5 44.5 A 12 12 0 0 0 42.5 44.5 L 42.5 46 L 29.5 46 L 29.5 44.5 A 12 12 0 0 0 5.5 44.5 L 4.5 44.5 Q -1.5 43.5 .5 38.5 L 14.2 6.5 Q 16.5 1.5 21 1.5 Z',
  truck: 'M 38.8 1.5 L 51 1.5 Q 55.5 1.5 57.8 6.5 L 71.5 38.5 Q 73.5 43.5 68 44.5 L 66.5 44.5 A 12 12 0 0 0 42.5 44.5 L 42.5 46 L 29.5 46 L 29.5 44.5 A 12 12 0 0 0 5.5 44.5 L 4.5 44.5 Q -1.5 43.5 .5 38.5 L 3.5 31.5 L 37.5 31.5 L 37.5 3.5 Q 37.5 1.5 38.8 1.5 Z',
};
const frontWindow = 'M 41.8 5.5 L 47.5 5.5 Q 51 5.5 52 8.5 L 56.5 18.5 Q 57.5 21.5 54.5 21.5 L 41.8 21.5 Q 38.8 21.5 38.8 18.5 L 38.8 8.5 Q 38.8 5.5 41.8 5.5 Z';
const rearWindow = 'M 24.5 5.5 L 30.2 5.5 Q 33.2 5.5 33.2 8.5 L 33.2 18.5 Q 33.2 21.5 30.2 21.5 L 17.5 21.5 Q 14.5 21.5 15.5 18.5 L 20 8.5 Q 21 5.5 24.5 5.5 Z';

function VehicleIcon({ vehicle }: { vehicle: Vehicle }) {
  return <svg className={`ufov-vehicle ufov-vehicle-${vehicle}`} viewBox="0 0 72 56" aria-hidden="true">
    <path className="ufov-vehicle-body" d={bodies[vehicle]} />
    {vehicle === 'car' && <path className="ufov-vehicle-window" d={rearWindow} />}
    <path className="ufov-vehicle-window" d={frontWindow} />
    <circle className="ufov-vehicle-body" cx="17.5" cy="44.5" r="8.5" />
    <circle className="ufov-vehicle-body" cx="54.5" cy="44.5" r="8.5" />
  </svg>;
}

const directionNames = {
  zh: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
  en: ['Up', 'Up right', 'Right', 'Down right', 'Down', 'Down left', 'Left', 'Up left'],
};
export const directionArrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

export function DirectionName(lang: 'zh' | 'en', axis: number) {
  return directionNames[lang][axis] ?? '';
}

export function VehicleQuestion({ lang, onChoose }: { lang: 'zh' | 'en'; onChoose?: (vehicle: Vehicle) => void }) {
  return <div className="ufov-answer-choices" inert={!onChoose}>
    {(['car', 'truck'] as const).map(vehicle => {
      const label = vehicle === 'car' ? (lang === 'en' ? 'Car' : '汽車') : (lang === 'en' ? 'Truck' : '卡車');
      return <button key={vehicle} type="button" className="ufov-vehicle-choice" onClick={onChoose && (() => onChoose(vehicle))} aria-label={label}>
        <VehicleIcon vehicle={vehicle} />
      </button>;
    })}
  </div>;
}

export function DirectionQuestion({ lang, onChoose, tutorialAxis }: { lang: 'zh' | 'en'; onChoose?: (axis: number) => void; tutorialAxis?: number }) {
  return <div className="ufov-answer-directions" inert={!onChoose}>
    <span className="ufov-axis-center" aria-hidden="true" />
    {directionNames[lang].map((name, axis) => {
      const degrees = -90 + axis * 45;
      const angle = degrees * Math.PI / 180;
      const style = {
        left: `calc(50% + ${Math.cos(angle).toFixed(8)} * var(--ufov-axis-radius))`,
        top: `calc(50% + ${Math.sin(angle).toFixed(8)} * var(--ufov-axis-radius))`,
      };
      return <span key={axis} className="ufov-axis-position">
        <span className="ufov-axis-guide" style={{ rotate: `${degrees}deg` }} aria-hidden="true" />
        <button type="button" className="ufov-axis-button" style={style} data-tutorial-target={tutorialAxis === axis ? '' : undefined}
          aria-label={`${axis + 1}. ${name}`} onClick={onChoose && (() => onChoose(axis))}>{axis + 1}</button>
      </span>;
    })}
  </div>;
}

export function StimulusFeedback({ lang, correct }: { lang: 'zh' | 'en'; correct: boolean }) {
  return <p className={`ufov-feedback ufov-feedback-${correct ? 'correct' : 'wrong'}`} role="status">
    <span aria-hidden="true">{correct ? '✓' : '×'}</span><span className="ufov-visually-hidden">
      {correct ? (lang === 'en' ? 'Correct' : '答對') : (lang === 'en' ? 'Incorrect' : '答錯')}
    </span>
  </p>;
}
