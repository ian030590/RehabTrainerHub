import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'flanker',
  moduleId: 'brain:flanker',
  sourceCommit: 'c74f2eb3b01a9d7b317cb64300db687180ad8937',
  title: {
    zh: '側翼干擾選擇',
    en: 'Flanker',
  },
} satisfies ExpFactoryGameConfig;

export function FlankerGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default FlankerGame;
