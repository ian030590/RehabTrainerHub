import type { ReadingSettings } from './settings';

export interface ReadingTrial {
  trial_type?: string;
  reading_time?: number;
  total_words?: number;
  presented_segments?: number;
  presentation_completed?: boolean;
  passage_index?: number;
  language_code?: number;
  question_index?: number;
  option_count?: number;
  correct_index?: number;
  response?: number | null;
  rt?: number | null;
  correct?: boolean;
  target?: string;
  response_text?: string;
  correct_text?: string;
}

const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const flag = (value: unknown) => typeof value === 'boolean' ? Number(value) : null;

// Same summary and round fields as the retired score.json; question rows are those with a boolean answer result.
export function BuildGameScore(results: ReadingTrial[], settings: ReadingSettings) {
  const presentation = results.find(row => typeof row.total_words === 'number');
  const questions = results.filter(row => typeof row.correct === 'boolean');
  return {
    schema: 'rehab-trainer.game-score/v1', gameId: 'reading-training',
    summary: {
      questions: questions.length,
      correct: questions.filter(row => row.correct).length,
      presentationMs: numeric(presentation?.reading_time),
      wordCount: numeric(presentation?.total_words),
      configuredWpm: settings.wordsPerMinute,
      presented: numeric(presentation?.presented_segments),
      finished: flag(presentation?.presentation_completed),
      passage: numeric(presentation?.passage_index),
      language: numeric(presentation?.language_code),
    },
    rounds: questions.map(row => ({
      question: numeric(row.question_index),
      correct: flag(row.correct),
      responseMs: numeric(row.rt),
      choice: numeric(row.response),
      expectedChoice: numeric(row.correct_index),
      options: numeric(row.option_count),
    })),
  };
}
