import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'n-back',
  moduleId: 'brain:n-back',
  sourceCommit: 'a23052398c0151a7cceba8f558dbd3b80d0b3340',
  title: {
    zh: '工作記憶更新',
    en: 'N-back',
  },
  tour: {
    goal: {
      zh: '持續更新字母序列，判斷目前字母是否與指定間隔之前相同。',
      en: 'Continuously update the letter sequence and decide whether the current letter matches the specified lag.',
    },
    stimulus: {
      zh: '大小寫字母會逐一出現；每個區段會指定 1、2 或 3 個試次的間隔，也包含目標字母控制區段。',
      en: 'Upper- and lower-case letters appear one at a time; blocks use a 1-, 2-, or 3-trial lag and include a target-letter control block.',
    },
    response: {
      zh: '符合規則按左方向鍵；不符合按下方向鍵，判斷時忽略大小寫。',
      en: 'Press Left Arrow for a match and Down Arrow otherwise, ignoring letter case.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function NBackGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default NBackGame;
