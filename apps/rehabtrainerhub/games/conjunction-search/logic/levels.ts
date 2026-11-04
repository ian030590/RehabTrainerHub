export interface Stimulus { glyph: string; tone: 'ink' | 'green' | 'blue' }
export interface SearchLevel { globalLevel: number; target: Stimulus; distractors: Stimulus[]; added: boolean }
interface SearchGameDefinition {
  id: string; title: { zh: string; en: string }; description: { zh: string; en: string };
  next: { id: string; title: { zh: string; en: string } } | null;
}

export const gameDefinition: SearchGameDefinition = {
  id: 'conjunction-search',
  title: { zh: '視覺搜尋：顏色與字形', en: 'Visual Search: Conjunction' },
  description: { zh: '判斷散布的字母中有沒有中央圓圈裡的綠色目標字，其他字與目標同色或同形。十二級視覺搜尋的第 9 到 12 級。', en: 'Decide whether the green letter shown in the centre circle is among the scattered letters. The others share its colour or its shape. Levels 9 to 12 of 12.' },
  next: null,
};

export const levels: SearchLevel[] = [
  { globalLevel: 9, target: { glyph: 'X', tone: 'green' }, distractors: [{ glyph: 'X', tone: 'blue' }, { glyph: 'R', tone: 'green' }], added: false },
  { globalLevel: 10, target: { glyph: 'b', tone: 'green' }, distractors: [{ glyph: 'b', tone: 'blue' }, { glyph: 'p', tone: 'green' }], added: false },
  { globalLevel: 11, target: { glyph: 'T', tone: 'green' }, distractors: [{ glyph: 'T', tone: 'blue' }, { glyph: 'upsideDownT', tone: 'green' }], added: false },
  { globalLevel: 12, target: { glyph: 'd', tone: 'green' }, distractors: [{ glyph: 'd', tone: 'blue' }, { glyph: 'b', tone: 'green' }], added: true },
];

const tPath = 'M15 15H85M50 15V85';
const bPath = 'M25 15V85H50C90 85 90 45 50 45H25';

export const glyphs: Record<string, { path: string; transform?: string }> = {
  X: { path: 'M20 15L80 85M80 15L20 85' },
  R: { path: 'M20 85V15H55C90 15 90 50 55 50H20M55 50L85 85' },
  T: { path: tPath },
  upsideDownT: { path: tPath, transform: 'rotate(180 50 50)' },
  b: { path: bPath },
  p: { path: bPath, transform: 'translate(0 100) scale(1 -1)' },
  d: { path: bPath, transform: 'translate(100 0) scale(-1 1)' },
};

function StimulusLabel(stimulus: Stimulus, en: boolean) {
  const glyph = stimulus.glyph === 'upsideDownT' ? (en ? 'upside-down T' : '倒 T') : stimulus.glyph;
  return en ? `${stimulus.tone === 'green' ? 'green' : 'blue'} ${glyph}` : `${stimulus.tone === 'green' ? '綠色' : '藍色'} ${glyph}`;
}

export function LevelLabel(level: SearchLevel, en: boolean) {
  const distractors = level.distractors.map(item => StimulusLabel(item, en)).join(' / ');
  const target = StimulusLabel(level.target, en);
  return en ? `Level ${level.globalLevel}: find ${target} among ${distractors}` : `等級 ${level.globalLevel}：在 ${distractors} 之中找 ${target}`;
}
