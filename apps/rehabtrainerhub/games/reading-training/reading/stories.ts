// Story loader local to the Hub-owned reading module.
import type { ReadingStory } from '../types/types';

// Use Vite's import.meta.glob to synchronously load all JSON files in the data directory
const enStoryModules = import.meta.glob('../data/reading-stories/en-story/*.json', { eager: true });
const zhStoryModules = import.meta.glob('../data/reading-stories/zh-story/*.json', { eager: true });

export const getRandomStory = (lang: string, passage = 0): (ReadingStory & { passageIndex: number }) | null => {
  const modules = lang === 'en' ? enStoryModules : zhStoryModules;
  const stories = Object.keys(modules).sort().map(key => (modules[key] as { default: ReadingStory }).default);
  if (stories.length === 0) return null;
  const index = passage === 0 ? Math.floor(Math.random() * stories.length) : passage - 1;
  if (!Number.isInteger(index) || index < 0 || index >= stories.length) throw new RangeError('Invalid passage');
  return { ...stories[index], passageIndex: index + 1 };
};
