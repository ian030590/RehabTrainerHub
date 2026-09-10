import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'antisaccade',
  moduleId: 'brain:antisaccade',
  sourceCommit: 'f1af8ef0f4b095c1d2b629297a3b589d0bc4234c',
  title: {
    zh: '反向眼跳抑制',
    en: 'Antisaccade',
  },
  tour: {
    goal: {
      zh: '方塊出現後，把注意移到相反側，辨認短暫出現的箭頭。',
      en: 'After the square appears, shift attention to the opposite side and identify the brief arrow.',
    },
    stimulus: {
      zh: '注視十字後，一側出現黑色方塊；箭頭隨後在另一側短暫出現並被遮罩。',
      en: 'After fixation, a black square appears on one side; an arrow briefly appears on the opposite side and is masked.',
    },
    response: {
      zh: '使用左、右或上方向鍵回答箭頭方向。',
      en: 'Use the Left, Right, or Up Arrow key to report the arrow direction.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function AntisaccadeGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default AntisaccadeGame;
