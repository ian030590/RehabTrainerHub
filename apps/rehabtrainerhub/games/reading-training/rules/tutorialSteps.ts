import type { TourStep } from '../runtime/tour';

export function GetReadingTutorialSteps(language: 'zh' | 'en'): TourStep[] {
  return language === 'en' ? [
    { target: '.reading-preview-word', title: 'Watch the centre', place: 'bottom',
      text: 'After you press Start, a 3, 2, 1 countdown appears, then the story is shown in the centre of the screen one batch at a time. Keep your eyes on the centre and read silently.' },
    { target: '.reading-preview-pace', title: 'Pace and batch size', place: 'bottom',
      text: 'Text follows the configured speed, tokens per display and contrast. Questions start automatically after the passage. Stop training or press Escape to cancel without saving unfinished results.' },
    { target: '.reading-preview-question', title: 'Answer the questions', place: 'top',
      text: 'After reading, answer up to 10 multiple-choice questions by selecting one option each. Results show correct answers, presentation time and the time taken for each question.' },
  ] : [
    { target: '.reading-preview-word', title: '注視中央文字', place: 'bottom',
      text: '按下開始後先倒數 3、2、1，故事文字會在畫面中央逐批出現。請注視中央並在心裡默讀，跟上故事內容。' },
    { target: '.reading-preview-pace', title: '呈現速度與每批片段', place: 'bottom',
      text: '文字依設定的速度、每批片段數與文字對比呈現，整篇呈現完畢後自動進入題目。按「停止訓練」或 Escape 可取消，不會保存未完成的成果。' },
    { target: '.reading-preview-question', title: '回答理解題', place: 'top',
      text: '閱讀後回答最多 10 題選擇題，每題點選一個答案。成果呈現答對題數、文字呈現時間與每題作答時間。' },
  ];
}
