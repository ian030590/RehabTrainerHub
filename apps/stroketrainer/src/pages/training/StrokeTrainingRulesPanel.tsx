import type { ReactNode } from 'react';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui/components/TrainingConfigSummary';
import { useT } from '../../i18n';

interface StrokeTrainingRulesPanelProps {
  gameId: string;
  title: ReactNode;
  summaryTitle?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  className?: string;
  onStart: () => void;
  onBack: () => void;
}

export function StrokeTrainingRulesPanel({
  gameId,
  title,
  summaryTitle,
  summaryItems,
  className,
  onStart,
  onBack,
}: StrokeTrainingRulesPanelProps) {
  const { lang } = useT();
  const labels = getStrokeRuleLabels(lang);

  return (
    <TrainingRulesPanel
      className={className}
      label={labels.label}
      title={title}
      summaryTitle={summaryTitle}
      summaryItems={summaryItems}
      sections={getStrokeRuleSections(gameId, lang)}
      startLabel={labels.start}
      backLabel={labels.back}
      onStart={onStart}
      onBack={onBack}
    />
  );
}

function getStrokeRuleLabels(lang: 'zh' | 'en') {
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

function getStrokeRuleSections(gameId: string, lang: 'zh' | 'en') {
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
    case 'memory':
    case 'memory-match':
      return buildReferenceRules(
        isZh,
        '翻開卡片並找出相同圖案配對，訓練短期記憶與視覺搜尋。',
        'Flip cards to find matching pairs and train short-term memory with visual scanning.',
        [
          '每次可翻開兩張卡片。',
          '若圖案相同會保留配對；不同則會翻回去。',
          '完成所有配對後進入結算。',
        ],
        [
          'Flip two cards at a time.',
          'Matching cards stay open; non-matching cards flip back.',
          'The session ends when every pair is matched.',
        ],
      );
    case 'lights':
    case 'lights-out':
      return buildReferenceRules(
        isZh,
        '點擊格子會切換該格與鄰近格子的亮滅，目標是關閉全部亮燈。',
        'Click a cell to toggle it and its neighbors. Turn all lights off.',
        [
          '每次點擊都會改變局面，請先觀察再規劃步驟。',
          '難度越高，盤面越需要多步推理。',
          '完成全部關燈後進入結算。',
        ],
        [
          'Each click changes the board, so plan before acting.',
          'Higher difficulty requires more multi-step reasoning.',
          'The session ends when all lights are off.',
        ],
      );
    case 'reaction':
    case 'reaction-time':
      return buildReferenceRules(
        isZh,
        '等待訊號出現後再點擊，訓練反應時間與抑制控制。',
        'Wait for the signal, then click quickly to train reaction time and inhibition.',
        [
          '訊號出現前不要提前點擊。',
          '看到開始訊號後立刻點擊目標區。',
          '完成設定題數後進入結算。',
        ],
        [
          'Do not click before the signal appears.',
          'Click the target area as soon as the go signal appears.',
          'The session ends after the configured number of trials.',
        ],
      );
    case 'whack':
    case 'whack-a-mole':
      return buildReferenceRules(
        isZh,
        '在時間內點擊出現的目標，訓練視覺搜尋與注意力轉移。',
        'Click targets as they appear within the time limit.',
        [
          '目標會在不同位置短暫出現。',
          '盡快點擊目標，漏掉或點錯會影響成績。',
          '時間結束後自動結算。',
        ],
        [
          'Targets appear briefly in different positions.',
          'Click quickly; missed or incorrect clicks affect the result.',
          'The session ends automatically when time expires.',
        ],
      );
    case 'sliding':
    case 'sliding-puzzle':
      return buildReferenceRules(
        isZh,
        '利用空格移動拼圖，將數字恢復到正確順序。',
        'Slide tiles into the empty space to restore numeric order.',
        [
          '每次只能移動與空格相鄰的拼圖。',
          '請規劃步驟，避免來回重複移動。',
          '完成排序後進入結算。',
        ],
        [
          'Only tiles adjacent to the empty space can move.',
          'Plan moves to avoid repeated backtracking.',
          'The session ends when the tiles are in order.',
        ],
      );
    case 'voice-defender':
      return isZh
        ? [
            {
              title: '遊玩方式',
              description: '朗讀靠近的字卡，成功辨識後會擊退敵人。',
              items: [
                '開始前請完成麥克風測試，並確認至少啟用一個詞彙。',
                '字卡靠近防線時，請清楚朗讀畫面上的文字。',
                '敵人抵達防線會扣除 HP；HP 歸零後進入結算。',
              ],
            },
            {
              title: '成績計算',
              description: '結算會記錄存活時間、擊退數、分數、最困難詞與辨識相似度。',
            },
          ]
        : [
            {
              title: 'How to Play',
              description: 'Read approaching word cards aloud to defeat enemies.',
              items: [
                'Test the microphone first and enable at least one vocabulary item.',
                'When a card approaches the defense line, clearly say the shown word.',
                'Enemies that reach the line cost HP; results appear when HP reaches zero.',
              ],
            },
            {
              title: 'Results',
              description: 'The result records survival time, defeated enemies, score, most difficult word, and similarity.',
            },
          ];
    case 'tongue-catch':
      return isZh
        ? [
            {
              title: '遊玩方式',
              description: '完成臉部與舌頭方向校正後，用舌頭方向控制角色接住掉落物。',
              items: [
                '請讓臉部保持在鏡頭中，依序完成休息、左、右方向校正。',
                '遊玩時依掉落物位置做出左伸、右伸或休息動作。',
                '時間結束後自動進入結算。',
              ],
            },
            {
              title: '成績計算',
              description: '結算會記錄接住數、成功率、反應資料與本次設定。',
            },
          ]
        : [
            {
              title: 'How to Play',
              description: 'After face and tongue calibration, use tongue direction to catch falling items.',
              items: [
                'Keep the face visible and complete rest, left, and right calibration.',
                'During play, move left, right, or rest based on the falling item position.',
                'The session ends automatically when time expires.',
              ],
            },
            {
              title: 'Results',
              description: 'The result records caught items, success rate, response data, and the selected settings.',
            },
          ];
    default:
      return buildReferenceRules(
        isZh,
        '依畫面提示完成任務，訓練注意力、控制與反應。',
        'Follow the on-screen task to train attention, control, and response.',
        ['完成設定目標後進入結算。'],
        ['The session moves to results when the configured goal is complete.'],
      );
  }
}

function buildReferenceRules(
  isZh: boolean,
  zhDescription: string,
  enDescription: string,
  zhItems: string[],
  enItems: string[],
) {
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
