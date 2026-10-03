import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui';
import { TrainingRulesPanel } from '@rehab-trainer/ui';
import { useT } from '@rehab-trainer/ui/components/i18n';
import type { ReactNode } from 'react';

export function BrainTrainingRulesPanel({ title, summaryTitle, summaryItems, onStart, onBack }: {
  gameId: 'hex';
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
      { title: 'How to Play', description: 'Claim one empty hexagonal cell per turn.', items: [
        'You are blue and connect top to bottom.',
        'The computer is red and connects left to right.',
        'Six touching sides form a path; the computer moves after one second.',
      ] },
      { title: 'Results', description: 'The result records the winner, elapsed time, moves, and invalid taps.' },
    ] : [
      { title: '遊玩方式', description: '每回合選擇一個空白六角格。', items: [
        '你是藍方，目標是連接棋盤上緣與下緣。',
        '電腦是紅方，目標是連接棋盤左緣與右緣。',
        '相鄰六邊接成路徑；電腦約一秒後落子。',
      ] },
      { title: '結果', description: '記錄勝負、經過時間、落子次數與無效點擊。' },
    ]}
    startLabel={en ? 'Start Training' : '開始練習'}
    backLabel={en ? 'Back to Settings' : '返回設定'} onStart={onStart} onBack={onBack}
  />;
}
