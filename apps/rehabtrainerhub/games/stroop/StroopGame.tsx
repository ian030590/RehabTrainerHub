import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'stroop',
  moduleId: 'brain:stroop',
  sourceCommit: 'b4125f0c1f4f0383928f4cab8c04fe5a26349c95',
  title: {
    zh: '色彩干擾抑制',
    en: 'Stroop',
  },
} satisfies ExpFactoryGameConfig;

export function StroopGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default StroopGame;
