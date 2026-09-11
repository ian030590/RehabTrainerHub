import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'attention-network-task',
  moduleId: 'brain:attention-network-task',
  sourceCommit: '6caac2b320cafe4b0707b3d1fdd360eb4f07dd43',
  title: {
    zh: '注意力網路測驗',
    en: 'Attention Network Task',
  },
} satisfies ExpFactoryGameConfig;

export function AttentionNetworkTaskGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default AttentionNetworkTaskGame;
