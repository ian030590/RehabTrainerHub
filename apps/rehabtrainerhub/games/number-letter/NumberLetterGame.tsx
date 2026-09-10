import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'number-letter',
  moduleId: 'brain:number-letter',
  sourceCommit: 'ae91b2b1c7e4695c9b58626ef3082eb5c018a421',
  title: {
    zh: '數字字母切換',
    en: 'Number-Letter',
  },
  tour: {
    goal: {
      zh: '依刺激所在的上半部或下半部，在數字與字母分類規則間切換。',
      en: 'Switch between number and letter classification according to whether the pair appears in the top or bottom half.',
    },
    stimulus: {
      zh: '一組字母與數字會出現在四個象限之一。',
      en: 'A letter-number pair appears in one of four quadrants.',
    },
    response: {
      zh: '上半部：奇數按 Z、偶數按 M；下半部：子音按 Z、母音按 M。',
      en: 'Top half: Z for odd, M for even. Bottom half: Z for consonant, M for vowel.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function NumberLetterGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default NumberLetterGame;
