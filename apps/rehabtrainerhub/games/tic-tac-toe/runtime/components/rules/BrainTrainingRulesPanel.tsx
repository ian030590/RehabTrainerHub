import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui';
import { TrainingRulesPanel } from '@rehab-trainer/ui';
import { useT } from '@rehab-trainer/ui/components/i18n';
import type { ReactNode } from 'react';

interface BrainTrainingRulesPanelProps {
  gameId: string;
  title: ReactNode;
  summaryTitle?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  className?: string;
  onStart: () => void;
  onBack: () => void;
}

export function BrainTrainingRulesPanel({ title, summaryTitle, summaryItems, className, onStart, onBack }: BrainTrainingRulesPanelProps) {
  const { lang } = useT();
  const isZh = lang !== 'en';
  const sections = isZh
    ? [
        {
          title: '遊玩方式',
          description: '你先下 X，電腦接著下 O。初階為 3×3 連成 3 格，中階為 4×4 連成 3 格，進階為 5×5 連成 4 格。',
          items: [
            '輪到你時點選空格放入 X；電腦約一秒後放入 O。',
            '先在橫向、直向或斜向連成指定格數者獲勝；棋盤填滿且無人連線則平手。',
            '電腦思考時無法落子；點選已佔用的格子會記為一次無效操作。',
          ],
        },
        { title: '當次紀錄', description: '記錄勝負或平手、時間、玩家步數、電腦步數與無效操作。' },
      ]
    : [
        {
          title: 'How to Play',
          description: 'You play X first, then the computer plays O. Beginner is 3×3/connect 3; Intermediate is 4×4/connect 3; Advanced is 5×5/connect 4.',
          items: [
            'Tap an empty cell on your turn. The computer moves about one second later.',
            'The first horizontal, vertical or diagonal line of the required length wins. A full board without a line is a draw.',
            'Input is paused while the computer thinks. Tapping an occupied cell on your turn counts as an invalid move.',
          ],
        },
        { title: 'Session record', description: 'Records win, loss or draw, time, player moves, computer moves and invalid moves.' },
      ];
  return <TrainingRulesPanel className={className} label={isZh ? '遊戲規則' : 'Game Rules'}
    title={title} summaryTitle={summaryTitle} summaryItems={summaryItems} sections={sections}
    startLabel={isZh ? '開始練習' : 'Start Training'} backLabel={isZh ? '返回設定' : 'Back to Settings'}
    onStart={onStart} onBack={onBack} />;
}