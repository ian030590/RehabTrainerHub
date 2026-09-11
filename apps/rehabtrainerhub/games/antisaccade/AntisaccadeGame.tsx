import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'antisaccade',
  moduleId: 'brain:antisaccade',
  sourceCommit: 'f1af8ef0f4b095c1d2b629297a3b589d0bc4234c',
  title: {
    zh: '反向眼跳抑制',
    en: 'Antisaccade',
  },
} satisfies ExpFactoryGameConfig;

export function AntisaccadeGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default AntisaccadeGame;
