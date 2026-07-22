import type { ReactNode } from 'react';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui/components/TrainingConfigSummary';
import { useT } from '../../i18n';

interface MouthTrainingRulesPanelProps {
  gameId: string;
  title: ReactNode;
  summaryTitle?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  className?: string;
  onStart: () => void;
  onBack: () => void;
}

export function MouthTrainingRulesPanel({ gameId, title, summaryTitle, summaryItems, className, onStart, onBack }: MouthTrainingRulesPanelProps) {
  const { lang } = useT();
  const isEnglish = lang === 'en';
  const sections = gameId === 'tongue-catch'
    ? isEnglish
      ? [{ title: 'How to Play', description: 'After face and tongue calibration, use tongue direction to catch falling items.', items: ['Keep the face visible and complete rest, left, and right calibration.', 'Move left, right, or rest based on the falling item position.', 'The session ends automatically when time expires.'] }, { title: 'Results', description: 'Results include caught items, success rate, response data, and the selected settings.' }]
      : [{ title: '進行方式', description: '完成臉部與舌頭校正後，依舌頭方向接住掉落物。', items: ['讓臉部保持在鏡頭內，依序完成休息、左側與右側校正。', '依掉落物位置向左、向右或保持休息姿勢。', '時間結束後會自動顯示結果。'] }, { title: '訓練結果', description: '結果會記錄接住數量、成功率、反應資料與選用設定。' }]
    : isEnglish
      ? [{ title: 'How to Play', description: 'Read approaching word cards aloud to defeat enemies.', items: ['Test the microphone first and enable at least one vocabulary item.', 'Clearly say the displayed word before it reaches the defense line.', 'Enemies that reach the line cost HP; results appear when HP reaches zero.'] }, { title: 'Results', description: 'Results include survival time, defeated enemies, score, difficult words, and similarity.' }]
      : [{ title: '進行方式', description: '朗讀接近中的詞卡，擊退敵人。', items: ['先測試麥克風，並至少啟用一個詞彙。', '在詞卡抵達防線前，清楚說出畫面上的詞語。', '敵人抵達防線會扣除生命值；生命值歸零後顯示結果。'] }, { title: '訓練結果', description: '結果會記錄存活時間、擊退敵人數、分數、困難詞彙與相似度。' }];

  return <TrainingRulesPanel className={className} label={isEnglish ? 'Game Rules' : '遊戲規則'} title={title} summaryTitle={summaryTitle} summaryItems={summaryItems} sections={sections} startLabel={isEnglish ? 'Start Training' : '開始訓練'} backLabel={isEnglish ? 'Back to Settings' : '返回設定'} onStart={onStart} onBack={onBack} />;
}
