export interface ReadingQuestion {
  q_id: number;
  question: string;
  options: string[];
  correct_index: number;
}

export interface ReadingStory {
  story_id: string;
  language: 'en' | 'zh';
  title: string;
  content_array: string[];
  questions: ReadingQuestion[];
}
