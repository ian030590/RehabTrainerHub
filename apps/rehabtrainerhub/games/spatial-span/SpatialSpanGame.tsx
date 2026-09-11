import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'spatial-span',
  moduleId: 'brain:spatial-span',
  sourceCommit: 'f81c74c80744982771fb051308105c85cf999c27',
  title: {
    zh: '空間廣度記憶',
    en: 'Spatial Span',
  },
} satisfies ExpFactoryGameConfig;

export function SpatialSpanGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default SpatialSpanGame;
