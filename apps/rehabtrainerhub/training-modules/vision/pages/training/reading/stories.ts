// Story loader local to the Hub-owned reading module.
import type { ReadingStory } from './types';
import enStory01 from '../data/reading-stories/en-story/en_story_01.json';
import enStory02 from '../data/reading-stories/en-story/en_story_02.json';
import enStory03 from '../data/reading-stories/en-story/en_story_03.json';
import zhStory01 from '../data/reading-stories/zh-story/zh_story_01.json';
import zhStory02 from '../data/reading-stories/zh-story/zh_story_02.json';
import zhStory03 from '../data/reading-stories/zh-story/zh_story_03.json';

// Explicit imports work in both the Hub's Next/Turbopack build and the Vite
// runtime build. Keep this module dynamically loaded by the reading engine so
// story data is not pulled into the lobby, configuration, or rules chunks.
const enStories: readonly ReadingStory[] = [
  CreateReadingStory(enStory01, 'en'),
  CreateReadingStory(enStory02, 'en'),
  CreateReadingStory(enStory03, 'en'),
];
const zhStories: readonly ReadingStory[] = [
  CreateReadingStory(zhStory01, 'zh'),
  CreateReadingStory(zhStory02, 'zh'),
  CreateReadingStory(zhStory03, 'zh'),
];

export const getRandomStory = (lang: string): ReadingStory | null => {
  const stories = lang === 'en' ? enStories : zhStories;
  if (stories.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * stories.length);
  return stories[randomIndex];
};

function CreateReadingStory(
  story: Omit<ReadingStory, 'language'> & { language: string },
  language: ReadingStory['language'],
): ReadingStory {
  if (story.language !== language) {
    throw new Error(`Reading story ${story.story_id} has an unexpected language.`);
  }
  return {
    ...story,
    language,
  };
}
