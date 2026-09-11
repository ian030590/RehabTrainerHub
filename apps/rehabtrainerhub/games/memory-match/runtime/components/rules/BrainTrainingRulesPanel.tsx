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
        case 'memory-match':
            return BuildRules(isZh, '翻開卡片並找出相同圖案配對，訓練短期記憶與視覺搜尋。', 'Flip cards to find matching pairs and train short-term memory with visual scanning.', ['每次可翻開兩張卡片。', '若圖案相同會保留配對；不同則會翻回去。', '完成所有配對後進入結算。'], ['Flip two cards at a time.', 'Matching cards stay open; non-matching cards flip back.', 'The session ends when every pair is matched.']);
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
