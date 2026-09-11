import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'tower-of-london',
  moduleId: 'brain:tower-of-london',
  sourceCommit: '79d00756e389187a4bab5cf8c2c68c728f9c4b4a',
  title: {
    zh: '倫敦塔規劃',
    en: 'Tower of London',
  },
} satisfies ExpFactoryGameConfig;

export function TowerOfLondonGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default TowerOfLondonGame;
