export interface Stimulus { glyph: string; tone: 'ink' | 'green' | 'blue' }
export interface SearchLevel { globalLevel: number; target: Stimulus; distractors: Stimulus[]; added: boolean }
interface SearchGameDefinition {
  id: string; title: { zh: string; en: string }; description: { zh: string; en: string };
  next: { id: string; title: { zh: string; en: string } } | null;
}

export const gameDefinition: SearchGameDefinition = {
  id: 'popout-search',
  title: { zh: '視覺搜尋：突顯目標', en: 'Visual Search: Pop-out' },
  description: { zh: '判斷散布的字母中有沒有中央圓圈裡的目標字，目標與其他字的形狀差異明顯。十二級視覺搜尋的第 1 到 4 級。', en: 'Decide whether the letter shown in the centre circle is among the scattered letters. The target looks clearly different from the others. Levels 1 to 4 of 12.' },
  next: { id: 'complex-search', title: { zh: '視覺搜尋：相似字形', en: 'Visual Search: Complex' } },
};

export const levels: SearchLevel[] = [
  { globalLevel: 1, target: { glyph: 'X', tone: 'ink' }, distractors: [{ glyph: 'O', tone: 'ink' }], added: false },
  { globalLevel: 2, target: { glyph: 'T', tone: 'ink' }, distractors: [{ glyph: 'O', tone: 'ink' }], added: false },
  { globalLevel: 3, target: { glyph: 'H', tone: 'ink' }, distractors: [{ glyph: 'C', tone: 'ink' }], added: false },
  { globalLevel: 4, target: { glyph: 'E', tone: 'ink' }, distractors: [{ glyph: 'C', tone: 'ink' }], added: true },
];

export const glyphs: Record<string, { path: string; transform?: string }> = {
  X: { path: 'M20 15L80 85M80 15L20 85' },
  O: { path: 'M50 15C10 15 10 85 50 85C90 85 90 15 50 15Z' },
  T: { path: 'M15 15H85M50 15V85' },
  H: { path: 'M20 15V85M80 15V85M20 50H80' },
  C: { path: 'M80 25C60 5 15 10 15 50C15 90 60 95 80 75' },
  E: { path: 'M80 15H20V85H80M20 50H70' },
};

export function LevelLabel(level: SearchLevel, en: boolean) {
  const distractors = level.distractors.map(item => item.glyph).join(' / ');
  return en ? `Level ${level.globalLevel}: find ${level.target.glyph} among ${distractors}` : `等級 ${level.globalLevel}：在 ${distractors} 之中找 ${level.target.glyph}`;
}
