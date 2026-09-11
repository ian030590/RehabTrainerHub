// Canonical Hub-owned motor module rules.
import type { TrainingConfigSummaryItem } from './TrainingRulesPanel';
import { TrainingRulesPanel } from './TrainingRulesPanel';
import { useT } from '@rehab-trainer/ui/i18n/games';
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
        case 'motor-cortex-rehab':
            return isZh
                ? [
                    {
                        title: '玩法',
                        description: '使用攝影機追蹤手部位置，依選擇的追蹤模式完成追蹤或觸達任務。',
                        items: [
                            '開始後把手放入攝影機畫面，讓手部游標停在目標圓內。',
                            '彈跳球、垂直與水平模式會持續移動目標；隨機觸達模式會在成功維持後換到新位置。',
                            '系統會依連續成功與命中率調整速度、目標大小與維持時間。',
                        ],
                    },
                    {
                        title: '結果紀錄',
                        description: '結果會紀錄追蹤模式、追蹤手、命中率、可追蹤率、完成次數、中斷維持與自適應等級。',
                    },
                ]
                : [
                    {
                        title: 'How to Play',
                        description: 'Use webcam hand tracking to complete the selected tracking or reaching drill.',
                        items: [
                            'Place the hand in the camera frame and keep the hand cursor inside the target circle.',
                            'Bouncing, vertical, and horizontal modes move continuously; random reach relocates after a steady hold.',
                            'The system adapts speed, target size, and hold time based on streaks and accuracy.',
                        ],
                    },
                    {
                        title: 'Results',
                        description: 'The result records drill, tracking hand, accuracy, tracking visibility, reps, interrupted holds, and adaptive level.',
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
