import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'flanker',
  moduleId: 'brain:flanker',
  sourceCommit: 'c74f2eb3b01a9d7b317cb64300db687180ad8937',
  title: {
    zh: '側翼干擾選擇',
    en: 'Flanker',
  },
  tour: {
    goal: {
      zh: '只判斷五個字母中間的字母，忽略兩側字母。',
      en: 'Identify only the middle letter in a row of five and ignore the flankers.',
    },
    stimulus: {
      zh: '畫面會出現由 F 與 H 組成的五字母字串。',
      en: 'A five-letter string made from F and H appears on screen.',
    },
    response: {
      zh: '中間是 F 就按 F；中間是 H 就按 H。',
      en: 'Press F when the centre letter is F, and H when it is H.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function FlankerGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default FlankerGame;
