import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui';
import { TrainingRulesPanel } from '@rehab-trainer/ui';
import { useT } from '@rehab-trainer/ui/components/i18n';
import type { ReactNode } from 'react';

export function BrainTrainingRulesPanel({ title, summaryTitle, summaryItems, onStart, onBack }: {
  gameId: 'maze';
  title: ReactNode;
  summaryTitle?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  onStart: () => void;
  onBack: () => void;
}) {
  const { lang } = useT();
  const en = lang === 'en';
  return <TrainingRulesPanel
    label={en ? 'Game Rules' : '遊戲規則'} title={title} summaryTitle={summaryTitle}
    summaryItems={summaryItems}
    sections={en ? [
      { title: 'How to Play', description: 'Navigate from the start to the farthest goal.', items: [
        'Use arrow keys, the touch direction pad, or tap an adjacent open cell to move.',
        'Walls and non-adjacent taps count as errors.',
        'Each session generates a new maze. An optional time limit ends an incomplete run.',
      ] },
      { title: 'Results', description: 'The result records completion, elapsed time, moves, and errors.' },
    ] : [
      { title: '遊玩方式', description: '沿通道從起點走到最遠的終點。', items: [
        '使用方向鍵、觸控方向盤或點選相鄰可通行格移動。',
        '撞牆或點選非相鄰格會記為錯誤。',
        '每局會產生新迷宮；設定時間限制時，逾時便結束本局。',
      ] },
      { title: '結果', description: '記錄完成狀態、經過時間、移動次數與錯誤次數。' },
    ]}
    startLabel={en ? 'Start Training' : '開始練習'}
    backLabel={en ? 'Back to Settings' : '返回設定'} onStart={onStart} onBack={onBack}
  />;
}
