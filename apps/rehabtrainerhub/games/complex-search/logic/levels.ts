export interface Stimulus { glyph: string; tone: 'ink' | 'green' | 'blue' }
export interface SearchLevel { globalLevel: number; target: Stimulus; distractors: Stimulus[]; added: boolean }
interface SearchGameDefinition {
  id: string; title: { zh: string; en: string }; description: { zh: string; en: string };
  next: { id: string; title: { zh: string; en: string } } | null;
}

export const gameDefinition: SearchGameDefinition = {
  id: 'complex-search',
  title: { zh: '相似字形', en: 'Visual Search: Complex' },
  description: { zh: '判斷散布的字母中有沒有中央圓圈裡的目標字，目標與其他字的形狀相近。十二級視覺搜尋的第 5 到 8 級。', en: 'Decide whether the letter shown in the centre circle is among the scattered letters. The target looks similar to the others. Levels 5 to 8 of 12.' },
  next: { id: 'conjunction-search', title: { zh: '顏色與字形', en: 'Visual Search: Conjunction' } },
};

export const levels: SearchLevel[] = [
  { globalLevel: 5, target: { glyph: 'S', tone: 'ink' }, distractors: [{ glyph: 'C', tone: 'ink' }], added: false },
  { globalLevel: 6, target: { glyph: 'O', tone: 'ink' }, distractors: [{ glyph: 'G', tone: 'ink' }], added: false },
  { globalLevel: 7, target: { glyph: 'B', tone: 'ink' }, distractors: [{ glyph: 'D', tone: 'ink' }], added: false },
  { globalLevel: 8, target: { glyph: 'P', tone: 'ink' }, distractors: [{ glyph: 'R', tone: 'ink' }], added: true },
];

export const glyphs: Record<string, { path: string; transform?: string }> = {
  S: { path: 'M80 25C65 5 20 10 20 32C20 55 80 45 80 68C80 90 35 95 20 75' },
  C: { path: 'M80 25C60 5 15 10 15 50C15 90 60 95 80 75' },
  O: { path: 'M50 15C10 15 10 85 50 85C90 85 90 15 50 15Z' },
  G: { path: 'M80 25C60 5 15 10 15 50C15 90 60 95 80 75V50H55' },
  B: { path: 'M20 15V85H55C90 85 90 50 55 50H20M20 15H55C90 15 90 50 55 50' },
  D: { path: 'M20 15V85H45C100 85 100 15 45 15Z' },
  P: { path: 'M20 85V15H55C90 15 90 50 55 50H20' },
  R: { path: 'M20 85V15H55C90 15 90 50 55 50H20M55 50L85 85' },
};

export function LevelLabel(level: SearchLevel, en: boolean) {
  const distractors = level.distractors.map(item => item.glyph).join(' / ');
  return en ? `Level ${level.globalLevel}: find ${level.target.glyph} among ${distractors}` : `等級 ${level.globalLevel}：在 ${distractors} 之中找 ${level.target.glyph}`;
}
