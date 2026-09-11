// Canonical Hub-owned motor module rules.
import type { TrainingConfigSummaryItem } from '../../../rules/TrainingRulesPanel';
import { TrainingRulesPanel } from '../../../rules/TrainingRulesPanel';
import { useT } from '@rehab-trainer/ui/components/i18n';
import type { ReactNode } from 'react';
interface MotorTrainingRulesPanelProps {
    gameId: string;
    title: ReactNode;
    summaryTitle?: ReactNode;
    summaryItems?: readonly TrainingConfigSummaryItem[];
    className?: string;
    onStart: () => void;
    onBack: () => void;
}
export function MotorTrainingRulesPanel({ gameId, title, summaryTitle, summaryItems, className, onStart, onBack, }: MotorTrainingRulesPanelProps) {
    const { lang } = useT();
    const labels = GetMotorRuleLabels(lang);
    return (<TrainingRulesPanel className={className} label={labels.label} title={title} summaryTitle={summaryTitle} summaryItems={summaryItems} sections={GetMotorRuleSections(gameId, lang)} startLabel={labels.start} backLabel={labels.back} onStart={onStart} onBack={onBack}/>);
}
function GetMotorRuleLabels(lang: 'zh' | 'en') {
    return lang === 'en'
        ? {
            label: 'Game Rules',
            start: 'Start Training',
            back: 'Back to Settings',
        }
        : {
            label: '遊戲規則說明',
            start: '開始訓練',
            back: '回設定',
        };
}
function GetMotorRuleSections(gameId: string, lang: 'zh' | 'en') {
    const isZh = lang !== 'en';
    switch (gameId) {
        case 'gesture-battler':
            return isZh
                ? [
                    {
                        title: '遊玩方式',
                        description: '先完成手勢校正，再用穩定手勢累積攻擊並擊敗敵人。',
                        items: [
                            '請讓手部清楚進入鏡頭，依序完成握拳、張手與數字手勢校正。',
                            '自由模式可做任一已校正手勢；指定模式必須做出畫面要求的手勢。',
                            '手勢穩定維持到設定秒數後才會施放攻擊。',
                        ],
                    },
                    {
                        title: '成績計算',
                        description: '結算會記錄成功施放、被中斷次數、總時長與各手勢平均相似度。',
                    },
                ]
                : [
                    {
                        title: 'How to Play',
                        description: 'Calibrate hand gestures, then hold stable gestures to attack the enemy.',
                        items: [
                            'Keep the hand visible and complete closed fist, open hand, and number gesture calibration.',
                            'Free mode accepts any calibrated gesture; directed mode requires the prompted gesture.',
                            'A gesture must stay stable for the configured hold duration before it casts.',
                        ],
                    },
                    {
                        title: 'Results',
                        description: 'The result records casts, interrupted holds, total duration, and average gesture similarity.',
                    },
                ];
        case 'memory':
        case 'lights':
        case 'reaction':
        case 'whack':
        case 'sliding':
        default:
            return BuildReferenceRules(isZh, '依畫面提示完成注意、控制與反應任務。', 'Follow the on-screen attention, control, and response task.', ['完成設定目標後進入結算。'], ['The session moves to results when the configured goal is complete.']);
    }
}
function BuildReferenceRules(isZh: boolean, zhDescription: string, enDescription: string, zhItems: string[], enItems: string[]) {
    return isZh
        ? [
            {
                title: '遊玩方式',
                description: zhDescription,
                items: zhItems,
            },
            {
                title: '成績計算',
                description: '結算會記錄完成狀態、用時、成功次數與錯誤次數。',
            },
        ]
        : [
            {
                title: 'How to Play',
                description: enDescription,
                items: enItems,
            },
            {
                title: 'Results',
                description: 'The result records completion status, elapsed time, successes, and errors.',
            },
        ];
}
