import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'spatial-span',
  moduleId: 'brain:spatial-span',
  sourceCommit: 'f81c74c80744982771fb051308105c85cf999c27',
  title: {
    zh: '空間廣度記憶',
    en: 'Spatial Span',
  },
  tour: {
    goal: {
      zh: '記住方格亮起的空間順序，先順向回想，再反向回想。',
      en: 'Remember the order in which grid locations flash, first forward and later in reverse.',
    },
    stimulus: {
      zh: '九宮格中的位置會逐一變紅。',
      en: 'Locations in a grid flash red one at a time.',
    },
    response: {
      zh: '依出現順序點選方格；反向區段則以相反順序點選。',
      en: 'Click the grid locations in presentation order, or in reverse order during reverse blocks.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function SpatialSpanGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default SpatialSpanGame;
