// Passage numbers follow the original sorted file names in each language; they are not difficulty levels.
import enStory01 from '../data/reading-stories/en-story/en_story_01.json';
import enStory02 from '../data/reading-stories/en-story/en_story_02.json';
import enStory03 from '../data/reading-stories/en-story/en_story_03.json';
import zhStory01 from '../data/reading-stories/zh-story/zh_story_01.json';
import zhStory02 from '../data/reading-stories/zh-story/zh_story_02.json';
import zhStory03 from '../data/reading-stories/zh-story/zh_story_03.json';
import type { ReadingStory, SelectedReadingStory } from '../types/types';

const stories = {
  en: [enStory01, enStory02, enStory03],
  zh: [zhStory01, zhStory02, zhStory03],
} as unknown as Record<'en' | 'zh', ReadingStory[]>;

export function GetStory(language: string, passage = 0, random: () => number = Math.random): SelectedReadingStory {
  const choices = stories[language === 'en' ? 'en' : 'zh'];
  const index = passage === 0 ? Math.floor(random() * choices.length) : passage - 1;
  if (!Number.isInteger(index) || index < 0 || index >= choices.length) throw new RangeError('Invalid passage');
  return { ...choices[index], passageIndex: index + 1 };
}
