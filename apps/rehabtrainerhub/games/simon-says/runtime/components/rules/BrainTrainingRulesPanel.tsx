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
        case 'simon-says':
            return isZh
                ? [
                    {
                        title: '遊玩方式',
                        description: '記住每次單次跳動並亮起霓虹的顏色順序，輪到你時依序點擊。',
                        items: [
                            '觀看階段請不要點擊；滑入與點擊有不同的動畫，點擊時會播放聲音。',
                            '答錯會扣一顆心、左右晃動提示，並重播同一組順序讓你再試。',
                            '只有生命降到 0 才會結束；完成目標記憶長度即成功。',
                        ],
                    },
                    {
                        title: '成績計算',
                        description: '結算會逐次顯示記憶長度、是否正確與作答毫秒數。',
                    },
                ]
                : [
                    {
                        title: 'How to Play',
                        description: 'Remember each color after its single neon bounce, then tap the sequence in order.',
                        items: [
                            'Do not tap during the watch phase. Hover and click use distinct animations, and each click plays a sound.',
                            'A wrong answer costs one heart, shakes the board, and replays the same sequence for another attempt.',
                            'The session ends only at zero lives; completing the target memory length succeeds.',
                        ],
                    },
                    {
                        title: 'Results',
                        description: 'Results list memory length, correctness, and response time in milliseconds for every attempt.',
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
