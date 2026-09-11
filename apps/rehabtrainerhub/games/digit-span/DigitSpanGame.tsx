import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'digit-span',
  moduleId: 'brain:digit-span',
  sourceCommit: '161a52f895396f25f83749680e253d57b6795537',
  title: {
    zh: '數字廣度記憶',
    en: 'Digit Span',
  },
} satisfies ExpFactoryGameConfig;

export function DigitSpanGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default DigitSpanGame;
