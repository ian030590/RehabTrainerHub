import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'digit-span',
  moduleId: 'brain:digit-span',
  sourceCommit: '161a52f895396f25f83749680e253d57b6795537',
  title: {
    zh: '數字廣度記憶',
    en: 'Digit Span',
  },
  tour: {
    goal: {
      zh: '記住依序出現的數字，先順向回想，再反向回想。',
      en: 'Remember each number sequence, first recalling it forward and later in reverse.',
    },
    stimulus: {
      zh: '數字會一次出現一個，序列長度依原始實驗規則調整。',
      en: 'Digits appear one at a time and sequence length follows the original experiment rules.',
    },
    response: {
      zh: '使用畫面數字鍵盤輸入完整序列；反向區段要從最後一個數字開始輸入。',
      en: 'Enter the full sequence with the on-screen keypad; in reverse blocks, start with the last digit shown.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function DigitSpanGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default DigitSpanGame;
