import type { TongueLabel } from './logic/tongueCatch';

// The original calibration drawing: lips, the mouth line and the tongue at rest, left or right. Colors live in game.css.
export function TongueCue({ label }: { label: TongueLabel }) {
  const tongueX = label === 'Tongue_Left' ? 35 : label === 'Tongue_Right' ? 105 : 70;
  const tongueWidth = label === 'Rest' ? 18 : 54;
  return <svg className="tongue-cue" viewBox="0 0 140 100" aria-hidden="true">
    <path className="tongue-cue-lips" d="M25 52 C33 24 107 24 115 52 C105 77 35 77 25 52Z" strokeWidth="5" />
    <path className="tongue-cue-mouth" d="M38 51 C52 63 88 63 102 51" fill="none" strokeWidth="5" strokeLinecap="round" />
    <rect className="tongue-cue-tongue" x={tongueX - tongueWidth / 2} y="50" width={tongueWidth} height="22" rx="11" strokeWidth="3" />
  </svg>;
}
