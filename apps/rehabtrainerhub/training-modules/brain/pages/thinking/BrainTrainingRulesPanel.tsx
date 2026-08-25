// Canonical Hub-owned brain module rules.
import type { ReactNode } from 'react';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import type { TrainingConfigSummaryItem } from '@rehab-trainer/ui/components/TrainingConfigSummary';
import { useT } from '../../i18n';

interface BrainTrainingRulesPanelProps {
  gameId: string;
  title: ReactNode;
  summaryTitle?: ReactNode;
  summaryItems?: readonly TrainingConfigSummaryItem[];
  className?: string;
  onStart: () => void;
  onBack: () => void;
}

export function BrainTrainingRulesPanel({
  gameId,
  title,
  summaryTitle,
  summaryItems,
  className,
  onStart,
  onBack,
}: BrainTrainingRulesPanelProps) {
  const { lang } = useT();
  const labels = GetRuleLabels(lang);

  return (
    <TrainingRulesPanel
      className={className}
      label={labels.label}
      title={title}
      summaryTitle={summaryTitle}
      summaryItems={summaryItems}
      sections={GetRuleSections(gameId, lang)}
      startLabel={labels.start}
      backLabel={labels.back}
      onStart={onStart}
      onBack={onBack}
    />
  );
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
    case 'memory-match':
      return BuildRules(
        isZh,
        '翻開卡片並找出相同圖案配對，訓練短期記憶與視覺搜尋。',
        'Flip cards to find matching pairs and train short-term memory with visual scanning.',
        ['每次可翻開兩張卡片。', '若圖案相同會保留配對；不同則會翻回去。', '完成所有配對後進入結算。'],
        ['Flip two cards at a time.', 'Matching cards stay open; non-matching cards flip back.', 'The session ends when every pair is matched.'],
      );
    case 'lights-out':
      return BuildRules(
        isZh,
        '點擊格子會切換該格與鄰近格子的亮滅，目標是關閉全部亮燈。',
        'Click a cell to toggle it and its neighbors. Turn all lights off.',
        ['每次點擊都會改變局面，請先觀察再規劃步驟。', '難度越高，盤面越需要多步推理。', '完成全部關燈後進入結算。'],
        ['Each click changes the board, so plan before acting.', 'Higher difficulty requires more multi-step reasoning.', 'The session ends when all lights are off.'],
      );
    case 'reaction-time':
      return BuildRules(
        isZh,
        '等待訊號出現後再點擊，訓練反應時間與抑制控制。',
        'Wait for the signal, then click quickly to train reaction time and inhibition.',
        ['訊號出現前不要提前點擊。', '看到開始訊號後立刻點擊目標區。', '每次訊號都會記錄成功或提前點擊，以及反應毫秒數。', '完成設定題數後進入結算。'],
        ['Do not click before the signal appears.', 'Click the target area as soon as the go signal appears.', 'Every signal records success or false start with its response time in milliseconds.', 'The session ends after the configured number of trials.'],
      );
    case 'whack-a-mole':
      return BuildRules(
        isZh,
        '在時間內點擊出現的目標，訓練視覺搜尋與注意力轉移。',
        'Click targets as they appear within the time limit.',
        ['目標會在不同位置短暫出現。', '盡快點擊目標，漏掉或點錯會影響成績。', '每次目標或點擊都會記錄命中、逾時或點錯，以及反應毫秒數。', '時間結束後自動結算。'],
        ['Targets appear briefly in different positions.', 'Click quickly; missed or incorrect clicks affect the result.', 'Every target or tap records hit, expired, or wrong tap with its response time in milliseconds.', 'The session ends automatically when time expires.'],
      );
    case 'sliding-puzzle':
      return BuildRules(
        isZh,
        '利用空格移動拼圖，將數字恢復到正確順序。',
        'Slide tiles into the empty space to restore numeric order.',
        ['每次只能移動與空格相鄰的拼圖。', '請規劃步驟，避免來回重複移動。', '完成排序後進入結算。'],
        ['Only tiles adjacent to the empty space can move.', 'Plan moves to avoid repeated backtracking.', 'The session ends when the tiles are in order.'],
      );
    case 'sudoku':
      return BuildRules(
        isZh,
        '此入口合併三種數字推理：初級是拉丁方格，中級是魔術方陣，高級是 9x9 數獨。',
        'This entry combines three number-grid tasks: Beginner is Latin Square, Intermediate is Magic Square, and Advanced is 9x9 Sudoku.',
        ['點擊空格會依序切換可用數字。', '依目前難度完成列、行、宮格或加總規則。', '全部空格填到正確答案後完成訓練。'],
        ['Tap a blank cell to cycle its value.', 'Complete the row, column, box, or sum rule for the selected difficulty.', 'The session ends when every blank matches the solution.'],
      );
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
    case 'tic-tac-toe':
      return BuildRules(
        isZh,
        '與電腦輪流下棋，先連線者獲勝。',
        'Take turns against the computer and make a line first.',
        ['你是 X。', '點擊空格落子，電腦會自動回合。'],
        ['You are X.', 'Tap an empty cell; the computer moves automatically.'],
      );
    case 'connect4':
      return BuildRules(
        isZh,
        '投入棋子並搶先連成四個。',
        'Drop discs and connect four first.',
        ['點擊欄位投入黃色棋子。', '電腦會自動回合，橫直斜任一方向連四即勝。'],
        ['Tap a column to drop a yellow disc.', 'The computer moves automatically; four in any direction wins.'],
      );
    case 'dots-and-boxes':
      return BuildRules(
        isZh,
        '連接兩點成線，完成方盒即可得分。',
        'Draw lines between dots; completing a box scores a point.',
        ['點擊點與點之間的線段。', '我方牆壁為藍色，電腦牆壁為紅色。', '完成盒子可繼續回合，最後分數較高者成功。'],
        ['Tap a line between dots.', 'Your walls are blue and the computer walls are red.', 'Completing a box gives another turn; higher final score succeeds.'],
      );
    case 'hex':
      return BuildRules(
        isZh,
        '搶先連接自己兩側邊界。',
        'Connect your two sides before the computer connects its sides.',
        ['你是藍色，目標是連接上方與下方。', '電腦是紅色，會嘗試連接左右兩側。'],
        ['You are blue and connect top to bottom.', 'The computer is red and connects left to right.'],
      );
    case 'maze':
      return BuildRules(
        isZh,
        '在迷宮中從起點走到終點。',
        'Navigate from the start to the goal.',
        ['可用方向鍵移動，也可點擊相鄰可通行格移動。', '碰到牆或點非相鄰格會記為錯誤。', '每次訓練會生成不同迷宮、起點與終點。'],
        ['Use arrow keys or tap an adjacent open cell to move.', 'Walls or non-adjacent taps count as errors.', 'Each session generates a new maze with varied start and goal cells.'],
      );
    default:
      return BuildRules(
        isZh,
        '依畫面提示完成任務，訓練注意力、控制與反應。',
        'Follow the on-screen task to train attention, control, and response.',
        ['完成設定目標後進入結算。'],
        ['The session moves to results when the configured goal is complete.'],
      );
  }
}

function BuildRules(
  isZh: boolean,
  zhDescription: string,
  enDescription: string,
  zhItems: string[],
  enItems: string[],
) {
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
