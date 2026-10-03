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
          description: '在固定 7 欄、6 列的棋盤與電腦輪流落子；你先下黃棋，電腦接著下紅棋。',
          items: [
            '點選一欄，棋子會落在該欄最低的空格。',
            '先在橫向、直向或斜向連成四子者獲勝；棋盤填滿且無人連線則平手。',
            '滿欄操作會記為一次錯誤；棋子落下和電腦思考時暫停輸入。',
          ],
        },
        { title: '當次紀錄', description: '記錄勝負或平手、時間、玩家步數、電腦步數與滿欄操作。' },
      ]
    : [
        {
          title: 'How to Play',
          description: 'Take turns on a fixed seven-column, six-row board. You drop yellow discs first; the computer drops red discs.',
          items: [
            'Choose a column and the disc falls to its lowest empty cell.',
            'The first horizontal, vertical or diagonal line of four wins. A full board without a line is a draw.',
            'Choosing a full column counts as an error. Input pauses during a drop and while the computer thinks.',
          ],
        },
        { title: 'Session record', description: 'Records win, loss or draw, time, player moves, computer moves and full-column attempts.' },
      ];
  return <TrainingRulesPanel className={className} label={isZh ? '遊戲規則' : 'Game Rules'}
    title={title} summaryTitle={summaryTitle} summaryItems={summaryItems} sections={sections}
    startLabel={isZh ? '開始練習' : 'Start Training'} backLabel={isZh ? '返回設定' : 'Back to Settings'}
    onStart={onStart} onBack={onBack} />;
}