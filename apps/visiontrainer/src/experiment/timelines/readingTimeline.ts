import HtmlButtonResponsePlugin from '@jspsych/plugin-html-button-response';
import PixiReadingTrainingPlugin from '../plugins/pixi-reading-training';
import { GetSetting } from '../../utils/settings';
import type { BuildTimelineOverrides } from './types';

export function BuildReadingTimeline(overrides?: BuildTimelineOverrides): object[] {
  const wps = overrides?.reading?.wps ?? GetSetting('readingWPS');
  const crowding = overrides?.reading?.crowding ?? GetSetting('readingCrowding');
  const contrast = overrides?.reading?.contrast ?? GetSetting('readingContrast');
  const story = overrides?.reading?.story;

  const timeline: object[] = [];

  if (story && story.content_array) {
    timeline.push({
      type: PixiReadingTrainingPlugin,
      content_array: story.content_array,
      wps,
      crowding,
      contrast,
    });

    const questions = [...(story.questions || [])];
    const numQuestions = Math.min(10, questions.length);
    for (let i = 0; i < numQuestions; i++) {
      const j = i + Math.floor(Math.random() * (questions.length - i));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    const selectedQuestions = questions.slice(0, numQuestions);

    for (const q of selectedQuestions) {
      timeline.push({
        type: HtmlButtonResponsePlugin,
        css_classes: ['reading-qa-trial'],
        stimulus: `<div class="reading-qa-question">${q.question}</div>`,
        choices: q.options,
        button_html: (choice: string) => `<button class="reading-qa-btn">${choice}</button>`,
        data: {
          target: q.question,
          correct_index: q.correct_index,
        },
        on_finish: (data: any) => {
          data.correct = data.response === q.correct_index;
          data.response_text = q.options[data.response];
        },
      });
    }
  } else {
    console.error('No story data provided to reading timeline');
  }

  return timeline;
}
