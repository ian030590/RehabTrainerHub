import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'keep-track',
  moduleId: 'brain:keep-track',
  sourceCommit: '202b7c7bb488240341ff26fcc9b808a13683eed6',
  title: {
    zh: '類別記憶追蹤',
    en: 'Keep Track',
  },
} satisfies ExpFactoryGameConfig;

export function KeepTrackGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default KeepTrackGame;
