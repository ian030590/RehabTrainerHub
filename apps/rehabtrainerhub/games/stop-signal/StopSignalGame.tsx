import { ExpFactoryGame, type ExpFactoryGameConfig } from '@rehab-trainer/ui/components/ExpFactoryGame';

const config = {
  gameId: 'stop-signal',
  moduleId: 'brain:stop-signal',
  sourceCommit: '04796ee87b083d7a0bd5f8a9ee722ea4d60d5c8e',
  title: {
    zh: '煞車抑制反應',
    en: 'Stop-Signal',
  },
  tour: {
    goal: {
      zh: '平常依形狀按鍵作答；聽到停止訊號時取消原本的反應。',
      en: 'Classify each shape normally, but cancel the response when the stop signal sounds.',
    },
    stimulus: {
      zh: '畫面逐一呈現黑色形狀，部分試次會在形狀後播放聲音。',
      en: 'Black shapes appear one at a time; some trials include a tone after the shape.',
    },
    response: {
      zh: '依畫面對照使用 Z 或 M；若聽到聲音，該試次不要按鍵。',
      en: 'Use Z or M according to the on-screen mapping; if a tone sounds, do not press a key.',
    },
  },
} satisfies ExpFactoryGameConfig;

export function StopSignalGame({ onExit }: { onExit: () => void }) {
  return <ExpFactoryGame config={config} onExit={onExit} />;
}

export default StopSignalGame;
