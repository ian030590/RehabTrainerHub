import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'n-back',
  moduleId: 'brain:n-back',
  sourceCommit: 'a23052398c0151a7cceba8f558dbd3b80d0b3340',
  title: {
    zh: '工作記憶更新',
    en: 'N-back',
  },
} satisfies ExpFactoryGameConfig;

export function NBackGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default NBackGame;
