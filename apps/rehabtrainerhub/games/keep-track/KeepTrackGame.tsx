import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'keep-track',
  moduleId: 'brain:keep-track',
  sourceCommit: '202b7c7bb488240341ff26fcc9b808a13683eed6',
  title: {
    zh: '類別記憶追蹤',
    en: 'Keep Track',
  },
  tour: {
    goal: {
      zh: '同時追蹤指定類別，記住每個目標類別最後出現的詞。',
      en: 'Track the assigned categories and remember the last word shown from each target category.',
    },
    stimulus: {
      zh: '每段先顯示三到五個目標類別，之後逐一呈現六種類別的詞。',
      en: 'Each block first names three to five target categories, then presents words from all six categories.',
    },
    response: {
      zh: '結束時輸入各目標類別最後出現的詞，詞與詞之間用空格分開。',
      en: 'At the end, enter the last word from each target category, separated by spaces.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function KeepTrackGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default KeepTrackGame;
