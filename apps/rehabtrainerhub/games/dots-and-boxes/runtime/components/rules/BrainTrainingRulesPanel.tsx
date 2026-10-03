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
          description: '你和電腦輪流在相鄰兩點之間畫線；你的線為藍色，電腦的線為紅色。',
          items: [
            '選擇一條尚未畫出的橫線或直線；畫好已佔用的線會記為一次錯誤。',
            '畫出方格最後一條邊可取得該格並再走一回合；一條邊可能同時完成兩格。',
            '未完成方格時，電腦約一秒後畫線。所有線畫完後，方格較多的一方獲勝。',
          ],
        },
        { title: '當次紀錄', description: '記錄勝負或平手、用時、雙方畫線次數、雙方方格數、無效操作與棋盤大小。' },
      ]
    : [
        {
          title: 'How to Play',
          description: 'Take turns drawing a line between neighboring dots. Your lines are blue and the computer lines are red.',
          items: [
            'Choose an undrawn horizontal or vertical edge. Choosing an occupied edge counts as an error.',
            'Closing a box scores a point and gives another turn; one edge can complete two boxes.',
            'If no box closes, the computer draws after about one second. When all edges are drawn, the player with more boxes wins.',
          ],
        },
        { title: 'Session record', description: 'Records win, loss or draw, time, both line counts, both box scores, invalid edges and grid size.' },
      ];
  return <TrainingRulesPanel className={className} label={isZh ? '遊戲規則' : 'Game Rules'}
    title={title} summaryTitle={summaryTitle} summaryItems={summaryItems} sections={sections}
    startLabel={isZh ? '開始練習' : 'Start Training'} backLabel={isZh ? '返回設定' : 'Back to Settings'}
    onStart={onStart} onBack={onBack} />;
}