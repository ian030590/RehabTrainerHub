import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'stroop',
  moduleId: 'brain:stroop',
  sourceCommit: 'b4125f0c1f4f0383928f4cab8c04fe5a26349c95',
  title: {
    zh: '色彩干擾抑制',
    en: 'Stroop',
  },
  tour: {
    goal: {
      zh: '忽略文字意思，只判斷文字的墨水顏色。',
      en: 'Ignore the word meaning and identify the ink colour.',
    },
    stimulus: {
      zh: '畫面會出現紅、藍或綠色的顏色字，字義可能和墨水顏色不同。',
      en: 'A colour word appears in red, blue, or green ink; its meaning may conflict with the ink.',
    },
    response: {
      zh: '按 R、B 或 G，分別回答紅、藍或綠。請兼顧速度與正確。',
      en: 'Press R, B, or G for red, blue, or green. Respond quickly and accurately.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function StroopGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default StroopGame;
