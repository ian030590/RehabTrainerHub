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
    case 'motor-cortex-rehab':
      return isZh
        ? [
            {
              title: '玩法',
              description: '使用攝影機追蹤手部位置，依選擇的治療模組完成追蹤或觸達任務。',
              items: [
                '開始後把手放入攝影機畫面，讓手部游標停在目標圓內。',
                '彈跳球、垂直與水平模組會持續移動目標；隨機觸達模組會在成功維持後換到新位置。',
                '系統會依連續成功與命中率調整速度、目標大小與維持時間。',
              ],
            },
            {
              title: '結果紀錄',
              description: '結果會紀錄訓練模組、追蹤手、命中率、可追蹤率、完成次數、中斷維持與自適應等級。',
            },
          ]
        : [
            {
              title: 'How to Play',
              description: 'Use webcam hand tracking to complete the selected tracking or reaching drill.',
              items: [
                'Place the hand in the camera frame and keep the hand cursor inside the target circle.',
                'Bouncing, vertical, and horizontal modules move continuously; random reach relocates after a steady hold.',
                'The system adapts speed, target size, and hold time based on streaks and accuracy.',
              ],
            },
            {
              title: 'Results',
              description: 'The result records drill, tracking hand, accuracy, tracking visibility, reps, interrupted holds, and adaptive level.',
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
    case 'sudoku':
      return buildReferenceRules(
        isZh,
        '填入空白數字，讓每列、每行與每個宮格都不重複。',
        'Fill blank numbers so every row, column, and box has no repeats.',
        ['點擊空格會依序切換可用數字。', '全部空格填到正確答案後完成訓練。'],
        ['Tap a blank cell to cycle its value.', 'The session ends when every blank matches the solution.'],
      );
    case 'latin-square':
      return buildReferenceRules(
        isZh,
        '填入空白數字，讓每列與每行都各出現一次每個數字。',
        'Fill blanks so each row and column contains each number once.',
        ['點擊空格切換數字。', '完成正確方格後進入結算。'],
        ['Tap blanks to cycle numbers.', 'The session ends when the square is correct.'],
      );
    case 'magic-square':
      return buildReferenceRules(
        isZh,
        '補上數字，讓列、行與對角線加總一致。',
        'Complete the grid so rows, columns, and diagonals have the same sum.',
        ['點擊空格切換數字。', '完成正確方陣後進入結算。'],
        ['Tap blanks to cycle numbers.', 'The session ends when the magic square is correct.'],
      );
    case 'n-queens':
      return buildReferenceRules(
        isZh,
        '放置指定數量的皇后，且彼此不能互相攻擊。',
        'Place the required queens so none can attack another.',
        ['點擊格子放置或移除皇后。', '同行、同列或同斜線會被視為衝突。'],
        ['Tap a cell to place or remove a queen.', 'Shared rows, columns, or diagonals count as conflicts.'],
      );
    case 'knights-tour':
      return buildReferenceRules(
        isZh,
        '依騎士走法移動，讓每個格子只拜訪一次。',
        'Move like a knight and visit each square once.',
        ['第一步可點任一格。', '之後每步必須是 L 形騎士移動，且不能回到已拜訪格。'],
        ['Tap any square to start.', 'Each next move must be an L-shaped knight move to an unvisited square.'],
      );
    case 'binary-puzzle':
      return buildReferenceRules(
        isZh,
        '用 0 與 1 完成方格，遵守平衡與不可三連規則。',
        'Fill the grid with 0s and 1s using balance and no-three-in-a-row rules.',
        ['點擊空格切換空白、0、1。', '全部空格符合答案後完成訓練。'],
        ['Tap blanks to cycle empty, 0, and 1.', 'The session ends when the grid is correct.'],
      );
    case 'mastermind':
      return buildReferenceRules(
        isZh,
        '用回饋提示推理隱藏色碼。',
        'Use feedback to deduce the hidden color code.',
        ['先點上方位置，再點下方顏色。', '送出後會顯示位置正確與顏色正確數量。'],
        ['Tap a slot, then tap a color.', 'Submit to see exact-position and color-only feedback.'],
      );
    case 'bulls-and-cows':
      return buildReferenceRules(
        isZh,
        '用位置與數字提示推理四位不重複數字。',
        'Deduce the unique four-digit number from position and digit feedback.',
        ['先點位置，再點數字。', '首位不可為 0，且四個數字不可重複。'],
        ['Tap a slot, then tap a digit.', 'The first digit cannot be 0 and digits cannot repeat.'],
      );
    case 'simon-says':
      return buildReferenceRules(
        isZh,
        '記住顏色亮起順序，並在輪到你時重複。',
        'Remember the color sequence and repeat it when prompted.',
        ['觀看階段請不要點擊。', '輸入錯誤會立即結束，完成目標輪數即成功。'],
        ['Do not tap during the watch phase.', 'A wrong input ends the session; reaching the target round succeeds.'],
      );
    case 'tic-tac-toe':
      return buildReferenceRules(
        isZh,
        '與電腦輪流下棋，先連線者獲勝。',
        'Take turns against the computer and make a line first.',
        ['你是藍色 X。', '點擊空格落子，電腦會自動回合。'],
        ['You are the blue X.', 'Tap an empty cell; the computer moves automatically.'],
      );
    case 'connect4':
      return buildReferenceRules(
        isZh,
        '投入棋子並搶先連成四個。',
        'Drop discs and connect four first.',
        ['點擊欄位投入藍色棋子。', '電腦會自動回合，橫直斜任一方向連四即勝。'],
        ['Tap a column to drop a blue disc.', 'The computer moves automatically; four in any direction wins.'],
      );
    case 'nim':
      return buildReferenceRules(
        isZh,
        '從單一堆中取走物件，避免拿到最後一個。',
        'Remove objects from one pile while avoiding the final object.',
        ['點擊某個物件會取走該物件與其後方物件。', '拿走最後一個物件者失敗。'],
        ['Tap an object to remove it and the objects after it.', 'The player who takes the last object loses.'],
      );
    case 'dots-and-boxes':
      return buildReferenceRules(
        isZh,
        '連接兩點成線，完成方盒即可得分。',
        'Draw lines between dots; completing a box scores a point.',
        ['點擊點與點之間的線段。', '完成盒子可繼續回合，最後分數較高者成功。'],
        ['Tap a line between dots.', 'Completing a box gives another turn; higher final score succeeds.'],
      );
    case 'hex':
      return buildReferenceRules(
        isZh,
        '搶先連接自己兩側邊界。',
        'Connect your two sides before the computer connects its sides.',
        ['你是藍色，目標是連接上方與下方。', '電腦是紅色，會嘗試連接左右兩側。'],
        ['You are blue and connect top to bottom.', 'The computer is red and connects left to right.'],
      );
    case 'set-game':
      return buildReferenceRules(
        isZh,
        '找出三張在每個特徵上都全同或全異的圖卡。',
        'Find three cards where every feature is all same or all different.',
        ['依序點選三張圖卡。', '有效組合會替換新卡，錯誤組合會清除選取。'],
        ['Tap three cards.', 'Valid sets are replaced; invalid selections are cleared.'],
      );
    case 'tangram':
      return buildReferenceRules(
        isZh,
        '把七巧板拼片配對到相符輪廓。',
        'Match tangram pieces to their silhouettes.',
        ['先點下方拼片，再點上方相符輪廓。', '全部拼片放到正確輪廓後完成訓練。'],
        ['Tap a lower piece, then tap its matching outline.', 'The session ends when all pieces are placed.'],
      );
    case 'sokoban':
      return buildReferenceRules(
        isZh,
        '推動箱子到指定目標格。',
        'Push boxes onto target cells.',
        ['點擊相鄰格移動。', '若相鄰格有箱子且後方可通行，就會推動箱子。'],
        ['Tap an adjacent cell to move.', 'If a box is adjacent and the next cell is clear, it is pushed.'],
      );
    case 'maze':
      return buildReferenceRules(
        isZh,
        '在迷宮中從起點走到終點。',
        'Navigate from the start to the goal.',
        ['點擊相鄰可通行格移動。', '碰到牆或點非相鄰格會記為錯誤。'],
        ['Tap an adjacent open cell to move.', 'Walls or non-adjacent taps count as errors.'],
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
