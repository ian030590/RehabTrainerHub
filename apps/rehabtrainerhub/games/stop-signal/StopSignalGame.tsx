import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'stop-signal',
  moduleId: 'brain:stop-signal',
  sourceCommit: '04796ee87b083d7a0bd5f8a9ee722ea4d60d5c8e',
  title: {
    zh: '煞車抑制反應',
    en: 'Stop-Signal',
  },
} satisfies ExpFactoryGameConfig;

export function StopSignalGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default StopSignalGame;
