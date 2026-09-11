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
        case 'minesweeper':
            return isZh
                ? [
                    {
                        title: '遊玩方式',
                        description: '翻開安全格並標記地雷，避免點到地雷。',
                        items: [
                            '數字代表周圍八格中的地雷數量，請用它推理安全格。',
                            '可切換旗標模式來標記疑似地雷的位置。',
                            '翻開地雷會立即結束；成功處理所有安全格則完成訓練。',
                        ],
                    },
                    {
                        title: '成績計算',
                        description: '結算會記錄完成狀態、用時、翻開格數、旗標數與錯誤旗標。',
                    },
                ]
                : [
                    {
                        title: 'How to Play',
                        description: 'Reveal safe cells, flag mines, and avoid clicking a mine.',
                        items: [
                            'Numbers show how many mines are in the surrounding eight cells.',
                            'Use flag mode to mark suspected mines.',
                            'Revealing a mine ends the game; clearing all safe cells completes the training.',
                        ],
                    },
                    {
                        title: 'Results',
                        description: 'The result records completion status, time, opened cells, flags, and incorrect flags.',
                    },
                ];
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
