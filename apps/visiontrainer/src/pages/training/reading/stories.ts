import type { ReadingStory } from './types';

// Use Vite's import.meta.glob to synchronously load all JSON files in the data directory
const enStoryModules = import.meta.glob('../data/reading-stories/en-story/*.json', { eager: true });
const zhStoryModules = import.meta.glob('../data/reading-stories/zh-story/*.json', { eager: true });

export const getRandomStory = (lang: string): ReadingStory | null => {
  const modules = lang === 'en' ? enStoryModules : zhStoryModules;
  const stories = Object.values(modules).map((mod: any) => mod.default as ReadingStory);
  if (stories.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * stories.length);
  return stories[randomIndex];
};
