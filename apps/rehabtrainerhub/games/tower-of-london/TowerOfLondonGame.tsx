import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'tower-of-london',
  moduleId: 'brain:tower-of-london',
  sourceCommit: '79d00756e389187a4bab5cf8c2c68c728f9c4b4a',
  title: {
    zh: '倫敦塔規劃',
    en: 'Tower of London',
  },
  tour: {
    goal: {
      zh: '用最少移動次數，把自己的彩球排列成目標排列。',
      en: 'Rearrange your coloured balls to match the target in as few moves as possible.',
    },
    stimulus: {
      zh: '畫面同時顯示自己的柱架與固定的目標柱架；三根柱可容納的球數不同。',
      en: 'Your peg board and a fixed target board appear together; the three pegs have different capacities.',
    },
    response: {
      zh: '先點一根柱拿起最上方的球，再點另一根未滿的柱放下；每題限時二十秒。',
      en: 'Click a peg to pick up its top ball, then click a non-full peg to place it; each problem has a 20-second limit.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function TowerOfLondonGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default TowerOfLondonGame;
