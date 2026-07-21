import { type CSSProperties, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initJsPsych } from 'jspsych';
import { useT, type TranslationKey } from '../../i18n';
import { DownloadCsvFile } from '../../utils/downloadFile';
import { getActiveUser } from '../../utils/settings';
import { PlayFailureSound, PlayGameEndSound, PlaySuccessSound, PrepareAudioFeedback } from '../../utils/soundManager';
import { SaveTrainingSessionRecord } from '../../utils/trainingRecords';
import { Clamp, csvCell, FormatTestDate, WriteJsPsychData } from './gameUtils';
import { VerifySelectedTrainingUser } from './selectedUserGuard';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import { TrainingConfigPanel } from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { typography } from '@rehab-trainer/ui/trainerTheme';
import { StrokeTrainingRulesPanel } from './StrokeTrainingRulesPanel';

type MinesweeperPhase = 'menu' | 'rules' | 'playing' | 'results';
type MinesweeperDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type BoardPresetId = 'compact' | 'classic-easy' | 'classic-medium' | 'classic-hard' | 'large' | 'dense' | 'custom';
type GameResult = 'Victory' | 'Defeat';

interface MinesweeperGameProps {
  onExit: () => void;
}

interface DifficultyConfig {
  labelKey: TranslationKey;
  density: number;
  descriptionKey: TranslationKey;
}

interface Cell {
  x: number;
  y: number;
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacentMines: number;
}

interface SessionRecord {
  Game_Result: GameResult;
  Total_Duration_Seconds: number;
}

const difficulties: Record<MinesweeperDifficulty, DifficultyConfig> = {
  Beginner: { labelKey: 'minesweeper.diff.beginner', density: 0.1, descriptionKey: 'minesweeper.diff.beginnerDesc' },
  Intermediate: { labelKey: 'minesweeper.diff.intermediate', density: 0.16, descriptionKey: 'minesweeper.diff.intermediateDesc' },
  Advanced: { labelKey: 'minesweeper.diff.advanced', density: 0.24, descriptionKey: 'minesweeper.diff.advancedDesc' },
};

const boardPresets: Record<Exclude<BoardPresetId, 'custom'>, { label: string; rows: number; cols: number; mines?: number; descriptionKey: TranslationKey }> = {
  compact: { label: '6x6', rows: 6, cols: 6, descriptionKey: 'minesweeper.preset.compactDesc' },
  'classic-easy': { label: '9x9 / 10', rows: 9, cols: 9, mines: 10, descriptionKey: 'minesweeper.preset.classicEasyDesc' },
  'classic-medium': { label: '16x16 / 40', rows: 16, cols: 16, mines: 40, descriptionKey: 'minesweeper.preset.classicMediumDesc' },
  'classic-hard': { label: '16x30 / 99', rows: 16, cols: 30, mines: 99, descriptionKey: 'minesweeper.preset.classicHardDesc' },
  large: { label: '20x20', rows: 20, cols: 20, descriptionKey: 'minesweeper.preset.largeDesc' },
  dense: { label: '80x80', rows: 80, cols: 80, descriptionKey: 'minesweeper.preset.denseDesc' },
};
const defaultDifficulty: MinesweeperDifficulty = 'Beginner';
const defaultBoardPreset: BoardPresetId = 'compact';
const defaultBoardRows = boardPresets[defaultBoardPreset].rows;
const defaultBoardCols = boardPresets[defaultBoardPreset].cols;
const defaultCustomBoardSize = 12;
const mobileBoardViewportPercent = 70;
const mobileBoardWidthLimit = `${mobileBoardViewportPercent}vw`;
const mobileBoardHeightLimit = `${mobileBoardViewportPercent}vh`;
const desktopBoardInlineMarginPx = 48;

const minesweeperAccent = '#005EB8';

const directions = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

export function MinesweeperGame({ onExit }: MinesweeperGameProps) {
  const { t } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elapsedMillisRef = useRef(0);
  const playStartedAtRef = useRef<number>(Date.now());
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const [phase, setPhase] = useState<MinesweeperPhase>('menu');
  const [difficulty, setDifficulty] = useState<MinesweeperDifficulty>(defaultDifficulty);
  const [boardPreset, setBoardPreset] = useState<BoardPresetId>(defaultBoardPreset);
  const [customBoardSize, setCustomBoardSize] = useState(defaultCustomBoardSize);
  const [board, setBoard] = useState<Cell[][]>(() => CreateEmptyBoard(defaultBoardRows, defaultBoardCols));
  const [boardRows, setBoardRows] = useState(defaultBoardRows);
  const [boardCols, setBoardCols] = useState(defaultBoardCols);
  const [mineCount, setMineCount] = useState(CalculateMineCount(defaultBoardRows, defaultBoardCols, difficulties[defaultDifficulty].density));
  const [minesGenerated, setMinesGenerated] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [result, setResult] = useState<SessionRecord | null>(null);

  const activeConfig = difficulties[difficulty];
  const activeDifficultyLabel = t(activeConfig.labelKey);
  const activeDifficultyDescription = t(activeConfig.descriptionKey);
  const selectedBoardConfig = useMemo(() => GetSelectedBoardConfig(boardPreset, customBoardSize, activeConfig.density), [activeConfig.density, boardPreset, customBoardSize]);
  const selectedMineCount = selectedBoardConfig.mines;
  const selectedDensityPercent = Math.round((selectedMineCount / Math.max(1, selectedBoardConfig.rows * selectedBoardConfig.cols)) * 100);
  const isCustomBoardSize = boardPreset === 'custom';
  const boardMetrics = useMemo(() => GetBoardMetrics(boardRows, boardCols), [boardCols, boardRows]);
  const gameTitle = t('training.minesweeper.title');

  const canvasStyle = useMemo<CSSProperties>(() => {
    return {
      width: `min(${boardMetrics.pixelWidth}px, calc(100vw - ${desktopBoardInlineMarginPx}px), ${mobileBoardWidthLimit})`,
      aspectRatio: `${boardMetrics.pixelWidth} / ${boardMetrics.pixelHeight}`,
      height: 'auto',
      maxHeight: mobileBoardHeightLimit,
    };
  }, [boardMetrics.pixelHeight, boardMetrics.pixelWidth]);

  useEffect(() => {
    jsPsychRef.current = initJsPsych();
  }, []);

  const finishGame = useCallback((nextBoard: Cell[][], gameResult: GameResult) => {
    PlayGameEndSound(gameResult, jsPsychRef);
    const duration = Math.max(0, (elapsedMillisRef.current + Date.now() - playStartedAtRef.current) / 1000);
    elapsedMillisRef.current = duration * 1000;
    const trainingDate = FormatTestDate(new Date());
    const participantId = getActiveUser() || 'Unknown';
    const record: SessionRecord = {
      Game_Result: gameResult,
      Total_Duration_Seconds: Number(duration.toFixed(1)),
    };
    setBoard(nextBoard);
    setResult(record);
    setPhase('results');
    void SaveTrainingSessionRecord({
      userName: participantId,
      moduleId: 'cognitive-training',
      gameId: 'minesweeper',
      gameTitle,
      difficulty,
      trainingDate,
      details: {
        Game_Result: record.Game_Result,
        Total_Duration_Seconds: record.Total_Duration_Seconds,
      },
    });
    WriteJsPsychData(jsPsychRef, record as unknown as Record<string, unknown>, 'Unable to write minesweeper result to jsPsych data.');
  }, [difficulty, gameTitle]);

  const startGame = useCallback(async () => {
    if (!VerifySelectedTrainingUser()) return;
    PrepareAudioFeedback(jsPsychRef);
    await enterTrainingFullscreen();

    const nextRows = selectedBoardConfig.rows;
    const nextCols = selectedBoardConfig.cols;
    const nextMineCount = selectedBoardConfig.mines;
    setBoardRows(nextRows);
    setBoardCols(nextCols);
    setMineCount(nextMineCount);
    setBoard(CreateEmptyBoard(nextRows, nextCols));
    setMinesGenerated(false);
    setFlagMode(false);
    setResult(null);
    elapsedMillisRef.current = 0;
    playStartedAtRef.current = Date.now();
    setPhase('playing');
  }, [enterTrainingFullscreen, selectedBoardConfig]);

  const returnToMenu = useCallback(() => {
    setPhase('menu');
    setResult(null);
    setFlagMode(false);
  }, []);

  const toggleFlagAt = useCallback((x: number, y: number) => {
    if (phase !== 'playing') return;
    setBoard((currentBoard) => {
      const target = currentBoard[y]?.[x];
      if (!target || target.revealed) return currentBoard;

      const nextBoard = [...currentBoard];
      nextBoard[y] = currentBoard[y].map((cell) => (
        cell.x === x ? { ...cell, flagged: !cell.flagged } : cell
      ));
      return nextBoard;
    });
  }, [phase]);

  const revealAt = useCallback((x: number, y: number) => {
    if (phase !== 'playing') return;
    const target = board[y]?.[x];
    if (!target || target.flagged || target.revealed) return;

    let nextBoard = CloneBoard(board);
    if (!minesGenerated) {
      nextBoard = GenerateMines(nextBoard, mineCount, x, y);
      setMinesGenerated(true);
    }

    const clicked = nextBoard[y][x];
    if (clicked.mine) {
      PlayFailureSound(jsPsychRef);
      finishGame(RevealAllMines(nextBoard), 'Defeat');
      return;
    }

    const openedBoard = RevealSafeCells(nextBoard, x, y);
    PlaySuccessSound(jsPsychRef);
    if (HasWon(openedBoard)) {
      finishGame(openedBoard, 'Victory');
      return;
    }
    setBoard(openedBoard);
  }, [board, finishGame, mineCount, minesGenerated, phase]);

  const handleCanvasPointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing') return;
    event.preventDefault();
    const position = GetCanvasCell(event, boardRows, boardCols);
    if (!position) return;
    if (event.button === 2 || flagMode) {
      toggleFlagAt(position.x, position.y);
      return;
    }
    revealAt(position.x, position.y);
  }, [boardCols, boardRows, flagMode, phase, revealAt, toggleFlagAt]);

  useTrainingAbort({
    active: phase === 'playing' || phase === 'rules',
    onAbort: returnToMenu,
  });

  useEffect(() => {
    DrawBoard(canvasRef.current, board, boardMetrics);
  }, [board, boardMetrics]);

  const downloadResult = () => {
    if (!result) return;
    DownloadCsvFile(ToCsv([result]), `minesweeper_${Date.now()}.csv`);
  };

  return (
    <div ref={fullscreenRootRef} className={`minesweeper-game minesweeper-phase-${phase}`}>
      {phase === 'menu' && (
        <div className="training-panel">
          <TrainingConfigPanel
            label={t('training.cognitive.configLabel')}
            title={gameTitle}
            summaryTitle={gameTitle}
            summaryItems={[
              { label: t('cognitive.config.difficulty'), value: activeDifficultyLabel },
              {
                label: t('minesweeper.config.boardSize'),
                value: `${selectedBoardConfig.label} (${selectedBoardConfig.rows}x${selectedBoardConfig.cols})`,
              },
              { label: t('minesweeper.config.mineDensity'), value: `${selectedDensityPercent}%` },
              { label: t('minesweeper.config.mineCountLabel'), value: selectedMineCount },
            ]}
            actions={(
              <>
                <StartTrainingButton onClick={() => setPhase('rules')}>
                  {t('training.rules')}
                </StartTrainingButton>
                <button className="btn btn-ghost btn-lg" onClick={onExit}>{t('training.back')}</button>
              </>
            )}
          >
              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('cognitive.config.difficulty')}</h2>
                    <p>{activeDifficultyDescription}</p>
                  </div>
                  <span>{activeDifficultyLabel}</span>
                </div>
                <div className="training-option-grid training-option-grid-three">
                  {Object.entries(difficulties).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className={`training-option ${difficulty === key ? 'active' : ''}`}
                      onClick={() => setDifficulty(key as MinesweeperDifficulty)}
                    >
                      <span className="training-option-title">{t(value.labelKey)}</span>
                      <span className="training-option-meta">{t(value.descriptionKey)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="training-setting">
                <div className="training-setting-header">
                  <div>
                    <h2>{t('minesweeper.config.boardSize')}</h2>
                    <p>{selectedBoardConfig.rows}x{selectedBoardConfig.cols}</p>
                  </div>
                  <span>{isCustomBoardSize ? t('training.custom') : t('training.default')}</span>
                </div>
                <div className="training-option-grid minesweeper-preset-grid">
                  {Object.entries(boardPresets).map(([id, preset]) => (
                    <button
                      key={id}
                      type="button"
                      className={`training-option ${boardPreset === id ? 'active' : ''}`}
                      onClick={() => setBoardPreset(id as BoardPresetId)}
                    >
                      <span className="training-option-title">{preset.label}</span>
                      <span className="training-option-meta">{t(preset.descriptionKey)}</span>
                    </button>
                  ))}
                  <label
                    className={`training-option training-option-custom ${isCustomBoardSize ? 'active' : ''}`}
                    onClick={() => setBoardPreset('custom')}
                  >
                    <span className="training-option-title">{t('training.custom')}</span>
                    <input
                      className="training-number-input"
                      type="number"
                      min="4"
                      max="100"
                      step="1"
                      value={customBoardSize}
                      onChange={(event) => {
                        const value = Clamp(Number(event.target.value), 4, 100);
                        setCustomBoardSize(value);
                        setBoardPreset('custom');
                      }}
                      onFocus={() => setBoardPreset('custom')}
                      aria-label={t('minesweeper.config.customBoardSize')}
                    />
                  </label>
                </div>
              </section>
          </TrainingConfigPanel>
        </div>
      )}

      {phase === 'rules' && (
        <div className="training-panel">
          <StrokeTrainingRulesPanel
            gameId="minesweeper"
            title={gameTitle}
            summaryTitle={gameTitle}
            summaryItems={[
              { label: t('cognitive.config.difficulty'), value: activeDifficultyLabel },
              {
                label: t('minesweeper.config.boardSize'),
                value: `${selectedBoardConfig.label} (${selectedBoardConfig.rows}x${selectedBoardConfig.cols})`,
              },
              { label: t('minesweeper.config.mineDensity'), value: `${selectedDensityPercent}%` },
              { label: t('minesweeper.config.mineCountLabel'), value: selectedMineCount },
            ]}
            onStart={() => void startGame()}
            onBack={() => setPhase('menu')}
          />
        </div>
      )}

      {phase === 'playing' && (
        <div className="minesweeper-board-stage">
          <canvas
            ref={canvasRef}
            className={`minesweeper-canvas ${flagMode ? 'flag-mode' : ''}`}
            style={canvasStyle}
            onPointerDown={handleCanvasPointerDown}
            onContextMenu={(event) => event.preventDefault()}
            aria-label={t('minesweeper.boardAria')}
          />
          <div className="minesweeper-board-controls">
            <button
              className={`btn btn-sm ${flagMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFlagMode((current) => !current)}
            >
              {flagMode ? t('minesweeper.flagModeActive') : t('minesweeper.flagMode')}
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && result && (
        <div className="experiment-container experiment-container-scrollable minesweeper-results-container">
          <div className="experiment-results">
            <h1>{result.Game_Result === 'Victory' ? t('minesweeper.results.victory') : t('minesweeper.results.defeat')}</h1>
            <div className="training-result-summary">
              <span>
                <small>{t('cognitive.results.result')}</small>
                <strong>{result.Game_Result === 'Victory' ? t('cognitive.results.victory') : t('cognitive.results.defeat')}</strong>
              </span>
              <span>
                <small>{t('minesweeper.results.duration')}</small>
                <strong>{FormatSeconds(result.Total_Duration_Seconds, t)}</strong>
              </span>
            </div>

            <TrainingResultActions
              downloadLabel={t('training.downloadCsvRecord')}
              restartLabel={t('training.restart')}
              backLabel={t('training.returnHome')}
              onDownloadCsv={downloadResult}
              onRestart={() => setPhase('rules')}
              onBackHome={returnToMenu}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateEmptyBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, (_, y) => (
    Array.from({ length: cols }, (_, x) => ({
      x,
      y,
      mine: false,
      revealed: false,
      flagged: false,
      adjacentMines: 0,
    }))
  ));
}

function CloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function GetSelectedBoardConfig(presetId: BoardPresetId, customBoardSize: number, density: number) {
  if (presetId !== 'custom') {
    const preset = boardPresets[presetId];
    return {
      label: preset.label,
      rows: preset.rows,
      cols: preset.cols,
      mines: preset.mines ?? CalculateMineCount(preset.rows, preset.cols, density),
    };
  }
  const size = Clamp(Math.round(customBoardSize), 4, 100);
  return {
    label: `${size}x${size}`,
    rows: size,
    cols: size,
    mines: CalculateMineCount(size, size, density),
  };
}

function CalculateMineCount(rows: number, cols: number, density: number): number {
  const cells = rows * cols;
  return Clamp(Math.round(cells * density), 1, Math.max(1, cells - 9));
}

function GenerateMines(board: Cell[][], mineCount: number, safeX: number, safeY: number): Cell[][] {
  const candidates: Cell[] = [];
  board.forEach((row) => {
    row.forEach((cell) => {
      if (Math.abs(cell.x - safeX) <= 1 && Math.abs(cell.y - safeY) <= 1) return;
      candidates.push(cell);
    });
  });

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  candidates.slice(0, Math.min(mineCount, candidates.length)).forEach((cell) => {
    board[cell.y][cell.x].mine = true;
  });

  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell.mine) return;
      cell.adjacentMines = GetNeighbors(board, cell.x, cell.y).filter((neighbor) => neighbor.mine).length;
    });
  });

  return board;
}

function RevealSafeCells(board: Cell[][], x: number, y: number): Cell[][] {
  const queue: Cell[] = [board[y][x]];
  const visited = new Set<string>();
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const cell = queue[queueIndex];
    queueIndex += 1;
    const key = `${cell.x},${cell.y}`;
    if (visited.has(key) || cell.flagged || cell.mine) continue;
    visited.add(key);
    cell.revealed = true;

    if (cell.adjacentMines === 0) {
      GetNeighbors(board, cell.x, cell.y).forEach((neighbor) => {
        if (!neighbor.revealed && !neighbor.flagged && !neighbor.mine) queue.push(neighbor);
      });
    }
  }

  return board;
}

function RevealAllMines(board: Cell[][]): Cell[][] {
  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell.mine) cell.revealed = true;
    });
  });
  return board;
}

function HasWon(board: Cell[][]): boolean {
  return board.every((row) => row.every((cell) => cell.mine || cell.revealed));
}

function GetNeighbors(board: Cell[][], x: number, y: number): Cell[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  return directions.flatMap(([dx, dy]) => {
    const nextX = x + dx;
    const nextY = y + dy;
    if (nextX < 0 || nextX >= cols || nextY < 0 || nextY >= rows) return [];
    return [board[nextY][nextX]];
  });
}

function GetBoardMetrics(rows: number, cols: number) {
  const maxDimension = Math.max(rows, cols);
  const cellSize = maxDimension <= 6 ? 72 : maxDimension <= 20 ? 34 : maxDimension <= 30 ? 22 : 12;
  return {
    cellSize,
    pixelWidth: cellSize * cols,
    pixelHeight: cellSize * rows,
  };
}

function DrawBoard(canvas: HTMLCanvasElement | null, board: Cell[][], metrics: ReturnType<typeof GetBoardMetrics>) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = metrics.pixelWidth * dpr;
  canvas.height = metrics.pixelHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, metrics.pixelWidth, metrics.pixelHeight);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, metrics.pixelWidth, metrics.pixelHeight);

  board.forEach((row) => {
    row.forEach((cell) => DrawCell(ctx, cell, metrics.cellSize));
  });
}

function DrawCell(ctx: CanvasRenderingContext2D, cell: Cell, cellSize: number) {
  const x = cell.x * cellSize;
  const y = cell.y * cellSize;
  const gap = Math.max(1, Math.floor(cellSize * 0.06));
  const innerX = x + gap;
  const innerY = y + gap;
  const innerSize = cellSize - gap * 2;

  ctx.fillStyle = cell.revealed ? '#FFFFFF' : minesweeperAccent;
  if (cell.flagged && !cell.revealed) ctx.fillStyle = minesweeperAccent;
  if (cell.revealed && cell.mine) ctx.fillStyle = minesweeperAccent;
  ctx.fillRect(innerX, innerY, innerSize, innerSize);

  ctx.strokeStyle = cell.revealed ? '#64748B' : '#FFFFFF';
  ctx.lineWidth = Math.max(1, cellSize * 0.04);
  ctx.strokeRect(innerX, innerY, innerSize, innerSize);

  if (cell.flagged && !cell.revealed) {
    DrawFlag(ctx, x, y, cellSize);
    return;
  }

  if (!cell.revealed) return;

  if (cell.mine) {
    DrawMine(ctx, x, y, cellSize);
    return;
  }

  if (cell.adjacentMines > 0) {
    ctx.fillStyle = minesweeperAccent;
    ctx.font = `800 ${Math.max(8, cellSize * 0.58)}px ${typography.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(cell.adjacentMines), x + cellSize / 2, y + cellSize / 2 + cellSize * 0.04);
  }
}

function DrawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number) {
  const poleX = x + cellSize * 0.38;
  const topY = y + cellSize * 0.2;
  const bottomY = y + cellSize * 0.78;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = Math.max(2, cellSize * 0.08);
  ctx.beginPath();
  ctx.moveTo(poleX, topY);
  ctx.lineTo(poleX, bottomY);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(poleX, topY);
  ctx.lineTo(x + cellSize * 0.74, y + cellSize * 0.34);
  ctx.lineTo(poleX, y + cellSize * 0.48);
  ctx.closePath();
  ctx.fill();
}

function DrawMine(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number) {
  const cx = x + cellSize / 2;
  const cy = y + cellSize / 2;
  const radius = cellSize * 0.24;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = Math.max(1.5, cellSize * 0.05);
  directions.forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * radius * 1.45, cy + dy * radius * 1.45);
    ctx.stroke();
  });
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function GetCanvasCell(event: PointerEvent<HTMLCanvasElement>, rows: number, cols: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * cols);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * rows);
  if (x < 0 || x >= cols || y < 0 || y >= rows) return null;
  return { x, y };
}

function FormatSeconds(value: number, t: (key: TranslationKey, params?: Record<string, string | number>) => string) {
  return t('training.secondsShort', { value });
}

function ToCsv(records: SessionRecord[]): string {
  const columns: Array<{ label: string; value: (record: SessionRecord) => unknown }> = [
    { label: 'Game_Result', value: (record) => record.Game_Result },
    { label: 'Total_Duration_Seconds', value: (record) => record.Total_Duration_Seconds },
  ];
  return [
    columns.map((column) => column.label).join(','),
    ...records.map((record) => columns.map((column) => csvCell(column.value(record))).join(',')),
  ].join('\n');
}
