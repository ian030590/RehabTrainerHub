// Canonical Hub-owned brain module rules.
import type { TrainingConfigSummaryItem } from '../../../rules/TrainingRulesPanel';
import { TrainingRulesPanel } from '../../../rules/TrainingRulesPanel';
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
export function BrainTrainingRulesPanel({ gameId, title, summaryTitle, summaryItems, className, onStart, onBack, }: BrainTrainingRulesPanelProps) {
    const { lang } = useT();
    const labels = GetRuleLabels(lang);
    return (<TrainingRulesPanel className={className} label={labels.label} title={title} summaryTitle={summaryTitle} summaryItems={summaryItems} sections={GetRuleSections(gameId, lang)} startLabel={labels.start} backLabel={labels.back} onStart={onStart} onBack={onBack}/>);
}
function GetRuleLabels(lang: 'zh' | 'en') {
    return lang === 'en'
        ? { label: 'Game Rules', start: 'Start Training', back: 'Back to Settings' }
        : { label: '遊戲規則說明', start: '開始訓練', back: '回設定' };
}
function GetRuleSections(gameId: string, lang: 'zh' | 'en') {
    const isZh = lang !== 'en';
    switch (gameId) {
        case 'sudoku':
            return BuildRules(isZh, '此入口合併三種數字推理：初級是拉丁方格，中級是魔術方陣，高級是 9x9 數獨。', 'This entry combines three number-grid tasks: Beginner is Latin Square, Intermediate is Magic Square, and Advanced is 9x9 Sudoku.', ['點擊空格會依序切換可用數字。', '依目前難度完成列、行、宮格或加總規則。', '全部空格填到正確答案後完成訓練。'], ['Tap a blank cell to cycle its value.', 'Complete the row, column, box, or sum rule for the selected difficulty.', 'The session ends when every blank matches the solution.']);
        default:
            return BuildRules(isZh, '依畫面提示完成任務，訓練注意力、控制與反應。', 'Follow the on-screen task to train attention, control, and response.', ['完成設定目標後進入結算。'], ['The session moves to results when the configured goal is complete.']);
    }
}
function BuildRules(isZh: boolean, zhDescription: string, enDescription: string, zhItems: string[], enItems: string[]) {
    return isZh
        ? [
            { title: '遊玩方式', description: zhDescription, items: zhItems },
            { title: '成績計算', description: '結算會記錄完成狀態、用時、成功次數與錯誤次數。' },
        ]
        : [
            { title: 'How to Play', description: enDescription, items: enItems },
            { title: 'Results', description: 'The result records completion status, elapsed time, successes, and errors.' },
        ];
}
