export interface BullsAndCowsBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function GetBullsAndCowsLayout(bounds: BullsAndCowsBounds, historyCount: number) {
  const sectionGap = Clamp(Math.floor(bounds.height * 0.02), 2, 10);
  const rowGap = Clamp(Math.floor(bounds.height * 0.02), 2, 8);
  const inputGap = 12;
  const inputCell = Math.floor(Math.min(54, (bounds.width - inputGap * 3) / 4, Clamp(bounds.height * 0.19, 24, 54)));
  const paletteGap = 8;
  const paletteCell = Math.floor(Math.min(38, (bounds.width - paletteGap * 4) / 5, Clamp(bounds.height * 0.17, 18, 38)));
  const submitHeight = Math.floor(Math.min(48, Math.max(30, bounds.height * 0.19)));
  const historyRowHeight = Clamp(Math.floor(bounds.height * 0.1), 18, 30);
  const controlsHeight = inputCell + paletteCell * 2 + rowGap + submitHeight + sectionGap * 3;
  const maxHistoryRows = Math.max(0, Math.min(8, Math.floor((bounds.height - controlsHeight) / historyRowHeight)));
  const visibleHistoryRows = Math.min(Math.max(0, historyCount), maxHistoryRows);
  const contentHeight = maxHistoryRows * historyRowHeight + controlsHeight;
  const contentTop = bounds.top + Math.max(0, (bounds.height - contentHeight) / 2);
  const historyWidth = Math.min(340, bounds.width);
  const inputWidth = inputCell * 4 + inputGap * 3;
  const paletteWidth = paletteCell * 5 + paletteGap * 4;
  const inputTop = contentTop + maxHistoryRows * historyRowHeight + sectionGap;
  const paletteTop = inputTop + inputCell + sectionGap;
  const submitTop = paletteTop + paletteCell * 2 + rowGap + sectionGap;

  return {
    history: {
      x: bounds.left + (bounds.width - historyWidth) / 2,
      y: contentTop + (maxHistoryRows - visibleHistoryRows) * historyRowHeight,
      width: historyWidth,
      rowHeight: historyRowHeight,
      visibleRows: visibleHistoryRows,
    },
    input: {
      x: bounds.left + (bounds.width - inputWidth) / 2,
      y: inputTop,
      cell: inputCell,
      gap: inputGap,
    },
    palette: {
      x: bounds.left + (bounds.width - paletteWidth) / 2,
      y: paletteTop,
      cell: paletteCell,
      gap: paletteGap,
      rowGap,
    },
    submit: {
      x: bounds.left + (bounds.width - Math.min(180, bounds.width)) / 2,
      y: submitTop,
      width: Math.min(180, bounds.width),
      height: submitHeight,
    },
  };
}

function Clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
