import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'letter-memory',
  moduleId: 'brain:letter-memory',
  sourceCommit: '4ad00df094fa370737be4d8cddfee682cd57f6b6',
  title: {
    zh: '字母記憶更新',
    en: 'Letter Memory',
  },
  tour: {
    goal: {
      zh: '在長度不固定的字母流中，持續保留最後四個字母。',
      en: 'Continuously retain the final four letters of a variable-length letter stream.',
    },
    stimulus: {
      zh: '字母會一次出現一個，序列長度會改變。',
      en: 'Letters appear one at a time and the stream length varies.',
    },
    response: {
      zh: '每段結束後，依順序輸入最後四個字母。',
      en: 'At the end of each stream, enter the last four letters in order.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function LetterMemoryGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default LetterMemoryGame;
