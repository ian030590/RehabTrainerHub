import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'plus-minus',
  moduleId: 'brain:plus-minus',
  sourceCommit: '02b36c0625d08432993b33ff214a9860b7811c78',
  title: {
    zh: '心算加減切換',
    en: 'Plus-Minus',
  },
  tour: {
    goal: {
      zh: '完成加三、減三與加減交替三種心算區段。',
      en: 'Complete add-three, subtract-three, and alternating add/subtract blocks.',
    },
    stimulus: {
      zh: '每個區段會顯示一列兩位數與輸入框。',
      en: 'Each block presents a list of two-digit numbers with response fields.',
    },
    response: {
      zh: '輸入每題答案，用 Tab 移到下一格；交替區段從加三開始，再減三並持續交替。',
      en: 'Enter each answer and use Tab to move on; in the alternating block, start with +3, then −3, and continue alternating.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function PlusMinusGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default PlusMinusGame;
