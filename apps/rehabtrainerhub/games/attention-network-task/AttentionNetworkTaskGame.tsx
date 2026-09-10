import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'attention-network-task',
  moduleId: 'brain:attention-network-task',
  sourceCommit: '6caac2b320cafe4b0707b3d1fdd360eb4f07dd43',
  title: {
    zh: '注意力網路測驗',
    en: 'Attention Network Task',
  },
  tour: {
    goal: {
      zh: '判斷中央箭頭方向，忽略兩側箭頭或短線。',
      en: 'Report the direction of the centre arrow and ignore the surrounding arrows or dashes.',
    },
    stimulus: {
      zh: '箭頭列會出現在畫面上方或下方，之前可能短暫出現星號提示。',
      en: 'An arrow row appears above or below fixation and may be preceded by a brief asterisk cue.',
    },
    response: {
      zh: '中央箭頭向左按左方向鍵；向右按右方向鍵。',
      en: 'Press the Left Arrow for a left-pointing centre arrow and Right Arrow for a right-pointing one.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function AttentionNetworkTaskGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default AttentionNetworkTaskGame;
