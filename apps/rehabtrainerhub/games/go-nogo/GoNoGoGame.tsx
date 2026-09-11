import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'go-nogo',
  moduleId: 'brain:go-nogo',
  sourceCommit: 'f6d89998ad71581b30113bc9df5afa90cf010871',
  title: {
    zh: '通行與抑制反應',
    en: 'Go/No-Go',
  },
} satisfies ExpFactoryGameConfig;

export function GoNoGoGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default GoNoGoGame;
