import type { ReactNode } from 'react';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui/components/TrainingConfigSummary';
import { useT } from '../../i18n';

interface MouthTrainingRulesPanelProps {
  title: ReactNode;
  summaryTitle?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  className?: string;
  onStart: () => void;
  onBack: () => void;
}

export function MouthTrainingRulesPanel({
  title,
  summaryTitle,
  summaryItems,
  className,
  onStart,
  onBack,
}: MouthTrainingRulesPanelProps) {
  const { lang } = useT();
  const isEnglish = lang === 'en';
  const sections = isEnglish
    ? [
        {
          title: 'How to Play',
          description: 'After face and tongue calibration, use tongue direction to catch falling items.',
          items: [
            'Keep the face visible and complete rest, left, and right calibration.',
            'Move left, right, or rest based on the falling item position.',
            'The session ends automatically when time expires.',
          ],
        },
        {
          title: 'Results',
          description: 'Results include caught items, success rate, response data, and the selected settings.',
        },
      ]
    : [
        {
          title: '玩法',
          description: '完成臉部與舌頭校準後，用舌頭方向接住掉落物。',
          items: [
            '保持臉部在鏡頭內，依序完成休息、左伸、右伸校準。',
            '遊戲中依掉落物位置向左、向右或回到休息狀態。',
            '時間結束後自動進入結果頁。',
          ],
        },
        {
          title: '訓練結果',
          description: '結果會記錄接住數量、成功率、反應資料與本次設定。',
        },
      ];

  return (
    <TrainingRulesPanel
      className={className}
      label={isEnglish ? 'Game Rules' : '遊戲規則'}
      title={title}
      summaryTitle={summaryTitle}
      summaryItems={summaryItems}
      sections={sections}
      startLabel={isEnglish ? 'Start Training' : '開始訓練'}
      backLabel={isEnglish ? 'Back to Settings' : '回到設定'}
      onStart={onStart}
      onBack={onBack}
    />
  );
}
