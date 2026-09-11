import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'number-letter',
  moduleId: 'brain:number-letter',
  sourceCommit: 'ae91b2b1c7e4695c9b58626ef3082eb5c018a421',
  title: {
    zh: '數字字母切換',
    en: 'Number-Letter',
  },
} satisfies ExpFactoryGameConfig;

export function NumberLetterGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default NumberLetterGame;
