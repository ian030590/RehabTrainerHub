// The car and truck outlines the canvas draws, and the answer controls shared by the run and the tutorial scene.
const bodies = {
  car: 'M 21 1.5 L 51 1.5 Q 55.5 1.5 57.8 6.5 L 71.5 38.5 Q 73.5 43.5 68 44.5 L 66.5 44.5 A 12 12 0 0 0 42.5 44.5 L 42.5 46 L 29.5 46 L 29.5 44.5 A 12 12 0 0 0 5.5 44.5 L 4.5 44.5 Q -1.5 43.5 .5 38.5 L 14.2 6.5 Q 16.5 1.5 21 1.5 Z',
  truck: 'M 38.8 1.5 L 51 1.5 Q 55.5 1.5 57.8 6.5 L 71.5 38.5 Q 73.5 43.5 68 44.5 L 66.5 44.5 A 12 12 0 0 0 42.5 44.5 L 42.5 46 L 29.5 46 L 29.5 44.5 A 12 12 0 0 0 5.5 44.5 L 4.5 44.5 Q -1.5 43.5 .5 38.5 L 3.5 31.5 L 37.5 31.5 L 37.5 3.5 Q 37.5 1.5 38.8 1.5 Z',
};
const frontWindow = 'M 41.8 5.5 L 47.5 5.5 Q 51 5.5 52 8.5 L 56.5 18.5 Q 57.5 21.5 54.5 21.5 L 41.8 21.5 Q 38.8 21.5 38.8 18.5 L 38.8 8.5 Q 38.8 5.5 41.8 5.5 Z';
const rearWindow = 'M 24.5 5.5 L 30.2 5.5 Q 33.2 5.5 33.2 8.5 L 33.2 18.5 Q 33.2 21.5 30.2 21.5 L 17.5 21.5 Q 14.5 21.5 15.5 18.5 L 20 8.5 Q 21 5.5 24.5 5.5 Z';

export function VehicleIcon({ vehicle }: { vehicle: 'car' | 'truck' }) {
  return <svg className={`ufov-vehicle ufov-vehicle-${vehicle}`} viewBox="0 0 72 56" aria-hidden="true">
    <path className="ufov-vehicle-body" d={bodies[vehicle]} />
    {vehicle === 'car' && <path className="ufov-vehicle-window" d={rearWindow} />}
    <path className="ufov-vehicle-window" d={frontWindow} />
    <circle className="ufov-vehicle-body" cx="17.5" cy="44.5" r="8.5" />
    <circle className="ufov-vehicle-body" cx="54.5" cy="44.5" r="8.5" />
  </svg>;
}

export function TriangleIcon() {
  return <svg className="ufov-triangle" viewBox="0 0 92 90" aria-hidden="true"><path d="M 4 4 L 88 4 L 46 86 Z" /></svg>;
}

const directionNames = {
  zh: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
  en: ['Up', 'Up right', 'Right', 'Down right', 'Down', 'Down left', 'Left', 'Up left'],
};
const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
// Grid cells for the eight directions around an empty center, so each answer sits where the car appeared.
const directionCells = [1, 2, 5, 8, 7, 6, 3, 0];

export function DirectionName(lang: 'zh' | 'en', axis: number) {
  return directionNames[lang][axis] ?? '';
}

// Without onChoose the pad renders inert copies for the tutorial scene.
export function VehicleChoices({ lang, className, onChoose }: { lang: 'zh' | 'en'; className: string; onChoose?: (vehicle: 'car' | 'truck') => void }) {
  return <div className={`ufov-vehicle-choices ${className}`}>
    {(['car', 'truck'] as const).map(vehicle => {
      const label = vehicle === 'car' ? (lang === 'en' ? 'Car' : '汽車') : (lang === 'en' ? 'Truck' : '卡車');
      return onChoose
        ? <button key={vehicle} type="button" className="btn ufov-vehicle-choice" onClick={() => onChoose(vehicle)}><VehicleIcon vehicle={vehicle} />{label}</button>
        : <span key={vehicle} className="btn ufov-vehicle-choice"><VehicleIcon vehicle={vehicle} />{label}</span>;
    })}
  </div>;
}

export function DirectionPad({ lang, className, onChoose }: { lang: 'zh' | 'en'; className: string; onChoose?: (axis: number) => void }) {
  return <div className={`ufov-direction-pad ${className}`}>
    {directionCells.map((cell, axis) => {
      const style = { gridArea: `${Math.floor(cell / 3) + 1} / ${cell % 3 + 1}` };
      const content = <><span className="ufov-direction-arrow" aria-hidden="true">{arrows[axis]}</span>{directionNames[lang][axis]}</>;
      return onChoose
        ? <button key={axis} type="button" className="btn ufov-direction" style={style} aria-label={`${axis + 1}. ${directionNames[lang][axis]}`}
          onClick={() => onChoose(axis)}>{content}</button>
        : <span key={axis} className="btn ufov-direction" style={style}>{content}</span>;
    })}
  </div>;
}
