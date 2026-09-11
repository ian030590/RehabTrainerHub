import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
// Timeline local to the Hub-owned reading module.
import HtmlButtonResponsePlugin from '@jspsych/plugin-html-button-response';
import { GetSetting } from '@rehab-trainer/ui/settings';
import PixiReadingTrainingPlugin from '../pixi-reading-training';
type BuildTimelineOverrides = { reading?: { story?: ReturnType<typeof import('../reading/stories').getRandomStory>; wps?: number; crowding?: number; contrast?: number } };

export function BuildReadingTimeline(overrides?: BuildTimelineOverrides): object[] {
  const wps = overrides?.reading?.wps ?? (GetHostedGameSetting<number>('wordsPerMinute') / 60);
  const crowding = overrides?.reading?.crowding ?? (GetHostedGameSetting<number>('crowding') / 100);
  const contrast = overrides?.reading?.contrast ?? (GetHostedGameSetting<number>('contrast') / 100);
  const story = overrides?.reading?.story;

  const timeline: object[] = [];

  if (story && story.content_array) {
    timeline.push({
      type: PixiReadingTrainingPlugin,
      content_array: story.content_array,
      wps,
      crowding,
      contrast: -Math.log10(contrast),
      data: { passage_index: story.passageIndex, language_code: story.language === 'en' ? 1 : 0 },
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
          question_index: story.questions.indexOf(q) + 1,
          option_count: q.options.length,
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
