import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'letter-memory',
  moduleId: 'brain:letter-memory',
  sourceCommit: '4ad00df094fa370737be4d8cddfee682cd57f6b6',
  title: {
    zh: '字母記憶更新',
    en: 'Letter Memory',
  },
} satisfies ExpFactoryGameConfig;

export function LetterMemoryGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default LetterMemoryGame;
