import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'plus-minus',
  moduleId: 'brain:plus-minus',
  sourceCommit: '02b36c0625d08432993b33ff214a9860b7811c78',
  title: {
    zh: '心算加減切換',
    en: 'Plus-Minus',
  },
} satisfies ExpFactoryGameConfig;

export function PlusMinusGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default PlusMinusGame;
