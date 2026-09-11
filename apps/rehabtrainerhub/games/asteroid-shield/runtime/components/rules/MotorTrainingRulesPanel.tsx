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
        case 'asteroid-shield':
            return isZh
                ? [
                    {
                        title: '玩法',
                        description: '移動護盾攔截飛向飛船的小行星；操作包含定位、反應與持續注意任務。',
                        items: [
                            '依設定使用滑鼠，或透過 MediaPipe 追蹤手掌位置控制護盾。體感操作無法啟動時會改用滑鼠。',
                            '藍色小行星造成少量傷害，綠色小行星傷害較高，暗色小行星若命中會直接結束。',
                            '能量石碰到護盾或飛船會恢復耐久；每累積一段攔截數，小行星速度會提升。',
                        ],
                    },
                    {
                        title: '結果紀錄',
                        description: '結果會記錄分數、飛船耐久、攔截數、受擊數、能量石數量、反應時間與當下控制方式。',
                    },
                ]
                : [
                    {
                        title: 'How to Play',
                        description: 'Move the shield to intercept asteroids before they reach the spaceship.',
                        items: [
                            'Use the configured mouse control or MediaPipe palm tracking to aim the shield. If motion control cannot start, the session switches to mouse control.',
                            'Blue asteroids deal light damage, green asteroids deal heavier damage, and dark asteroids end the session if they hit.',
                            'Energy rocks restore durability; asteroid speed increases after repeated successful blocks.',
                        ],
                    },
                    {
                        title: 'Results',
                        description: 'The result records score, ship durability, blocks, hits, energy rocks, response time, and control source.',
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
