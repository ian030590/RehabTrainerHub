import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'go-nogo',
  moduleId: 'brain:go-nogo',
  sourceCommit: 'f6d89998ad71581b30113bc9df5afa90cf010871',
  title: {
    zh: '通行與抑制反應',
    en: 'Go/No-Go',
  },
  tour: {
    goal: {
      zh: '看到指定的目標顏色就反應；看到另一個顏色時抑制反應。',
      en: 'Respond to the assigned target colour and withhold your response to the other colour.',
    },
    stimulus: {
      zh: '畫面會逐一出現藍色或橘色方塊；正式目標顏色由原始實驗隨機指定。',
      en: 'Blue or orange squares appear one at a time; the original experiment randomly assigns the target colour.',
    },
    response: {
      zh: '目標方塊出現時按空白鍵；非目標方塊出現時不要按鍵。',
      en: 'Press Space for the target square and press nothing for the non-target square.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function GoNoGoGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default GoNoGoGame;
