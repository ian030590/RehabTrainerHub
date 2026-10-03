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
          description: '這個入口依難度提供三種不同的數字方格：初階為 4×4 拉丁方格，中階為 3×3 魔術方陣，進階為 9×9 數獨。',
          items: [
            '點選空格，依序切換數字；固定數字不能修改。',
            '拉丁方格的每行與每列填入 1 至 4；魔術方陣的每行、每列與對角線總和為 15；數獨的每行、每列與 3×3 宮格填入 1 至 9。',
            '所有空格與題目解答相符即完成；整盤填滿但仍有錯誤時會計入一次錯誤。',
          ],
        },
        { title: '當次紀錄', description: '記錄完成狀態、時間、步數、錯誤次數與題型。' },
      ]
    : [
        {
          title: 'How to Play',
          description: 'Difficulty selects one of three number-grid tasks: 4×4 Latin square, 3×3 magic square or 9×9 Sudoku.',
          items: [
            'Tap a blank to cycle its number. Given numbers cannot be changed.',
            'For Latin square, use 1–4 in every row and column. For magic square, each row, column and diagonal totals 15. For Sudoku, use 1–9 in every row, column and 3×3 box.',
            'Match every blank to the solution to finish. A full board with incorrect values counts as one error.',
          ],
        },
        { title: 'Session record', description: 'Records completion, time, moves, errors and puzzle type.' },
      ];
  return <TrainingRulesPanel className={className} label={isZh ? '遊戲規則' : 'Game Rules'}
    title={title} summaryTitle={summaryTitle} summaryItems={summaryItems} sections={sections}
    startLabel={isZh ? '開始練習' : 'Start Training'} backLabel={isZh ? '返回設定' : 'Back to Settings'}
    onStart={onStart} onBack={onBack} />;
}