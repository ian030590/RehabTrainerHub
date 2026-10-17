import HtmlButtonResponsePlugin from '@jspsych/plugin-html-button-response';
import PixiReadingTrainingPlugin from '../pixi-reading-training';
import { ValidateSettings, type ReadingSettings } from '../settings';
import type { SelectedReadingStory } from '../types/types';

export interface ReadingQuestionData {
  question_index: number;
  option_count: number;
  target: string;
  correct_index: number;
  correct_text: string;
  response?: number | null;
  rt?: number | null;
  correct?: boolean;
  response_text?: string;
}

// Retains the original conversions: rate per second, tokens per display and the plugin's log contrast parameter.
export function BuildReadingTimeline(settings: ReadingSettings, story: SelectedReadingStory | null, random: () => number = Math.random): object[] {
  if (!ValidateSettings(settings)) throw new Error('Invalid reading settings.');
  if (!story?.content_array?.length) throw new Error('No story data provided to the reading timeline.');
  const timeline: object[] = [{
    type: PixiReadingTrainingPlugin,
    content_array: story.content_array,
    wps: settings.wordsPerMinute / 60,
    crowding: settings.crowding / 100,
    contrast: -Math.log10(settings.contrast / 100),
    data: { passage_index: story.passageIndex, language_code: story.language === 'en' ? 1 : 0 },
  }];

  const questions = [...(story.questions || [])];
  const count = Math.min(10, questions.length);
  for (let index = 0; index < count; index++) {
    const swap = index + Math.floor(random() * (questions.length - index));
    [questions[index], questions[swap]] = [questions[swap], questions[index]];
  }
  for (const question of questions.slice(0, count)) {
    timeline.push({
      type: HtmlButtonResponsePlugin,
      css_classes: ['reading-qa-trial'],
      stimulus: `<p class="reading-qa-question">${question.question}</p>`,
      choices: question.options,
      button_html: (choice: string) => `<button type="button" class="reading-qa-btn">${choice}</button>`,
      data: {
        question_index: story.questions.indexOf(question) + 1,
        option_count: question.options.length,
        target: question.question,
        correct_index: question.correct_index,
        // Display-only text for the results table; the saved score keeps numeric fields.
        correct_text: question.options[question.correct_index],
      },
      on_finish: (data: ReadingQuestionData) => {
        data.correct = data.response === question.correct_index;
        data.response_text = typeof data.response === 'number' ? question.options[data.response] : undefined;
      },
    });
  }
  return timeline;
}
