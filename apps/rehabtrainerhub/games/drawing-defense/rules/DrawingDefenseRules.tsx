// Canonical Hub-owned motor module rules.
import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui/components/TrainingConfigSummary';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
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
        case 'drawing-defense':
            return isZh
                ? [
                    {
                        title: '遊玩方式',
                        description: '依畫面提示畫出指定形狀，成功辨識後會攻擊來襲目標。',
                        items: [
                            '每個敵人會顯示需要描繪的形狀，請用滑鼠、觸控或手寫板完成筆畫。',
                            '系統會依形狀相似度與設定的等待時間判定是否命中。',
                            '敵人抵達防線會扣除 HP；HP 歸零或時間結束後進入結算。',
                        ],
                    },
                    {
                        title: '成績計算',
                        description: '結算會記錄擊退數、生成數、反應時間、形狀與是否成功擊退。',
                    },
                ]
                : [
                    {
                        title: 'How to Play',
                        description: 'Draw the prompted shape to attack incoming targets.',
                        items: [
                            'Each enemy shows a target shape. Draw it with mouse, touch, or a pen tablet.',
                            'Recognition uses shape similarity and the configured stroke wait time.',
                            'Enemies that reach the defense line cost HP; results appear when HP reaches zero or time ends.',
                        ],
                    },
                    {
                        title: 'Results',
                        description: 'The result records defeated enemies, spawned enemies, reaction time, shape, and success status.',
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
